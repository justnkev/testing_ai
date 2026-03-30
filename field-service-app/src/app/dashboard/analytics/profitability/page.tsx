import { Suspense } from 'react';
import { DollarSign, TrendingUp, AlertTriangle, BarChart3, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { getProfitabilityOverview } from '@/lib/actions/profitability';
import { ProfitabilityChart } from '@/components/analytics/profitability-chart';
import { ProfitabilityTable } from '@/components/analytics/profitability-table';

export const dynamic = 'force-dynamic';

export default async function ProfitabilityPage() {
    const result = await getProfitabilityOverview(15);
    const overview = result.success && result.data ? result.data.overview : [];
    const kpis = result.success && result.data
        ? result.data.kpis
        : { total_revenue: 0, total_costs: 0, average_margin_pct: 0, over_budget_count: 0, job_count: 0 };

    return (
        <div className="p-4 md:p-8 space-y-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Link
                        href="/dashboard/analytics"
                        className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center hover:bg-slate-700 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-slate-400" />
                    </Link>
                    <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/25">
                        <TrendingUp className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-white">Profitability</h1>
                        <p className="text-slate-400 text-sm">Gross margin analysis — Revenue vs. Labor + Materials</p>
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Revenue */}
                <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="w-4 h-4 text-cyan-400" />
                        <span className="text-slate-400 text-sm">Total Revenue</span>
                    </div>
                    <p className="text-2xl font-bold text-cyan-400">
                        ${kpis.total_revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">{kpis.job_count} jobs with data</p>
                </div>

                {/* Total Costs */}
                <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <BarChart3 className="w-4 h-4 text-orange-400" />
                        <span className="text-slate-400 text-sm">Total Costs</span>
                    </div>
                    <p className="text-2xl font-bold text-orange-400">
                        ${kpis.total_costs.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Labor + Materials</p>
                </div>

                {/* Average Margin */}
                <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-green-400" />
                        <span className="text-slate-400 text-sm">Avg. Margin</span>
                    </div>
                    <p className={`text-2xl font-bold ${
                        kpis.average_margin_pct > 30 ? 'text-green-400' :
                        kpis.average_margin_pct > 0 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                        {kpis.average_margin_pct.toFixed(1)}%
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Across all tracked jobs</p>
                </div>

                {/* Over Budget */}
                <div className={`rounded-xl border p-4 ${
                    kpis.over_budget_count > 0
                        ? 'bg-red-500/10 border-red-500/30'
                        : 'bg-slate-800/50 border-slate-700'
                }`}>
                    <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className={`w-4 h-4 ${kpis.over_budget_count > 0 ? 'text-red-400' : 'text-slate-500'}`} />
                        <span className="text-slate-400 text-sm">Over Budget</span>
                    </div>
                    <p className={`text-2xl font-bold ${kpis.over_budget_count > 0 ? 'text-red-400' : 'text-slate-300'}`}>
                        {kpis.over_budget_count}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                        {kpis.over_budget_count > 0 ? 'Jobs exceeding estimated cost' : 'All jobs within budget'}
                    </p>
                </div>
            </div>

            {/* Chart */}
            <ProfitabilityChart data={overview} />

            {/* Table */}
            <ProfitabilityTable data={overview} />
        </div>
    );
}
