// Supabase Edge Function: notify-customer
// Handles automated SMS (Twilio) and Email (Resend) notifications on job status changes

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Types
interface JobRecord {
    id: string;
    customer_id: string;
    title: string;
    status: string;
    scheduled_date: string;
    scheduled_time: string | null;
    user_id: string;
}

interface Customer {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    marketing_opt_in: boolean;
}

interface WebhookPayload {
    type: "INSERT" | "UPDATE";
    table: string;
    schema: string;
    record: JobRecord;
    old_record: JobRecord | null;
}

interface NotificationResult {
    channel: "sms" | "email";
    success: boolean;
    messageId?: string;
    error?: string;
}

// Template rendering with {{variable}} substitution
function renderTemplate(template: string, data: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] || "");
}

// Check if current time is within quiet hours (9 PM - 8 AM)
function isQuietHours(): boolean {
    const now = new Date();
    const hour = now.getHours();
    return hour >= 21 || hour < 8;
}

// SMS Templates
const SMS_TEMPLATES = {
    en_route: "Hi {{customer_name}}, your technician is on the way! Track your job here: {{tracking_url}}",
};

// Email Templates
const EMAIL_TEMPLATES = {
    scheduled: {
        subject: "Job Confirmed - {{job_title}}",
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Job Confirmed</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%); padding: 32px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">✓ Job Confirmed</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px 32px;">
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                Hi <strong>{{customer_name}}</strong>,
              </p>
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                Your job has been confirmed and scheduled. Here are the details:
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F9FAFB; border-radius: 8px; padding: 24px; margin: 0 0 24px;">
                <tr>
                  <td style="padding: 16px;">
                    <p style="color: #6B7280; font-size: 14px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.5px;">Job</p>
                    <p style="color: #111827; font-size: 18px; font-weight: 600; margin: 0;">{{job_title}}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px; border-top: 1px solid #E5E7EB;">
                    <p style="color: #6B7280; font-size: 14px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.5px;">Date & Time</p>
                    <p style="color: #111827; font-size: 18px; font-weight: 600; margin: 0;">{{scheduled_date}} at {{scheduled_time}}</p>
                  </td>
                </tr>
              </table>
              <p style="color: #6B7280; font-size: 14px; line-height: 1.6; margin: 0;">
                We'll send you another notification when your technician is on the way.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #F9FAFB; padding: 24px 32px; text-align: center; border-top: 1px solid #E5E7EB;">
              <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
                You received this email because you have a job scheduled with us.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    },
    completed: {
        subject: "Job Complete - {{job_title}}",
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Job Complete</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); padding: 32px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">🎉 Job Complete!</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px 32px;">
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                Hi <strong>{{customer_name}}</strong>,
              </p>
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                Great news! Your job "<strong>{{job_title}}</strong>" has been completed successfully.
              </p>
              <!-- Invoice Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 32px;">
                <tr>
                  <td align="center">
                    <a href="{{invoice_url}}" style="display: inline-block; background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                      📄 View Invoice
                    </a>
                  </td>
                </tr>
              </table>
              <!-- Divider -->
              <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 32px 0;">
              <!-- Review Section -->
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 16px; text-align: center;">
                How was your experience? We'd love to hear from you!
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="{{review_url}}" style="display: inline-block; background-color: #FEF3C7; color: #D97706; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; border: 2px solid #FCD34D;">
                      ⭐ Leave a Review
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #F9FAFB; padding: 24px 32px; text-align: center; border-top: 1px solid #E5E7EB;">
              <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
                Thank you for choosing us! We appreciate your business.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    },
};

// Send SMS via Twilio
async function sendSMS(
    phone: string,
    message: string
): Promise<NotificationResult> {
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const fromNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!accountSid || !authToken || !fromNumber) {
        return { channel: "sms", success: false, error: "Twilio credentials not configured" };
    }

    try {
        const response = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
                },
                body: new URLSearchParams({
                    To: phone,
                    From: fromNumber,
                    Body: message,
                }),
            }
        );

        const data = await response.json();

        if (!response.ok) {
            return { channel: "sms", success: false, error: data.message || "Twilio API error" };
        }

        return { channel: "sms", success: true, messageId: data.sid };
    } catch (error) {
        return { channel: "sms", success: false, error: String(error) };
    }
}

// Send Email via Resend
async function sendEmail(
    to: string,
    subject: string,
    html: string
): Promise<NotificationResult> {
    const apiKey = Deno.env.get("RESEND_API_KEY");

    if (!apiKey) {
        return { channel: "email", success: false, error: "Resend API key not configured" };
    }

    try {
        const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                from: "notifications@resend.dev", // Change to your verified domain
                to: [to],
                subject,
                html,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            return { channel: "email", success: false, error: data.message || "Resend API error" };
        }

        return { channel: "email", success: true, messageId: data.id };
    } catch (error) {
        return { channel: "email", success: false, error: String(error) };
    }
}

// Main handler
Deno.serve(async (req) => {
    try {
        // Parse webhook payload
        const payload: WebhookPayload = await req.json();
        console.log("Received webhook:", JSON.stringify(payload, null, 2));

        const { record: job, old_record: oldJob, type } = payload;

        // Only process status changes we care about
        const notifiableStatuses = ["scheduled", "en_route", "completed"];
        const isStatusChange = type === "UPDATE" && oldJob?.status !== job.status;
        const isNewScheduled = type === "INSERT" && job.status === "scheduled";

        if (!notifiableStatuses.includes(job.status) || (!isStatusChange && !isNewScheduled)) {
            return new Response(JSON.stringify({ message: "No notification needed" }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            });
        }

        // Initialize Supabase client with service role
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Fetch customer details
        const { data: customer, error: customerError } = await supabase
            .from("fs_customers")
            .select("id, name, email, phone, marketing_opt_in")
            .eq("id", job.customer_id)
            .single();

        if (customerError || !customer) {
            console.error("Failed to fetch customer:", customerError);
            return new Response(JSON.stringify({ error: "Customer not found" }), {
                status: 404,
                headers: { "Content-Type": "application/json" },
            });
        }

        // Check opt-out
        if (!customer.marketing_opt_in) {
            console.log("Customer opted out of notifications");
            return new Response(JSON.stringify({ message: "Customer opted out" }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            });
        }

        const baseUrl = Deno.env.get("NOTIFICATION_BASE_URL") || "https://example.com";
        const notificationType = job.status as "scheduled" | "en_route" | "completed";
        const results: NotificationResult[] = [];

        // Prepare template data
        const templateData: Record<string, string> = {
            customer_name: customer.name,
            job_title: job.title,
            scheduled_date: job.scheduled_date,
            scheduled_time: job.scheduled_time || "TBD",
            tracking_url: `${baseUrl}/track/${job.id}`,
            invoice_url: `${baseUrl}/invoice/${job.id}`,
            review_url: `${baseUrl}/review/${job.id}`,
        };

        // Helper to log notification attempt
        async function logNotification(
            channel: "sms" | "email",
            result: NotificationResult,
            payloadData: Record<string, unknown>,
            shouldQueue = false
        ) {
            try {
                await supabase.from("communication_logs").insert({
                    job_id: job.id,
                    customer_id: customer.id,
                    notification_type: notificationType,
                    channel,
                    status: shouldQueue ? "queued" : result.success ? "sent" : "failed",
                    provider_message_id: result.messageId,
                    error_message: result.error,
                    payload: payloadData,
                    sent_at: result.success && !shouldQueue ? new Date().toISOString() : null,
                });
            } catch (logError) {
                // Check for unique constraint violation (duplicate)
                if (String(logError).includes("unique") || String(logError).includes("duplicate")) {
                    console.log(`Duplicate notification prevented: ${channel} for job ${job.id}`);
                } else {
                    console.error("Failed to log notification:", logError);
                }
            }
        }

        // Handle "en_route" status - SMS
        if (notificationType === "en_route" && customer.phone) {
            // Check quiet hours
            if (isQuietHours()) {
                console.log("Quiet hours - queuing SMS");
                await logNotification("sms", { channel: "sms", success: false, error: "Quiet hours" }, { message: SMS_TEMPLATES.en_route }, true);
            } else {
                const message = renderTemplate(SMS_TEMPLATES.en_route, templateData);
                const smsResult = await sendSMS(customer.phone, message);
                results.push(smsResult);
                await logNotification("sms", smsResult, { message });
            }
        }

        // Handle "scheduled" status - Email
        if (notificationType === "scheduled" && customer.email) {
            const template = EMAIL_TEMPLATES.scheduled;
            const subject = renderTemplate(template.subject, templateData);
            const html = renderTemplate(template.html, templateData);
            const emailResult = await sendEmail(customer.email, subject, html);
            results.push(emailResult);
            await logNotification("email", emailResult, { subject });
        }

        // Handle "completed" status - Email
        if (notificationType === "completed" && customer.email) {
            const template = EMAIL_TEMPLATES.completed;
            const subject = renderTemplate(template.subject, templateData);
            const html = renderTemplate(template.html, templateData);
            const emailResult = await sendEmail(customer.email, subject, html);
            results.push(emailResult);
            await logNotification("email", emailResult, { subject });
        }

        console.log("Notification results:", results);

        return new Response(
            JSON.stringify({
                success: true,
                job_id: job.id,
                status: job.status,
                results,
            }),
            {
                status: 200,
                headers: { "Content-Type": "application/json" },
            }
        );
    } catch (error) {
        console.error("Edge Function error:", error);
        return new Response(JSON.stringify({ error: String(error) }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
});
