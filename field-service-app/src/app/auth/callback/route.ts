import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    const next = searchParams.get('next') ?? '/dashboard';

    // ── Handle Supabase error redirects (e.g., expired OTP, access denied) ──
    const error = searchParams.get('error');
    const errorCode = searchParams.get('error_code');
    const errorDescription = searchParams.get('error_description');

    if (error) {
        console.error('[Auth Callback] Supabase error:', {
            error,
            errorCode,
            errorDescription,
        });

        const loginUrl = new URL(`${origin}/login`);
        loginUrl.searchParams.set('error', errorCode || error);
        if (errorDescription) {
            loginUrl.searchParams.set('message', errorDescription);
        }
        return NextResponse.redirect(loginUrl.toString());
    }

    // ── Handle PKCE code exchange ──
    if (code) {
        const supabase = await createClient();
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

        if (!exchangeError) {
            // Determine if this is an invite or recovery flow
            const {
                data: { user },
            } = await supabase.auth.getUser();

            // For invite flows, add type=invite param to the set-new-password page
            if (next === '/auth/set-new-password' && user) {
                const isInvite =
                    user.user_metadata?.role ||
                    user.user_metadata?.organization_id;
                const url = new URL(`${origin}${next}`);
                if (isInvite) {
                    url.searchParams.set('type', 'invite');
                }
                return NextResponse.redirect(url);
            }

            return NextResponse.redirect(`${origin}${next}`);
        }

        // Code exchange failed — likely expired or already-used token
        console.error('[Auth Callback] Code exchange failed:', exchangeError);

        const loginUrl = new URL(`${origin}/login`);
        loginUrl.searchParams.set('error', 'code_exchange_failed');
        loginUrl.searchParams.set('message', exchangeError.message);
        return NextResponse.redirect(loginUrl.toString());
    }

    // No code and no error — shouldn't happen, redirect to login
    console.warn('[Auth Callback] No code or error params found in URL');
    return NextResponse.redirect(`${origin}/login?error=missing_params&message=No+authentication+data+found+in+callback+URL`);
}
