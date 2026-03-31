'use client';

import { Button } from '@/components/ui/button';
import type { TimeEntryWithDetails, TimeEntryStatus } from '@/lib/validations/payroll';
import {
    CheckCircle,
    XCircle,
    AlertTriangle,
    Clock,
    Car,
    Wrench,
    ChevronDown,
} from 'lucide-react';

interface PayrollAuditTableProps {
    entries: TimeEntryWithDetails[];
    selectedIds: Set<string>;
    onSelectionChange: (ids: Set<string>) => void;
    onEntryClick: (entry: TimeEntryWithDetails) => void;
    onBulkAction: (action: 'approved' | 'rejected') => void;
    statusFilter: string;
    onStatusFilterChange: (status: string) => void;
}

const statusColors: Record<TimeEntryStatus, string> = {
    pending: 'bg-amber-500/20 text-amber-400',
    approved: 'bg-green-500/20 text-green-400',
    rejected: 'bg-red-500/20 text-red-400',
    manual_review: 'bg-purple-500/20 text-purple-400',
};

const statusLabels: Record<TimeEntryStatus, string> = {
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    manual_review: 'Manual Review',
};

export function PayrollAuditTable({
    entries,
    selectedIds,
    onSelectionChange,
    onEntryClick,
    onBulkAction,
    statusFilter,
    onStatusFilterChange,
}: PayrollAuditTableProps) {
    const toggleSelect = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        onSelectionChange(next);
    };

    const toggleAll = () => {
        if (selectedIds.size === entries.length) {
            onSelectionChange(new Set());
        } else {
            onSelectionChange(new Set(entries.map((e) => e.id)));
        }
    };

    // Group entries by job
    const grouped = entries.reduce<Record<string, TimeEntryWithDetails[]>>(
        (acc, entry) => {
            const key = entry.job_id || 'unassigned';
            if (!acc[key]) acc[key] = [];
            acc[key].push(entry);
            return acc;
        },
        {}
    );

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-800 rounded-xl border border-slate-700 p-4">
                <div className="flex items-center gap-3">
                    {/* Status filter */}
                    <div className="relative">
                        <select
                            value={statusFilter}
                            onChange={(e) => onStatusFilterChange(e.target.value)}
                            className="appearance-none bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 pr-8 text-sm text-white"
                        >
                            <option value="">All Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="manual_review">Manual Review</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2 top-2.5 pointer-events-none" />
                    </div>
                    <span className="text-sm text-slate-400">
                        {entries.length} entries
                    </span>
                </div>

                {/* Bulk actions */}
                {selectedIds.size > 0 && (
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-300">
                            {selectedIds.size} selected
                        </span>
                        <Button
                            size="sm"
                            onClick={() => onBulkAction('approved')}
                            className="bg-green-600 hover:bg-green-700 text-white"
                        >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Approve
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onBulkAction('rejected')}
                            className="border-red-500/50 text-red-400 hover:bg-red-500/20"
                        >
                            <XCircle className="w-4 h-4 mr-1" />
                            Reject
                        </Button>
                    </div>
                )}
            </div>

            {/* Table */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-slate-700">
                            <th className="p-3 text-left">
                                <input
                                    type="checkbox"
                                    checked={
                                        entries.length > 0 &&
                                        selectedIds.size === entries.length
                                    }
                                    onChange={toggleAll}
                                    className="rounded border-slate-600"
                                />
                            </th>
                            <th className="p-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                                Employee
                            </th>
                            <th className="p-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider hidden md:table-cell">
                                Job
                            </th>
                            <th className="p-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                                Type
                            </th>
                            <th className="p-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                                Hours
                            </th>
                            <th className="p-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider hidden sm:table-cell">
                                Cost
                            </th>
                            <th className="p-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                                Status
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                        {entries.map((entry) => (
                            <tr
                                key={entry.id}
                                className="hover:bg-slate-700/30 cursor-pointer transition-colors"
                                onClick={() => onEntryClick(entry)}
                            >
                                <td
                                    className="p-3"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.has(entry.id)}
                                        onChange={() => toggleSelect(entry.id)}
                                        className="rounded border-slate-600"
                                    />
                                </td>
                                <td className="p-3">
                                    <div className="text-sm font-medium text-white">
                                        {entry.user?.full_name || 'Unknown'}
                                    </div>
                                    <div className="text-xs text-slate-400">
                                        {new Date(entry.clock_in_at).toLocaleDateString()}
                                    </div>
                                </td>
                                <td className="p-3 hidden md:table-cell">
                                    <div className="text-sm text-slate-300 max-w-[200px] truncate">
                                        {entry.job?.title ||
                                            entry.job_snapshot?.title ||
                                            '—'}
                                    </div>
                                </td>
                                <td className="p-3">
                                    {entry.is_travel_time ? (
                                        <span className="flex items-center gap-1 text-xs text-blue-400">
                                            <Car className="w-3 h-3" />
                                            Travel
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1 text-xs text-amber-400">
                                            <Wrench className="w-3 h-3" />
                                            Wrench
                                        </span>
                                    )}
                                </td>
                                <td className="p-3">
                                    <span className="text-sm text-white font-mono">
                                        {entry.total_hours
                                            ? entry.total_hours.toFixed(2)
                                            : entry.clock_out_at
                                            ? '—'
                                            : '⏱️'}
                                    </span>
                                    {entry.flagged_reason && (
                                        <AlertTriangle className="w-3 h-3 text-amber-400 inline ml-1" />
                                    )}
                                </td>
                                <td className="p-3 hidden sm:table-cell">
                                    <span className="text-sm text-emerald-400 font-mono">
                                        {entry.gross_pay
                                            ? `$${entry.gross_pay.toFixed(2)}`
                                            : '—'}
                                    </span>
                                </td>
                                <td className="p-3">
                                    <span
                                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                                            statusColors[entry.status]
                                        }`}
                                    >
                                        {entry.status === 'manual_review' && (
                                            <AlertTriangle className="w-3 h-3" />
                                        )}
                                        {entry.status === 'pending' && (
                                            <Clock className="w-3 h-3" />
                                        )}
                                        {statusLabels[entry.status]}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {entries.length === 0 && (
                    <div className="p-12 text-center text-slate-400">
                        No time entries found
                    </div>
                )}
            </div>
        </div>
    );
}
