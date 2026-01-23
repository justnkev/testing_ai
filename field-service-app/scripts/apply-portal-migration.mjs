// Migration script to create portal tables
// Run with: node scripts/apply-portal-migration.mjs

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://skolvxmcritlzepnaogd.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrb2x2eG1jcml0bHplcG5hb2dkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDUyMDgzMywiZXhwIjoyMDc2MDk2ODMzfQ.UOKevKp9W6svGNhfRwhxr1mU_0cQf7H4fbc-Ye7FsmE';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
    console.log('Starting portal tables migration...');

    // Test connection first
    const { data: tables, error: testError } = await supabase
        .from('fs_customers')
        .select('id')
        .limit(1);

    if (testError) {
        console.error('Connection test failed:', testError);
        return;
    }
    console.log('✓ Connected to Supabase');

    // Check if portal_tokens table exists
    const { data: tokenTest, error: tokenError } = await supabase
        .from('portal_tokens')
        .select('id')
        .limit(1);

    if (tokenError?.code === '42P01') {
        console.log('Portal tables do not exist - please run the SQL migration manually');
        console.log('File: supabase/migrations/20260122_create_portal_tables.sql');
    } else if (!tokenError) {
        console.log('✓ Portal tables already exist!');

        // Create a test token to verify write access
        const testCustomerId = '93c5c2d3-adcb-4e68-9d3b-8b5f6b357396';
        const testToken = 'test-' + Date.now();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        const { data: insertResult, error: insertError } = await supabase
            .from('portal_tokens')
            .insert({
                customer_id: testCustomerId,
                token: testToken,
                expires_at: expiresAt.toISOString()
            })
            .select();

        if (insertError) {
            console.error('✗ Failed to create test token:', insertError);
        } else {
            console.log('✓ Test token created successfully:', insertResult[0].token);
            console.log('\nPortal URL: http://localhost:3000/portal/' + testToken);
        }
    } else {
        console.error('Error checking portal_tokens:', tokenError);
    }
}

runMigration().catch(console.error);
