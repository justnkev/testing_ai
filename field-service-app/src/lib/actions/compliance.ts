'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export type ActionResult<T = void> =
    | { success: true; data?: T }
    | { success: false; error: string };

// ── Types ──────────────────────────────────────────────────────

export interface RateOverride {
    id?: string;
    labor_classification: string;
    hourly_rate: number;
    overtime_rate: number | null;
    fringe_rate: number;
}

export interface CertifiedPayrollRow {
    employee_id: string;
    employee_name: string;
    labor_classification: string;
    last_four_ssn: string | null;
    work_date: string;
    regular_hours: number;
    overtime_hours: number;
    total_hours: number;
    hourly_rate: number;
    overtime_rate: number;
    fringe_rate: number;
    gross_pay: number;
    is_prevailing_wage: boolean;
}

// ── Rate Overrides ─────────────────────────────────────────────

export async function getJobRateOverrides(
    jobId: string
): Promise<ActionResult<RateOverride[]>> {
    try {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from('job_rate_overrides')
            .select('*')
            .eq('job_id', jobId)
            .order('labor_classification');

        if (error) return { success: false, error: 'Failed to fetch rate overrides' };
        return { success: true, data: data as RateOverride[] };
    } catch {
        return { success: false, error: 'Unexpected error' };
    }
}

export async function setJobRateOverrides(
    jobId: string,
    overrides: RateOverride[]
): Promise<ActionResult> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: 'Not authenticated' };

        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id, role')
            .eq('id', user.id)
            .single();

        if (!profile || !['admin', 'manager'].includes(profile.role)) {
            return { success: false, error: 'Insufficient permissions' };
        }

        // Delete existing overrides for this job, then insert new ones
        await supabase
            .from('job_rate_overrides')
            .delete()
            .eq('job_id', jobId);

        if (overrides.length > 0) {
            const rows = overrides.map((o) => ({
                job_id: jobId,
                organization_id: profile.organization_id,
                labor_classification: o.labor_classification,
                hourly_rate: o.hourly_rate,
                overtime_rate: o.overtime_rate,
                fringe_rate: o.fringe_rate || 0,
            }));

            const { error } = await supabase.from('job_rate_overrides').insert(rows);
            if (error) {
                console.error('Rate override insert error:', error);
                return { success: false, error: 'Failed to save rate overrides' };
            }
        }

        revalidatePath(`/dashboard/payroll/compliance`);
        return { success: true };
    } catch (e) {
        console.error('Set rate overrides error:', e);
        return { success: false, error: 'Unexpected error' };
    }
}

// ── Prevailing Wage Toggle ─────────────────────────────────────

export async function markJobAsPrevailingWage(
    jobId: string,
    isPrevailingWage: boolean
): Promise<ActionResult> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: 'Not authenticated' };

        const { error } = await supabase
            .from('fs_jobs')
            .update({ is_prevailing_wage: isPrevailingWage })
            .eq('id', jobId);

        if (error) return { success: false, error: 'Failed to update job' };

        revalidatePath(`/dashboard/payroll/compliance`);
        return { success: true };
    } catch {
        return { success: false, error: 'Unexpected error' };
    }
}

// ── Certified Payroll Report ───────────────────────────────────

export async function generateCertifiedPayrollReport(
    jobId: string,
    startDate: string,
    endDate: string
): Promise<ActionResult<CertifiedPayrollRow[]>> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: 'Not authenticated' };

        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (!profile || !['admin', 'manager'].includes(profile.role)) {
            return { success: false, error: 'Compliance reports require admin access' };
        }

        const { data, error } = await supabase.rpc('generate_certified_payroll_data', {
            p_job_id: jobId,
            p_start_date: startDate,
            p_end_date: endDate,
        });

        if (error) {
            console.error('Certified payroll RPC error:', error);
            return { success: false, error: 'Failed to generate report' };
        }

        return { success: true, data: (data || []) as CertifiedPayrollRow[] };
    } catch (e) {
        console.error('Certified payroll error:', e);
        return { success: false, error: 'Unexpected error' };
    }
}

// ── Get Prevailing Wage Jobs ───────────────────────────────────

export async function getPrevailingWageJobs(): Promise<ActionResult<any[]>> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: 'Not authenticated' };

        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single();

        if (!profile?.organization_id) return { success: false, error: 'No organization' };

        const { data, error } = await supabase
            .from('fs_jobs')
            .select(`
                id, title, status, is_prevailing_wage,
                customer:fs_customers(name),
                rate_overrides:job_rate_overrides(id, labor_classification, hourly_rate, overtime_rate, fringe_rate)
            `)
            .eq('organization_id', profile.organization_id)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) return { success: false, error: 'Failed to fetch jobs' };
        return { success: true, data: data || [] };
    } catch {
        return { success: false, error: 'Unexpected error' };
    }
}

// ── Get All Jobs (for compliance job selector) ─────────────────

export async function getComplianceJobsList(): Promise<ActionResult<any[]>> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: 'Not authenticated' };

        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single();

        if (!profile?.organization_id) return { success: false, error: 'No organization' };

        const { data, error } = await supabase
            .from('fs_jobs')
            .select('id, title, status, is_prevailing_wage, customer:fs_customers(name)')
            .eq('organization_id', profile.organization_id)
            .in('status', ['in_progress', 'completed'])
            .order('created_at', { ascending: false });

        if (error) return { success: false, error: 'Failed to fetch jobs' };
        return { success: true, data: data || [] };
    } catch {
        return { success: false, error: 'Unexpected error' };
    }
}
