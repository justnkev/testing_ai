'use client';

import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Cell,
    ReferenceLine,
} from 'recharts';
import type { ProfitabilityOverview } from '@/lib/validations/profitability';
import { TrendingUp } from 'lucide-react';

interface ProfitabilityChartProps {
    data: ProfitabilityOverview[];
}

export function ProfitabilityChart({ data }: ProfitabilityChartProps) {
    const chartData = data.map((row) => ({
        name: row.job_title.length > 18 ? row.job_title.slice(0, 18) + '…' : row.job_title,
        'Estimated Revenue': Number(row.total_revenue),
        'Labor Cost': Number(row.total_labor_cost),
        'Material Cost': Number(row.total_material_cost),
        isOverBudget: row.is_over_budget,
        margin: Number(row.gross_margin_pct),
    }));

    const formatCurrency = (value: number) =>
        `$${value.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload?.length) return null;
        const row = payload[0]?.payload;
        return (
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl text-sm">
                <p className="text-white font-medium mb-2">{label}</p>
                <div className="space-y-1">
                    <p className="text-cyan-400">Revenue: {formatCurrency(row['Estimated Revenue'])}</p>
                    <p className="text-orange-400">Labor: {formatCurrency(row['Labor Cost'])}</p>
                    <p className="text-purple-400">Materials: {formatCurrency(row['Material Cost'])}</p>
                    <div className="border-t border-slate-700 pt-1 mt-1">
                        <p className={row.isOverBudget ? 'text-red-400 font-medium' : 'text-green-400 font-medium'}>
                            Margin: {row.margin.toFixed(1)}%
                            {row.isOverBudget && ' ⚠️ Over Budget'}
                        </p>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-5">
            <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-cyan-400" />
                <h3 className="text-white font-semibold text-lg">Estimated vs. Actual Costs</h3>
            </div>
            {chartData.length === 0 ? (
                <div className="h-[320px] flex items-center justify-center text-slate-500">
                    No profitability data yet. Jobs with estimates or logged costs will appear here.
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={320}>
                    <BarChart
                        data={chartData}
                        margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                        barCategoryGap="20%"
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis
                            dataKey="name"
                            tick={{ fill: '#94a3b8', fontSize: 11 }}
                            axisLine={{ stroke: '#475569' }}
                            tickLine={false}
                            interval={0}
                            angle={-20}
                            textAnchor="end"
                            height={60}
                        />
                        <YAxis
                            tick={{ fill: '#94a3b8', fontSize: 11 }}
                            axisLine={{ stroke: '#475569' }}
                            tickLine={false}
                            tickFormatter={formatCurrency}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend
                            wrapperStyle={{ fontSize: 12, color: '#94a3b8' }}
                        />
                        <Bar dataKey="Estimated Revenue" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Labor Cost" fill="#f97316" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Material Cost" fill="#a855f7" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            )}
        </div>
    );
}
