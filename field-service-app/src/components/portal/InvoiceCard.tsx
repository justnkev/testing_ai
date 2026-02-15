import Link from 'next/link';
import { Receipt, DollarSign, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface InvoiceCardProps {
    id: string;
    invoiceNumber: string | null;
    totalAmount: number;
    paymentStatus: 'unpaid' | 'paid' | 'partial' | 'refunded';
    createdAt: string;
    paidAt: string | null;
    portalToken: string;
}

export function InvoiceCard({
    id,
    invoiceNumber,
    totalAmount,
    paymentStatus,
    createdAt,
    paidAt,
    portalToken,
}: InvoiceCardProps) {
    const statusColors = {
        unpaid: 'bg-red-100 text-red-800 border-red-200',
        paid: 'bg-green-100 text-green-800 border-green-200',
        partial: 'bg-amber-100 text-amber-800 border-amber-200',
        refunded: 'bg-slate-100 text-slate-800 border-slate-200',
    };

    const statusText = {
        unpaid: 'Unpaid',
        paid: 'Paid',
        partial: 'Partially Paid',
        refunded: 'Refunded',
    };

    return (
        <Link href={`/portal/${portalToken}/invoices/${id}`}>
            <Card className="p-5 hover:shadow-lg transition-shadow cursor-pointer border-slate-200">
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${paymentStatus === 'unpaid' ? 'bg-red-100' : 'bg-green-100'
                            }`}>
                            <Receipt className={`w-5 h-5 ${paymentStatus === 'unpaid' ? 'text-red-600' : 'text-green-600'
                                }`} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-900">
                                Invoice {invoiceNumber || `#${id.slice(0, 8)}`}
                            </h3>
                            <p className="text-xs text-slate-500">
                                {new Date(createdAt).toLocaleDateString()}
                            </p>
                        </div>
                    </div>

                    <span
                        className={`px-3 py-1 rounded-full text-xs font-medium border ${statusColors[paymentStatus]}`}
                    >
                        {statusText[paymentStatus]}
                    </span>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-1 text-sm text-slate-600">
                        <DollarSign className="w-4 h-4" />
                        <span className="font-semibold text-slate-900">
                            ${totalAmount.toFixed(2)}
                        </span>
                    </div>

                    {paymentStatus === 'unpaid' && (
                        <span className="flex items-center gap-1 text-sm text-red-600 font-medium">
                            <AlertCircle className="w-4 h-4" />
                            Pay now →
                        </span>
                    )}

                    {paymentStatus === 'paid' && paidAt && (
                        <span className="text-xs text-slate-500">
                            Paid {new Date(paidAt).toLocaleDateString()}
                        </span>
                    )}
                </div>
            </Card>
        </Link>
    );
}
