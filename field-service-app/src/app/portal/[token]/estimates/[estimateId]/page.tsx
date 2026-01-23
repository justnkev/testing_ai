import { redirect } from 'next/navigation';
import Link from 'next/link';
import { validatePortalToken } from '@/lib/actions/portal-auth';
import { getEstimateById } from '@/lib/actions/portal-estimates';
import { createClient } from '@/lib/supabase/server';
import { PortalHeader } from '@/components/portal/PortalHeader';
import { EstimateActions } from '@/components/portal/EstimateActions';
import { ArrowLeft, Calendar, DollarSign } from 'lucide-react';
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

export default async function EstimatePage({
    params,
}: {
    params: Promise<{ token: string; estimateId: string }>;
}) {
    const { token, estimateId } = await params;

    // Validate token
    const validation = await validatePortalToken(token);
    if (!validation.valid || !validation.customerId) {
        redirect('/portal/expired');
    }

    // Fetch estimate
    const { success, estimate, error } = await getEstimateById(estimateId, validation.customerId);
    if (!success || !estimate) {
        redirect(`/portal/${token}`);
    }

    const settings = await getBusinessSettings();

    const statusColors: Record<string, string> = {
        pending: 'bg-amber-100 text-amber-800 border-amber-200',
        approved: 'bg-green-100 text-green-800 border-green-200',
        declined: 'bg-red-100 text-red-800 border-red-200',
        expired: 'bg-slate-100 text-slate-800 border-slate-200',
    };

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

                <Card className="p-8">
                    <div className="flex items-start justify-between mb-6">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 mb-1">
                                Estimate #{estimate.id.slice(0, 8)}
                            </h1>
                            <p className="text-sm text-slate-500 flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                Created {new Date(estimate.created_at).toLocaleDateString()}
                            </p>
                        </div>
                        <span
                            className={`px-4 py-2 rounded-full text-sm font-medium border ${statusColors[estimate.status]
                                }`}
                        >
                            {estimate.status.charAt(0).toUpperCase() + estimate.status.slice(1)}
                        </span>
                    </div>

                    {estimate.description && (
                        <div className="mb-6">
                            <h3 className="font-semibold text-slate-900 mb-2">Description</h3>
                            <p className="text-slate-600">{estimate.description}</p>
                        </div>
                    )}

                    {estimate.line_items && Array.isArray(estimate.line_items) && (
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
                                        {estimate.line_items.map((item: any, index: number) => (
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
                                {estimate.total_amount.toFixed(2)}
                            </div>
                        </div>
                    </div>

                    {estimate.signature_data && (
                        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                            <h3 className="font-semibold text-green-900 mb-3">Approval Signature</h3>
                            <div className="bg-white rounded-lg p-3 mb-2">
                                <img
                                    src={estimate.signature_data}
                                    alt="Signature"
                                    className="max-w-full h-24"
                                />
                            </div>
                            <p className="text-sm text-green-800">
                                Signed by <strong>{estimate.signature_name}</strong> on{' '}
                                {new Date(estimate.signed_at!).toLocaleString()}
                            </p>
                        </div>
                    )}

                    <EstimateActions
                        estimateId={estimate.id}
                        customerId={validation.customerId}
                        status={estimate.status}
                    />
                </Card>
            </main>
        </div>
    );
}
