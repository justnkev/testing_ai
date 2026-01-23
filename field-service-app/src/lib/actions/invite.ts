'use server';

import { createClient } from '@supabase/supabase-js';
import { UserRole, ROLES } from '@/constants/roles';
import { revalidatePath } from 'next/cache';
import { createClient as createServerClient } from '@/lib/supabase/server';

export async function inviteStaff(prevState: any, formData: FormData) {
    const email = formData.get('email') as string;
    const role = formData.get('role') as UserRole;
    const fullName = formData.get('fullName') as string;

    if (!email || !role || !fullName) {
        return { error: 'Please fill in all fields' };
    }

    try {
        // 1. Check if current user is admin/manager (using standard client)
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { error: 'Unauthorized' };

        const { data: profile } = await supabase
            .from('profiles')
            .select('role, organization_id')
            .eq('id', user.id)
            .single();

        if (!profile || (profile.role !== ROLES.ADMIN && profile.role !== ROLES.MANAGER)) {
            return { error: 'You do not have permission to invite staff' };
        }

        // 2. Initialize Admin Client
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            return { error: 'Server misconfiguration: Missing Service Role Key' };
        }

        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        );

        // 3. Invite User by Email
        const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
            data: {
                full_name: fullName,
                organization_id: profile.organization_id // Assign to same org
            }
        });

        if (error) {
            if (error.message.includes('already registered') || error.status === 422) {
                return { error: 'User is already registered.' };
            }
            console.error('Invite error:', error);
            return { error: error.message };
        }

        if (data.user) {
            // 4. Update the profile with the correct role and org
            const { error: profileError } = await supabaseAdmin
                .from('profiles')
                .update({
                    role: role,
                    organization_id: profile.organization_id,
                    is_active: true
                })
                .eq('id', data.user.id);

            if (profileError) {
                console.error('Profile update error:', profileError);
                return { error: 'User invited but failed to set profile details. Please update manually.' };
            }

            // 5. Audit Log
            await supabase.from('audit_logs').insert({
                organization_id: profile.organization_id,
                actor_id: user.id,
                action: 'INVITE_USER',
                target_id: data.user.id,
                target_type: 'profile',
                details: { email, role, full_name: fullName }
            });
        }

        revalidatePath('/dashboard/settings/invite');
        revalidatePath('/dashboard/settings/team');
        return { success: `Invitation sent to ${email} as ${role}` };

    } catch (err) {
        console.error('Unexpected error:', err);
        return { error: 'An unexpected error occurred' };
    }
}
