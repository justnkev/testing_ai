import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';
import { markInvoicePaid } from '@/lib/actions/portal-invoices';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-12-15.clover',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
    try {
        const body = await request.text();
        const headersList = await headers();
        const signature = headersList.get('stripe-signature');

        if (!signature) {
            return NextResponse.json(
                { error: 'Missing signature' },
                { status: 400 }
            );
        }

        let event: Stripe.Event;

        try {
            event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
        } catch (err) {
            console.error('Webhook signature verification failed:', err);
            return NextResponse.json(
                { error: 'Invalid signature' },
                { status: 400 }
            );
        }

        // Handle the event
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;

                const invoiceId = session.metadata?.invoice_id;
                const paymentIntentId = session.payment_intent as string;

                if (invoiceId) {
                    // Fetch the payment intent to get the charge ID
                    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
                    const chargeId = (paymentIntent.latest_charge as string) || '';

                    // Mark invoice as paid
                    const result = await markInvoicePaid(
                        invoiceId,
                        paymentIntentId,
                        chargeId
                    );

                    if (!result.success) {
                        console.error('Failed to mark invoice as paid:', result.error);
                    } else {
                        console.log(`Invoice ${invoiceId} marked as paid`);
                    }
                }
                break;
            }

            case 'checkout.session.expired': {
                const session = event.data.object as Stripe.Checkout.Session;
                console.log('Checkout session expired:', session.id);
                // Could log this or notify the customer
                break;
            }

            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error('Webhook error:', error);
        return NextResponse.json(
            { error: 'Webhook handler failed' },
            { status: 500 }
        );
    }
}
