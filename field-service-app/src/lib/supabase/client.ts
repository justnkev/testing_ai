import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            auth: {
                // Use implicit flow so email confirmation links include hash tokens
                // (#access_token=...) instead of PKCE codes (?code=...).
                // PKCE requires the code_verifier cookie from the original browser session,
                // which breaks when users open confirmation emails in incognito or a different browser.
                flowType: 'implicit',
            },
        }
    );
}
