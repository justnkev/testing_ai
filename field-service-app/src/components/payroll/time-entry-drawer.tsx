'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { bulkUpdateEntryStatus } from '@/lib/actions/payroll';
import type { TimeEntryWithDetails } from '@/lib/validations/payroll';
import { toast } from 'sonner';
import {
    X,
    Clock,
    MapPin,
    Car,
    Wrench,
    DollarSign,
    AlertTriangle,
    CheckCircle,
    XCircle,
    User,
    Loader2,
} from 'lucide-react';

interface TimeEntryDrawerProps {
    entry: TimeEntryWithDetails;
    onClose: () => void;
    onStatusChange: () => void;
}

export function TimeEntryDrawer({
    entry,
    onClose,
    onStatusChange,
}: TimeEntryDrawerProps) {
    const [isActioning, setIsActioning] = useState(false);
    const [notes, setNotes] = useState('');

    const handleAction = useCallback(
        async (action: 'approved' | 'rejected') => {
            setIsActioning(true);
            const result = await bulkUpdateEntryStatus(
                [entry.id],
                action,
                notes || undefined
            );
            if (result.success) {
                toast.success(`Entry ${action}`);
                onStatusChange();
                onClose();
            } else if (!result.success) {
                toast.error(result.error);
            }
            setIsActioning(false);
        },
        [entry.id, notes, onStatusChange, onClose]
    );

    const clockIn = new Date(entry.clock_in_at);
    const clockOut = entry.clock_out_at ? new Date(entry.clock_out_at) : null;

    // Get job title from live data or snapshot
    const jobTitle =
        entry.job?.title ||
        entry.job_snapshot?.title ||
        'Unlinked Job';
    const customerName =
        entry.job?.customer?.name ||
        entry.job_snapshot?.customer_name ||
        'Unknown';

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Drawer */}
            <div className="relative w-full max-w-md bg-slate-800 border-l border-slate-700 overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between z-10">
                    <h2 className="text-lg font-bold text-white">Entry Details</h2>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="text-slate-400 hover:text-white"
                    >
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Flag Warning */}
                    {entry.flagged_reason && (
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-start gap-2">
                            <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                            <div>
                                <p className="text-sm font-medium text-amber-400">
                                    {entry.flagged_reason === 'forgotten_clock_out'
                                        ? 'Forgotten Clock-Out'
                                        : entry.flagged_reason === 'overtime_warning'
                                        ? 'Overtime Warning'
                                        : entry.flagged_reason}
                                </p>
                                <p className="text-xs text-amber-400/70 mt-0.5">
                                    {entry.flagged_reason === 'forgotten_clock_out'
                                        ? 'This entry was open for more than 12 hours.'
                                        : 'Weekly hours exceed 40. Overtime rate was applied.'}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Employee */}
                    <Section icon={User} title="Employee">
                        <p className="text-white font-medium">
                            {entry.user?.full_name || 'Unknown'}
                        </p>
                        {entry.user?.base_hourly_rate && (
                            <p className="text-sm text-slate-400">
                                Base rate: ${entry.user.base_hourly_rate.toFixed(2)}/hr
                            </p>
                        )}
                    </Section>

                    {/* Job */}
                    <Section icon={Wrench} title="Job">
                        <p className="text-white">{jobTitle}</p>
                        <p className="text-sm text-slate-400">{customerName}</p>
                        {!entry.job && entry.job_snapshot && (
                            <p className="text-xs text-amber-400/70 mt-1">
                                ℹ️ Showing snapshot — original job was archived
                            </p>
                        )}
                    </Section>

                    {/* Time */}
                    <Section icon={Clock} title="Time">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs text-slate-400 mb-1">Clock In</p>
                                <p className="text-white text-sm">
                                    {clockIn.toLocaleDateString()}
                                </p>
                                <p className="text-white text-sm font-mono">
                                    {clockIn.toLocaleTimeString()}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-400 mb-1">Clock Out</p>
                                {clockOut ? (
                                    <>
                                        <p className="text-white text-sm">
                                            {clockOut.toLocaleDateString()}
                                        </p>
                                        <p className="text-white text-sm font-mono">
                                            {clockOut.toLocaleTimeString()}
                                        </p>
                                    </>
                                ) : (
                                    <p className="text-amber-400 text-sm">Still clocked in</p>
                                )}
                            </div>
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                            {entry.is_travel_time ? (
                                <span className="flex items-center gap-1 text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full">
                                    <Car className="w-3 h-3" />
                                    Travel Time
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 text-xs bg-amber-500/20 text-amber-400 px-2 py-1 rounded-full">
                                    <Wrench className="w-3 h-3" />
                                    Wrench Time
                                </span>
                            )}
                        </div>
                    </Section>

                    {/* Cost Breakdown */}
                    <Section icon={DollarSign} title="Cost Breakdown">
                        <div className="space-y-2">
                            <Row label="Total Hours" value={entry.total_hours?.toFixed(2) || '—'} />
                            <Row
                                label="Applied Rate"
                                value={
                                    entry.applied_rate
                                        ? `$${entry.applied_rate.toFixed(2)}/hr`
                                        : '—'
                                }
                            />
                            <Row
                                label="Multiplier"
                                value={
                                    entry.applied_multiplier
                                        ? `${entry.applied_multiplier}×`
                                        : '—'
                                }
                            />
                            <div className="pt-2 border-t border-slate-700">
                                <Row
                                    label="Gross Pay"
                                    value={
                                        entry.gross_pay
                                            ? `$${entry.gross_pay.toFixed(2)}`
                                            : '—'
                                    }
                                    bold
                                />
                            </div>
                        </div>
                    </Section>

                    {/* Location */}
                    {(entry.clock_in_latitude || entry.clock_out_latitude) && (
                        <Section icon={MapPin} title="Location">
                            <div className="grid grid-cols-2 gap-4 text-xs text-slate-400">
                                {entry.clock_in_latitude && (
                                    <div>
                                        <p className="mb-0.5 text-slate-500">Clock In</p>
                                        <p>
                                            {entry.clock_in_latitude.toFixed(5)},{' '}
                                            {entry.clock_in_longitude?.toFixed(5)}
                                        </p>
                                    </div>
                                )}
                                {entry.clock_out_latitude && (
                                    <div>
                                        <p className="mb-0.5 text-slate-500">Clock Out</p>
                                        <p>
                                            {entry.clock_out_latitude.toFixed(5)},{' '}
                                            {entry.clock_out_longitude?.toFixed(5)}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </Section>
                    )}

                    {/* Review Info */}
                    {entry.reviewed_by && (
                        <Section icon={CheckCircle} title="Review">
                            <p className="text-sm text-slate-300">
                                Reviewed at{' '}
                                {entry.reviewed_at
                                    ? new Date(entry.reviewed_at).toLocaleString()
                                    : '—'}
                            </p>
                            {entry.review_notes && (
                                <p className="text-sm text-slate-400 mt-1">
                                    {entry.review_notes}
                                </p>
                            )}
                        </Section>
                    )}

                    {/* Action Buttons */}
                    {(entry.status === 'pending' || entry.status === 'manual_review') && (
                        <div className="space-y-3 pt-4 border-t border-slate-700">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">
                                    Review Notes (optional)
                                </label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Add a note..."
                                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white resize-none"
                                    rows={2}
                                />
                            </div>
                            <div className="flex gap-3">
                                <Button
                                    onClick={() => handleAction('approved')}
                                    disabled={isActioning}
                                    className="flex-1 bg-green-600 hover:bg-green-700"
                                >
                                    {isActioning ? (
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                        <CheckCircle className="w-4 h-4 mr-2" />
                                    )}
                                    Approve
                                </Button>
                                <Button
                                    onClick={() => handleAction('rejected')}
                                    disabled={isActioning}
                                    variant="outline"
                                    className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/20"
                                >
                                    <XCircle className="w-4 h-4 mr-2" />
                                    Reject
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Helper Components ──────────────────────────────────────────

function Section({
    icon: Icon,
    title,
    children,
}: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div>
            <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4 text-slate-400" />
                <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                    {title}
                </h3>
            </div>
            <div className="pl-6">{children}</div>
        </div>
    );
}

function Row({
    label,
    value,
    bold,
}: {
    label: string;
    value: string;
    bold?: boolean;
}) {
    return (
        <div className="flex justify-between items-center">
            <span className="text-sm text-slate-400">{label}</span>
            <span
                className={`text-sm font-mono ${
                    bold ? 'text-emerald-400 font-bold text-base' : 'text-white'
                }`}
            >
                {value}
            </span>
        </div>
    );
}
