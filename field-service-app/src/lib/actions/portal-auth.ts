'use server';

import { createServiceClient } from '@/lib/supabase/service';
import { Resend } from 'resend';
import crypto from 'crypto';

const resend = new Resend(process.env.RESEND_API_KEY);

interface TokenValidationResult {
    valid: boolean;
    customerId?: string;
    customerEmail?: string;
    customerName?: string;
    expired?: boolean;
    revoked?: boolean;
}

/**
 * Generate a secure portal token for a customer
 * @param customerId - UUID of the customer
 * @param expiryDays - Number of days until token expires (default: 30)
 * @returns The generated token string
 */
export async function generatePortalToken(
    customerId: string,
    expiryDays: number = 30
): Promise<{ success: boolean; token?: string; error?: string }> {
    try {
        const supabase = createServiceClient();

        // Verify customer exists
        const { data: customer, error: customerError } = await supabase
            .from('fs_customers')
            .select('id, name, email')
            .eq('id', customerId)
            .single();

        if (customerError || !customer) {
            return { success: false, error: 'Customer not found' };
        }

        // Generate cryptographically secure token
        const token = crypto.randomBytes(32).toString('base64url');

        // Calculate expiry date
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiryDays);

        // Insert token into database
        const { error: insertError } = await supabase
            .from('portal_tokens')
            .insert({
                customer_id: customerId,
                token,
                expires_at: expiresAt.toISOString(),
            });

        if (insertError) {
            console.error('Error creating portal token:', insertError);
            return { success: false, error: 'Failed to create portal token' };
        }

        return { success: true, token };
    } catch (error) {
        console.error('Error in generatePortalToken:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
}

/**
 * Validate a portal token and return customer information
 * @param token - The portal token to validate
 * @returns Validation result with customer info if valid
 */
export async function validatePortalToken(
    token: string
): Promise<TokenValidationResult> {
    try {
        const supabase = createServiceClient();

        // Fetch token with customer info
        const { data: tokenData, error: tokenError } = await supabase
            .from('portal_tokens')
            .select(`
        id,
        customer_id,
        expires_at,
        revoked_at,
        fs_customers (
          id,
          name,
          email
        )
      `)
            .eq('token', token)
            .single();

        if (tokenError || !tokenData) {
            return { valid: false };
        }

        // Check if revoked
        if (tokenData.revoked_at) {
            return { valid: false, revoked: true };
        }

        // Check if expired
        const now = new Date();
        const expiresAt = new Date(tokenData.expires_at);
        if (expiresAt < now) {
            return {
                valid: false,
                expired: true,
                customerId: tokenData.customer_id,
            };
        }

        // Update last accessed timestamp
        await supabase
            .from('portal_tokens')
            .update({ last_accessed_at: new Date().toISOString() })
            .eq('id', tokenData.id);

        const customer = Array.isArray(tokenData.fs_customers)
            ? tokenData.fs_customers[0]
            : tokenData.fs_customers;

        return {
            valid: true,
            customerId: tokenData.customer_id,
            customerEmail: customer?.email,
            customerName: customer?.name,
        };
    } catch (error) {
        console.error('Error in validatePortalToken:', error);
        return { valid: false };
    }
}

/**
 * Refresh an expired token for a customer
 * @param customerId - UUID of the customer
 * @returns New token
 */
export async function refreshPortalToken(
    customerId: string
): Promise<{ success: boolean; token?: string; error?: string }> {
    try {
        const supabase = createServiceClient();

        // Revoke existing tokens for this customer
        await supabase
            .from('portal_tokens')
            .update({ revoked_at: new Date().toISOString() })
            .eq('customer_id', customerId)
            .is('revoked_at', null);

        // Generate new token
        return await generatePortalToken(customerId);
    } catch (error) {
        console.error('Error in refreshPortalToken:', error);
        return { success: false, error: 'Failed to refresh token' };
    }
}

/**
 * Send portal link email to customer using Resend
 * @param customerId - UUID of the customer
 * @param token - Portal token
 * @returns Success status
 */
export async function sendPortalLinkEmail(
    customerId: string,
    token: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = createServiceClient();

        // Fetch customer info
        const { data: customer, error: customerError } = await supabase
            .from('fs_customers')
            .select('name, email')
            .eq('id', customerId)
            .single();

        if (customerError || !customer || !customer.email) {
            return { success: false, error: 'Customer email not found' };
        }

        // Fetch business settings for branding
        const { data: settings } = await supabase
            .from('business_settings')
            .select('business_name, contact_email')
            .single();

        const businessName = settings?.business_name || 'Field Service Co.';
        const portalUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/portal/${token}`;

        // Send email via Resend
        const { error: emailError } = await resend.emails.send({
            from: settings?.contact_email || 'noreply@example.com',
            to: customer.email,
            subject: `Your ${businessName} Customer Portal Access`,
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Hello ${customer.name},</h2>
          <p>Access your customer portal to view your service history, pending estimates, and invoices.</p>
          <p style="margin: 30px 0;">
            <a href="${portalUrl}" style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
              Access Portal
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">
            This link will expire in 30 days. If you need a new link, you can request one from the portal page.
          </p>
          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            — ${businessName}
          </p>
        </div>
      `,
        });

        if (emailError) {
            console.error('Error sending portal email:', emailError);
            return { success: false, error: 'Failed to send email' };
        }

        return { success: true };
    } catch (error) {
        console.error('Error in sendPortalLinkEmail:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
}

/**
 * Request a new portal link for an email address
 * @param email - Customer email
 * @returns Success status
 */
export async function requestNewPortalLink(
    email: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = createServiceClient();

        // Find customer by email
        const { data: customer, error: customerError } = await supabase
            .from('fs_customers')
            .select('id, email, name')
            .eq('email', email)
            .single();

        if (customerError || !customer) {
            // Don't reveal if email exists for security
            return { success: true }; // Still return success to prevent email enumeration
        }

        // Generate and send new token
        const { success, token } = await refreshPortalToken(customer.id);

        if (success && token) {
            await sendPortalLinkEmail(customer.id, token);
        }

        return { success: true };
    } catch (error) {
        console.error('Error in requestNewPortalLink:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
}
