'use server';

import { createServiceClient } from '@/lib/supabase/service';
import { createClient } from '@/lib/supabase/server';
import { UserRole, ROLES } from '@/constants/roles';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const inviteSchema = z.object({
    email: z.string().email('Please enter a valid email address'),
    role: z.enum(['admin', 'manager', 'technician'], {
        message: 'Please select a valid role',
    }),
    fullName: z.string().min(2, 'Full name must be at least 2 characters'),
});

export type InviteState = {
    error?: string;
    success?: string;
    fieldErrors?: Record<string, string[]>;
};

export async function inviteUser(
    _prevState: InviteState,
    formData: FormData
): Promise<InviteState> {
    // 1. Validate input
    const raw = {
        email: formData.get('email') as string,
        role: formData.get('role') as string,
        fullName: formData.get('fullName') as string,
    };

    const parsed = inviteSchema.safeParse(raw);
    if (!parsed.success) {
        return { fieldErrors: parsed.error.flatten().fieldErrors };
    }

    const { email, role, fullName } = parsed.data;

    try {
        // 2. Authorization check — only admins/managers can invite
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) return { error: 'Unauthorized — please log in.' };

        const { data: profile } = await supabase
            .from('profiles')
            .select('role, organization_id')
            .eq('id', user.id)
            .single();

        if (
            !profile ||
            (profile.role !== ROLES.ADMIN && profile.role !== ROLES.MANAGER)
        ) {
            return { error: 'You do not have permission to invite staff.' };
        }

        // 3. Use service role client for admin API
        const supabaseAdmin = createServiceClient();

        const siteUrl =
            process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

        const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
            email,
            {
                data: {
                    full_name: fullName,
                    organization_id: profile.organization_id,
                    role: role,
                },
                redirectTo: `${siteUrl}/auth/callback/invite`,
            }
        );

        if (error) {
            if (error.message.includes('already registered') || error.status === 422) {
                return { error: 'This user is already registered.' };
            }
            console.error('Invite error:', error);
            return { error: error.message };
        }

        // 4. Update profile with role & org
        if (data.user) {
            await supabaseAdmin
                .from('profiles')
                .update({
                    role: role as UserRole,
                    organization_id: profile.organization_id,
                    is_active: true,
                })
                .eq('id', data.user.id);

            // Audit log
            await supabase.from('audit_logs').insert({
                organization_id: profile.organization_id,
                actor_id: user.id,
                action: 'INVITE_USER',
                target_id: data.user.id,
                target_type: 'profile',
                details: { email, role, full_name: fullName },
            });
        }

        revalidatePath('/dashboard/settings/invite');
        revalidatePath('/dashboard/settings/team');
        return { success: `Invitation sent to ${email} as ${role}.` };
    } catch (err) {
        console.error('Unexpected invite error:', err);
        return { error: 'An unexpected error occurred.' };
    }
}
