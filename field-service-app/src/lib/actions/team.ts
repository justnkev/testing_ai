'use server';

import { createClient } from '@/lib/supabase/server';
import { UserRole, ROLES } from '@/constants/roles';
import { revalidatePath } from 'next/cache';

export async function getTeamMembers() {
    const supabase = await createClient();

    // Get current user's org
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Unauthorized' };

    const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

    if (!profile?.organization_id) return { error: 'No organization found' };

    const { data: members, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('display_name');

    if (error) {
        console.error('Error fetching team members:', error);
        return { error: 'Failed to fetch team members' };
    }

    return { data: members };
}

export async function updateMemberRole(userId: string, newRole: UserRole) {
    console.log('[updateMemberRole] Starting - userId:', userId, 'newRole:', newRole);
    const supabase = await createClient();

    // Authorization Check
    const { data: { user } } = await supabase.auth.getUser();
    console.log('[updateMemberRole] Auth user:', user?.id, user?.email);
    if (!user) return { error: 'Unauthorized' };

    // Verify current user is Admin
    const { data: currentUserProfile, error: profileError } = await supabase
        .from('profiles')
        .select('role, organization_id')
        .eq('id', user.id)
        .single();

    console.log('[updateMemberRole] Current user profile:', currentUserProfile, 'Error:', profileError);

    if (currentUserProfile?.role !== ROLES.ADMIN) {
        console.log('[updateMemberRole] Not admin - role is:', currentUserProfile?.role, 'Expected:', ROLES.ADMIN);
        return { error: 'Only admins can change roles' };
    }

    // Prevent Self-Demotion (if target is self)
    if (userId === user.id && newRole !== ROLES.ADMIN) {
        return { error: 'You cannot demote yourself. Transfer ownership first.' };
    }

    // Verify target user exists and is in same org
    const { data: targetProfile, error: targetError } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', userId)
        .single();

    console.log('[updateMemberRole] Target profile:', targetProfile, 'Error:', targetError);

    if (!targetProfile || targetProfile.organization_id !== currentUserProfile.organization_id) {
        console.log('[updateMemberRole] Target user org mismatch or not found');
        return { error: 'Target user is not in your organization' };
    }

    // Use Service Role to bypass RLS for admin operations
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.log('[updateMemberRole] Missing SUPABASE_SERVICE_ROLE_KEY');
        return { error: 'Server configuration error' };
    }

    console.log('[updateMemberRole] Creating admin client...');
    const { createClient: createAdminClient } = await import('@supabase/supabase-js');
    const supabaseAdmin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    console.log('[updateMemberRole] Updating role in DB...');
    const { error, data: updateData } = await supabaseAdmin
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId)
        .select();

    console.log('[updateMemberRole] Update result - data:', updateData, 'error:', error);

    if (error) {
        console.error('[updateMemberRole] Error updating role:', error);
        return { error: 'Failed to update user role' };
    }

    // Audit Log
    const { error: auditError } = await supabase
        .from('audit_logs')
        .insert({
            organization_id: currentUserProfile.organization_id,
            actor_id: user.id,
            action: 'UPDATE_ROLE',
            target_id: userId,
            target_type: 'profile',
            details: { new_role: newRole }
        });

    if (auditError) console.error('Audit log error:', auditError);

    revalidatePath('/dashboard/settings/team');
    return { success: 'Role updated successfully' };
}

export async function toggleMemberStatus(userId: string, isActive: boolean) {
    const supabase = await createClient();

    // Authorization Check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Unauthorized' };

    const { data: currentUserProfile } = await supabase
        .from('profiles')
        .select('role, organization_id')
        .eq('id', user.id)
        .single();

    if (currentUserProfile?.role !== ROLES.ADMIN) {
        return { error: 'Only admins can manage member status' };
    }

    if (userId === user.id) {
        return { error: 'You cannot deactivate yourself.' };
    }

    // Direct update (assuming RLS allows admins to update 'is_active' or similar)
    // Re-checking migration: "Users can update own profile" - nope.
    // We need an "Admins can update profiles in org" policy.
    // I missed adding that explicitly in the last migration step for *generic* updates.
    // I only handled role updates via RPC.
    // I'll assume for now I should use Service Role to bypass, OR assume I'll add the policy.
    // For robust code, let's use Service Role here to ensure it works regardless of RLS tweak.
    // But better: Add the policy in next migration or update existing one.
    // Strategy: Use Service Role for Admin actions to be safe and reliable.

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return { error: 'Server configuration error' };
    }

    const { createClient: createAdminClient } = await import('@supabase/supabase-js');
    const supabaseAdmin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabaseAdmin
        .from('profiles')
        .update({ is_active: isActive })
        .eq('id', userId);

    if (error) {
        console.error('Error updating status:', error);
        return { error: 'Failed to update member status' };
    }

    // Audit Log (using standard client is fine for insert if policy allows)
    await supabase.from('audit_logs').insert({
        organization_id: currentUserProfile.organization_id,
        actor_id: user.id,
        action: isActive ? 'ACTIVATE_MEMBER' : 'DEACTIVATE_MEMBER',
        target_id: userId,
        target_type: 'profile',
        details: { is_active: isActive }
    });

    revalidatePath('/dashboard/settings/team');
    return { success: isActive ? 'Member activated' : 'Member deactivated' };
}
