'use client';

import { useEffect, useState, useMemo, useCallback, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Loader2, AlertTriangle, ShieldAlert, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Timeout (ms) before we assume authentication failed */
const AUTH_TIMEOUT_MS = 12_000;

type CallbackStatus = 'extracting' | 'setting_session' | 'redirecting';

function InviteCallbackContent() {
    const router = useRouter();
    const supabase = useMemo(() => createClient(), []);

    const [status, setStatus] = useState<CallbackStatus>('extracting');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    /**
     * Classify Supabase errors into user-friendly messages
     */
    const classifyError = useCallback((rawMessage: string): string => {
        const lower = rawMessage.toLowerCase();

        if (lower.includes('expired') || lower.includes('otp_expired')) {
            return 'Your invite link has expired. Please ask your administrator to send a new invitation.';
        }
        if (lower.includes('invalid') || lower.includes('otp_disabled')) {
            return 'This invite link is invalid. It may have already been used. Please request a new invitation.';
        }
        if (lower.includes('user not found')) {
            return 'No account was found for this invitation. Please contact your administrator.';
        }
        // Return the raw Supabase message for anything else
        return rawMessage;
    }, []);

    useEffect(() => {
        let mounted = true;
        let timeoutId: ReturnType<typeof setTimeout>;

        const processHash = async () => {
            // ── Step 1: Check for explicit errors in hash or query ──
            const url = new URL(window.location.href);
            const hashString = url.hash.substring(1); // strip leading '#'
            const hashParams = new URLSearchParams(hashString);

            const error: string | null =
                url.searchParams.get('error') || hashParams.get('error');
            const errorDescription: string | null =
                url.searchParams.get('error_description') ||
                hashParams.get('error_description');

            if (error) {
                const friendlyMsg = errorDescription
                    ? classifyError(errorDescription.replace(/\+/g, ' '))
                    : classifyError(error);
                console.error('[InviteCallback] URL error param:', error, errorDescription);
                if (mounted) setErrorMsg(friendlyMsg);
                return;
            }

            // ── Step 2: Extract tokens from hash ──
            const accessToken: string | null = hashParams.get('access_token');
            const refreshToken: string | null = hashParams.get('refresh_token');

            console.log('[InviteCallback] Hash present:', hashString.length > 0);
            console.log('[InviteCallback] access_token found:', !!accessToken);
            console.log('[InviteCallback] refresh_token found:', !!refreshToken);

            if (!accessToken || !refreshToken) {
                // No hash tokens — user navigated here directly or link is malformed
                console.warn('[InviteCallback] No tokens in URL hash. Redirecting to login.');
                if (mounted) {
                    setErrorMsg(
                        'No authentication tokens found. This page should only be reached via an invite email link.'
                    );
                }
                return;
            }

            // ── Step 3: Set the Supabase session using extracted tokens ──
            if (mounted) setStatus('setting_session');
            console.log('[InviteCallback] Calling supabase.auth.setSession()...');

            const { data, error: sessionError } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
            });

            if (sessionError) {
                console.error('[InviteCallback] setSession error:', sessionError.message);
                if (mounted) setErrorMsg(classifyError(sessionError.message));
                return;
            }

            if (!data.session) {
                console.error('[InviteCallback] setSession returned no session');
                if (mounted) setErrorMsg('Failed to establish session. Please try the invite link again.');
                return;
            }

            console.log('[InviteCallback] Session set for:', data.session.user.email);

            // ── Step 4: Redirect to onboarding ──
            if (mounted) {
                setStatus('redirecting');
                // Clean the hash from the URL before navigating (security hygiene)
                window.history.replaceState(null, '', window.location.pathname);
                router.push('/auth/onboarding?type=invite');
            }
        };

        // Start processing
        processHash();

        // Safety timeout — don't leave the user on an infinite spinner
        timeoutId = setTimeout(() => {
            if (mounted && !errorMsg) {
                setErrorMsg(
                    'Authentication timed out. The invite link may have expired. Please request a new invitation from your administrator.'
                );
            }
        }, AUTH_TIMEOUT_MS);

        return () => {
            mounted = false;
            clearTimeout(timeoutId);
        };
    }, [supabase, router, classifyError, errorMsg]);

    // ── Error State ──
    if (errorMsg) {
        const isExpired =
            errorMsg.toLowerCase().includes('expired') ||
            errorMsg.toLowerCase().includes('timed out');

        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white p-4">
                <div className="max-w-md w-full bg-slate-800 p-6 rounded-lg border border-red-500/30 shadow-xl">
                    <div className="flex items-center gap-3 mb-4 text-red-400">
                        {isExpired ? (
                            <Clock className="h-6 w-6 flex-shrink-0" />
                        ) : (
                            <ShieldAlert className="h-6 w-6 flex-shrink-0" />
                        )}
                        <h2 className="text-xl font-bold">
                            {isExpired ? 'Link Expired' : 'Authentication Failed'}
                        </h2>
                    </div>
                    <p className="text-slate-300 mb-6 font-mono text-sm break-words bg-slate-950 p-3 rounded border border-slate-700">
                        {errorMsg}
                    </p>
                    <Button
                        onClick={() => router.push('/login')}
                        className="w-full bg-slate-700 hover:bg-slate-600 text-white"
                    >
                        Return to Login
                    </Button>
                </div>
            </div>
        );
    }

    // ── Loading State ──
    const statusMessages: Record<CallbackStatus, string> = {
        extracting: 'Reading invite link...',
        setting_session: 'Setting up your session...',
        redirecting: 'Success! Redirecting to onboarding...',
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
            <div className="bg-slate-800 p-8 rounded-lg shadow-xl flex flex-col items-center gap-4 max-w-sm w-full">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                <p className="text-slate-300 text-center">{statusMessages[status]}</p>
                <p className="text-xs text-slate-500 mt-2">
                    If this takes more than a few seconds, check the console for details.
                </p>
            </div>
        </div>
    );
}

/**
 * Wrapped in Suspense to prevent Vercel build errors
 * when using client-side hooks like useSearchParams.
 */
export default function InviteCallbackPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
                    <div className="bg-slate-800 p-8 rounded-lg shadow-xl flex flex-col items-center gap-4">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                        <p className="text-slate-300">Loading...</p>
                    </div>
                </div>
            }
        >
            <InviteCallbackContent />
        </Suspense>
    );
}
