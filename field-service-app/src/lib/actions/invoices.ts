'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import Decimal from 'decimal.js';

export type ActionResult<T = void> =
    | { success: true; data?: T }
    | { success: false; error: string };

interface InvoiceLineItem {
    description: string;
    quantity: number;
    unit_price: number;
    amount: number;
    is_passthrough?: boolean; // Markup exception
    source_type?: 'labor' | 'material' | 'custom';
    source_id?: string;
}

/**
 * Generate an invoice for a completed job.
 * Priority: Estimate → Actuals fallback
 * (Legacy method — kept for backwards compatibility)
 */
export async function generateInvoiceForJob(jobId: string): Promise<ActionResult<{ invoiceId: string }>> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: 'Unauthorized' };

        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single();

        if (!profile?.organization_id) return { success: false, error: 'No Organization Found' };

        // Check if Invoice already exists
        const { data: existingInvoice } = await supabase
            .from('invoices')
            .select('id')
            .eq('job_id', jobId)
            .maybeSingle();

        if (existingInvoice) {
            return { success: true, data: { invoiceId: existingInvoice.id } };
        }

        // Fetch Job Details
        const { data: job, error: jobError } = await supabase
            .from('fs_jobs')
            .select('*, customer:fs_customers(*)')
            .eq('id', jobId)
            .single();

        if (jobError || !job) return { success: false, error: 'Job not found' };

        // Check for Estimate to Convert
        const { data: estimate } = await supabase
            .from('estimates')
            .select('*, estimate_items(*)')
            .eq('job_id', jobId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        let lineItems: InvoiceLineItem[] = [];
        let totalAmount = new Decimal(0);

        if (estimate && estimate.estimate_items?.length > 0) {
            lineItems = estimate.estimate_items.map((item: any) => {
                const amt = new Decimal(item.quantity).mul(new Decimal(item.unit_price));
                return {
                    description: item.description,
                    quantity: Number(item.quantity),
                    unit_price: Number(item.unit_price),
                    amount: amt.toNumber(),
                };
            });
            totalAmount = new Decimal(estimate.total_amount);
        } else {
            // Fallback: use actual time entries + parts
            const result = await buildActualCostLineItems(supabase, jobId, 0);
            lineItems = result.lineItems;
            totalAmount = result.totalAmount;
        }

        const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

        const { data: invoice, error: invoiceError } = await supabase
            .from('invoices')
            .insert({
                job_id: jobId,
                organization_id: profile.organization_id,
                customer_id: job.customer_id,
                invoice_number: invoiceNumber,
                total_amount: totalAmount.toNumber(),
                payment_status: 'unpaid',
                status: 'draft',
                due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                line_items: lineItems,
                balance_due: totalAmount.toNumber(),
                amount_paid: 0,
                markup_pct: 0,
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
 * Generate invoice from ACTUAL costs (Phase 1 labor + Phase 2 materials).
 * Applies configurable markup with per-item pass-through exceptions.
 */
export async function generateCostBasedInvoice(
    jobId: string,
    markupPct: number = 0,
    passthroughPartIds: string[] = []
): Promise<ActionResult<{ invoiceId: string }>> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: 'Unauthorized' };

        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single();

        if (!profile?.organization_id) return { success: false, error: 'No Organization Found' };

        const { data: job } = await supabase
            .from('fs_jobs')
            .select('customer_id, default_markup_pct')
            .eq('id', jobId)
            .single();

        if (!job) return { success: false, error: 'Job not found' };

        // Use job-level markup override if set, else param, else org default
        let effectiveMarkup = markupPct;
        if (job.default_markup_pct && Number(job.default_markup_pct) > 0) {
            effectiveMarkup = Number(job.default_markup_pct);
        }
        if (effectiveMarkup <= 0) {
            const { data: settings } = await supabase
                .from('business_settings')
                .select('default_markup_pct')
                .limit(1)
                .maybeSingle();
            if (settings?.default_markup_pct) {
                effectiveMarkup = Number(settings.default_markup_pct);
            }
        }

        const result = await buildActualCostLineItems(supabase, jobId, effectiveMarkup, passthroughPartIds);
        const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

        const { data: invoice, error: invoiceError } = await supabase
            .from('invoices')
            .insert({
                job_id: jobId,
                organization_id: profile.organization_id,
                customer_id: job.customer_id,
                invoice_number: invoiceNumber,
                total_amount: result.totalAmount.toNumber(),
                payment_status: 'unpaid',
                status: 'draft',
                due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                line_items: result.lineItems,
                balance_due: result.totalAmount.toNumber(),
                amount_paid: 0,
                markup_pct: effectiveMarkup,
                source_time_entry_ids: result.timeEntryIds,
                source_job_part_ids: result.jobPartIds,
            })
            .select()
            .single();

        if (invoiceError) {
            console.error('Cost-based invoice error:', invoiceError);
            return { success: false, error: 'Failed to create invoice' };
        }

        revalidatePath(`/dashboard/jobs/${jobId}`);
        revalidatePath(`/dashboard/invoices/${invoice.id}`);
        return { success: true, data: { invoiceId: invoice.id } };
    } catch (error: any) {
        console.error('Cost-based invoice error:', error);
        return { success: false, error: 'Unexpected error' };
    }
}

/**
 * Build line items from actual time entries + parts with markup.
 */
async function buildActualCostLineItems(
    supabase: any,
    jobId: string,
    markupPct: number,
    passthroughPartIds: string[] = []
) {
    const lineItems: InvoiceLineItem[] = [];
    const timeEntryIds: string[] = [];
    const jobPartIds: string[] = [];
    const markup = new Decimal(markupPct).div(100);

    // 1. Labor from approved time entries
    const { data: timeEntries } = await supabase
        .from('time_entries')
        .select('id, user_id, total_hours, gross_pay, applied_rate, is_travel_time')
        .eq('job_id', jobId)
        .eq('status', 'approved');

    const entries = timeEntries || [];
    let laborTotal = new Decimal(0);

    // Group by user for cleaner line items
    const byUser: Record<string, { hours: Decimal; pay: Decimal; rate: number; ids: string[] }> = {};
    for (const entry of entries) {
        timeEntryIds.push(entry.id);
        const uid = entry.user_id;
        if (!byUser[uid]) {
            byUser[uid] = { hours: new Decimal(0), pay: new Decimal(0), rate: Number(entry.applied_rate || 0), ids: [] };
        }
        byUser[uid].hours = byUser[uid].hours.add(new Decimal(entry.total_hours || 0));
        byUser[uid].pay = byUser[uid].pay.add(new Decimal(entry.gross_pay || 0));
        byUser[uid].ids.push(entry.id);
    }

    // Fetch user names
    const userIds = Object.keys(byUser);
    let userNames: Record<string, string> = {};
    if (userIds.length > 0) {
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', userIds);
        if (profiles) {
            for (const p of profiles) {
                userNames[p.id] = p.full_name || 'Technician';
            }
        }
    }

    for (const [uid, data] of Object.entries(byUser)) {
        const techName = userNames[uid] || 'Technician';
        const hrs = data.hours.toNumber();
        const pay = data.pay;
        laborTotal = laborTotal.add(pay);

        lineItems.push({
            description: `Labor — ${techName} (${hrs.toFixed(1)} hrs @ $${data.rate.toFixed(2)}/hr)`,
            quantity: hrs,
            unit_price: data.rate,
            amount: pay.toNumber(),
            source_type: 'labor',
        });
    }

    // 2. Materials from job parts
    const { data: parts } = await supabase
        .from('fs_job_parts')
        .select('id, quantity_used, unit_price_at_time_of_use, is_custom_entry, custom_item_name, custom_item_price, item:fs_inventory_items(name)')
        .eq('job_id', jobId);

    const usedParts = parts || [];
    let materialSubtotal = new Decimal(0);

    for (const part of usedParts) {
        jobPartIds.push(part.id);
        const name = part.is_custom_entry ? (part.custom_item_name || 'Custom Part') : (part.item?.name || 'Part');
        const unitPrice = new Decimal(
            part.is_custom_entry
                ? (part.custom_item_price || 0)
                : part.unit_price_at_time_of_use
        );
        const qty = part.quantity_used;
        const subtotal = unitPrice.mul(qty);
        const isPassthrough = passthroughPartIds.includes(part.id);

        // Apply markup to materials unless pass-through
        const markedUp = isPassthrough ? subtotal : subtotal.mul(new Decimal(1).add(markup));

        materialSubtotal = materialSubtotal.add(markedUp);

        lineItems.push({
            description: name + (isPassthrough ? ' (pass-through)' : ''),
            quantity: qty,
            unit_price: isPassthrough ? unitPrice.toNumber() : unitPrice.mul(new Decimal(1).add(markup)).toNumber(),
            amount: markedUp.toNumber(),
            is_passthrough: isPassthrough,
            source_type: 'material',
            source_id: part.id,
        });
    }

    const totalAmount = laborTotal.add(materialSubtotal);

    return { lineItems, totalAmount, timeEntryIds, jobPartIds };
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
        amount_paid?: number;
    }
): Promise<ActionResult> {
    try {
        const supabase = await createClient();

        // If amount_paid is updated, recalculate balance_due
        const updateData: any = { ...data };
        if (data.amount_paid !== undefined) {
            // Need to fetch current total to calc balance
            const { data: inv } = await supabase
                .from('invoices')
                .select('total_amount')
                .eq('id', invoiceId)
                .single();

            if (inv) {
                const balance = new Decimal(inv.total_amount).sub(new Decimal(data.amount_paid));
                updateData.balance_due = balance.toNumber();

                // Auto-set payment_status based on balance
                if (balance.lte(0)) {
                    updateData.payment_status = 'paid';
                    updateData.paid_at = new Date().toISOString();
                } else if (new Decimal(data.amount_paid).gt(0)) {
                    updateData.payment_status = 'partial';
                }
            }
        }

        const { error } = await supabase
            .from('invoices')
            .update(updateData)
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

/**
 * Record a partial payment
 */
export async function recordPartialPayment(
    invoiceId: string,
    paymentAmount: number
): Promise<ActionResult> {
    try {
        const supabase = await createClient();

        const { data: inv } = await supabase
            .from('invoices')
            .select('total_amount, amount_paid')
            .eq('id', invoiceId)
            .single();

        if (!inv) return { success: false, error: 'Invoice not found' };

        const newPaid = new Decimal(inv.amount_paid || 0).add(new Decimal(paymentAmount));
        const newBalance = new Decimal(inv.total_amount).sub(newPaid);

        const updateData: any = {
            amount_paid: newPaid.toNumber(),
            balance_due: newBalance.toNumber(),
        };

        if (newBalance.lte(0)) {
            updateData.payment_status = 'paid';
            updateData.paid_at = new Date().toISOString();
        } else {
            updateData.payment_status = 'partial';
        }

        const { error } = await supabase
            .from('invoices')
            .update(updateData)
            .eq('id', invoiceId);

        if (error) return { success: false, error: 'Failed to record payment' };

        revalidatePath(`/dashboard/invoices/${invoiceId}`);
        return { success: true };
    } catch {
        return { success: false, error: 'Unexpected error' };
    }
}
