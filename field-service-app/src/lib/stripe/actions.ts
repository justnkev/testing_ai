'use server';

import { stripe, getWebhookSecret } from './client';
import { createServiceClient } from '@/lib/supabase/service';
import { createClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export async function createStripeConnectAccount(userId: string) {
    const supabase = createServiceClient();

    // 1. Get user email
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (!profile) throw new Error('Profile not found');
    if (profile.stripe_connect_id) {
        return { accountId: profile.stripe_connect_id };
    }

    // 2. Create Express Account
    const account = await stripe.accounts.create({
        type: 'express',
        country: 'US',
        email: profile.email,
        capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
        },
    });

    // 3. Save ID
    await supabase.from('profiles')
        .update({ stripe_connect_id: account.id })
        .eq('id', userId);

    return { accountId: account.id };
}

export async function createAccountLink() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const serviceSupabase = createServiceClient();
    const { data: profile } = await serviceSupabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    let accountId = profile.stripe_connect_id;

    if (!accountId) {
        const result = await createStripeConnectAccount(user.id);
        accountId = result.accountId;
    }

    const headersList = await headers();
    const origin = headersList.get('origin') || 'http://localhost:3000';

    const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${origin}/dashboard/settings/profile`,
        return_url: `${origin}/dashboard/settings/profile`,
        type: 'account_onboarding',
    });

    return redirect(accountLink.url);
}

export async function getStripeAccountStatus() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
        .from('profiles')
        .select('stripe_connect_id')
        .eq('id', user.id)
        .single();

    if (!profile?.stripe_connect_id) return { isConnected: false };

    const account = await stripe.accounts.retrieve(profile.stripe_connect_id);
    return {
        isConnected: account.details_submitted,
        accountId: account.id,
    };
}
