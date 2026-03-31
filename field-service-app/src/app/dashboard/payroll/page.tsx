'use client';

import { useState, useEffect, useCallback } from 'react';
import { PayrollAuditTable } from '@/components/payroll/payroll-audit-table';
import { PayPeriodSummary } from '@/components/payroll/pay-period-summary';
import { TimeEntryDrawer } from '@/components/payroll/time-entry-drawer';
import { getPayrollAuditData, bulkUpdateEntryStatus } from '@/lib/actions/payroll';
import type { TimeEntryWithDetails } from '@/lib/validations/payroll';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    DollarSign,
    ClipboardCheck,
    FileText,
    Loader2,
    Shield,
    Clock,
} from 'lucide-react';
import { ManualTimeEntryModal } from '@/components/payroll/manual-time-entry-modal';

export default function PayrollPage() {
    const [entries, setEntries] = useState<TimeEntryWithDetails[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [selectedEntry, setSelectedEntry] = useState<TimeEntryWithDetails | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);

    // Fetch data
    const loadData = useCallback(async () => {
        setIsLoading(true);
        const result = await getPayrollAuditData(
            statusFilter ? { status: statusFilter } : undefined
        );
        if (result.success && result.data) {
            setEntries(result.data);
        } else if (!result.success) {
            toast.error(result.error);
        }
        setIsLoading(false);
    }, [statusFilter]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Bulk actions
    const handleBulkAction = useCallback(
        async (action: 'approved' | 'rejected') => {
            if (selectedIds.size === 0) {
                toast.warning('Select at least one entry');
                return;
            }

            const result = await bulkUpdateEntryStatus(
                Array.from(selectedIds),
                action,
            );

            if (result.success) {
                toast.success(
                    `${result.data?.updated || selectedIds.size} entries ${action}`
                );
                setSelectedIds(new Set());
                loadData();
            } else if (!result.success) {
                toast.error(result.error);
            }
        },
        [selectedIds, loadData]
    );

    // Stats
    const pendingCount = entries.filter((e) => e.status === 'pending').length;
    const flaggedCount = entries.filter((e) => e.flagged_reason).length;
    const totalHours = entries.reduce((sum, e) => sum + (e.total_hours || 0), 0);
    const totalPay = entries.reduce((sum, e) => sum + (e.gross_pay || 0), 0);

    return (
        <div className="p-6 space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <DollarSign className="w-7 h-7 text-emerald-400" />
                        Payroll
                    </h1>
                    <p className="text-slate-400 mt-1">
                        Review time entries, approve hours, and export pay period summaries
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsManualEntryOpen(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-sm font-medium rounded-lg transition-all border border-slate-700 whitespace-nowrap"
                    >
                        <Clock className="w-4 h-4" />
                        Add Time Entry
                    </button>
                    <a
                        href="/dashboard/payroll/compliance"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-sm font-medium rounded-lg transition-all shadow-lg shadow-amber-500/20 whitespace-nowrap"
                    >
                        <Shield className="w-4 h-4" />
                        Compliance
                    </a>
                </div>
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Pending" value={pendingCount} color="amber" />
                <StatCard label="Flagged" value={flaggedCount} color="red" />
                <StatCard
                    label="Total Hours"
                    value={totalHours.toFixed(1)}
                    color="blue"
                />
                <StatCard
                    label="Gross Pay"
                    value={`$${totalPay.toFixed(2)}`}
                    color="emerald"
                />
            </div>

            {/* Tabs */}
            <Tabs defaultValue="audit" className="space-y-4">
                <TabsList className="bg-slate-800 border border-slate-700">
                    <TabsTrigger
                        value="audit"
                        className="text-slate-400 data-[state=active]:bg-slate-700 data-[state=active]:text-white"
                    >
                        <ClipboardCheck className="w-4 h-4 mr-2" />
                        Audit & Approve
                    </TabsTrigger>
                    <TabsTrigger
                        value="summary"
                        className="text-slate-400 data-[state=active]:bg-slate-700 data-[state=active]:text-white"
                    >
                        <FileText className="w-4 h-4 mr-2" />
                        Pay Period Summary
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="audit">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                        </div>
                    ) : (
                        <PayrollAuditTable
                            entries={entries}
                            selectedIds={selectedIds}
                            onSelectionChange={setSelectedIds}
                            onEntryClick={setSelectedEntry}
                            onBulkAction={handleBulkAction}
                            statusFilter={statusFilter}
                            onStatusFilterChange={setStatusFilter}
                        />
                    )}
                </TabsContent>

                <TabsContent value="summary">
                    <PayPeriodSummary />
                </TabsContent>
            </Tabs>

            {/* Entry detail drawer */}
            {selectedEntry && (
                <TimeEntryDrawer
                    entry={selectedEntry}
                    onClose={() => setSelectedEntry(null)}
                    onStatusChange={loadData}
                />
            )}

            {/* Manual Time Entry Modal */}
            {isManualEntryOpen && (
                <ManualTimeEntryModal 
                    onClose={() => {
                        setIsManualEntryOpen(false);
                        loadData();
                    }} 
                />
            )}
        </div>
    );
}

// ── Stat Card ────────────────────────────────────────────────────
function StatCard({
    label,
    value,
    color,
}: {
    label: string;
    value: string | number;
    color: string;
}) {
    const colorMap: Record<string, string> = {
        amber: 'from-amber-500/10 to-amber-600/5 border-amber-500/20 text-amber-400',
        red: 'from-red-500/10 to-red-600/5 border-red-500/20 text-red-400',
        blue: 'from-blue-500/10 to-blue-600/5 border-blue-500/20 text-blue-400',
        emerald:
            'from-emerald-500/10 to-emerald-600/5 border-emerald-500/20 text-emerald-400',
    };

    return (
        <div
            className={`rounded-xl border bg-gradient-to-br p-4 ${
                colorMap[color] || colorMap.blue
            }`}
        >
            <p className="text-xs text-slate-400 mb-1">{label}</p>
            <p className={`text-2xl font-bold ${colorMap[color]?.split(' ').pop()}`}>
                {value}
            </p>
        </div>
    );
}
