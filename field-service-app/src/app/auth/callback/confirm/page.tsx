'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Loader2, AlertTriangle, Clock, Wrench } from 'lucide-react';

function ConfirmCallbackContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [error, setError] = useState<string | null>(null);
    const [errorType, setErrorType] = useState<'expired' | 'invalid' | 'generic'>('generic');

    useEffect(() => {
        const supabase = createClient();
        let timeoutId: NodeJS.Timeout;

        const handleAuthCallback = async () => {
            try {
                // ── Attempt 1: Check URL hash (Implicit flow) ──
                const hash = window.location.hash;
                if (hash && hash.length > 1) {
                    // Clear hash from URL for security
                    window.history.replaceState(null, '', window.location.pathname + window.location.search);

                    const hashParams = new URLSearchParams(hash.substring(1));
                    const accessToken = hashParams.get('access_token');
                    const refreshToken = hashParams.get('refresh_token');
                    const errorParam = hashParams.get('error');
                    const errorDescription = hashParams.get('error_description');

                    if (errorParam) {
                        const isExpired = errorDescription?.toLowerCase().includes('expired') ||
                            errorParam === 'access_denied';
                        setErrorType(isExpired ? 'expired' : 'generic');
                        setError(errorDescription || 'Authentication failed. Please try again.');
                        return;
                    }

                    if (accessToken && refreshToken) {
                        const { error: sessionError } = await supabase.auth.setSession({
                            access_token: accessToken,
                            refresh_token: refreshToken,
                        });

                        if (sessionError) {
                            const isExpired = sessionError.message?.toLowerCase().includes('expired');
                            setErrorType(isExpired ? 'expired' : 'generic');
                            setError(sessionError.message);
                            return;
                        }

                        // Success — redirect to dashboard
                        router.push('/dashboard');
                        return;
                    }
                }

                // ── Attempt 2: Check ?code= query param (PKCE flow) ──
                const code = searchParams.get('code');
                if (code) {
                    // Try to exchange the code for a session.
                    // This requires the code_verifier cookie from the original signup browser.
                    // If opened in incognito/different browser, this will fail.
                    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

                    if (!exchangeError) {
                        router.push('/dashboard');
                        return;
                    }

                    // PKCE verifier not found — explain the issue clearly
                    const isPkceError = exchangeError.message?.includes('code verifier') ||
                        exchangeError.message?.includes('PKCE');
                    if (isPkceError) {
                        setErrorType('generic');
                        setError(
                            'This confirmation link must be opened in the same browser you used to sign up. ' +
                            'Please copy this URL and paste it into the browser where you created your account.'
                        );
                        return;
                    }

                    const isExpired = exchangeError.message?.toLowerCase().includes('expired');
                    setErrorType(isExpired ? 'expired' : 'generic');
                    setError(exchangeError.message);
                    return;
                }

                // ── Attempt 3: Check for Supabase error params ──
                const errorParam = searchParams.get('error');
                const errorDescription = searchParams.get('error_description');
                if (errorParam) {
                    const isExpired = errorDescription?.toLowerCase().includes('expired') ||
                        errorParam === 'otp_expired';
                    setErrorType(isExpired ? 'expired' : 'generic');
                    setError(errorDescription || 'Authentication failed. Please try again.');
                    return;
                }

                // ── Fallback: Wait for Supabase auto-detection ──
                timeoutId = setTimeout(() => {
                    setError('No authentication data found in the URL. Please try signing up again.');
                    setErrorType('invalid');
                }, 5000);
            } catch (err) {
                console.error('[Auth Confirm] Unexpected error:', err);
                setError('An unexpected error occurred. Please try again.');
            }
        };

        // Listen for auth state changes (Supabase auto-detection)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
                clearTimeout(timeoutId);
                router.push('/dashboard');
            }
        });

        handleAuthCallback();

        return () => {
            clearTimeout(timeoutId);
            subscription.unsubscribe();
        };
    }, [router, searchParams]);

    if (error) {
        const icons = {
            expired: <Clock className="h-8 w-8 text-amber-400" />,
            invalid: <AlertTriangle className="h-8 w-8 text-red-400" />,
            generic: <Wrench className="h-8 w-8 text-slate-400" />,
        };

        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
                <div className="bg-slate-800 rounded-xl shadow-2xl p-8 max-w-md w-full text-center space-y-4">
                    <div className="flex justify-center">{icons[errorType]}</div>
                    <h2 className="text-xl font-semibold text-white">
                        {errorType === 'expired' ? 'Link Expired' : 'Confirmation Failed'}
                    </h2>
                    <p className="text-slate-300 text-sm">{error}</p>
                    <button
                        onClick={() => router.push('/login')}
                        className="w-full mt-4 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
                    >
                        Back to Login
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900">
            <div className="text-center space-y-4">
                <Loader2 className="h-10 w-10 animate-spin text-blue-500 mx-auto" />
                <p className="text-slate-300 text-lg">Confirming your account...</p>
                <p className="text-slate-500 text-sm">Please wait while we set up your session.</p>
            </div>
        </div>
    );
}

export default function ConfirmCallbackPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
            </div>
        }>
            <ConfirmCallbackContent />
        </Suspense>
    );
}
