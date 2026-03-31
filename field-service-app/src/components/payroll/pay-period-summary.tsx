'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { getPayPeriodSummary } from '@/lib/actions/payroll';
import type { PayPeriodSummary as PayPeriodSummaryType } from '@/lib/validations/payroll';
import { toast } from 'sonner';
import {
    Download,
    FileJson,
    FileText,
    Loader2,
    Calendar,
    Users,
} from 'lucide-react';

export function PayPeriodSummary() {
    const [startDate, setStartDate] = useState(() => {
        // Default: start of current month
        const d = new Date();
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        return d.toISOString().slice(0, 10);
    });
    const [endDate, setEndDate] = useState(() => {
        return new Date().toISOString().slice(0, 10);
    });
    const [summaries, setSummaries] = useState<PayPeriodSummaryType[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const loadSummary = useCallback(async () => {
        setIsLoading(true);
        const result = await getPayPeriodSummary(
            new Date(startDate).toISOString(),
            new Date(endDate + 'T23:59:59Z').toISOString(),
            'json'
        );

        if (result.success && Array.isArray(result.data)) {
            setSummaries(result.data);
        } else if (!result.success) {
            toast.error(result.error);
        }
        setIsLoading(false);
    }, [startDate, endDate]);

    const handleExport = useCallback(
        async (format: 'json' | 'csv') => {
            const result = await getPayPeriodSummary(
                new Date(startDate).toISOString(),
                new Date(endDate + 'T23:59:59Z').toISOString(),
                format
            );

            if (!result.success) {
                toast.error(result.error);
                return;
            }

            const content =
                format === 'csv'
                    ? (result.data as string)
                    : JSON.stringify(result.data, null, 2);

            const blob = new Blob([content], {
                type: format === 'csv' ? 'text/csv' : 'application/json',
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `payroll_${startDate}_${endDate}.${format}`;
            a.click();
            URL.revokeObjectURL(url);

            toast.success(`Exported as ${format.toUpperCase()}`);
        },
        [startDate, endDate]
    );

    // Totals
    const totals = summaries.reduce(
        (acc, s) => ({
            regular: acc.regular + s.total_regular_hours,
            overtime: acc.overtime + s.total_overtime_hours,
            travel: acc.travel + s.total_travel_hours,
            pay: acc.pay + s.total_gross_pay,
            entries: acc.entries + s.entry_count,
        }),
        { regular: 0, overtime: 0, travel: 0, pay: 0, entries: 0 }
    );

    return (
        <div className="space-y-4">
            {/* Controls */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
                    <div className="flex-1 grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">
                                <Calendar className="w-3 h-3 inline mr-1" />
                                Start Date
                            </label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">
                                <Calendar className="w-3 h-3 inline mr-1" />
                                End Date
                            </label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
                            />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            onClick={loadSummary}
                            disabled={isLoading}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            {isLoading ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <Users className="w-4 h-4 mr-2" />
                            )}
                            Generate
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => handleExport('csv')}
                            disabled={summaries.length === 0}
                            className="border-slate-600"
                        >
                            <FileText className="w-4 h-4 mr-1" />
                            CSV
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => handleExport('json')}
                            disabled={summaries.length === 0}
                            className="border-slate-600"
                        >
                            <FileJson className="w-4 h-4 mr-1" />
                            JSON
                        </Button>
                    </div>
                </div>
            </div>

            {/* Summary Table */}
            {summaries.length > 0 && (
                <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-700">
                                <th className="p-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    Employee
                                </th>
                                <th className="p-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    Rate
                                </th>
                                <th className="p-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    Regular Hrs
                                </th>
                                <th className="p-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    OT Hrs
                                </th>
                                <th className="p-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider hidden sm:table-cell">
                                    Travel Hrs
                                </th>
                                <th className="p-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    Gross Pay
                                </th>
                                <th className="p-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider hidden md:table-cell">
                                    Entries
                                </th>
                                <th className="p-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider hidden md:table-cell">
                                    Pending
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {summaries.map((s) => (
                                <tr
                                    key={s.user_id}
                                    className="hover:bg-slate-700/30 transition-colors"
                                >
                                    <td className="p-3 text-sm font-medium text-white">
                                        {s.full_name}
                                    </td>
                                    <td className="p-3 text-sm text-slate-300 font-mono">
                                        ${s.base_rate.toFixed(2)}
                                    </td>
                                    <td className="p-3 text-sm text-slate-300 font-mono">
                                        {s.total_regular_hours.toFixed(2)}
                                    </td>
                                    <td className="p-3 text-sm font-mono">
                                        <span
                                            className={
                                                s.total_overtime_hours > 0
                                                    ? 'text-amber-400'
                                                    : 'text-slate-300'
                                            }
                                        >
                                            {s.total_overtime_hours.toFixed(2)}
                                        </span>
                                    </td>
                                    <td className="p-3 text-sm text-blue-400 font-mono hidden sm:table-cell">
                                        {s.total_travel_hours.toFixed(2)}
                                    </td>
                                    <td className="p-3 text-sm text-emerald-400 font-bold font-mono">
                                        ${s.total_gross_pay.toFixed(2)}
                                    </td>
                                    <td className="p-3 text-sm text-slate-400 hidden md:table-cell">
                                        {s.entry_count}
                                    </td>
                                    <td className="p-3 hidden md:table-cell">
                                        {s.pending_count > 0 ? (
                                            <span className="px-2 py-0.5 rounded-full text-xs bg-amber-500/20 text-amber-400">
                                                {s.pending_count}
                                            </span>
                                        ) : (
                                            <span className="text-sm text-slate-500">0</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="border-t-2 border-slate-600 bg-slate-700/30">
                                <td className="p-3 text-sm font-bold text-white">
                                    Total
                                </td>
                                <td className="p-3" />
                                <td className="p-3 text-sm text-white font-mono font-bold">
                                    {totals.regular.toFixed(2)}
                                </td>
                                <td className="p-3 text-sm text-amber-400 font-mono font-bold">
                                    {totals.overtime.toFixed(2)}
                                </td>
                                <td className="p-3 text-sm text-blue-400 font-mono font-bold hidden sm:table-cell">
                                    {totals.travel.toFixed(2)}
                                </td>
                                <td className="p-3 text-sm text-emerald-400 font-mono font-bold">
                                    ${totals.pay.toFixed(2)}
                                </td>
                                <td className="p-3 text-sm text-slate-400 hidden md:table-cell">
                                    {totals.entries}
                                </td>
                                <td className="p-3 hidden md:table-cell" />
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}

            {summaries.length === 0 && !isLoading && (
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
                    <Download className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400">
                        Select a date range and click Generate to view the pay period
                        summary
                    </p>
                </div>
            )}
        </div>
    );
}
