import { redirect } from 'next/navigation';
import Link from 'next/link';
import { validatePortalToken } from '@/lib/actions/portal-auth';
import { getInvoiceById } from '@/lib/actions/portal-invoices';
import { createClient } from '@/lib/supabase/server';
import { PortalHeader } from '@/components/portal/PortalHeader';
import { InvoicePayment } from '@/components/portal/InvoicePayment';
import { ArrowLeft, Calendar, DollarSign, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/card';

async function getBusinessSettings() {
    const supabase = await createClient();
    const { data } = await supabase.from('business_settings').select('*').single();
    return data || {
        business_name: 'Field Service Co.',
        logo_url: null,
        contact_email: null,
        contact_phone: null,
    };
}

export default async function InvoicePage({
    params,
    searchParams,
}: {
    params: Promise<{ token: string; invoiceId: string }>;
    searchParams: Promise<{ payment?: string; session_id?: string }>;
}) {
    const { token, invoiceId } = await params;
    const search = await searchParams;

    // Validate token
    const validation = await validatePortalToken(token);
    if (!validation.valid || !validation.customerId) {
        redirect('/portal/expired');
    }

    // Fetch invoice
    const { success, invoice, error } = await getInvoiceById(invoiceId, validation.customerId);
    if (!success || !invoice) {
        redirect(`/portal/${token}`);
    }

    const settings = await getBusinessSettings();

    const statusColors: Record<string, string> = {
        unpaid: 'bg-red-100 text-red-800 border-red-200',
        paid: 'bg-green-100 text-green-800 border-green-200',
        partial: 'bg-amber-100 text-amber-800 border-amber-200',
        refunded: 'bg-slate-100 text-slate-800 border-slate-200',
    };

    const showPaymentSuccess = search.payment === 'success';
    const showPaymentCancelled = search.payment === 'cancelled';

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
            <PortalHeader
                businessName={settings.business_name}
                logoUrl={settings.logo_url}
                contactEmail={settings.contact_email}
                contactPhone={settings.contact_phone}
                customerName={validation.customerName}
            />

            <main className="max-w-4xl mx-auto px-4 py-8">
                <Link
                    href={`/portal/${token}`}
                    className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-6"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Portal
                </Link>

                {showPaymentSuccess && (
                    <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
                        <CheckCircle2 className="w-6 h-6 text-green-600" />
                        <div>
                            <h3 className="font-semibold text-green-900">Payment Successful!</h3>
                            <p className="text-sm text-green-800">Your payment has been processed.</p>
                        </div>
                    </div>
                )}

                {showPaymentCancelled && (
                    <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                        <h3 className="font-semibold text-amber-900">Payment Cancelled</h3>
                        <p className="text-sm text-amber-800">
                            You can try again whenever you're ready.
                        </p>
                    </div>
                )}

                <Card className="p-8">
                    <div className="flex items-start justify-between mb-6">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 mb-1">
                                Invoice {invoice.invoice_number || `#${invoice.id.slice(0, 8)}`}
                            </h1>
                            <p className="text-sm text-slate-500 flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                Created {new Date(invoice.created_at).toLocaleDateString()}
                            </p>
                        </div>
                        <span
                            className={`px-4 py-2 rounded-full text-sm font-medium border ${statusColors[invoice.payment_status]
                                }`}
                        >
                            {invoice.payment_status.charAt(0).toUpperCase() +
                                invoice.payment_status.slice(1)}
                        </span>
                    </div>

                    {invoice.line_items && Array.isArray(invoice.line_items) && (
                        <div className="mb-6">
                            <h3 className="font-semibold text-slate-900 mb-3">Line Items</h3>
                            <div className="border border-slate-200 rounded-lg overflow-hidden">
                                <table className="w-full">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">
                                                Item
                                            </th>
                                            <th className="px-4 py-3 text-right text-sm font-medium text-slate-700">
                                                Amount
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {invoice.line_items.map((item: any, index: number) => (
                                            <tr key={index}>
                                                <td className="px-4 py-3 text-sm text-slate-900">
                                                    {item.description || item.name}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-slate-900 text-right">
                                                    ${Number(item.amount || 0).toFixed(2)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    <div className="border-t border-slate-200 pt-4 mb-6">
                        <div className="flex justify-between items-center">
                            <span className="text-lg font-semibold text-slate-900">Total Amount</span>
                            <div className="flex items-center gap-1 text-2xl font-bold text-slate-900">
                                <DollarSign className="w-6 h-6" />
                                {invoice.total_amount.toFixed(2)}
                            </div>
                        </div>
                    </div>

                    {invoice.payment_status === 'paid' && invoice.paid_at && (
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
                            <CheckCircle2 className="w-6 h-6 text-green-600" />
                            <div>
                                <p className="font-semibold text-green-900">Payment Received</p>
                                <p className="text-sm text-green-800">
                                    Paid on {new Date(invoice.paid_at).toLocaleDateString()}
                                </p>
                            </div>
                        </div>
                    )}

                    <InvoicePayment
                        invoiceId={invoice.id}
                        portalToken={token}
                        paymentStatus={invoice.payment_status}
                    />
                </Card>
            </main>
        </div>
    );
}
