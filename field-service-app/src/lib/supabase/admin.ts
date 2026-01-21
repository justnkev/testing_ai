import { createClient } from '@supabase/supabase-js';

/**
 * Supabase Admin Client
 * Uses SERVICE_ROLE_KEY to bypass RLS - for webhooks and server-side operations only
 * NEVER expose this to the client!
 */
export function createAdminClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error('Missing Supabase admin credentials');
    }

    return createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}
