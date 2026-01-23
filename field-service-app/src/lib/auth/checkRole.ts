import { createClient } from '@/lib/supabase/server';
import { UserRole } from '@/constants/roles';

export async function checkRole(allowedRoles: UserRole[]) {
    const supabase = await createClient();

    // Get user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return false;
    }

    // Get profile role
    // Using single() can fail if no row found, returning null/error.
    // If we rely on the claim in user_metadata that's faster, but database is source of truth.
    // Let's fetch from DB for security.
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (error || !profile) {
        // Fallback: Check metadata if we synced it there, or just fail.
        // For now, fail safe.
        return false;
    }

    return allowedRoles.includes(profile.role as UserRole);
}
