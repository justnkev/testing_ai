'use client';

import { memo } from 'react';
import {
    PieChart,
    Pie,
    Cell,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from 'recharts';
import type { LeadSource } from '@/lib/validations/analytics';
import { LEAD_SOURCE_COLORS } from '@/lib/validations/analytics';

interface LeadSourceDonutChartProps {
    data: LeadSource[];
}

function LeadSourceDonutChartComponent({ data }: LeadSourceDonutChartProps) {
    if (data.length === 0) {
        return null;
    }

    const total = data.reduce((sum, item) => sum + item.customerCount, 0);

    return (
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">Lead Sources</h3>
            <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            dataKey="customerCount"
                            nameKey="leadSourceLabel"
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={2}
                        >
                            {data.map((entry) => (
                                <Cell
                                    key={entry.leadSource}
                                    fill={LEAD_SOURCE_COLORS[entry.leadSource] || '#6B7280'}
                                />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#1E293B',
                                border: '1px solid #475569',
                                borderRadius: '8px',
                                color: '#F8FAFC',
                            }}
                            formatter={(value: any, name: any) => [
                                `${value} (${Math.round((Number(value) / total) * 100)}%)`,
                                name,
                            ]}
                        />
                        <Legend
                            verticalAlign="bottom"
                            iconType="circle"
                            iconSize={10}
                            formatter={(value) => (
                                <span style={{ color: '#94A3B8', fontSize: 12 }}>{value}</span>
                            )}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

export const LeadSourceDonutChart = memo(LeadSourceDonutChartComponent);
