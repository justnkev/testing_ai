'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { CreditCard } from 'lucide-react';
import { toast } from 'sonner';

interface InvoicePaymentProps {
    invoiceId: string;
    portalToken: string;
    paymentStatus: string;
}

export function InvoicePayment({ invoiceId, portalToken, paymentStatus }: InvoicePaymentProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    const handlePayNow = async () => {
        setIsLoading(true);

        try {
            const response = await fetch('/api/stripe/create-checkout-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invoiceId, portalToken }),
            });

            const data = await response.json();

            if (data.error) {
                toast.error(data.error);
                setIsLoading(false);
                return;
            }

            if (data.sessionUrl) {
                // Redirect to Stripe Checkout
                window.location.href = data.sessionUrl;
            }
        } catch (error) {
            console.error('Payment error:', error);
            toast.error('Failed to initiate payment');
            setIsLoading(false);
        }
    };

    if (paymentStatus !== 'unpaid') {
        return null;
    }

    return (
        <div className="mt-6">
            <Button
                onClick={handlePayNow}
                disabled={isLoading}
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-lg"
            >
                <CreditCard className="w-5 h-5 mr-2" />
                {isLoading ? 'Redirecting to payment...' : 'Pay Now'}
            </Button>
            <p className="text-xs text-slate-500 text-center mt-3">
                Powered by Stripe • Secure payment processing
            </p>
        </div>
    );
}
