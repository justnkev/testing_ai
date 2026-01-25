'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function InviteCallback() {
    const router = useRouter();
    const supabase = createClient();
    const [status, setStatus] = useState<string>('Initializing auth...');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;

        const handleAuth = async () => {
            // 1. Check for explicit error in URL (Hash or Query)
            const url = new URL(window.location.href);
            // Handle hash params manually since URL object might not parse hash qs automatically
            const hashString = url.hash.substring(1);
            const hashParams = new URLSearchParams(hashString);
            const searchParams = url.searchParams;

            const error = searchParams.get('error') || hashParams.get('error');
            const errorDescription = searchParams.get('error_description') || hashParams.get('error_description');

            if (error) {
                console.error('Auth Error Detected:', error, errorDescription);
                if (mounted) setErrorMsg(`${error}: ${errorDescription?.replace(/\+/g, ' ')}`);
                return;
            }

            if (mounted) setStatus('Verifying session...');

            // 2. Let Supabase Client handle the session exchange automatically
            // The createBrowserClient is configured to auto-detect URL tokens
            const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
                console.log('Auth Event:', event, session?.user?.email);

                if (event === 'SIGNED_IN' && session) {
                    if (mounted) setStatus('Session established! Redirecting...');
                    // Successful login - go to onboarding
                    router.replace('/auth/onboarding?type=invite');
                } else if (event === 'SIGNED_OUT') {
                    // This might happen initially, waiting for sign in
                    // But if it persists, we might be stuck. 
                    // However, we'll rely on the timeout below or the setSession call below.
                }
            });

            // 3. Fallback: If auto-detect fails, try manual setSession for Implicit Flow
            const accessToken = hashParams.get('access_token');
            const refreshToken = hashParams.get('refresh_token');

            if (accessToken && refreshToken) {
                if (mounted) setStatus('Manually setting session...');
                const { error } = await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken,
                });
                if (error) {
                    console.error('Manual SetSession Error:', error);
                    if (mounted) setErrorMsg(error.message);
                }
            } else {
                // 4. PKCE Flow: If we have a 'code', Supabase client handles it automatically via onAuthStateChange
                // We just wait. But if nothing happens after 5 seconds, we show error.
                const code = searchParams.get('code');
                if (!code && !accessToken) {
                    // No tokens found?
                    console.warn('No auth tokens found in URL');
                }
            }

            return () => {
                subscription.unsubscribe();
            };
        };

        handleAuth();

    }, [supabase, router]);

    if (errorMsg) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white p-4">
                <div className="max-w-md w-full bg-slate-800 p-6 rounded-lg border border-red-500/30">
                    <div className="flex items-center gap-3 mb-4 text-red-400">
                        <AlertTriangle className="h-6 w-6" />
                        <h2 className="text-xl font-bold">Authentication Failed</h2>
                    </div>
                    <p className="text-slate-300 mb-6 font-mono text-sm break-words bg-slate-950 p-2 rounded">
                        {errorMsg}
                    </p>
                    <Button onClick={() => router.push('/login')} variant="outline" className="w-full">
                        Return to Login
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                <p className="text-slate-300">{status}</p>
                <p className="text-xs text-slate-500 mt-4">Check console for debug info</p>
            </div>
        </div>
    );
}
