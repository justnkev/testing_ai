'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { CalendarEvent, STATUS_COLORS, Technician } from '@/lib/validations/calendar';

export type ActionResult<T = void> =
    | { success: true; data?: T }
    | { success: false; error: string };

/**
 * Fetch jobs for calendar within a date range
 * Optimized for calendar view with customer and technician data
 */
export async function getJobsForCalendar(
    startDate: string,
    endDate: string
): Promise<ActionResult<CalendarEvent[]>> {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return { success: false, error: 'Not authenticated' };
        }

        const { data: jobs, error } = await supabase
            .from('fs_jobs')
            .select(`
        id,
        title,
        description,
        status,
        scheduled_date,
        scheduled_time,
        estimated_duration_minutes,
        priority,
        customer_id,
        technician_id,
        customer:fs_customers (
          id,
          name,
          address,
          city,
          state,
          zip_code
        ),
        technician:profiles (
          id,
          display_name,
          avatar_color
        )
      `)
            .gte('scheduled_date', startDate)
            .lte('scheduled_date', endDate)
            .order('scheduled_date', { ascending: true })
            .order('scheduled_time', { ascending: true });

        if (error) {
            console.error('Calendar fetch error:', error);
            return { success: false, error: 'Failed to fetch jobs' };
        }

        // Transform to FullCalendar event format
        const events: CalendarEvent[] = (jobs || []).map((job) => {
            const colors = STATUS_COLORS[job.status] || STATUS_COLORS.scheduled;
            // Supabase returns relations as arrays, get first element
            const customerData = job.customer;
            const customer = Array.isArray(customerData) ? customerData[0] : customerData;
            const technicianData = job.technician;
            const technician = Array.isArray(technicianData) ? technicianData[0] : technicianData;

            // Build start datetime
            let startDateTime = job.scheduled_date;
            let endDateTime: string | undefined;
            let allDay = true;

            if (job.scheduled_time) {
                startDateTime = `${job.scheduled_date}T${job.scheduled_time}`;
                allDay = false;

                // Calculate end time based on duration
                if (job.estimated_duration_minutes) {
                    const startDate = new Date(`${job.scheduled_date}T${job.scheduled_time}`);
                    const endDate = new Date(startDate.getTime() + job.estimated_duration_minutes * 60000);
                    endDateTime = endDate.toISOString();
                }
            }

            // Build customer address
            const customerAddress = customer
                ? [customer.address, customer.city, customer.state, customer.zip_code]
                    .filter(Boolean)
                    .join(', ')
                : '';

            return {
                id: job.id,
                title: job.title,
                start: startDateTime,
                end: endDateTime,
                allDay,
                backgroundColor: technician?.avatar_color || colors.bg,
                borderColor: colors.border,
                textColor: colors.text,
                classNames: job.priority === 'urgent' || job.priority === 'high' ? ['fc-event-priority'] : [],
                extendedProps: {
                    jobId: job.id,
                    customerId: customer?.id,
                    customerName: customer?.name,
                    customerAddress,
                    technicianId: job.technician_id,
                    technicianName: technician?.display_name,
                    status: job.status as 'scheduled' | 'in_progress' | 'completed' | 'cancelled',
                    priority: job.priority as 'low' | 'normal' | 'high' | 'urgent',
                    description: job.description,
                    duration: job.estimated_duration_minutes || 60,
                },
            };
        });

        return { success: true, data: events };
    } catch (error) {
        console.error('Calendar error:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
}

/**
 * Reschedule a job via drag-and-drop
 */
export async function rescheduleJob(
    jobId: string,
    newDate: string,
    newTime: string | null
): Promise<ActionResult> {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return { success: false, error: 'Not authenticated' };
        }

        const { error } = await supabase
            .from('fs_jobs')
            .update({
                scheduled_date: newDate,
                scheduled_time: newTime,
            })
            .eq('id', jobId);

        if (error) {
            console.error('Reschedule error:', error);
            return { success: false, error: 'Failed to reschedule job' };
        }

        revalidatePath('/dashboard/calendar');
        revalidatePath('/dashboard');
        revalidatePath('/dashboard/jobs');

        return { success: true };
    } catch (error) {
        console.error('Reschedule error:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
}

/**
 * Get all technicians for filtering
 */
export async function getTechnicians(): Promise<ActionResult<Technician[]>> {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return { success: false, error: 'Not authenticated' };
        }

        const { data, error } = await supabase
            .from('profiles')
            .select('id, display_name, email, avatar_color, role')
            .order('display_name', { ascending: true });

        if (error) {
            console.error('Technicians fetch error:', error);
            return { success: false, error: 'Failed to fetch technicians' };
        }

        return { success: true, data: (data || []) as Technician[] };
    } catch (error) {
        console.error('Technicians error:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
}

/**
 * Assign a technician to a job
 */
export async function assignTechnician(
    jobId: string,
    technicianId: string | null
): Promise<ActionResult> {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return { success: false, error: 'Not authenticated' };
        }

        const { error } = await supabase
            .from('fs_jobs')
            .update({ technician_id: technicianId })
            .eq('id', jobId);

        if (error) {
            console.error('Assign technician error:', error);
            return { success: false, error: 'Failed to assign technician' };
        }

        revalidatePath('/dashboard/calendar');
        revalidatePath('/dashboard/jobs');

        return { success: true };
    } catch (error) {
        console.error('Assign error:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
}

/**
 * Quick update job status from calendar
 */
export async function updateJobFromCalendar(
    jobId: string,
    updates: {
        status?: string;
        technicianId?: string | null;
        notes?: string;
    }
): Promise<ActionResult> {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return { success: false, error: 'Not authenticated' };
        }

        const updateData: Record<string, unknown> = {};
        if (updates.status) updateData.status = updates.status;
        if (updates.technicianId !== undefined) updateData.technician_id = updates.technicianId;
        if (updates.notes !== undefined) updateData.notes = updates.notes;

        const { error } = await supabase
            .from('fs_jobs')
            .update(updateData)
            .eq('id', jobId);

        if (error) {
            console.error('Update job error:', error);
            return { success: false, error: 'Failed to update job' };
        }

        revalidatePath('/dashboard/calendar');
        revalidatePath('/dashboard');
        revalidatePath('/dashboard/jobs');

        return { success: true };
    } catch (error) {
        console.error('Update error:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
}
