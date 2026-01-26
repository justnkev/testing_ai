'use server';

import { createServiceClient } from '@/lib/supabase/service';
import { z } from 'zod';
import { Resend } from 'resend';
import { revalidatePath } from 'next/cache';

// Public Validation Schema
const leadSchema = z.object({
    honeypot: z.string().optional(), // Must be empty
    org_id: z.string().uuid(),
    contact: z.object({
        name: z.string().min(2, 'Name is required'),
        email: z.string().email('Invalid email address'),
        phone: z.string().min(10, 'Valid phone number is required'),
        address: z.string().min(5, 'Address is required'),
        city: z.string().min(2, 'City is required'),
        state: z.string().min(2, 'State is required'),
        zip_code: z.string().min(5, 'ZIP code is required'),
    }),
    service: z.object({
        title: z.string().min(3, 'Service needed is required'),
        description: z.string().optional(),
        preferred_date: z.string().min(1, 'Date is required'),
        preferred_time: z.string().optional(),
    }),
});

export type LeadFormData = z.infer<typeof leadSchema>;

export async function submitLead(data: LeadFormData) {
    // 1. Honeypot Check (Anti-Spam)
    if (data.honeypot && data.honeypot.length > 0) {
        // Silent success to fool bots
        return { success: true };
    }

    // 2. Validate Data
    const result = leadSchema.safeParse(data);
    if (!result.success) {
        return { success: false, error: result.error.issues[0].message };
    }

    const { contact, service, org_id } = result.data;

    // 3. Initialize Service Client (Bypass RLS)
    const supabase = createServiceClient();

    try {
        // 4. Verify Organization Exists
        const { data: org, error: orgError } = await supabase
            .from('business_settings')
            .select('id, business_name, contact_email')
            //.eq('id', org_id) // Ideally check IDs match if multiple orgs supported, for now assume single tenant or validation
            .single();

        if (orgError || !org) {
            return { success: false, error: 'Invalid organization ID' };
        }

        // 5. Find or Create Customer
        let customerId: string;

        const { data: existingCustomer } = await supabase
            .from('fs_customers')
            .select('id')
            .eq('email', contact.email)
            .single();

        if (existingCustomer) {
            customerId = existingCustomer.id;
        } else {
            // Create new customer
            const { data: newCustomer, error: createError } = await supabase
                .from('fs_customers')
                .insert({
                    name: contact.name,
                    email: contact.email,
                    phone: contact.phone,
                    address: contact.address,
                    city: contact.city,
                    state: contact.state,
                    zip_code: contact.zip_code,
                    notes: 'Created via Public Booking Widget',
                })
                .select('id')
                .single();

            if (createError) throw new Error('Failed to create customer record');
            customerId = newCustomer.id;
        }

        // 6. Create Job (Lead)
        const { error: jobError } = await supabase.from('fs_jobs').insert({
            customer_id: customerId,
            title: service.title,
            description: service.description || '',
            status: 'requested', // New status we just added
            scheduled_date: service.preferred_date,
            scheduled_time: service.preferred_time || null,
            priority: 'normal',
            latitude: 0, // Placeholder, would ideally geocode
            longitude: 0,
            notes: 'Incoming Web Lead',
            // is_lead: true -- Add column later if needed, mostly implied by 'requested' status
        });

        if (jobError) throw new Error('Failed to create job request: ' + jobError.message);

        // 7. Send Notification (Resend)
        const resend = new Resend(process.env.RESEND_API_KEY);

        if (org.contact_email) {
            await resend.emails.send({
                from: 'Field Service App <onboarding@resend.dev>',
                to: org.contact_email,
                subject: `New Job Request: ${contact.name}`,
                html: `
                    <h1>New Web Lead</h1>
                    <p><strong>Customer:</strong> ${contact.name} (${contact.email})</p>
                    <p><strong>Service:</strong> ${service.title}</p>
                    <p><strong>Date Requested:</strong> ${service.preferred_date}</p>
                    <br/>
                    <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/jobs">View in Dashboard</a>
                `
            });
        }

        // 8. Revalidate (Admin might be looking at dashboard)
        revalidatePath('/dashboard/jobs');

        return { success: true };

    } catch (err: any) {
        console.error('Lead Submission Error:', err);
        return { success: false, error: err.message || 'Failed to submit request' };
    }
}
