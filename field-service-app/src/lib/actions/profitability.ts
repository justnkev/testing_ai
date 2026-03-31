'use server';

import { createClient } from '@/lib/supabase/server';
import type {
    JobProfitability,
    ProfitabilityOverview,
    ProfitabilityKPIs,
} from '@/lib/validations/profitability';

export type ActionResult<T = void> =
    | { success: true; data?: T }
    | { success: false; error: string };

/**
 * Get profitability breakdown for a single job.
 */
export async function getJobProfitability(
    jobId: string
): Promise<ActionResult<JobProfitability>> {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return { success: false, error: 'Not authenticated' };
        }

        const { data, error } = await supabase.rpc('get_job_profitability', {
            p_job_id: jobId,
        });

        if (error) {
            console.error('Job profitability RPC error:', error);
            return { success: false, error: 'Failed to calculate profitability' };
        }

        return { success: true, data: data as JobProfitability };
    } catch (error) {
        console.error('Job profitability error:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
}

/**
 * Get profitability overview for admin dashboard — top N jobs.
 */
export async function getProfitabilityOverview(
    limit: number = 10
): Promise<ActionResult<{ overview: ProfitabilityOverview[]; kpis: ProfitabilityKPIs }>> {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return { success: false, error: 'Not authenticated' };
        }

        const { data, error } = await supabase.rpc('get_profitability_overview', {
            p_limit: limit,
        });

        if (error) {
            console.error('Profitability overview RPC error:', error);
            return { success: false, error: 'Failed to fetch profitability data' };
        }

        const rows = (data || []) as ProfitabilityOverview[];

        // Compute KPIs from the returned rows
        const kpis: ProfitabilityKPIs = {
            total_revenue: rows.reduce((s, r) => s + Number(r.total_revenue), 0),
            total_costs: rows.reduce((s, r) => s + Number(r.total_cost), 0),
            average_margin_pct:
                rows.length > 0
                    ? rows.reduce((s, r) => s + Number(r.gross_margin_pct), 0) / rows.length
                    : 0,
            over_budget_count: rows.filter((r) => r.is_over_budget).length,
            job_count: rows.length,
        };

        return { success: true, data: { overview: rows, kpis } };
    } catch (error) {
        console.error('Profitability overview error:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
}
