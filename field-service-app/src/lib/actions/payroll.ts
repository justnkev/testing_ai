'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { Resend } from 'resend';
import type {
    TimeEntry,
    TimeEntryWithDetails,
    PayPeriodSummary,
    LaborCostResult,
} from '@/lib/validations/payroll';

// ── Shared Result Type (matches existing pattern) ────────────────
export type ActionResult<T = void> =
    | { success: true; data?: T }
    | { success: false; error: string };

// ── Clock In ─────────────────────────────────────────────────────
/**
 * Start tracking time against a job.
 * Captures geolocation and a snapshot of the job metadata.
 * Prevents double clock-in (one active entry per user).
 */
export async function clockIn(
    jobId: string,
    isTravelTime: boolean,
    latitude: number | null,
    longitude: number | null
): Promise<ActionResult<TimeEntry>> {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return { success: false, error: 'Not authenticated' };
        }

        // Prevent double clock-in
        const { data: existing } = await supabase
            .from('time_entries')
            .select('id, job_id')
            .eq('user_id', user.id)
            .is('clock_out_at', null)
            .limit(1)
            .maybeSingle();

        if (existing) {
            return {
                success: false,
                error: 'You are already clocked in. Please clock out of your current entry first.',
            };
        }

        // Capture job snapshot (survives job archival/deletion)
        const { data: job } = await supabase
            .from('fs_jobs')
            .select(`
                title,
                scheduled_date,
                customer:fs_customers(name)
            `)
            .eq('id', jobId)
            .single();

        const customerData = job?.customer as
            | { name: string }
            | { name: string }[]
            | null;
        const customerName = Array.isArray(customerData)
            ? customerData[0]?.name
            : customerData?.name;

        const jobSnapshot = job
            ? {
                title: job.title,
                customer_name: customerName || 'Unknown',
                scheduled_date: job.scheduled_date,
            }
            : null;

        // Create the time entry
        const { data: entry, error: insertError } = await supabase
            .from('time_entries')
            .insert({
                user_id: user.id,
                job_id: jobId,
                is_travel_time: isTravelTime,
                clock_in_latitude: latitude,
                clock_in_longitude: longitude,
                job_snapshot: jobSnapshot,
            })
            .select()
            .single();

        if (insertError || !entry) {
            console.error('Clock-in insert error:', insertError);
            return { success: false, error: 'Failed to start timer' };
        }

        revalidatePath(`/dashboard/jobs/${jobId}/mobile`);

        return { success: true, data: entry as TimeEntry };
    } catch (error) {
        console.error('Clock-in error:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
}

// ── Clock Out ────────────────────────────────────────────────────
/**
 * Stop tracking time. Triggers server-side labor cost calculation via RPC.
 */
export async function clockOut(
    entryId: string,
    latitude: number | null,
    longitude: number | null
): Promise<ActionResult<LaborCostResult>> {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return { success: false, error: 'Not authenticated' };
        }

        // Set clock_out_at and geolocation
        const { error: updateError } = await supabase
            .from('time_entries')
            .update({
                clock_out_at: new Date().toISOString(),
                clock_out_latitude: latitude,
                clock_out_longitude: longitude,
            })
            .eq('id', entryId)
            .eq('user_id', user.id);

        if (updateError) {
            console.error('Clock-out update error:', updateError);
            return { success: false, error: 'Failed to stop timer' };
        }

        // Calculate labor cost via RPC
        const { data: costResult, error: rpcError } = await supabase
            .rpc('calculate_labor_cost', { entry_id: entryId });

        if (rpcError) {
            console.error('Labor cost RPC error:', rpcError);
            // Non-fatal: the entry is clocked out, cost can be recalculated later
        }

        // Get the entry to revalidate the right job path
        const { data: entry } = await supabase
            .from('time_entries')
            .select('job_id')
            .eq('id', entryId)
            .single();

        if (entry?.job_id) {
            revalidatePath(`/dashboard/jobs/${entry.job_id}/mobile`);
        }
        revalidatePath('/dashboard/payroll');

        return {
            success: true,
            data: costResult as LaborCostResult,
        };
    } catch (error) {
        console.error('Clock-out error:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
}

// ── Get Active Entry ─────────────────────────────────────────────
/**
 * Returns the user's currently open time entry (if any).
 * Used to show the active timer in the UI.
 */
export async function getActiveTimeEntry(): Promise<ActionResult<TimeEntry | null>> {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return { success: false, error: 'Not authenticated' };
        }

        const { data: entry, error } = await supabase
            .from('time_entries')
            .select('*')
            .eq('user_id', user.id)
            .is('clock_out_at', null)
            .limit(1)
            .maybeSingle();

        if (error) {
            return { success: false, error: 'Failed to fetch active entry' };
        }

        return { success: true, data: (entry as TimeEntry) || null };
    } catch (error) {
        console.error('Get active entry error:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
}

// ── Bulk Update Entry Status (Admin) ─────────────────────────────
/**
 * Bulk approve or reject time entries. Writes to audit_logs.
 */
export async function bulkUpdateEntryStatus(
    entryIds: string[],
    newStatus: 'approved' | 'rejected',
    notes?: string
): Promise<ActionResult<{ updated: number }>> {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return { success: false, error: 'Not authenticated' };
        }

        // Get org ID for audit log
        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id, role')
            .eq('id', user.id)
            .single();

        if (!profile || !['admin', 'manager'].includes(profile.role)) {
            return { success: false, error: 'Insufficient permissions' };
        }

        // Fetch current statuses for audit trail
        const { data: currentEntries } = await supabase
            .from('time_entries')
            .select('id, status')
            .in('id', entryIds);

        // Update entries
        const { error: updateError, count } = await supabase
            .from('time_entries')
            .update({
                status: newStatus,
                reviewed_by: user.id,
                reviewed_at: new Date().toISOString(),
                review_notes: notes || null,
            })
            .in('id', entryIds);

        if (updateError) {
            console.error('Bulk status update error:', updateError);
            return { success: false, error: 'Failed to update entries' };
        }

        // Write audit logs
        const auditEntries = (currentEntries || []).map((entry) => ({
            organization_id: profile.organization_id,
            actor_id: user.id,
            action: newStatus === 'approved' ? 'APPROVE_TIME_ENTRY' : 'REJECT_TIME_ENTRY',
            target_id: entry.id,
            target_type: 'time_entry',
            details: {
                previous_status: entry.status,
                new_status: newStatus,
                notes: notes || null,
            },
        }));

        if (auditEntries.length > 0) {
            await supabase.from('audit_logs').insert(auditEntries);
        }

        revalidatePath('/dashboard/payroll');

        return { success: true, data: { updated: count || entryIds.length } };
    } catch (error) {
        console.error('Bulk update error:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
}

// ── Get Payroll Audit Data ───────────────────────────────────────
/**
 * Fetches time entries for the admin audit page.
 * Reactively flags "forgotten clock-outs" (>12hrs open) and
 * sends Resend email notifications for newly flagged entries.
 */
export async function getPayrollAuditData(filters?: {
    status?: string;
    userId?: string;
}): Promise<ActionResult<TimeEntryWithDetails[]>> {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return { success: false, error: 'Not authenticated' };
        }

        // ── Reactive forgotten clock-out detection ──
        const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

        const { data: staleEntries } = await supabase
            .from('time_entries')
            .select('id, user_id')
            .is('clock_out_at', null)
            .lt('clock_in_at', twelveHoursAgo)
            .neq('status', 'manual_review');

        if (staleEntries && staleEntries.length > 0) {
            const staleIds = staleEntries.map((e) => e.id);

            // Flag them
            await supabase
                .from('time_entries')
                .update({
                    status: 'manual_review',
                    flagged_reason: 'forgotten_clock_out',
                })
                .in('id', staleIds);

            // Send Resend email notification to admin
            try {
                const resend = new Resend(process.env.RESEND_API_KEY);
                const { data: adminProfile } = await supabase
                    .from('profiles')
                    .select('full_name')
                    .eq('id', user.id)
                    .single();

                await resend.emails.send({
                    from: 'Field Service App <onboarding@resend.dev>',
                    to: user.email || '',
                    subject: `⚠️ ${staleEntries.length} Forgotten Clock-Out(s) Detected`,
                    html: `
                        <h2>Payroll Alert</h2>
                        <p>Hi ${adminProfile?.full_name || 'Admin'},</p>
                        <p><strong>${staleEntries.length}</strong> time entries have been open for more than 12 hours and have been flagged for manual review.</p>
                        <p>Please review them on the <a href="${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/payroll">Payroll Audit page</a>.</p>
                    `,
                });
            } catch (emailErr) {
                console.error('Resend notification error:', emailErr);
                // Non-fatal: entries are already flagged
            }
        }

        // ── Fetch entries with details ──
        let query = supabase
            .from('time_entries')
            .select(`
                *,
                user:profiles(full_name, base_hourly_rate),
                job:fs_jobs(title, status, customer:fs_customers(name))
            `)
            .order('clock_in_at', { ascending: false });

        if (filters?.status) {
            query = query.eq('status', filters.status);
        }
        if (filters?.userId) {
            query = query.eq('user_id', filters.userId);
        }

        const { data: entries, error } = await query;

        if (error) {
            console.error('Payroll audit fetch error:', error);
            return { success: false, error: 'Failed to fetch payroll data' };
        }

        // Normalize Supabase join results
        const normalized = (entries || []).map((entry) => {
            const userData = entry.user;
            const jobData = entry.job;
            return {
                ...entry,
                user: Array.isArray(userData) ? userData[0] : userData,
                job: Array.isArray(jobData) ? jobData[0] : jobData,
            };
        });

        return { success: true, data: normalized as TimeEntryWithDetails[] };
    } catch (error) {
        console.error('Payroll audit error:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
}

// ── Get Pay Period Summary ───────────────────────────────────────
/**
 * Calls the get_pay_period_summary RPC and optionally converts to CSV.
 */
export async function getPayPeriodSummary(
    startDate: string,
    endDate: string,
    format: 'json' | 'csv' = 'json'
): Promise<ActionResult<PayPeriodSummary[] | string>> {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return { success: false, error: 'Not authenticated' };
        }

        const { data, error } = await supabase.rpc('get_pay_period_summary', {
            p_start_date: startDate,
            p_end_date: endDate,
        });

        if (error) {
            console.error('Pay period summary RPC error:', error);
            return { success: false, error: 'Failed to generate pay period summary' };
        }

        const summaries = (data || []) as PayPeriodSummary[];

        if (format === 'csv') {
            const headers = [
                'Employee',
                'Base Rate ($/hr)',
                'Regular Hours',
                'Overtime Hours',
                'Travel Hours',
                'Total Gross Pay',
                'Total Entries',
                'Pending Entries',
            ];
            const rows = summaries.map((s) =>
                [
                    `"${s.full_name}"`,
                    s.base_rate.toFixed(2),
                    s.total_regular_hours.toFixed(2),
                    s.total_overtime_hours.toFixed(2),
                    s.total_travel_hours.toFixed(2),
                    s.total_gross_pay.toFixed(2),
                    s.entry_count,
                    s.pending_count,
                ].join(',')
            );
            const csv = [headers.join(','), ...rows].join('\n');
            return { success: true, data: csv };
        }

        return { success: true, data: summaries };
    } catch (error) {
        console.error('Pay period summary error:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
}
