'use server';

import { createClient } from '@/lib/supabase/server';
import { generateCostBasedInvoice } from './invoices';

export type ActionResult<T = void> =
    | { success: true; data?: T }
    | { success: false; error: string };

export interface BillingDashboardRecord {
    id: string;
    record_type: 'invoice' | 'unbilled_job';
    display_id: string;
    customer_name: string;
    job_title: string;
    created_at: string;
    due_date: string | null;
    total_amount: number;
    balance_due: number;
    status: string;
    payment_status: string;
    days_aging: number | null;
    job_id: string;
    customer_id: string;
    has_missing_costs: boolean;
}

export interface BillingKPIs {
    total_receivables: number;
    average_dso: number;
    total_unbilled: number;
}

export async function getBillingDashboardData(): Promise<ActionResult<BillingDashboardRecord[]>> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: 'Unauthorized' };

        const { data, error } = await supabase
            .from('v_billing_dashboard')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching billing data:', error);
            return { success: false, error: error.message };
        }

        return { success: true, data: data as BillingDashboardRecord[] };
    } catch (error: any) {
        console.error('getBillingDashboardData error:', error);
        return { success: false, error: 'Unexpected error' };
    }
}

export async function getBillingKPIs(): Promise<ActionResult<BillingKPIs>> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: 'Unauthorized' };

        const { data, error } = await supabase.rpc('get_billing_kpis');

        if (error) {
            console.error('Error fetching billing KPIs:', error);
            return { success: false, error: error.message };
        }

        if (data && data.length > 0) {
            return {
                success: true,
                data: {
                    total_receivables: Number(data[0].total_receivables || 0),
                    average_dso: Number(data[0].average_dso || 0),
                    total_unbilled: Number(data[0].total_unbilled || 0)
                }
            };
        }

        return {
            success: true,
            data: { total_receivables: 0, average_dso: 0, total_unbilled: 0 }
        };
    } catch (error: any) {
        console.error('getBillingKPIs error:', error);
        return { success: false, error: 'Unexpected error' };
    }
}

/**
 * Perform a Bill Run on a set of completed jobs that haven't been invoiced.
 * This generates Draft invoices for them.
 */
export async function processBillRun(jobIds: string[]): Promise<ActionResult<{ generatedCount: number; errors: string[] }>> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: 'Unauthorized' };

        let generatedCount = 0;
        const errors: string[] = [];

        // Note: For large datasets, this might be better handled in a queue/background job.
        // For standard SMB load, executing in a loop is acceptable.
        for (const jobId of jobIds) {
            // Check if it already has an invoice just in case to avoid duplicates
            const { data: existing } = await supabase
                .from('invoices')
                .select('id')
                .eq('job_id', jobId)
                .maybeSingle();

            if (existing) {
                errors.push(`Job ${jobId} already has an invoice.`);
                continue;
            }

            // generateCostBasedInvoice generates it in "draft" status by default
            const result = await generateCostBasedInvoice(jobId);
            if (result.success) {
                generatedCount++;
            } else {
                errors.push(`Job ${jobId} failed: ${result.error}`);
            }
        }

        return { 
            success: true, 
            data: { generatedCount, errors } 
        };
    } catch (error: any) {
        console.error('processBillRun error:', error);
        return { success: false, error: 'Unexpected error during bill run' };
    }
}
