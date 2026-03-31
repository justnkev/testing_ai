'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
    ArrowLeft, Save, Send, CheckCircle, Download, RefreshCw,
    Loader2, DollarSign, AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { updateInvoice, generateCostBasedInvoice, recordPartialPayment } from '@/lib/actions/invoices';
import { generateInvoicePDF } from '@/lib/pdf/invoice-pdf';

export default function InvoiceDetailsPage() {
    const router = useRouter();
    const params = useParams();
    const invoiceId = params.id as string;

    const [invoice, setInvoice] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [regenerating, setRegenerating] = useState(false);

    // Form State
    const [dueDate, setDueDate] = useState('');
    const [notes, setNotes] = useState('');
    const [paymentAmount, setPaymentAmount] = useState('');

    const fetchInvoice = useCallback(async () => {
        setLoading(true);
        const supabase = createClient();
        const { data, error } = await supabase
            .from('invoices')
            .select(`
                *,
                job:fs_jobs(
                    id, title, default_markup_pct,
                    customer:fs_customers(name, email, address, city, state, zip_code)
                )
            `)
            .eq('id', invoiceId)
            .single();

        if (error) {
            toast.error('Failed to load invoice');
            console.error(error);
        } else {
            setInvoice(data);
            if (data.due_date) setDueDate(new Date(data.due_date).toISOString().split('T')[0]);
            if (data.notes) setNotes(data.notes);
        }
        setLoading(false);
    }, [invoiceId]);

    useEffect(() => { fetchInvoice(); }, [fetchInvoice]);

    const handleSave = async () => {
        setSaving(true);
        const result = await updateInvoice(invoiceId, {
            due_date: dueDate ? new Date(dueDate).toISOString() : null,
            notes: notes || null,
        });
        if (result.success) toast.success('Invoice saved');
        else toast.error(result.error);
        setSaving(false);
    };

    const handleStatusChange = async (newStatus: string) => {
        const result = await updateInvoice(invoiceId, { status: newStatus });
        if (result.success) {
            toast.success(`Invoice marked as ${newStatus}`);
            setInvoice({ ...invoice, status: newStatus });
        } else {
            toast.error(result.error);
        }
    };

    const handleRecordPayment = async () => {
        if (!paymentAmount || Number(paymentAmount) <= 0) {
            toast.warning('Enter a valid payment amount');
            return;
        }
        const result = await recordPartialPayment(invoiceId, Number(paymentAmount));
        if (result.success) {
            toast.success('Payment recorded');
            setPaymentAmount('');
            fetchInvoice();
        } else {
            toast.error(result.error);
        }
    };

    const handleRegenerateFromActuals = async () => {
        if (!invoice?.job?.id) return;
        if (!confirm('This will create a new invoice from actual costs. Continue?')) return;

        setRegenerating(true);
        const result = await generateCostBasedInvoice(invoice.job.id, invoice.markup_pct || 0);
        if (result.success && result.data) {
            toast.success('New invoice generated from actuals');
            router.push(`/dashboard/invoices/${result.data.invoiceId}`);
        } else if (!result.success) {
            toast.error(result.error);
        }
        setRegenerating(false);
    };

    const handleDownloadPDF = async () => {
        if (!invoice) return;
        setDownloading(true);
        try {
            // Fetch business settings
            const supabase = createClient();
            const { data: settings } = await supabase
                .from('business_settings')
                .select('business_name, contact_email, contact_phone, logo_url')
                .limit(1)
                .maybeSingle();

            const customer = invoice.job?.customer || {};

            await generateInvoicePDF({
                invoiceNumber: invoice.invoice_number || `INV-${invoiceId.slice(0, 8)}`,
                status: invoice.status || 'draft',
                createdAt: invoice.created_at,
                dueDate: invoice.due_date,
                notes: invoice.notes,
                totalAmount: Number(invoice.total_amount),
                amountPaid: Number(invoice.amount_paid || 0),
                balanceDue: Number(invoice.balance_due ?? invoice.total_amount),
                markupPct: Number(invoice.markup_pct || 0),
                lineItems: invoice.line_items || [],
                customer: {
                    name: customer.name || 'Customer',
                    email: customer.email,
                    address: customer.address,
                    city: customer.city,
                    state: customer.state,
                    zip_code: customer.zip_code,
                },
                business: {
                    name: settings?.business_name || 'Company',
                    email: settings?.contact_email,
                    phone: settings?.contact_phone,
                    logo_url: settings?.logo_url,
                },
                jobTitle: invoice.job?.title || 'Job',
            });

            toast.success('PDF downloaded');
        } catch (err) {
            console.error('PDF generation error:', err);
            toast.error('Failed to generate PDF');
        }
        setDownloading(false);
    };

    if (loading) return <div className="p-8 text-slate-400">Loading invoice...</div>;
    if (!invoice) return <div className="p-8 text-slate-400">Invoice not found</div>;

    const customer = invoice.job?.customer;
    const balanceDue = invoice.balance_due ?? invoice.total_amount;
    const amountPaid = invoice.amount_paid || 0;

    return (
        <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link href={`/dashboard/jobs/${invoice.job_id}`}>
                        <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-slate-800">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                            {invoice.invoice_number}
                            <Badge variant="outline" className="text-lg py-1 text-slate-200">
                                {invoice.status}
                            </Badge>
                            {invoice.payment_status === 'partial' && (
                                <Badge variant="outline" className="text-amber-400 border-amber-500/30">
                                    Partial Payment
                                </Badge>
                            )}
                        </h1>
                        <p className="text-slate-400">
                            For Job: {invoice.job?.title}
                            {invoice.markup_pct > 0 && (
                                <span className="ml-2 text-xs text-cyan-400">({invoice.markup_pct}% markup)</span>
                            )}
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button
                        variant="outline"
                        onClick={handleDownloadPDF}
                        disabled={downloading}
                        className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-950/30"
                    >
                        {downloading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                        Download PDF
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleRegenerateFromActuals}
                        disabled={regenerating}
                        className="border-orange-500/30 text-orange-400 hover:bg-orange-950/30"
                    >
                        {regenerating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                        Regenerate from Actuals
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleSave}
                        disabled={saving}
                        className="border-purple-500/30 text-purple-400 hover:bg-purple-950/30"
                    >
                        <Save className="w-4 h-4 mr-2" />
                        {saving ? 'Saving...' : 'Save Draft'}
                    </Button>
                    {invoice.status === 'draft' && (
                        <Button onClick={() => handleStatusChange('sent')} className="bg-cyan-600 hover:bg-cyan-700">
                            <Send className="w-4 h-4 mr-2" /> Mark Sent
                        </Button>
                    )}
                    {invoice.status === 'sent' && (
                        <Button onClick={() => handleStatusChange('paid')} className="bg-green-600 hover:bg-green-700">
                            <CheckCircle className="w-4 h-4 mr-2" /> Mark Paid
                        </Button>
                    )}
                </div>
            </div>

            {/* Balance Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-slate-900 border-slate-800">
                    <CardContent className="p-4">
                        <p className="text-xs text-slate-400 mb-1">Total Amount</p>
                        <p className="text-2xl font-bold text-white">${Number(invoice.total_amount).toFixed(2)}</p>
                    </CardContent>
                </Card>
                <Card className="bg-slate-900 border-slate-800">
                    <CardContent className="p-4">
                        <p className="text-xs text-slate-400 mb-1">Amount Paid</p>
                        <p className="text-2xl font-bold text-green-400">${Number(amountPaid).toFixed(2)}</p>
                    </CardContent>
                </Card>
                <Card className={`border-slate-800 ${Number(balanceDue) > 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-green-500/10 border-green-500/30'}`}>
                    <CardContent className="p-4">
                        <p className="text-xs text-slate-400 mb-1">Balance Due</p>
                        <p className={`text-2xl font-bold ${Number(balanceDue) > 0 ? 'text-red-400' : 'text-green-400'}`}>
                            ${Number(balanceDue).toFixed(2)}
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Main Content: Invoice Preview */}
                <div className="md:col-span-2 space-y-6">
                    <Card className="bg-slate-900 border-slate-800">
                        <CardHeader>
                            <CardTitle className="text-white">Bill To</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-slate-300 space-y-1">
                                <p className="font-semibold text-white text-lg">{customer?.name}</p>
                                <p>{customer?.email}</p>
                                <p>{customer?.address}</p>
                                <p>{customer?.city}, {customer?.state} {customer?.zip_code}</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-slate-900 border-slate-800">
                        <CardHeader>
                            <CardTitle className="text-white">Line Items</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="relative overflow-x-auto">
                                <table className="w-full text-sm text-left text-slate-400">
                                    <thead className="text-xs text-slate-200 uppercase bg-slate-800">
                                        <tr>
                                            <th className="px-6 py-3">Description</th>
                                            <th className="px-6 py-3 text-right">Qty</th>
                                            <th className="px-6 py-3 text-right">Unit Price</th>
                                            <th className="px-6 py-3 text-right">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {invoice.line_items?.map((item: any, i: number) => (
                                            <tr key={i} className="border-b border-slate-800">
                                                <td className="px-6 py-4 font-medium text-white">
                                                    {item.description}
                                                    {item.is_passthrough && (
                                                        <Badge variant="outline" className="ml-2 text-[10px] text-cyan-400 border-cyan-500/30">
                                                            Pass-through
                                                        </Badge>
                                                    )}
                                                    {item.source_type && (
                                                        <span className="ml-2 text-xs text-slate-500">
                                                            ({item.source_type})
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right">{Number(item.quantity).toFixed(1)}</td>
                                                <td className="px-6 py-4 text-right">${Number(item.unit_price).toFixed(2)}</td>
                                                <td className="px-6 py-4 text-right">${Number(item.amount).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="font-semibold text-white bg-slate-800/50">
                                            <td className="px-6 py-4" colSpan={3}>Total</td>
                                            <td className="px-6 py-4 text-right">${Number(invoice.total_amount).toFixed(2)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            {/* Audit Trail */}
                            {(invoice.source_time_entry_ids?.length > 0 || invoice.source_job_part_ids?.length > 0) && (
                                <div className="mt-3 pt-3 border-t border-slate-700 text-xs text-slate-500">
                                    Linked: {invoice.source_time_entry_ids?.length || 0} time entries, {invoice.source_job_part_ids?.length || 0} parts
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar: Settings */}
                <div className="space-y-6">
                    <Card className="bg-slate-900 border-slate-800">
                        <CardHeader>
                            <CardTitle className="text-white">Settings</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-400">Due Date</label>
                                <Input
                                    type="date"
                                    value={dueDate}
                                    onChange={(e) => setDueDate(e.target.value)}
                                    className="bg-slate-800 border-slate-700"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-400">Notes / Terms</label>
                                <Textarea
                                    placeholder="Thank you for your business..."
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="bg-slate-800 border-slate-700 h-32"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Record Payment */}
                    {invoice.payment_status !== 'paid' && (
                        <Card className="bg-slate-900 border-slate-800">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-white">
                                    <DollarSign className="w-4 h-4 text-green-400" />
                                    Record Payment
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="Payment amount..."
                                    value={paymentAmount}
                                    onChange={(e) => setPaymentAmount(e.target.value)}
                                    className="bg-slate-800 border-slate-700"
                                />
                                <Button
                                    onClick={handleRecordPayment}
                                    className="w-full bg-green-600 hover:bg-green-700"
                                    disabled={!paymentAmount}
                                >
                                    Record Payment
                                </Button>
                                <p className="text-xs text-slate-500">
                                    Balance due auto-calculates. Partial payments supported.
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
