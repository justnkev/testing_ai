'use server';

import { createClient } from '@/lib/supabase/server';

interface Invoice {
    id: string;
    job_id: string;
    customer_id: string;
    invoice_number: string | null;
    total_amount: number;
    payment_status: 'unpaid' | 'paid' | 'partial' | 'refunded';
    stripe_payment_intent_id: string | null;
    stripe_charge_id: string | null;
    paid_at: string | null;
    line_items: any;
    created_at: string;
    updated_at: string;
}

/**
 * Get all invoices for a customer
 * @param customerId - UUID of the customer
 * @returns List of invoices
 */
export async function getInvoicesByCustomer(
    customerId: string
): Promise<{ success: boolean; invoices?: Invoice[]; error?: string }> {
    try {
        const supabase = await createClient();

        const { data, error } = await supabase
            .from('invoices')
            .select('*')
            .eq('customer_id', customerId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching invoices:', error);
            return { success: false, error: 'Failed to fetch invoices' };
        }

        return { success: true, invoices: data || [] };
    } catch (error) {
        console.error('Error in getInvoicesByCustomer:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
}

/**
 * Get a single invoice by ID (with customer validation)
 * @param invoiceId - UUID of the invoice
 * @param customerId - UUID of the customer (for authorization)
 * @returns Invoice data
 */
export async function getInvoiceById(
    invoiceId: string,
    customerId: string
): Promise<{ success: boolean; invoice?: Invoice; error?: string }> {
    try {
        const supabase = await createClient();

        const { data, error } = await supabase
            .from('invoices')
            .select('*')
            .eq('id', invoiceId)
            .eq('customer_id', customerId)
            .single();

        if (error || !data) {
            console.error('Error fetching invoice:', error);
            return { success: false, error: 'Invoice not found' };
        }

        return { success: true, invoice: data };
    } catch (error) {
        console.error('Error in getInvoiceById:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
}

/**
 * Mark an invoice as paid (called by Stripe webhook)
 * @param invoiceId - UUID of the invoice
 * @param stripePaymentIntentId - Stripe payment intent ID
 * @param stripeChargeId - Stripe charge ID
 * @returns Success status
 */
export async function markInvoicePaid(
    invoiceId: string,
    stripePaymentIntentId: string,
    stripeChargeId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = await createClient();

        const { error: updateError } = await supabase
            .from('invoices')
            .update({
                payment_status: 'paid',
                stripe_payment_intent_id: stripePaymentIntentId,
                stripe_charge_id: stripeChargeId,
                paid_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', invoiceId);

        if (updateError) {
            console.error('Error marking invoice as paid:', updateError);
            return { success: false, error: 'Failed to update invoice' };
        }

        return { success: true };
    } catch (error) {
        console.error('Error in markInvoicePaid:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
}
