'use server';

import { createClient } from '@/lib/supabase/server';
import { generateCostBasedInvoice } from './invoices';

export type ActionResult<T = void> =
    | { success: true; data?: T }
    | { success: false; error: string };

export interface BillingDashboardRecord {
    id: string;
    record_type: 'invoice' | 'unbilled_job';
    display_id: string;
    customer_name: string;
    job_title: string;
    created_at: string;
    due_date: string | null;
    total_amount: number;
    balance_due: number;
    status: string;
    payment_status: string;
    days_aging: number | null;
    job_id: string;
    customer_id: string;
    has_missing_costs: boolean;
}

export interface BillingKPIs {
    total_receivables: number;
    average_dso: number;
    total_unbilled: number;
}

export async function getBillingDashboardData(): Promise<ActionResult<BillingDashboardRecord[]>> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: 'Unauthorized' };

        const { data, error } = await supabase
            .from('v_billing_dashboard')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching billing data:', error);
            return { success: false, error: error.message };
        }

        return { success: true, data: data as BillingDashboardRecord[] };
    } catch (error: any) {
        console.error('getBillingDashboardData error:', error);
        return { success: false, error: 'Unexpected error' };
    }
}

export async function getBillingKPIs(): Promise<ActionResult<BillingKPIs>> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: 'Unauthorized' };

        const { data, error } = await supabase.rpc('get_billing_kpis');

        if (error) {
            console.error('Error fetching billing KPIs:', error);
            return { success: false, error: error.message };
        }

        if (data && data.length > 0) {
            return {
                success: true,
                data: {
                    total_receivables: Number(data[0].total_receivables || 0),
                    average_dso: Number(data[0].average_dso || 0),
                    total_unbilled: Number(data[0].total_unbilled || 0)
                }
            };
        }

        return {
            success: true,
            data: { total_receivables: 0, average_dso: 0, total_unbilled: 0 }
        };
    } catch (error: any) {
        console.error('getBillingKPIs error:', error);
        return { success: false, error: 'Unexpected error' };
    }
}

/**
 * Perform a Bill Run on a set of completed jobs that haven't been invoiced.
 * This generates Draft invoices for them.
 */
export async function processBillRun(jobIds: string[]): Promise<ActionResult<{ generatedCount: number; errors: string[] }>> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: 'Unauthorized' };

        let generatedCount = 0;
        const errors: string[] = [];

        // Note: For large datasets, this might be better handled in a queue/background job.
        // For standard SMB load, executing in a loop is acceptable.
        for (const jobId of jobIds) {
            // Check if it already has an invoice just in case to avoid duplicates
            const { data: existing } = await supabase
                .from('invoices')
                .select('id')
                .eq('job_id', jobId)
                .maybeSingle();

            if (existing) {
                errors.push(`Job ${jobId} already has an invoice.`);
                continue;
            }

            // generateCostBasedInvoice generates it in "draft" status by default
            const result = await generateCostBasedInvoice(jobId);
            if (result.success) {
                generatedCount++;
            } else {
                errors.push(`Job ${jobId} failed: ${result.error}`);
            }
        }

        return { 
            success: true, 
            data: { generatedCount, errors } 
        };
    } catch (error: any) {
        console.error('processBillRun error:', error);
        return { success: false, error: 'Unexpected error during bill run' };
    }
}

/**
 * Batch send invoices via email (Resend) and update status to sent.
 */
export async function batchSendInvoices(invoiceIds: string[]): Promise<ActionResult<{ sentCount: number; skippedCount: number; errors: string[] }>> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: 'Unauthorized' };

        let sentCount = 0;
        let skippedCount = 0;
        const errors: string[] = [];

        // Dynamic Resend import so we don't blow up if key is missing locally until action is called
        const { Resend } = await import('resend');
        if (!process.env.RESEND_API_KEY) {
            return { success: false, error: 'RESEND_API_KEY is not configured.' };
        }
        const resend = new Resend(process.env.RESEND_API_KEY);

        // Get Business Settings for From Address
        const { data: settings } = await supabase.from('business_settings').select('contact_email, business_name').maybeSingle();
        const fromEmail = settings?.contact_email || 'invoices@fieldservice.com';
        const businessName = settings?.business_name || 'Field Service Co.';

        for (const invoiceId of invoiceIds) {
            // Fetch invoice to verify status is 'draft'
            const { data: invoice } = await supabase
                .from('invoices')
                .select(`
                    id, 
                    status, 
                    total_amount, 
                    balance_due,
                    invoice_number,
                    due_date,
                    customer_id
                `)
                .eq('id', invoiceId)
                .single();

            if (!invoice) {
                errors.push(`Invoice ${invoiceId} not found.`);
                continue;
            }

            if (invoice.status !== 'draft') {
                skippedCount++;
                continue;
            }

            // Fetch Customer for email
            const { data: customer } = await supabase
                .from('fs_customers')
                .select('name, email')
                .eq('id', invoice.customer_id)
                .single();

            if (!customer || !customer.email) {
                errors.push(`Customer for invoice ${invoice.invoice_number} has no valid email.`);
                skippedCount++;
                continue;
            }

            // Send Email via Resend
            try {
                await resend.emails.send({
                    from: `${businessName} <${fromEmail}>`,
                    to: customer.email,
                    subject: `Invoice ${invoice.invoice_number} from ${businessName}`,
                    html: `
                        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2>You have a new invoice from ${businessName}</h2>
                            <p>Dear ${customer.name},</p>
                            <p>Please find the details of your invoice below:</p>
                            <ul>
                                <li><strong>Invoice Number:</strong> ${invoice.invoice_number}</li>
                                <li><strong>Total Amount:</strong> $${Number(invoice.total_amount).toFixed(2)}</li>
                                <li><strong>Balance Due:</strong> $${Number(invoice.balance_due).toFixed(2)}</li>
                                <li><strong>Due Date:</strong> ${invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'Upon receipt'}</li>
                            </ul>
                            <p>Thank you for your business!</p>
                        </div>
                    `
                });

                // Update Database Status
                const { error: updateError } = await supabase
                    .from('invoices')
                    .update({ status: 'sent', sent_at: new Date().toISOString() })
                    .eq('id', invoiceId);

                if (updateError) {
                    errors.push(`Failed to update status for ${invoice.invoice_number} in DB.`);
                } else {
                    sentCount++;
                }

            } catch (emailError: any) {
                console.error('Email send failed:', emailError);
                errors.push(`Failed to send email for ${invoice.invoice_number}: ${emailError.message}`);
                skippedCount++;
            }
        }

        return {
            success: true,
            data: { sentCount, skippedCount, errors }
        };

    } catch (error: any) {
        console.error('batchSendInvoices error:', error);
        return { success: false, error: 'Unexpected error during batch send' };
    }
}
