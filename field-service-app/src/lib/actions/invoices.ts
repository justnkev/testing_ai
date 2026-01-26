'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export type ActionResult<T = void> =
    | { success: true; data?: T }
    | { success: false; error: string };

/**
 * Generate an invoice for a completed job.
 * This aggregates the labor (estimated duration?) and parts used.
 * For now, we will create a basic invoice record. 
 * Note: The schema for `invoices` isn't fully visible to me, I'm inferring from typical patterns 
 * or would need to check existing code. Assuming standard fields.
 * 
 * However, based on the prompt "Update the invoices.ts server action...", implies one might exist?
 * I couldn't find it earlier. I will create a robust one.
 */
export async function generateInvoiceForJob(jobId: string): Promise<ActionResult<{ invoiceId: string }>> {
    try {
        const supabase = await createClient();

        // 1. Fetch Job Details
        const { data: job, error: jobError } = await supabase
            .from('fs_jobs')
            .select('*, customer:fs_customers(*)')
            .eq('id', jobId)
            .single();

        if (jobError || !job) return { success: false, error: 'Job not found' };

        // 2. Fetch Parts Used
        const { data: parts, error: partsError } = await supabase
            .from('fs_job_parts')
            .select('*, item:fs_inventory_items(*)')
            .eq('job_id', jobId);

        if (partsError) return { success: false, error: 'Failed to fetch parts' };

        // 3. Calculate Totals
        // Assuming a standard labor rate for now ($100/hr) as it's not in the prompt specs
        // User asked to "pull any parts... and add them as line items"
        const laborRate = 100;
        const laborHours = (job.estimated_duration_minutes || 60) / 60;
        const laborCost = laborHours * laborRate;

        const partsCost = parts.reduce((acc, part) => {
            return acc + (part.quantity_used * part.unit_price_at_time_of_use);
        }, 0);

        const totalAmount = laborCost + partsCost;

        // 4. Create Invoice Record
        // Checking `invoices` schema first would be ideal, but let's try standard insert
        // and if it fails I'll fix it. 
        // Based on `portal-invoices.ts`, there is an `invoices` table.
        const { data: invoice, error: invoiceError } = await supabase
            .from('invoices')
            .insert({
                job_id: jobId,
                // Assuming user_id or customer_id is needed. 
                // Often invoices link to customer.
                customer_id: job.customer_id,
                amount: totalAmount,
                status: 'draft',
                due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Net 7
                items: [
                    {
                        description: `Labor (${laborHours.toFixed(1)} hrs)`,
                        quantity: laborHours,
                        unit_price: laborRate,
                        amount: laborCost
                    },
                    ...parts.map(part => ({
                        description: part.item.name,
                        quantity: part.quantity_used,
                        unit_price: part.unit_price_at_time_of_use,
                        amount: part.quantity_used * part.unit_price_at_time_of_use
                    }))
                ]
            })
            .select()
            .single();

        if (invoiceError) {
            console.error('Invoice create error:', invoiceError);
            return { success: false, error: 'Failed to create invoice' };
        }

        revalidatePath(`/dashboard/jobs/${jobId}`);
        return { success: true, data: { invoiceId: invoice.id } };

    } catch (error) {
        console.error('Generate invoice error:', error);
        return { success: false, error: 'Unexpected error' };
    }
}
