'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Save, Send, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { updateInvoice } from '@/lib/actions/invoices';
import { format } from 'date-fns';

export default function InvoiceDetailsPage() {
    const router = useRouter();
    const params = useParams();
    const invoiceId = params.id as string;

    const [invoice, setInvoice] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form State
    const [dueDate, setDueDate] = useState('');
    const [notes, setNotes] = useState('');
    // We could add line item editing later

    useEffect(() => {
        async function fetchInvoice() {
            setLoading(true);
            const supabase = createClient();
            const { data, error } = await supabase
                .from('invoices')
                .select(`
                    *,
                    job:fs_jobs(
                        title,
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
        }
        fetchInvoice();
    }, [invoiceId]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const result = await updateInvoice(invoiceId, {
                due_date: dueDate ? new Date(dueDate).toISOString() : null,
                notes: notes || null
            });

            if (result.success) {
                toast.success('Invoice saved');
            } else {
                toast.error(result.error);
            }
        } catch (error) {
            toast.error('Failed to save');
        } finally {
            setSaving(false);
        }
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

    if (loading) return <div className="p-8">Loading invoice...</div>;
    if (!invoice) return <div className="p-8">Invoice not found</div>;

    const customer = invoice.job?.customer;

    return (
        <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href={`/dashboard/jobs/${invoice.job_id}`}>
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                            {invoice.invoice_number}
                            <Badge variant="outline" className="text-lg py-1">
                                {invoice.status}
                            </Badge>
                        </h1>
                        <p className="text-slate-400">
                            For Job: {invoice.job?.title}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
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
                        <Button
                            onClick={() => handleStatusChange('sent')}
                            className="bg-cyan-600 hover:bg-cyan-700"
                        >
                            <Send className="w-4 h-4 mr-2" />
                            Mark Sent
                        </Button>
                    )}
                    {invoice.status === 'sent' && (
                        <Button
                            onClick={() => handleStatusChange('paid')}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Mark Paid
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Main Content: Invoice Preview */}
                <div className="md:col-span-2 space-y-6">
                    <Card className="bg-slate-900 border-slate-800">
                        <CardHeader>
                            <CardTitle>Bill To</CardTitle>
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
                            <CardTitle>Line Items</CardTitle>
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
                                                <td className="px-6 py-4 font-medium text-white">{item.description}</td>
                                                <td className="px-6 py-4 text-right">{item.quantity}</td>
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
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar: Settings */}
                <div className="space-y-6">
                    <Card className="bg-slate-900 border-slate-800">
                        <CardHeader>
                            <CardTitle>Settings</CardTitle>
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
                </div>
            </div>
        </div>
    );
}
