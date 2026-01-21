'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
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
                notes: validatedData.data.notes || null,
            })
            .select('id')
            .single();

        if (error) {
            console.error('Supabase error:', JSON.stringify(error, null, 2));
            return { success: false, error: `Failed to create job: ${error.message}` };
        }

        revalidatePath('/dashboard');
        revalidatePath('/dashboard/jobs');

        return { success: true, data: { id: data.id } };
    } catch (error) {
        console.error('Create job error:', error);
        return { success: false, error: 'An unexpected error occurred. Please try again.' };
    }
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
        )
      `)
            .gte('scheduled_date', today)
            .in('status', ['scheduled', 'in_progress'])
            .order('scheduled_date', { ascending: true })
            .order('scheduled_time', { ascending: true });

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
        )
      `)
            .order('scheduled_date', { ascending: false });

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
