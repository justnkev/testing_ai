'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

/**
 * Bootstrap organization for a user who doesn't have one yet.
 * This is called when a user logs in and has no organization_id.
 * 
 * For the first user in the system, creates a new org and makes them admin.
 * For invited users, this should not be called (they get org_id during invite).
 */
export async function bootstrapOrganization() {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Unauthorized' };

    // Check if user already has an organization
    const { data: existingProfile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

    if (existingProfile?.organization_id) {
        // User already has an org, nothing to do
        return { success: true, message: 'Organization already exists' };
    }

    // Check if there's a default organization to join
    // (For single-tenant mode, all users join the same org)
    const { data: defaultOrg } = await supabase
        .from('organizations')
        .select('id')
        .limit(1)
        .single();

    if (defaultOrg) {
        // Join existing organization
        const { error: updateError } = await supabase
            .from('profiles')
            .update({
                organization_id: defaultOrg.id,
                is_active: true
            })
            .eq('id', user.id);

        if (updateError) {
            console.error('Error linking user to org:', updateError);
            return { error: 'Failed to link your account to organization' };
        }

        revalidatePath('/dashboard');
        return { success: true, organizationId: defaultOrg.id };
    }

    // No organization exists - create one (first user scenario)
    const orgName = user.email?.split('@')[1] || 'My Organization';

    const { data: newOrg, error: orgError } = await supabase
        .from('organizations')
        .insert({
            name: orgName,
            support_email: user.email
        })
        .select()
        .single();

    if (orgError || !newOrg) {
        console.error('Error creating organization:', orgError);
        return { error: 'Failed to create organization' };
    }

    // Link user to new org as admin
    const { error: profileError } = await supabase
        .from('profiles')
        .update({
            organization_id: newOrg.id,
            role: 'admin',
            is_active: true
        })
        .eq('id', user.id);

    if (profileError) {
        console.error('Error updating profile:', profileError);
        return { error: 'Failed to set up your account' };
    }

    // Log the bootstrap event
    await supabase.from('audit_logs').insert({
        organization_id: newOrg.id,
        actor_id: user.id,
        action: 'ORGANIZATION_CREATED',
        target_type: 'organization',
        target_id: newOrg.id,
        details: { name: orgName }
    });

    revalidatePath('/dashboard');
    return { success: true, organizationId: newOrg.id };
}

/**
 * Ensure the current user has a profile entry.
 * Called on first login to create profile if missing.
 */
export async function ensureProfile() {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Unauthorized' };

    // Check if profile exists
    const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();

    if (profile) {
        return { success: true, exists: true };
    }

    // Create profile
    const { error } = await supabase
        .from('profiles')
        .insert({
            id: user.id,
            email: user.email,
            display_name: user.user_metadata?.full_name || user.email?.split('@')[0]
        });

    if (error) {
        console.error('Error creating profile:', error);
        return { error: 'Failed to create profile' };
    }

    return { success: true, exists: false };
}
