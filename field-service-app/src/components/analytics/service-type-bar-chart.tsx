'use client';

import { memo } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
} from 'recharts';
import type { ServiceTypeRevenue } from '@/lib/validations/analytics';
import { SERVICE_TYPE_COLORS } from '@/lib/validations/analytics';

interface ServiceTypeBarChartProps {
    data: ServiceTypeRevenue[];
}

function ServiceTypeBarChartComponent({ data }: ServiceTypeBarChartProps) {
    if (data.length === 0) {
        return null;
    }

    return (
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">Revenue by Service Type</h3>
            <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={data}
                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                        layout="vertical"
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                        <XAxis
                            type="number"
                            tick={{ fill: '#94A3B8', fontSize: 12 }}
                            axisLine={{ stroke: '#475569' }}
                            tickLine={{ stroke: '#475569' }}
                            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                        />
                        <YAxis
                            dataKey="serviceTypeLabel"
                            type="category"
                            tick={{ fill: '#94A3B8', fontSize: 12 }}
                            axisLine={{ stroke: '#475569' }}
                            tickLine={{ stroke: '#475569' }}
                            width={80}
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
                        <Bar dataKey="totalRevenue" radius={[0, 4, 4, 0]}>
                            {data.map((entry) => (
                                <Cell
                                    key={entry.serviceType}
                                    fill={SERVICE_TYPE_COLORS[entry.serviceType] || '#6B7280'}
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

export const ServiceTypeBarChart = memo(ServiceTypeBarChartComponent);
