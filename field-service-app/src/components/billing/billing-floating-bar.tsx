'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Loader2, Receipt, Send } from 'lucide-react';
import { BillingDashboardRecord } from '@/lib/actions/billing';

interface BillingFloatingBarProps {
    selectedRows: BillingDashboardRecord[];
    onBillRun: (jobsToBill: string[]) => void;
    isProcessing: boolean;
}

export function BillingFloatingBar({
    selectedRows,
    onBillRun,
    isProcessing,
}: BillingFloatingBarProps) {
    if (selectedRows.length === 0) return null;

    // Filter to see what we can do
    const unbilledJobs = selectedRows.filter(r => r.record_type === 'unbilled_job');
    const draftInvoices = selectedRows.filter(r => r.record_type === 'invoice' && r.status === 'draft');

    const canBillRun = unbilledJobs.length > 0;
    const canSendInvoices = draftInvoices.length > 0;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-6 py-4 bg-slate-800 border border-slate-700 shadow-2xl rounded-full"
            >
                <div className="flex flex-col items-center justify-center mr-4">
                    <span className="text-sm font-semibold text-white">
                        {selectedRows.length} Selected
                    </span>
                    <span className="text-xs text-slate-400">
                        {unbilledJobs.length} Unbilled, {draftInvoices.length} Draft
                    </span>
                </div>

                <div className="h-8 w-px bg-slate-700" />

                {canBillRun && (
                    <Button
                        onClick={() => onBillRun(unbilledJobs.map(j => j.job_id))}
                        disabled={isProcessing}
                        className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-6 gap-2 shadow-lg shadow-blue-900/20"
                    >
                        {isProcessing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Receipt className="w-4 h-4" />
                        )}
                        Generate Invoices ({unbilledJobs.length})
                    </Button>
                )}

                {canSendInvoices && (
                    <Button
                        onClick={() => {
                            // TODO: Add bulk send feature
                            alert('Batch Send functionality not yet implemented.');
                        }}
                        disabled={isProcessing}
                        variant="secondary"
                        className="bg-slate-700 hover:bg-slate-600 text-white rounded-full px-6 gap-2"
                    >
                        <Send className="w-4 h-4" />
                        Send Invoices ({draftInvoices.length})
                    </Button>
                )}
            </motion.div>
        </AnimatePresence>
    );
}
