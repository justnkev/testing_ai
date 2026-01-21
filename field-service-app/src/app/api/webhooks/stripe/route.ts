import { NextRequest, NextResponse } from 'next/server';
import { stripe, getWebhookSecret } from '@/lib/stripe/client';
import { createAdminClient } from '@/lib/supabase/admin';
import Stripe from 'stripe';

/**
 * Log webhook event to Supabase for debugging and audit trail
 */
async function logWebhookEvent(
    eventId: string,
    eventType: string,
    priority: 'info' | 'warning' | 'error' | 'critical',
    message: string,
    payload?: object,
    metadata?: object
) {
    try {
        const supabase = createAdminClient();
        await supabase.from('fs_webhook_logs').insert({
            event_id: eventId,
            event_type: eventType,
            priority,
            message,
            payload: payload || null,
            metadata: metadata || null,
        });
    } catch (error) {
        // Don't throw - logging failure shouldn't break webhook processing
        console.error('[Webhook Log Error]', error);
    }
}

/**
 * Handle checkout.session.completed event
 * Called when a customer completes a Stripe Checkout session
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session, eventId: string) {
    const supabase = createAdminClient();
    const metadata = session.metadata || {};
    const jobId = metadata.job_id;
    const customerId = metadata.customer_id;
    const userId = metadata.user_id;

    console.log('[Webhook] Processing checkout.session.completed:', {
        sessionId: session.id,
        jobId,
        customerId,
        amount: session.amount_total,
    });

    // Validate required metadata
    if (!jobId) {
        await logWebhookEvent(
            eventId,
            'checkout.session.completed',
            'critical',
            'Missing job_id in checkout session metadata',
            { sessionId: session.id },
            metadata
        );
        console.error('[Webhook] CRITICAL: Missing job_id in metadata');
        return { success: false, error: 'Missing job_id' };
    }

    // Check if invoice already exists (idempotency)
    const { data: existingInvoice } = await supabase
        .from('fs_invoices')
        .select('id, status')
        .eq('stripe_session_id', session.id)
        .single();

    if (existingInvoice?.status === 'paid') {
        console.log('[Webhook] Invoice already marked as paid, skipping:', existingInvoice.id);
        await logWebhookEvent(
            eventId,
            'checkout.session.completed',
            'info',
            'Invoice already processed (idempotent skip)',
            { invoiceId: existingInvoice.id }
        );
        return { success: true, skipped: true };
    }

    // Get payment_intent as string (it can be string or PaymentIntent object)
    const paymentIntentId = typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id || null;

    // Create or update invoice record
    const invoiceData = {
        user_id: userId,
        job_id: jobId,
        customer_id: customerId || null,
        stripe_session_id: session.id,
        stripe_payment_intent_id: paymentIntentId,
        amount_cents: session.amount_total || 0,
        currency: session.currency || 'usd',
        status: 'paid',
        description: `Payment for Job ${jobId}`,
        paid_at: new Date().toISOString(),
    };

    if (existingInvoice) {
        // Update existing invoice
        const { error: updateError } = await supabase
            .from('fs_invoices')
            .update({
                status: 'paid',
                paid_at: new Date().toISOString(),
                stripe_payment_intent_id: paymentIntentId,
            })
            .eq('id', existingInvoice.id);

        if (updateError) {
            console.error('[Webhook] Failed to update invoice:', updateError);
            await logWebhookEvent(eventId, 'checkout.session.completed', 'error', 'Failed to update invoice', { error: updateError });
            return { success: false, error: updateError.message };
        }
    } else {
        // Create new invoice
        const { error: insertError } = await supabase
            .from('fs_invoices')
            .insert(invoiceData);

        if (insertError) {
            console.error('[Webhook] Failed to create invoice:', insertError);
            await logWebhookEvent(eventId, 'checkout.session.completed', 'error', 'Failed to create invoice', { error: insertError });
            return { success: false, error: insertError.message };
        }
    }

    // Update job payment status
    const { error: jobUpdateError } = await supabase
        .from('fs_jobs')
        .update({ payment_status: 'paid' })
        .eq('id', jobId);

    if (jobUpdateError) {
        console.error('[Webhook] Failed to update job payment status:', jobUpdateError);
        await logWebhookEvent(eventId, 'checkout.session.completed', 'warning', 'Invoice created but job update failed', { error: jobUpdateError });
    }

    console.log('[Webhook] Successfully processed checkout.session.completed');
    await logWebhookEvent(
        eventId,
        'checkout.session.completed',
        'info',
        'Payment processed successfully',
        { jobId, amount: session.amount_total }
    );

    return { success: true };
}

/**
 * Handle invoice.paid event
 * Called when a Stripe Invoice is paid (recurring payments, subscriptions)
 */
async function handleInvoicePaid(invoice: Stripe.Invoice, eventId: string) {
    const supabase = createAdminClient();
    const metadata = invoice.metadata || {};
    const jobId = metadata.job_id;
    const customerId = metadata.customer_id;
    const userId = metadata.user_id;

    console.log('[Webhook] Processing invoice.paid:', {
        invoiceId: invoice.id,
        jobId,
        amount: invoice.amount_paid,
    });

    // Validate required metadata
    if (!jobId) {
        await logWebhookEvent(
            eventId,
            'invoice.paid',
            'critical',
            'Missing job_id in invoice metadata',
            { stripeInvoiceId: invoice.id },
            metadata
        );
        console.error('[Webhook] CRITICAL: Missing job_id in invoice metadata');
        return { success: false, error: 'Missing job_id' };
    }

    // Check for existing invoice (idempotency)
    const { data: existingInvoice } = await supabase
        .from('fs_invoices')
        .select('id, status')
        .eq('stripe_invoice_id', invoice.id)
        .single();

    if (existingInvoice?.status === 'paid') {
        console.log('[Webhook] Invoice already marked as paid, skipping:', existingInvoice.id);
        return { success: true, skipped: true };
    }

    // For invoice.paid, payment_intent isn't directly available in newer API versions
    // We'll store null - the primary flow is via checkout.session.completed anyway
    const paymentIntentId: string | null = null;

    // Create or update invoice record
    const invoiceData = {
        user_id: userId,
        job_id: jobId,
        customer_id: customerId || null,
        stripe_invoice_id: invoice.id,
        stripe_payment_intent_id: paymentIntentId,
        amount_cents: invoice.amount_paid,
        currency: invoice.currency,
        status: 'paid',
        description: invoice.description || `Invoice ${invoice.number}`,
        paid_at: new Date().toISOString(),
    };

    if (existingInvoice) {
        const { error: updateError } = await supabase
            .from('fs_invoices')
            .update({
                status: 'paid',
                paid_at: new Date().toISOString(),
                stripe_payment_intent_id: paymentIntentId,
            })
            .eq('id', existingInvoice.id);

        if (updateError) {
            console.error('[Webhook] Failed to update invoice:', updateError);
            await logWebhookEvent(eventId, 'invoice.paid', 'error', 'Failed to update invoice', { error: updateError });
            return { success: false, error: updateError.message };
        }
    } else {
        const { error: insertError } = await supabase
            .from('fs_invoices')
            .insert(invoiceData);

        if (insertError) {
            console.error('[Webhook] Failed to create invoice:', insertError);
            await logWebhookEvent(eventId, 'invoice.paid', 'error', 'Failed to create invoice', { error: insertError });
            return { success: false, error: insertError.message };
        }
    }

    // Update job payment status
    const { error: jobUpdateError } = await supabase
        .from('fs_jobs')
        .update({ payment_status: 'paid' })
        .eq('id', jobId);

    if (jobUpdateError) {
        console.error('[Webhook] Failed to update job payment status:', jobUpdateError);
    }

    console.log('[Webhook] Successfully processed invoice.paid');
    await logWebhookEvent(eventId, 'invoice.paid', 'info', 'Invoice paid processed successfully', { jobId });

    return { success: true };
}

/**
 * POST /api/webhooks/stripe
 * Handles incoming Stripe webhook events
 */
export async function POST(request: NextRequest) {
    console.log('[Webhook] Received Stripe webhook request');

    // Get raw body for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
        console.error('[Webhook] Missing stripe-signature header');
        return NextResponse.json(
            { error: 'Missing stripe-signature header' },
            { status: 400 }
        );
    }

    let event: Stripe.Event;

    // Verify webhook signature
    try {
        const webhookSecret = getWebhookSecret();
        event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
        console.log('[Webhook] Signature verification SUCCESS:', event.type);
    } catch (err) {
        const error = err as Error;
        console.error('[Webhook] Signature verification FAILED:', error.message);
        return NextResponse.json(
            { error: `Webhook signature verification failed: ${error.message}` },
            { status: 400 }
        );
    }

    // Process the event
    const eventId = event.id;
    const eventType = event.type;

    console.log('[Webhook] Processing event:', { eventId, eventType });

    // Handle specific event types
    try {
        switch (eventType) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                await handleCheckoutCompleted(session, eventId);
                break;
            }

            case 'invoice.paid': {
                const invoice = event.data.object as Stripe.Invoice;
                await handleInvoicePaid(invoice, eventId);
                break;
            }

            case 'payment_intent.succeeded': {
                // Log but don't process - we handle this via checkout.session.completed
                console.log('[Webhook] payment_intent.succeeded received (handled via checkout session)');
                await logWebhookEvent(eventId, eventType, 'info', 'Payment intent succeeded (no action needed)');
                break;
            }

            case 'payment_intent.payment_failed': {
                // Log payment failures for debugging
                const paymentIntent = event.data.object as Stripe.PaymentIntent;
                console.error('[Webhook] Payment failed:', paymentIntent.last_payment_error?.message);
                await logWebhookEvent(
                    eventId,
                    eventType,
                    'error',
                    'Payment failed',
                    { error: paymentIntent.last_payment_error },
                    paymentIntent.metadata
                );
                break;
            }

            default:
                // Log unhandled events for awareness
                console.log('[Webhook] Unhandled event type:', eventType);
                await logWebhookEvent(eventId, eventType, 'info', `Unhandled event type: ${eventType}`);
        }
    } catch (processingError) {
        const error = processingError as Error;
        console.error('[Webhook] Error processing event:', error);
        await logWebhookEvent(eventId, eventType, 'error', `Processing error: ${error.message}`);
        // Still return 200 to prevent Stripe from retrying
        // The error is logged and can be investigated
    }

    return NextResponse.json({ received: true, eventId });
}

// Reject other HTTP methods
export async function GET() {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
