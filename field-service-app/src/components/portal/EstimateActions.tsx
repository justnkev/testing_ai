'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { approveEstimate, declineEstimate } from '@/lib/actions/portal-estimates';
import { SignaturePad } from '@/components/mobile/signature-pad';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Check, X, FileText } from 'lucide-react';

interface EstimateActionsProps {
    estimateId: string;
    customerId: string;
    status: string;
}

export function EstimateActions({ estimateId, customerId, status }: EstimateActionsProps) {
    const router = useRouter();
    const [showSignature, setShowSignature] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleApprove = () => {
        setShowSignature(true);
    };

    const handleSignatureCapture = async (signatureData: string, signerName: string) => {
        setIsLoading(true);

        const result = await approveEstimate(estimateId, customerId, signatureData, signerName);

        setIsLoading(false);

        if (result.success) {
            toast.success('Estimate approved successfully!');
            router.refresh();
            setShowSignature(false);
        } else {
            toast.error(result.error || 'Failed to approve estimate');
        }
    };

    const handleDecline = async () => {
        if (!confirm('Are you sure you want to decline this estimate?')) {
            return;
        }

        setIsLoading(true);
        const result = await declineEstimate(estimateId, customerId);
        setIsLoading(false);

        if (result.success) {
            toast.success('Estimate declined');
            router.refresh();
        } else {
            toast.error(result.error || 'Failed to decline estimate');
        }
    };

    if (status !== 'pending') {
        return null;
    }

    return (
        <>
            <div className="flex gap-3">
                <Button
                    onClick={handleDecline}
                    variant="outline"
                    disabled={isLoading}
                    className="flex-1 h-12 border-red-300 text-red-700 hover:bg-red-50"
                >
                    <X className="w-4 h-4 mr-2" />
                    Decline
                </Button>
                <Button
                    onClick={handleApprove}
                    disabled={isLoading}
                    className="flex-1 h-12 bg-green-600 hover:bg-green-700"
                >
                    <Check className="w-4 h-4 mr-2" />
                    Approve & Sign
                </Button>
            </div>

            {showSignature && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl p-6 max-w-lg w-full">
                        <h3 className="text-lg font-semibold mb-4">Sign to Approve Estimate</h3>
                        <SignaturePad
                            onCapture={handleSignatureCapture}
                            onCancel={() => setShowSignature(false)}
                            isLoading={isLoading}
                        />
                    </div>
                </div>
            )}
        </>
    );
}
