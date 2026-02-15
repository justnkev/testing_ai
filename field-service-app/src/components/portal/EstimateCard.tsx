import Link from 'next/link';
import { FileText, DollarSign, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface EstimateCardProps {
    id: string;
    totalAmount: number;
    description: string | null;
    createdAt: string;
    status: 'pending' | 'approved' | 'declined' | 'expired';
    portalToken: string;
}

export function EstimateCard({
    id,
    totalAmount,
    description,
    createdAt,
    status,
    portalToken,
}: EstimateCardProps) {
    const statusColors = {
        pending: 'bg-amber-100 text-amber-800 border-amber-200',
        approved: 'bg-green-100 text-green-800 border-green-200',
        declined: 'bg-red-100 text-red-800 border-red-200',
        expired: 'bg-slate-100 text-slate-800 border-slate-200',
    };

    const statusText = status.charAt(0).toUpperCase() + status.slice(1);

    return (
        <Link href={`/portal/${portalToken}/estimates/${id}`}>
            <Card className="p-5 hover:shadow-lg transition-shadow cursor-pointer border-slate-200">
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <FileText className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-900">
                                Estimate #{id.slice(0, 8)}
                            </h3>
                            <p className="text-xs text-slate-500">
                                {new Date(createdAt).toLocaleDateString()}
                            </p>
                        </div>
                    </div>

                    <span
                        className={`px-3 py-1 rounded-full text-xs font-medium border ${statusColors[status]}`}
                    >
                        {statusText}
                    </span>
                </div>

                {description && (
                    <p className="text-sm text-slate-600 mb-3 line-clamp-2">
                        {description}
                    </p>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-1 text-sm text-slate-600">
                        <DollarSign className="w-4 h-4" />
                        <span className="font-semibold text-slate-900">
                            ${totalAmount.toFixed(2)}
                        </span>
                    </div>

                    {status === 'pending' && (
                        <span className="text-sm text-blue-600 font-medium">
                            Awaiting approval →
                        </span>
                    )}
                </div>
            </Card>
        </Link>
    );
}
