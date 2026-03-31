'use client';

import { AlertTriangle, CheckCircle, Users, Package } from 'lucide-react';
import type { ProfitabilityOverview } from '@/lib/validations/profitability';

interface ProfitabilityTableProps {
    data: ProfitabilityOverview[];
}

export function ProfitabilityTable({ data }: ProfitabilityTableProps) {
    const formatCurrency = (val: number) =>
        `$${Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            completed: 'bg-green-500/10 text-green-400 border-green-500/30',
            in_progress: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
            scheduled: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
            pending: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
        };
        return styles[status] || styles.pending;
    };

    return (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
            <div className="p-5 border-b border-slate-700">
                <h3 className="text-white font-semibold text-lg">Job Profitability Breakdown</h3>
                <p className="text-slate-400 text-sm mt-1">
                    Over-budget jobs are flagged and sorted to the top.
                </p>
            </div>

            {data.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                    No jobs with cost data found.
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-700 text-slate-400 text-left">
                                <th className="px-4 py-3 font-medium w-8"></th>
                                <th className="px-4 py-3 font-medium">Job</th>
                                <th className="px-4 py-3 font-medium">Customer</th>
                                <th className="px-4 py-3 font-medium text-right">Revenue</th>
                                <th className="px-4 py-3 font-medium text-right">Labor</th>
                                <th className="px-4 py-3 font-medium text-right">Materials</th>
                                <th className="px-4 py-3 font-medium text-right">Margin</th>
                                <th className="px-4 py-3 font-medium text-center">Invoice</th>
                                <th className="px-4 py-3 font-medium text-center">Job Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((row) => (
                                <tr
                                    key={row.job_id}
                                    className={`border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors ${
                                        row.is_over_budget ? 'bg-red-500/5' : ''
                                    }`}
                                >
                                    {/* Flag */}
                                    <td className="px-4 py-3 text-center">
                                        {row.is_over_budget ? (
                                            <AlertTriangle className="w-4 h-4 text-red-400 animate-pulse" />
                                        ) : (
                                            <CheckCircle className="w-4 h-4 text-green-500/50" />
                                        )}
                                    </td>

                                    {/* Job title */}
                                    <td className="px-4 py-3">
                                        <p className="text-white font-medium truncate max-w-[200px]">
                                            {row.job_title}
                                        </p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-slate-500 text-xs flex items-center gap-1">
                                                <Users className="w-3 h-3" /> {row.technician_count}
                                            </span>
                                            <span className="text-slate-500 text-xs flex items-center gap-1">
                                                <Package className="w-3 h-3" /> {row.parts_count}
                                            </span>
                                        </div>
                                    </td>

                                    {/* Customer */}
                                    <td className="px-4 py-3 text-slate-300">
                                        {row.customer_name}
                                    </td>

                                    {/* Revenue */}
                                    <td className="px-4 py-3 text-right text-cyan-400 font-medium">
                                        {formatCurrency(row.total_revenue)}
                                    </td>

                                    {/* Labor */}
                                    <td className="px-4 py-3 text-right text-orange-400">
                                        {formatCurrency(row.total_labor_cost)}
                                    </td>

                                    {/* Materials */}
                                    <td className="px-4 py-3 text-right text-purple-400">
                                        {formatCurrency(row.total_material_cost)}
                                    </td>

                                    {/* Margin */}
                                    <td className="px-4 py-3 text-right">
                                        <span
                                            className={`font-semibold ${
                                                row.is_over_budget
                                                    ? 'text-red-400'
                                                    : Number(row.gross_margin_pct) > 30
                                                        ? 'text-green-400'
                                                        : 'text-yellow-400'
                                            }`}
                                        >
                                            {Number(row.gross_margin_pct).toFixed(1)}%
                                        </span>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            {formatCurrency(row.gross_margin)}
                                        </p>
                                    </td>

                                    {/* Invoice Status */}
                                    <td className="px-4 py-3 text-center">
                                        {row.invoice_status ? (
                                            <div className="flex flex-col items-center gap-1">
                                                <span
                                                    className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                                                        row.invoice_status === 'paid'
                                                            ? 'bg-green-500/10 text-green-400 border-green-500/30'
                                                            : row.invoice_status === 'sent'
                                                            ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                                                            : row.invoice_status === 'partial'
                                                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                                            : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                                                    }`}
                                                >
                                                    {row.invoice_status.toUpperCase()}
                                                </span>
                                                {(row.invoice_status === 'sent' || row.invoice_status === 'partial') && row.invoice_balance_due !== null && row.invoice_balance_due > 0 && (
                                                    <span className="text-[10px] text-red-400 font-medium">
                                                        {formatCurrency(row.invoice_balance_due)}
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-xs text-slate-600">—</span>
                                        )}
                                    </td>

                                    {/* Job Status badge */}
                                    <td className="px-4 py-3 text-center">
                                        <span
                                            className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusBadge(
                                                row.job_status
                                            )}`}
                                        >
                                            {row.job_status.replace('_', ' ')}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
