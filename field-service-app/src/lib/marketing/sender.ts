import { Resend } from 'resend';
import { createServiceClient } from '@/lib/supabase/service';

interface MarketingContext {
    customer_name: string;
    business_name: string;
    review_url?: string;
    service_date?: string;
    technician_name?: string;
    [key: string]: string | undefined;
}

interface SendMarketingParams {
    templateId: string;
    customerId: string;
    jobId?: string; // Optional context
    email: string;
    channel: 'email' | 'sms'; // We'll stub SMS for now or use email-to-sms if needed, prompting user
}

export async function sendMarketingMessage({ templateId, customerId, jobId, email, channel }: SendMarketingParams) {
    const supabase = createServiceClient();

    // 1. Fetch Template
    const { data: template } = await supabase
        .from('marketing_templates')
        .select('*')
        .eq('id', templateId)
        .single();

    if (!template) return { success: false, error: 'Template not found' };

    // 2. Fetch Context Data
    // Get Business Settings
    const { data: settings } = await supabase.from('business_settings').select('*').single();

    // Get Customer
    const { data: customer } = await supabase.from('fs_customers').select('*').eq('id', customerId).single();

    if (!customer) return { success: false, error: 'Customer not found' };

    // Get Job if linked
    let job = null;
    if (jobId) {
        const { data: jobData } = await supabase.from('fs_jobs').select('*').eq('id', jobId).single();
        job = jobData;
    }

    // 3. Prepare Merge Tags
    const context: MarketingContext = {
        customer_name: customer.name,
        business_name: settings?.business_name || 'Our Service',
        review_url: settings?.google_review_url || '#',
        service_date: job?.scheduled_date || new Date().toLocaleDateString(),
        // Add technician name if job has one
    };

    // 4. Substitute Content
    let subject = template.subject;
    let body = channel === 'email' ? template.email_body : template.sms_body;

    // Simple replacement
    Object.keys(context).forEach(key => {
        const pattern = new RegExp(`{{${key}}}`, 'g');
        const value = context[key] || '';
        subject = subject.replace(pattern, value);
        body = body?.replace(pattern, value) || '';
    });

    try {
        if (channel === 'email') {
            const resend = new Resend(process.env.RESEND_API_KEY);

            // Add Unsubscribe Link
            const unsubscribeLink = `${process.env.NEXT_PUBLIC_SITE_URL}/unsubscribe?c=${customerId}`;
            const bodyWithFooter = `${body}<br/><br/><small><a href="${unsubscribeLink}">Unsubscribe</a></small>`;

            await resend.emails.send({
                from: settings?.contact_email || 'noreply@fieldservice.com',
                to: email,
                subject: subject,
                html: bodyWithFooter
            });
        }

        // Log Success
        await supabase.from('campaign_logs').insert({
            customer_id: customerId,
            job_id: jobId,
            template_id: templateId,
            channel,
            status: 'sent'
        });

        return { success: true };

    } catch (error: any) {
        console.error('Marketing Send Error:', error);

        // Log Failure
        await supabase.from('campaign_logs').insert({
            customer_id: customerId,
            job_id: jobId,
            template_id: templateId,
            channel,
            status: 'failed',
            error_message: error.message
        });

        return { success: false, error: error.message };
    }
}
