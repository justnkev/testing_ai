import { redirect } from 'next/navigation';
import { validatePortalToken } from '@/lib/actions/portal-auth';
import { getEstimatesByCustomer } from '@/lib/actions/portal-estimates';
import { getInvoicesByCustomer } from '@/lib/actions/portal-invoices';
import { createClient } from '@/lib/supabase/server';
import { PortalHeader } from '@/components/portal/PortalHeader';
import { EstimateCard } from '@/components/portal/EstimateCard';
import { InvoiceCard } from '@/components/portal/InvoiceCard';
import { FileText, Receipt, CheckCircle } from 'lucide-react';

async function getBusinessSettings() {
    const supabase = await createClient();
    const { data } = await supabase.from('business_settings').select('*').single();
    return data || {
        business_name: 'Field Service Co.',
        logo_url: null,
        primary_color: '#3B82F6',
        contact_email: null,
        contact_phone: null,
    };
}

async function getCustomerJobs(customerId: string) {
    const supabase = await createClient();
    const { data } = await supabase
        .from('fs_jobs')
        .select('id, title, status, scheduled_date, completed_at')
        .eq('customer_id', customerId)
        .order('scheduled_date', { ascending: false })
        .limit(10);
    return data || [];
}

export default async function PortalDashboard({
    params,
}: {
    params: Promise<{ token: string }>;
}) {
    const { token } = await params;

    // Validate token
    const validation = await validatePortalToken(token);
    if (!validation.valid || !validation.customerId) {
        redirect('/portal/expired');
    }

    // Fetch data in parallel
    const [settings, estimates, invoices, jobs] = await Promise.all([
        getBusinessSettings(),
        getEstimatesByCustomer(validation.customerId),
        getInvoicesByCustomer(validation.customerId),
        getCustomerJobs(validation.customerId),
    ]);

    const pendingEstimates = estimates.estimates?.filter((e) => e.status === 'pending') || [];
    const unpaidInvoices = invoices.invoices?.filter((i) => i.payment_status === 'unpaid') || [];
    const completedJobs = jobs.filter((j) => j.status === 'completed');

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
            <PortalHeader
                businessName={settings.business_name}
                logoUrl={settings.logo_url}
                contactEmail={settings.contact_email}
                contactPhone={settings.contact_phone}
                customerName={validation.customerName}
            />

            <main className="max-w-6xl mx-auto px-4 py-8">
                {/* Welcome Section */}
                <div className="mb-8">
                    <h2 className="text-3xl font-bold text-slate-900 mb-2">
                        Customer Portal
                    </h2>
                    <p className="text-slate-600">
                        View your service history, approve estimates, and pay invoices
                    </p>
                </div>

                {/* Pending Actions */}
                {(pendingEstimates.length > 0 || unpaidInvoices.length > 0) && (
                    <div className="mb-8">
                        <h3 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
                            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                            Pending Actions
                        </h3>

                        <div className="grid md:grid-cols-2 gap-4">
                            {pendingEstimates.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                                        <FileText className="w-4 h-4" />
                                        Pending Estimates ({pendingEstimates.length})
                                    </h4>
                                    <div className="space-y-3">
                                        {pendingEstimates.map((estimate) => (
                                            <EstimateCard
                                                key={estimate.id}
                                                id={estimate.id}
                                                totalAmount={estimate.total_amount}
                                                description={estimate.description}
                                                createdAt={estimate.created_at}
                                                status={estimate.status}
                                                portalToken={token}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {unpaidInvoices.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                                        <Receipt className="w-4 h-4" />
                                        Unpaid Invoices ({unpaidInvoices.length})
                                    </h4>
                                    <div className="space-y-3">
                                        {unpaidInvoices.map((invoice) => (
                                            <InvoiceCard
                                                key={invoice.id}
                                                id={invoice.id}
                                                invoiceNumber={invoice.invoice_number}
                                                totalAmount={invoice.total_amount}
                                                paymentStatus={invoice.payment_status}
                                                createdAt={invoice.created_at}
                                                paidAt={invoice.paid_at}
                                                portalToken={token}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Service History */}
                <div>
                    <h3 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        Service History
                    </h3>

                    {completedJobs.length > 0 ? (
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">
                                            Service
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">
                                            Scheduled
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">
                                            Completed
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">
                                            Status
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {completedJobs.map((job) => (
                                        <tr key={job.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4 text-sm text-slate-900">{job.title}</td>
                                            <td className="px-6 py-4 text-sm text-slate-600">
                                                {new Date(job.scheduled_date).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600">
                                                {job.completed_at
                                                    ? new Date(job.completed_at).toLocaleDateString()
                                                    : '-'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                                                    Completed
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                            <p className="text-slate-500">No completed services yet</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
