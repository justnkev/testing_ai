'use server';

import { createClient } from '@/lib/supabase/server';
import type {
    KPIMetrics,
    MonthlyRevenue,
    ServiceTypeRevenue,
    LeadSource,
    TechnicianPerformance,
    ConversionFunnel,
    DateRange,
} from '@/lib/validations/analytics';

// Helper to build date range filter
function buildDateFilter(from?: string, to?: string) {
    const filters: { from: Date; to: Date } = {
        from: from ? new Date(from) : new Date(new Date().setMonth(new Date().getMonth() - 6)),
        to: to ? new Date(to) : new Date(),
    };
    return filters;
}

/**
 * Get KPI summary metrics for the dashboard
 */
export async function getKPIMetrics(range?: DateRange): Promise<{
    success: boolean;
    data: KPIMetrics;
    error?: string;
}> {
    try {
        const supabase = await createClient();
        const { from, to } = buildDateFilter(range?.from, range?.to);

        // Get total revenue (paid invoices)
        const { data: paidInvoices } = await supabase
            .from('invoices')
            .select('amount_paid')
            .in('payment_status', ['paid', 'partial'])
            .gte('paid_at', from.toISOString())
            .lte('paid_at', to.toISOString());

        const totalRevenue = paidInvoices?.reduce((sum, inv) => sum + (Number(inv.amount_paid) || 0), 0) || 0;

        // Get pending revenue (unpaid invoices)
        const { data: unpaidInvoices } = await supabase
            .from('invoices')
            .select('total_amount, amount_paid')
            .in('payment_status', ['unpaid', 'partial'])
            .gte('created_at', from.toISOString())
            .lte('created_at', to.toISOString());

        const pendingRevenue = unpaidInvoices?.reduce(
            (sum, inv) => sum + (Number(inv.total_amount) - Number(inv.amount_paid || 0)),
            0
        ) || 0;

        // Get job success rate
        const { data: jobs } = await supabase
            .from('fs_jobs')
            .select('status')
            .gte('scheduled_date', from.toISOString().split('T')[0])
            .lte('scheduled_date', to.toISOString().split('T')[0]);

        const completedJobs = jobs?.filter(j => j.status === 'completed').length || 0;
        const cancelledJobs = jobs?.filter(j => j.status === 'cancelled').length || 0;
        const totalJobsWithOutcome = completedJobs + cancelledJobs;
        const jobSuccessRate = totalJobsWithOutcome > 0
            ? Math.round((completedJobs / totalJobsWithOutcome) * 100)
            : 100;

        // Get new leads this month
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);

        const { count: newLeadsThisMonth } = await supabase
            .from('fs_customers')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', monthStart.toISOString());

        return {
            success: true,
            data: {
                totalRevenue,
                pendingRevenue,
                jobSuccessRate,
                newLeadsThisMonth: newLeadsThisMonth || 0,
            },
        };
    } catch (error) {
        console.error('getKPIMetrics error:', error);
        return {
            success: false,
            data: { totalRevenue: 0, pendingRevenue: 0, jobSuccessRate: 0, newLeadsThisMonth: 0 },
            error: 'Failed to fetch KPI metrics',
        };
    }
}

/**
 * Get revenue by month for the area chart
 */
export async function getRevenueByMonth(range?: DateRange): Promise<{
    success: boolean;
    data: MonthlyRevenue[];
    error?: string;
}> {
    try {
        const supabase = await createClient();
        const { from, to } = buildDateFilter(range?.from, range?.to);

        const { data: invoices } = await supabase
            .from('invoices')
            .select('amount_paid, paid_at')
            .in('payment_status', ['paid', 'partial'])
            .not('paid_at', 'is', null)
            .gte('paid_at', from.toISOString())
            .lte('paid_at', to.toISOString())
            .order('paid_at', { ascending: true });

        // Aggregate by month
        const monthlyData: Record<string, { revenue: number; count: number }> = {};

        invoices?.forEach(inv => {
            if (!inv.paid_at) return;
            const date = new Date(inv.paid_at);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = { revenue: 0, count: 0 };
            }
            monthlyData[monthKey].revenue += Number(inv.amount_paid) || 0;
            monthlyData[monthKey].count += 1;
        });

        const data: MonthlyRevenue[] = Object.entries(monthlyData)
            .map(([month, { revenue, count }]) => ({
                month,
                monthLabel: new Date(month + '-01').toLocaleDateString('en-US', {
                    month: 'short',
                    year: 'numeric'
                }),
                totalRevenue: revenue,
                invoiceCount: count,
            }))
            .sort((a, b) => a.month.localeCompare(b.month));

        return { success: true, data };
    } catch (error) {
        console.error('getRevenueByMonth error:', error);
        return { success: false, data: [], error: 'Failed to fetch monthly revenue' };
    }
}

/**
 * Get revenue by service type for the bar chart
 */
export async function getRevenueByServiceType(range?: DateRange): Promise<{
    success: boolean;
    data: ServiceTypeRevenue[];
    error?: string;
}> {
    try {
        const supabase = await createClient();
        const { from, to } = buildDateFilter(range?.from, range?.to);

        // Get jobs with their invoices
        const { data: jobs } = await supabase
            .from('fs_jobs')
            .select(`
        id,
        service_type,
        invoices!inner (
          amount_paid,
          payment_status
        )
      `)
            .gte('scheduled_date', from.toISOString().split('T')[0])
            .lte('scheduled_date', to.toISOString().split('T')[0]);

        // Aggregate by service type
        const serviceData: Record<string, { revenue: number; count: number }> = {};

        jobs?.forEach(job => {
            const serviceType = job.service_type || 'general';
            if (!serviceData[serviceType]) {
                serviceData[serviceType] = { revenue: 0, count: 0 };
            }
            serviceData[serviceType].count += 1;

            // Sum paid invoice amounts
            const invoices = job.invoices as Array<{ amount_paid: number; payment_status: string }>;
            invoices?.forEach(inv => {
                if (inv.payment_status === 'paid' || inv.payment_status === 'partial') {
                    serviceData[serviceType].revenue += Number(inv.amount_paid) || 0;
                }
            });
        });

        const data: ServiceTypeRevenue[] = Object.entries(serviceData)
            .map(([serviceType, { revenue, count }]) => ({
                serviceType,
                serviceTypeLabel: serviceType.charAt(0).toUpperCase() + serviceType.slice(1),
                totalRevenue: revenue,
                jobCount: count,
            }))
            .sort((a, b) => b.totalRevenue - a.totalRevenue);

        return { success: true, data };
    } catch (error) {
        console.error('getRevenueByServiceType error:', error);
        return { success: false, data: [], error: 'Failed to fetch service type revenue' };
    }
}

/**
 * Get lead sources for the donut chart
 */
export async function getLeadSources(range?: DateRange): Promise<{
    success: boolean;
    data: LeadSource[];
    error?: string;
}> {
    try {
        const supabase = await createClient();
        const { from, to } = buildDateFilter(range?.from, range?.to);

        const { data: customers } = await supabase
            .from('fs_customers')
            .select('lead_source')
            .gte('created_at', from.toISOString())
            .lte('created_at', to.toISOString());

        // Aggregate by lead source
        const sourceData: Record<string, number> = {};

        customers?.forEach(customer => {
            const source = customer.lead_source || 'other';
            sourceData[source] = (sourceData[source] || 0) + 1;
        });

        const data: LeadSource[] = Object.entries(sourceData)
            .map(([leadSource, customerCount]) => ({
                leadSource,
                leadSourceLabel: leadSource.charAt(0).toUpperCase() + leadSource.slice(1),
                customerCount,
            }))
            .sort((a, b) => b.customerCount - a.customerCount);

        return { success: true, data };
    } catch (error) {
        console.error('getLeadSources error:', error);
        return { success: false, data: [], error: 'Failed to fetch lead sources' };
    }
}

/**
 * Get technician performance leaderboard
 */
export async function getTechnicianLeaderboard(range?: DateRange): Promise<{
    success: boolean;
    data: TechnicianPerformance[];
    error?: string;
}> {
    try {
        const supabase = await createClient();
        const { from, to } = buildDateFilter(range?.from, range?.to);

        // Get jobs grouped by technician
        const { data: jobs } = await supabase
            .from('fs_jobs')
            .select(`
        technician_id,
        status,
        invoices (
          amount_paid,
          payment_status
        )
      `)
            .not('technician_id', 'is', null)
            .gte('scheduled_date', from.toISOString().split('T')[0])
            .lte('scheduled_date', to.toISOString().split('T')[0]);

        // Get technician names from profiles
        const technicianIds = [...new Set(jobs?.map(j => j.technician_id).filter(Boolean))];

        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, display_name, email')
            .in('id', technicianIds as string[]);

        const profileMap = new Map(profiles?.map(p => [p.id, p.display_name || p.email || 'Unknown']));

        // Aggregate by technician
        const techData: Record<string, { completed: number; cancelled: number; revenue: number }> = {};

        jobs?.forEach(job => {
            if (!job.technician_id) return;

            if (!techData[job.technician_id]) {
                techData[job.technician_id] = { completed: 0, cancelled: 0, revenue: 0 };
            }

            if (job.status === 'completed') techData[job.technician_id].completed += 1;
            if (job.status === 'cancelled') techData[job.technician_id].cancelled += 1;

            const invoices = job.invoices as Array<{ amount_paid: number; payment_status: string }>;
            invoices?.forEach(inv => {
                if (inv.payment_status === 'paid' || inv.payment_status === 'partial') {
                    techData[job.technician_id!].revenue += Number(inv.amount_paid) || 0;
                }
            });
        });

        const data: TechnicianPerformance[] = Object.entries(techData)
            .map(([id, stats]) => ({
                technicianId: id,
                technicianName: profileMap.get(id) || 'Unknown',
                jobsCompleted: stats.completed,
                jobsCancelled: stats.cancelled,
                totalRevenue: stats.revenue,
            }))
            .sort((a, b) => b.totalRevenue - a.totalRevenue);

        return { success: true, data };
    } catch (error) {
        console.error('getTechnicianLeaderboard error:', error);
        return { success: false, data: [], error: 'Failed to fetch technician leaderboard' };
    }
}

/**
 * Get conversion funnel stats
 */
export async function getConversionFunnel(): Promise<{
    success: boolean;
    data: ConversionFunnel;
    error?: string;
}> {
    try {
        const supabase = await createClient();

        const { data: estimates } = await supabase
            .from('estimates')
            .select('status, job_id');

        const totalEstimates = estimates?.length || 0;
        const approvedCount = estimates?.filter(e => e.status === 'approved').length || 0;
        const declinedCount = estimates?.filter(e => e.status === 'declined').length || 0;
        const convertedToJobs = estimates?.filter(e => e.job_id !== null).length || 0;
        const conversionRate = totalEstimates > 0
            ? Math.round((convertedToJobs / totalEstimates) * 100)
            : 0;

        return {
            success: true,
            data: {
                totalEstimates,
                approvedCount,
                declinedCount,
                convertedToJobs,
                conversionRate,
            },
        };
    } catch (error) {
        console.error('getConversionFunnel error:', error);
        return {
            success: false,
            data: { totalEstimates: 0, approvedCount: 0, declinedCount: 0, convertedToJobs: 0, conversionRate: 0 },
            error: 'Failed to fetch conversion funnel',
        };
    }
}
