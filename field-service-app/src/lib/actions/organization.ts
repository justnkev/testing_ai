'use server';

import { createClient } from '@/lib/supabase/server';
import { ROLES } from '@/constants/roles';
import { revalidatePath } from 'next/cache';
import { bootstrapOrganization, ensureProfile } from './bootstrap';

export async function getOrganization() {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Unauthorized' };

    // Ensure profile exists first
    await ensureProfile();

    // Get user's profile with organization_id
    const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

    // If no organization_id, attempt bootstrap
    if (!profile?.organization_id) {
        console.log('No organization found for user, attempting bootstrap...');
        const bootstrapResult = await bootstrapOrganization();

        if (bootstrapResult.error) {
            return { error: bootstrapResult.error };
        }

        // Re-fetch profile after bootstrap
        const { data: refreshedProfile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single();

        if (!refreshedProfile?.organization_id) {
            return { error: 'Failed to set up organization. Please contact support.' };
        }

        // Continue with the refreshed profile
        const { data: org, error } = await supabase
            .from('organizations')
            .select('*')
            .eq('id', refreshedProfile.organization_id)
            .single();

        if (error) {
            console.error('Error fetching org after bootstrap:', error);
            return { error: 'Failed to fetch organization' };
        }

        return { data: org, bootstrapped: true };
    }

    // Normal path: organization exists
    const { data: org, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', profile.organization_id)
        .single();

    if (error) {
        console.error('Error fetching org:', error);
        return { error: 'Failed to fetch organization' };
    }

    return { data: org };
}

export async function updateOrganization(prevState: any, formData: FormData) {
    const supabase = await createClient();

    const name = formData.get('name') as string;
    const supportEmail = formData.get('supportEmail') as string;
    const brandColor = formData.get('brandColor') as string;

    // Auth & Permission Check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Unauthorized' };

    const { data: profile } = await supabase
        .from('profiles')
        .select('role, organization_id')
        .eq('id', user.id)
        .single();

    if (profile?.role !== ROLES.ADMIN) {
        return { error: 'Only admins can update organization settings' };
    }

    const { error } = await supabase
        .from('organizations')
        .update({
            name,
            support_email: supportEmail,
            brand_color: brandColor,
            updated_at: new Date().toISOString()
        })
        .eq('id', profile.organization_id);

    if (error) {
        console.error('Error updating org:', error);
        return { error: 'Failed to update organization' };
    }

    // Audit Log
    await supabase.from('audit_logs').insert({
        organization_id: profile.organization_id,
        actor_id: user.id,
        action: 'UPDATE_ORG_SETTINGS',
        target_id: profile.organization_id,
        target_type: 'organization',
        details: { name, support_email: supportEmail }
    });

    revalidatePath('/dashboard/settings/organization');
    return { success: 'Organization settings updated' };
}
