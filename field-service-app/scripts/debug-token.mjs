// Debug script to check portal token validation
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://skolvxmcritlzepnaogd.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrb2x2eG1jcml0bHplcG5hb2dkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDUyMDgzMywiZXhwIjoyMDc2MDk2ODMzfQ.UOKevKp9W6svGNhfRwhxr1mU_0cQf7H4fbc-Ye7FsmE';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugToken() {
    const token = 'test-1769132977587';

    console.log('Checking token:', token);

    // Direct query to portal_tokens
    const { data: tokenData, error: tokenError } = await supabase
        .from('portal_tokens')
        .select(`
      id,
      customer_id,
      token,
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

    if (tokenError) {
        console.error('Token lookup error:', tokenError);
        return;
    }

    console.log('Token data:', JSON.stringify(tokenData, null, 2));

    // Check expiry
    const now = new Date();
    const expiresAt = new Date(tokenData.expires_at);
    console.log('Current time:', now.toISOString());
    console.log('Expires at:', expiresAt.toISOString());
    console.log('Is expired:', expiresAt < now);
    console.log('Is revoked:', tokenData.revoked_at !== null);

    // List all tokens
    const { data: allTokens } = await supabase
        .from('portal_tokens')
        .select('token, expires_at, revoked_at')
        .limit(5);
    console.log('\nAll tokens:', allTokens);
}

debugToken().catch(console.error);
