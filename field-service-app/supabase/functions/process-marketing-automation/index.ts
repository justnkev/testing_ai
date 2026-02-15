import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { Resend } from 'https://esm.sh/resend@3.1.0';

// Define types locally since we are in Deno edge function
interface Template {
    id: string;
    name: string;
    subject: string;
    email_body: string;
    sms_body: string;
    trigger_days_after: number;
    service_type_filter: string[] | null;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!; // Must use service role for background tasks
const supabase = createClient(supabaseUrl, supabaseKey);
const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

Deno.serve(async (req) => {
    try {
        // 0. Check Global Switch
        const { data: settings } = await supabase.from('business_settings').select('*').single();
        if (!settings?.marketing_enabled) {
            return new Response(JSON.stringify({ message: 'Marketing disabled' }), { headers: { 'Content-Type': 'application/json' } });
        }

        const today = new Date();

        // 1. Fetch Active Templates
        const { data: templates } = await supabase
            .from('marketing_templates')
            .select('*')
            .eq('is_active', true);

        if (!templates?.length) {
            return new Response(JSON.stringify({ message: 'No active templates' }), { headers: { 'Content-Type': 'application/json' } });
        }

        const results = [];

        // 2. Loop Templates and Find Matches
        for (const template of templates) {
            // Calculate target date based on trigger_days_after
            const targetDate = new Date();
            targetDate.setDate(today.getDate() - template.trigger_days_after);
            const dateStr = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD

            // Find jobs completed on that date
            // Note: In real production, we'd want a range (coverage for missed crons), 
            // but typical cron logic looks for specific day match.

            const { data: jobs } = await supabase
                .from('fs_jobs')
                .select(`
          id, 
          status, 
          completed_at, 
          customer_id,
          customer:fs_customers!inner(id, name, email, marketing_opt_in)
        `)
                .eq('status', 'completed')
                // Check if completed_at date part matches targetDate
                // Postgres query:  completed_at::date = 'YYYY-MM-DD'
                .filter('completed_at', 'gte', `${dateStr}T00:00:00`)
                .filter('completed_at', 'lt', `${dateStr}T23:59:59`);


            if (!jobs || jobs.length === 0) continue;

            // Process eligible jobs
            for (const job of jobs) {
                if (!job.customer.marketing_opt_in) continue; // Skip opt-outs
                if (!job.customer.email) continue; // Skip no email

                // Check Anti-Spam / Double Dip Logic:
                // Has this customer received THIS template for THIS job?
                // Or for "Service Reminder", maybe just check if sent recently?
                // For now, strict check: don't send same template for same job.

                // Exception: Service Reminder (365 days) might NOT have a job_id if we query by "last job date".
                // But here we queried jobs FROM 365 days ago, so we have a job_id reference.

                const { count } = await supabase
                    .from('campaign_logs')
                    .select('*', { count: 'exact', head: true })
                    .eq('job_id', job.id)
                    .eq('template_id', template.id);

                if (count && count > 0) continue; // Already sent

                // --- SEND LOGIC (Inline or Shared? Edge functions can't import from src/lib easily without monorepo setup) ---
                // We will implement sending logic right here to keep it self-contained in the Edge Function.

                // Prepare Content
                let subject = template.subject;
                let body = template.email_body || '';

                const context: any = {
                    customer_name: job.customer.name,
                    business_name: settings.business_name || 'Field Service',
                    review_url: settings.google_review_url || '#',
                    // Add unsubscribe link
                    unsubscribe_url: `${req.headers.get('origin') || 'http://localhost:3000'}/unsubscribe?c=${job.customer.id}`
                };

                // Replace Tags
                Object.keys(context).forEach(key => {
                    const re = new RegExp(`{{${key}}}`, 'g');
                    subject = subject.replace(re, context[key]);
                    body = body.replace(re, context[key]);
                });

                // Append Unsubscribe explicitly if not present
                body += `<br/><br/><p style="font-size:12px; color:#999"><a href="${context.unsubscribe_url}">Unsubscribe</a></p>`;

                // Send Email
                const { error: sendError } = await resend.emails.send({
                    from: settings.contact_email || 'noreply@fieldservice.com',
                    to: job.customer.email,
                    subject: subject,
                    html: body
                });

                // Log Result
                const logData = {
                    customer_id: job.customer.id,
                    job_id: job.id,
                    template_id: template.id,
                    channel: 'email',
                    status: sendError ? 'failed' : 'sent',
                    error_message: sendError?.message
                };

                await supabase.from('campaign_logs').insert(logData);

                results.push({ job: job.id, status: logData.status });
            }
        }

        return new Response(JSON.stringify({ success: true, processed: results }), {
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
});
