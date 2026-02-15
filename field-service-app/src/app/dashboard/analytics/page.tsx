import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

import { DollarSign, Clock, CheckCircle, UserPlus, BarChart3 } from 'lucide-react';
import {
    getKPIMetrics,
    getRevenueByMonth,
    getRevenueByServiceType,
    getLeadSources,
    getTechnicianLeaderboard
} from '@/lib/actions/analytics';
import { DateRangePicker } from '@/components/analytics/date-range-picker';
import { KPICard } from '@/components/analytics/kpi-card';
import { AnalyticsCharts } from './analytics-charts';

interface AnalyticsPageProps {
    searchParams: Promise<{ from?: string; to?: string }>;
}

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
    const params = await searchParams;
    const dateRange = { from: params.from, to: params.to };

    // Fetch all analytics data in parallel
    const [kpiResult, revenueResult, serviceResult, leadsResult, techResult] = await Promise.all([
        getKPIMetrics(dateRange),
        getRevenueByMonth(dateRange),
        getRevenueByServiceType(dateRange),
        getLeadSources(dateRange),
        getTechnicianLeaderboard(dateRange),
    ]);

    const kpi = kpiResult.data;
    const hasData =
        revenueResult.data.length > 0 ||
        serviceResult.data.length > 0 ||
        leadsResult.data.length > 0;

    return (
        <div className="p-4 md:p-8 space-y-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/25">
                        <BarChart3 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-white">Analytics</h1>
                        <p className="text-slate-400 text-sm">Track your business performance and growth</p>
                    </div>
                </div>
                <Suspense fallback={<div className="h-9 bg-slate-800 rounded animate-pulse w-96" />}>
                    <DateRangePicker />
                </Suspense>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard
                    title="Total Revenue"
                    value={kpi.totalRevenue}
                    icon={DollarSign}
                    format="currency"
                    colorClass="text-green-400"
                />
                <KPICard
                    title="Pending Revenue"
                    value={kpi.pendingRevenue}
                    icon={Clock}
                    format="currency"
                    colorClass="text-yellow-400"
                />
                <KPICard
                    title="Job Success Rate"
                    value={kpi.jobSuccessRate}
                    icon={CheckCircle}
                    format="percentage"
                    colorClass="text-blue-400"
                />
                <KPICard
                    title="New Leads (This Month)"
                    value={kpi.newLeadsThisMonth}
                    icon={UserPlus}
                    format="number"
                    colorClass="text-purple-400"
                />
            </div>

            {/* Charts */}
            <AnalyticsCharts
                hasData={hasData}
                monthlyRevenue={revenueResult.data}
                serviceTypeRevenue={serviceResult.data}
                leadSources={leadsResult.data}
                technicianLeaderboard={techResult.data}
            />
        </div>
    );
}
