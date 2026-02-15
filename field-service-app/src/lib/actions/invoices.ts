'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export type ActionResult<T = void> =
    | { success: true; data?: T }
    | { success: false; error: string };

/**
 * Generate an invoice for a completed job.
 * Priority:
 * 1. Convert existing Estimate (if exists) -> Invoice
 * 2. Else, calculate from Job Duration (Labor) + Parts Used -> Invoice
 */
export async function generateInvoiceForJob(jobId: string): Promise<ActionResult<{ invoiceId: string }>> {
    try {
        const supabase = await createClient();

        // 0. Auth & Org Check
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: 'Unauthorized' };

        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single();

        if (!profile?.organization_id) return { success: false, error: 'No Organization Found' };

        // 1. Check if Invoice already exists
        const { data: existingInvoice } = await supabase
            .from('invoices')
            .select('id')
            .eq('job_id', jobId)
            .maybeSingle();

        if (existingInvoice) {
            return { success: true, data: { invoiceId: existingInvoice.id } };
        }

        // 2. Fetch Job Details
        const { data: job, error: jobError } = await supabase
            .from('fs_jobs')
            .select('*, customer:fs_customers(*)')
            .eq('id', jobId)
            .single();

        if (jobError || !job) return { success: false, error: 'Job not found' };

        // 3. Check for Estimate to Convert
        const { data: estimate } = await supabase
            .from('estimates')
            .select('*, estimate_items(*)')
            .eq('job_id', jobId)
            // Priority to ACCEPTED, otherwise just take the latest
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        let lineItems = [];
        let totalAmount = 0;

        if (estimate && estimate.estimate_items?.length > 0) {
            // Option A: Use Estimate Data
            lineItems = estimate.estimate_items.map((item: any) => ({
                description: item.description,
                quantity: Number(item.quantity),
                unit_price: Number(item.unit_price),
                amount: Number(item.quantity) * Number(item.unit_price)
            }));
            totalAmount = estimate.total_amount;
        } else {
            // Option B: Fallback to Labor + Parts
            const { data: parts } = await supabase
                .from('fs_job_parts')
                .select('*, item:fs_inventory_items(*)')
                .eq('job_id', jobId);

            const usedParts = parts || [];

            const laborRate = 100; // Default $100/hr
            const laborHours = (job.estimated_duration_minutes || 60) / 60;
            const laborCost = laborHours * laborRate;

            lineItems.push({
                description: `Labor (${laborHours.toFixed(1)} hrs)`,
                quantity: laborHours,
                unit_price: laborRate,
                amount: laborCost
            });

            usedParts.forEach(part => {
                const cost = part.quantity_used * part.unit_price_at_time_of_use;
                lineItems.push({
                    description: part.item?.name || 'Part',
                    quantity: part.quantity_used,
                    unit_price: part.unit_price_at_time_of_use,
                    amount: cost
                });
            });

            totalAmount = lineItems.reduce((sum, item) => sum + item.amount, 0);
        }

        // 4. Create Invoice Record
        const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

        const { data: invoice, error: invoiceError } = await supabase
            .from('invoices')
            .insert({
                job_id: jobId,
                organization_id: profile.organization_id,
                customer_id: job.customer_id,
                invoice_number: invoiceNumber,
                total_amount: totalAmount,
                payment_status: 'unpaid',
                status: 'draft',
                due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                line_items: lineItems, // JSONB column
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (invoiceError) {
            console.error('Invoice create error:', invoiceError);
            return { success: false, error: 'Failed to create invoice: ' + invoiceError.message };
        }

        revalidatePath(`/dashboard/jobs/${jobId}`);
        return { success: true, data: { invoiceId: invoice.id } };

    } catch (error: any) {
        console.error('Generate invoice error:', error);
        return { success: false, error: 'Unexpected error: ' + (error.message || String(error)) };
    }
}

/**
 * Get the invoice for a specific job
 */
export async function getJobInvoice(jobId: string) {
    const supabase = await createClient();

    const { data: invoice, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('job_id', jobId)
        .maybeSingle();

    if (error) {
        console.error('Fetch job invoice error:', error);
        return null;
    }

    return invoice;
}

/**
 * Update an invoice
 */
export async function updateInvoice(
    invoiceId: string,
    data: {
        status?: string;
        due_date?: string | null;
        total_amount?: number;
        notes?: string | null;
    }
): Promise<ActionResult> {
    try {
        const supabase = await createClient();

        const { error } = await supabase
            .from('invoices')
            .update(data)
            .eq('id', invoiceId);

        if (error) {
            console.error('Update invoice error:', error);
            return { success: false, error: 'Failed to update invoice' };
        }

        revalidatePath(`/dashboard/invoices/${invoiceId}`);
        return { success: true };
    } catch (error) {
        console.error('Update invoice error:', error);
        return { success: false, error: 'Unexpected error' };
    }
}
