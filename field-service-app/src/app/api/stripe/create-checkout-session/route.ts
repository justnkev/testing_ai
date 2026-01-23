import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getInvoiceById } from '@/lib/actions/portal-invoices';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2024-12-18.acacia',
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { invoiceId, portalToken } = body;

        if (!invoiceId || !portalToken) {
            return NextResponse.json(
                { error: 'Invoice ID and portal token are required' },
                { status: 400 }
            );
        }

        // Note: We'll validate the customer via the invoice fetch
        // The portal token is used for return URLs
        const { success, invoice, error } = await getInvoiceById(invoiceId, '');

        if (!success || !invoice) {
            return NextResponse.json(
                { error: error || 'Invoice not found' },
                { status: 404 }
            );
        }

        if (invoice.payment_status === 'paid') {
            return NextResponse.json(
                { error: 'Invoice is already paid' },
                { status: 400 }
            );
        }

        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

        // Create Stripe Checkout Session
        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: `Invoice ${invoice.invoice_number || invoice.id.slice(0, 8)}`,
                            description: 'Service invoice payment',
                        },
                        unit_amount: Math.round(invoice.total_amount * 100), // Convert to cents
                    },
                    quantity: 1,
                },
            ],
            success_url: `${baseUrl}/portal/${portalToken}/invoices/${invoiceId}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${baseUrl}/portal/${portalToken}/invoices/${invoiceId}?payment=cancelled`,
            metadata: {
                invoice_id: invoiceId,
                customer_id: invoice.customer_id,
            },
            payment_intent_data: {
                metadata: {
                    invoice_id: invoiceId,
                },
            },
        });

        return NextResponse.json({ sessionUrl: session.url });
    } catch (error) {
        console.error('Error creating checkout session:', error);
        return NextResponse.json(
            { error: 'Failed to create checkout session' },
            { status: 500 }
        );
    }
}
