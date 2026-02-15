'use client';

import { memo } from 'react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import type { MonthlyRevenue } from '@/lib/validations/analytics';

interface RevenueAreaChartProps {
    data: MonthlyRevenue[];
}

function RevenueAreaChartComponent({ data }: RevenueAreaChartProps) {
    if (data.length === 0) {
        return null;
    }

    return (
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">Monthly Revenue</h3>
            <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                        data={data}
                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                        <defs>
                            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis
                            dataKey="monthLabel"
                            tick={{ fill: '#94A3B8', fontSize: 12 }}
                            axisLine={{ stroke: '#475569' }}
                            tickLine={{ stroke: '#475569' }}
                        />
                        <YAxis
                            tick={{ fill: '#94A3B8', fontSize: 12 }}
                            axisLine={{ stroke: '#475569' }}
                            tickLine={{ stroke: '#475569' }}
                            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#1E293B',
                                border: '1px solid #475569',
                                borderRadius: '8px',
                                color: '#F8FAFC',
                            }}
                            formatter={(value: any) => [
                                new Intl.NumberFormat('en-US', {
                                    style: 'currency',
                                    currency: 'USD',
                                }).format(Number(value)),
                                'Revenue',
                            ]}
                            labelStyle={{ color: '#94A3B8' }}
                        />
                        <Area
                            type="monotone"
                            dataKey="totalRevenue"
                            stroke="#3B82F6"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#revenueGradient)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

export const RevenueAreaChart = memo(RevenueAreaChartComponent);
