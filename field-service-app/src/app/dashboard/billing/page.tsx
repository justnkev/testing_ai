'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getBillingDashboardData, getBillingKPIs, processBillRun, batchSendInvoices, BillingDashboardRecord } from '@/lib/actions/billing';
import { BillingAnalyticsCards } from '@/components/billing/billing-analytics-cards';
import { BillingDataTable } from '@/components/billing/billing-data-table';
import { BillingFloatingBar } from '@/components/billing/billing-floating-bar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Receipt, FileText, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function BillingDashboardPage() {
    const queryClient = useQueryClient();
    const [selectedTab, setSelectedTab] = useState('all');
    const [selectedRows, setSelectedRows] = useState<BillingDashboardRecord[]>([]);

    // Queries
    const { data: billingData = [], isLoading: isDataLoading, error: dataError } = useQuery({
        queryKey: ['billing_dashboard_data'],
        queryFn: async () => {
            const res = await getBillingDashboardData();
            if (!res.success) throw new Error(res.error);
            return res.data || [];
        },
    });

    const { data: kpiData, isLoading: isKpiLoading } = useQuery({
        queryKey: ['billing_dashboard_kpis'],
        queryFn: async () => {
            const res = await getBillingKPIs();
            if (!res.success) throw new Error(res.error);
            return res.data || { total_receivables: 0, average_dso: 0, total_unbilled: 0 };
        },
    });

    // Mutations
    const billRunMutation = useMutation({
        mutationFn: async (jobIds: string[]) => {
            return await processBillRun(jobIds);
        },
        onSuccess: (res) => {
            if (res.success) {
                toast.success(`Successfully generated ${res.data?.generatedCount} draft invoice(s).`);
                if (res.data?.errors && res.data.errors.length > 0) {
                    res.data.errors.forEach(err => toast.error(err));
                }
                // Clear selection
                setSelectedRows([]);
                // Invalidate cache
                queryClient.invalidateQueries({ queryKey: ['billing_dashboard_data'] });
                queryClient.invalidateQueries({ queryKey: ['billing_dashboard_kpis'] });
            } else {
                toast.error(res.error || 'Failed to process bill run');
            }
        },
        onError: (err: any) => {
            toast.error(err.message || 'Error occurred during bill run.');
        }
    });

    const sendInvoicesMutation = useMutation({
        mutationFn: async (invoiceIds: string[]) => {
            return await batchSendInvoices(invoiceIds);
        },
        onSuccess: (res) => {
            if (!res.success) {
                toast.error(res.error || 'Failed to send invoices');
                return;
            }
            if (res.data) {
                const { sentCount, skippedCount, errors } = res.data;
                if (sentCount > 0) {
                    toast.success(`Successfully sent ${sentCount} invoice(s).`);
                }
                if (skippedCount > 0) {
                    toast.info(`Skipped ${skippedCount} non-draft invoice(s).`);
                }
                if (errors && errors.length > 0) {
                    errors.forEach((err: string) => toast.error(err));
                }
                // Clear selection
                setSelectedRows([]);
                // Invalidate cache
                queryClient.invalidateQueries({ queryKey: ['billing_dashboard_data'] });
                queryClient.invalidateQueries({ queryKey: ['billing_dashboard_kpis'] });
            }
        },
        onError: (err: any) => {
            toast.error(err.message || 'Error occurred during invoice send.');
        }
    });

    // Filtering
    const filteredData = useMemo(() => {
        if (selectedTab === 'all') return billingData;
        if (selectedTab === 'unbilled') return billingData.filter(r => r.record_type === 'unbilled_job');
        if (selectedTab === 'draft') return billingData.filter(r => r.status === 'draft');
        if (selectedTab === 'pending') return billingData.filter(r => r.status === 'sent' || r.status === 'pending');
        if (selectedTab === 'overdue') return billingData.filter(r => r.status === 'overdue');
        if (selectedTab === 'paid') return billingData.filter(r => r.payment_status === 'paid');
        return billingData;
    }, [billingData, selectedTab]);

    const exportToCSV = () => {
        if (filteredData.length === 0) {
            toast.info("No data to export based on current filters.");
            return;
        }

        const headers = ["ID", "Customer Name", "Record Type", "Status", "Payment Status", "Total Amount", "Balance Due", "Created At", "Due Date"];
        const csvRows = [headers.join(",")];

        for (const row of filteredData) {
            const values = [
                row.display_id || '',
                row.customer_name || '',
                row.record_type || '',
                row.status || '',
                row.payment_status || '',
                row.total_amount?.toString() || '0',
                row.balance_due?.toString() || '0',
                row.created_at ? new Date(row.created_at).toLocaleDateString() : '',
                row.due_date ? new Date(row.due_date).toLocaleDateString() : ''
            ];
            // Escape values that might have commas
            const escapedValues = values.map(v => `"${v?.replace(/"/g, '""') || ''}"`);
            csvRows.push(escapedValues.join(","));
        }

        const csvContent = csvRows.join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `AR_Report_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-2">
                        <Receipt className="w-8 h-8 text-blue-500" />
                        Billing & Accounts Receivable
                    </h1>
                    <p className="text-slate-400 mt-2">
                        Manage invoices, process bill runs, and track payment aging.
                    </p>
                </div>
                <div className="flex gap-3">
                    {/* Could add a manual "Create Invoice" button here */}
                    <Button 
                        variant="outline" 
                        onClick={exportToCSV}
                        className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700"
                    >
                        Export AR Report
                    </Button>
                </div>
            </div>

            {/* KPIs */}
            <BillingAnalyticsCards
                totalReceivables={kpiData?.total_receivables || 0}
                averageDSO={kpiData?.average_dso || 0}
                totalUnbilled={kpiData?.total_unbilled || 0}
                isLoading={isKpiLoading}
            />

            {/* Main Tabs and Content */}
            <Tabs defaultValue="all" value={selectedTab} onValueChange={setSelectedTab} className="w-full">
                <TabsList className="bg-slate-800/50 p-1 border border-slate-700">
                    <TabsTrigger value="all" className="text-slate-400 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                        All Records
                    </TabsTrigger>
                    <TabsTrigger value="unbilled" className="text-slate-400 data-[state=active]:bg-amber-500 data-[state=active]:text-white">
                        <FileText className="w-4 h-4 mr-2" />
                        Unbilled
                    </TabsTrigger>
                    <TabsTrigger value="draft" className="text-slate-400 data-[state=active]:bg-slate-600 data-[state=active]:text-white">
                        Draft
                    </TabsTrigger>
                    <TabsTrigger value="pending" className="text-slate-400 data-[state=active]:bg-indigo-500 data-[state=active]:text-white">
                        <Send className="w-4 h-4 mr-2" />
                        Sent / Pending
                    </TabsTrigger>
                    <TabsTrigger value="overdue" className="text-slate-400 data-[state=active]:bg-red-500 data-[state=active]:text-white">
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        Overdue
                    </TabsTrigger>
                    <TabsTrigger value="paid" className="text-slate-400 data-[state=active]:bg-emerald-500 data-[state=active]:text-white">
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Paid
                    </TabsTrigger>
                </TabsList>

                <div className="mt-6">
                    {dataError ? (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 flex items-center gap-3">
                            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                            <p>Failed to load billing data. Please try refreshing the page.</p>
                        </div>
                    ) : (
                        <TabsContent value={selectedTab} className="mt-0 focus-visible:outline-none focus-visible:ring-0">
                            {isDataLoading ? (
                                <div className="h-64 flex flex-col items-center justify-center bg-slate-800/20 border border-slate-700/50 rounded-xl">
                                    <Clock className="w-8 h-8 text-slate-500 animate-spin mb-4" />
                                    <p className="text-slate-400">Loading records...</p>
                                </div>
                            ) : (
                                <BillingDataTable 
                                    data={filteredData} 
                                    onRowSelectionChange={setSelectedRows} 
                                />
                            )}
                        </TabsContent>
                    )}
                </div>
            </Tabs>

            {/* Action Bar */}
            <BillingFloatingBar
                selectedRows={selectedRows}
                onBillRun={(jobIds) => billRunMutation.mutate(jobIds)}
                isProcessing={billRunMutation.isPending}
                onSendInvoices={(invoiceIds) => sendInvoicesMutation.mutate(invoiceIds)}
                isSending={sendInvoicesMutation.isPending}
            />
        </div>
    );
}

function Send({ className }: { className?: string }) {
    return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="22" x2="11" y1="2" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
}
