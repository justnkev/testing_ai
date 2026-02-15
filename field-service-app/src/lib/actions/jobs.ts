'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { Resend } from 'resend';
import { jobSchema, type JobFormData, type JobWithCustomer } from '@/lib/validations/job';

export type ActionResult<T = void> =
    | { success: true; data?: T }
    | { success: false; error: string };

export async function createJob(formData: JobFormData): Promise<ActionResult<{ id: string }>> {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return { success: false, error: 'You must be logged in to create a job' };
        }

        // Validate form data on server
        const validatedData = jobSchema.safeParse(formData);
        if (!validatedData.success) {
            return { success: false, error: validatedData.error.issues[0]?.message || 'Invalid form data' };
        }

        // Insert job into fs_jobs table (public schema)
        const { data, error } = await supabase
            .from('fs_jobs')
            .insert({
                user_id: user.id,
                customer_id: validatedData.data.customer_id,
                title: validatedData.data.title,
                description: validatedData.data.description || null,
                status: validatedData.data.status,
                scheduled_date: validatedData.data.scheduled_date,
                scheduled_time: validatedData.data.scheduled_time || null,
                estimated_duration_minutes: validatedData.data.estimated_duration_minutes || null,
                priority: validatedData.data.priority,
                latitude: validatedData.data.latitude,
                longitude: validatedData.data.longitude,
                technician_id: validatedData.data.technician_id || null,
            })
            .select('id, technician_id')
            .single();

        if (error) {
            console.error('Supabase error:', JSON.stringify(error, null, 2));
            return { success: false, error: `Failed to create job: ${error.message}` };
        }

        revalidatePath('/dashboard');
        revalidatePath('/dashboard/jobs');

        // If a technician was assigned during creation, send notification
        if (data.technician_id) {
            await notifyTechnician(data.technician_id, data.id);
        }

        return { success: true, data: { id: data.id } };
    } catch (error) {
        console.error('Create job error:', error);
        return { success: false, error: 'An unexpected error occurred. Please try again.' };
    }
}

export async function assignJob(jobId: string, technicianId: string): Promise<ActionResult> {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return { success: false, error: 'Not authenticated' };

        // 1. Update the job with the new technician_id
        const { error } = await supabase
            .from('fs_jobs')
            .update({
                technician_id: technicianId,
                updated_at: new Date().toISOString()
            })
            .eq('id', jobId);

        if (error) return { success: false, error: error.message };

        // 2. Send Email Notification (Fire and forget, but log error if fails)
        try {
            await notifyTechnician(technicianId, jobId);
        } catch (emailError) {
            console.error('Failed to send assignment email:', emailError);
            // We don't fail the action if email fails, but we log it.
        }

        revalidatePath('/dashboard');
        revalidatePath('/dashboard/jobs');
        revalidatePath(`/dashboard/jobs/${jobId}`);

        return { success: true };
    } catch (error) {
        console.error('Assign job error:', error);
        return { success: false, error: 'Unexpected error during assignment' };
    }
}

// Helper to send email notification
async function notifyTechnician(technicianId: string, jobId: string) {
    const supabase = createServiceClient();

    // Get Technician Email
    const { data: technician } = await supabase
        .from('profiles')
        .select('email, display_name')
        .eq('id', technicianId)
        .single();

    if (!technician || !technician.email) return;

    // Get Job Details
    const { data: job } = await supabase
        .from('fs_jobs')
        .select('title, scheduled_date, scheduled_time, customer:fs_customers(name, address)')
        .eq('id', jobId)
        .single();

    if (!job) return;

    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data: settings } = await supabase.from('business_settings').select('business_name').single();
    const businessName = settings?.business_name || 'Field Service App';

    await resend.emails.send({
        from: 'noreply@fieldservice.com', // Update with verified domain in prod
        to: technician.email,
        subject: `New Job Assigned: ${job.title}`,
        html: `
            <h2>New Job Assigned</h2>
            <p>Hello ${technician.display_name},</p>
            <p>You have been assigned a new job.</p>
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Job:</strong> ${job.title}</p>
                <p><strong>Date:</strong> ${job.scheduled_date} ${job.scheduled_time || ''}</p>
                <p><strong>Customer:</strong> ${job.customer ? (Array.isArray(job.customer) ? (job.customer[0] as any).name : (job.customer as any).name) : 'N/A'}</p>
                <p><strong>Address:</strong> ${job.customer ? (Array.isArray(job.customer) ? (job.customer[0] as any).address : (job.customer as any).address) : 'N/A'}</p>
            </div>
            <p>Please check your dashboard for more details.</p>
            <p>Best,<br/>${businessName}</p>
        `
    });
}

export async function getUpcomingJobs(): Promise<{ success: boolean; data: JobWithCustomer[]; error?: string }> {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return { success: false, error: 'Not authenticated', data: [] };
        }

        // Get today's date in ISO format
        const today = new Date().toISOString().split('T')[0];

        let query = supabase
            .from('fs_jobs')
            .select(`
        *,
        customer:fs_customers (
          id,
          name,
          address,
          city,
          state,
          zip_code,
          phone
        ),
        technician:profiles!fs_jobs_technician_id_fkey (
          display_name,
          email
        )
      `)
            .gte('scheduled_date', today)
            .in('status', ['scheduled', 'in_progress'])
            .order('scheduled_date', { ascending: true })
            .order('scheduled_time', { ascending: true });

        // If user is a technician (not admin), only show their assigned jobs
        if (user.user_metadata?.role === 'technician') {
            query = query.eq('technician_id', user.id);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Supabase error:', JSON.stringify(error, null, 2));
            return { success: false, error: `Failed to fetch jobs: ${error.message}`, data: [] };
        }

        return { success: true, data: (data || []) as JobWithCustomer[] };
    } catch (error) {
        console.error('Get jobs error:', error);
        return { success: false, error: 'An unexpected error occurred', data: [] };
    }
}

export async function getAllJobs(): Promise<{ success: boolean; data: JobWithCustomer[]; error?: string }> {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return { success: false, error: 'Not authenticated', data: [] };
        }

        let query = supabase
            .from('fs_jobs')
            .select(`
        *,
        customer:fs_customers (
          id,
          name,
          address,
          city,
          state,
          zip_code,
          phone
        ),
        technician:profiles!fs_jobs_technician_id_fkey (
          display_name,
          email
        )
      `)
            .order('scheduled_date', { ascending: false });

        // If user is a technician (not admin), only show their assigned jobs
        if (user.user_metadata?.role === 'technician') {
            query = query.eq('technician_id', user.id);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Supabase error:', JSON.stringify(error, null, 2));
            return { success: false, error: `Failed to fetch jobs: ${error.message}`, data: [] };
        }

        return { success: true, data: (data || []) as JobWithCustomer[] };
    } catch (error) {
        console.error('Get jobs error:', error);
        return { success: false, error: 'An unexpected error occurred', data: [] };
    }
}

export async function getJobById(id: string): Promise<ActionResult<{ job: JobWithCustomer }>> {
    try {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from('fs_jobs')
            .select(`
        *,
        customer:fs_customers (
          id,
          name,
          address,
          city,
          state,
          zip_code,
          phone
        ),
        technician:profiles!fs_jobs_technician_id_fkey (
          display_name,
          email
        )
      `)
            .eq('id', id)
            .limit(1);

        if (error) {
            console.error('getJobById error:', error);
            return {
                success: false,
                error: error.message || 'Job not found'
            };
        }

        if (!data || data.length === 0) {
            return { success: false, error: 'Job not found' };
        }

        return { success: true, data: { job: data[0] as JobWithCustomer } };
    } catch (error) {
        return { success: false, error: 'Unexpected error' };
    }
}

export async function updateJob(id: string, data: Partial<JobFormData>, updatedAt?: string): Promise<ActionResult> {
    try {
        const supabase = await createClient();
        const { error } = await supabase
            .from('fs_jobs')
            .update({
                title: data.title,
                description: data.description,
                status: data.status,
                priority: data.priority,
                scheduled_date: data.scheduled_date,
                scheduled_time: data.scheduled_time,
                estimated_duration_minutes: data.estimated_duration_minutes,
                notes: data.notes,
                customer_id: data.customer_id, // Allow changing customer
                technician_id: data.technician_id, // Allow changing technician
                latitude: data.latitude,
                longitude: data.longitude,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);

        if (error) return { success: false, error: error.message };

        revalidatePath('/dashboard');
        revalidatePath('/dashboard/jobs');
        revalidatePath(`/dashboard/jobs/${id}`);

        return { success: true };
    } catch (error) {
        return { success: false, error: 'Unexpected error' };
    }
}

export async function updateJobStatus(id: string, status: string): Promise<ActionResult> {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return { success: false, error: 'Not authenticated' };
        }

        const { error } = await supabase
            .from('fs_jobs')
            .update({ status })
            .eq('id', id);

        if (error) {
            console.error('Supabase error:', JSON.stringify(error, null, 2));
            return { success: false, error: 'Failed to update job status' };
        }

        revalidatePath('/dashboard');
        revalidatePath('/dashboard/jobs');

        return { success: true };
    } catch (error) {
        console.error('Update job status error:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
}

export async function deleteJob(id: string): Promise<ActionResult> {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return { success: false, error: 'Not authenticated' };
        }

        const { error } = await supabase
            .from('fs_jobs')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Supabase error:', JSON.stringify(error, null, 2));
            return { success: false, error: 'Failed to delete job' };
        }

        revalidatePath('/dashboard');
        revalidatePath('/dashboard/jobs');
        return { success: true };
    } catch (error) {
        console.error('Delete job error:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
}

export async function getMapJobs(): Promise<{ success: boolean; data: any[]; error?: string }> {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return { success: false, error: 'Not authenticated', data: [] };
        }

        let query = supabase
            .from('fs_jobs')
            .select(`
                id,
                title,
                status,
                latitude,
                longitude,
                customer:fs_customers (
                    name,
                    address,
                    city,
                    state,
                    zip_code
                )
            `)
            .not('latitude', 'is', null) // Only get jobs with coordinates
            .not('longitude', 'is', null);

        // If user is a technician (not admin), only show their assigned jobs
        if (user.user_metadata?.role === 'technician') {
            query = query.eq('technician_id', user.id);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Supabase error:', error);
            return { success: false, error: `Failed to fetch map jobs: ${error.message}`, data: [] };
        }

        return { success: true, data: data || [] };
    } catch (error) {
        console.error('Get map jobs error:', error);
        return { success: false, error: 'An unexpected error occurred', data: [] };
    }
}
