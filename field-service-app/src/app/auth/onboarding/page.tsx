'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Wrench, CheckCircle } from 'lucide-react';

type OnboardingState = 'loading' | 'clearing_session' | 'ready' | 'submitting' | 'complete' | 'error';

const INVITE_STATE_KEY = 'invite_onboarding_state';

export default function InviteOnboardingPage() {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [state, setState] = useState<OnboardingState>('loading');
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const router = useRouter();
    const searchParams = useSearchParams();
    const supabase = createClient();

    const isInviteFlow = searchParams.get('type') === 'invite';

    /**
     * Store invite state in sessionStorage to persist across page refreshes
     */
    const persistInviteState = useCallback((email: string) => {
        if (typeof window !== 'undefined') {
            sessionStorage.setItem(INVITE_STATE_KEY, JSON.stringify({
                email,
                timestamp: Date.now(),
            }));
        }
    }, []);

    /**
     * Retrieve persisted invite state
     */
    const getPersistedState = useCallback(() => {
        if (typeof window === 'undefined') return null;
        try {
            const stored = sessionStorage.getItem(INVITE_STATE_KEY);
            if (!stored) return null;
            const parsed = JSON.parse(stored);
            // Expire after 1 hour
            if (Date.now() - parsed.timestamp > 60 * 60 * 1000) {
                sessionStorage.removeItem(INVITE_STATE_KEY);
                return null;
            }
            return parsed;
        } catch {
            return null;
        }
    }, []);

    /**
     * Clear persisted invite state
     */
    const clearPersistedState = useCallback(() => {
        if (typeof window !== 'undefined') {
            sessionStorage.removeItem(INVITE_STATE_KEY);
        }
    }, []);

    /**
     * Main initialization logic
     */
    useEffect(() => {
        const initializeOnboarding = async () => {
            // If not invite flow, redirect to login
            if (!isInviteFlow) {
                router.replace('/login');
                return;
            }

            // Check for existing session
            const { data: { session } } = await supabase.auth.getSession();

            if (session) {
                const currentUserEmail = session.user.email;

                // Check if this is the invited user or a different user
                const persistedState = getPersistedState();

                if (persistedState && persistedState.email === currentUserEmail) {
                    // Same user - proceed (likely a page refresh)
                    setUserEmail(currentUserEmail ?? null);
                    setState('ready');
                    return;
                }

                // Check if user has already completed onboarding
                if (session.user.user_metadata?.onboarding_complete) {
                    // toast.info('Your account is already set up!'); 
                    // Don't auto-redirect, just show complete state to avoid loops
                    setState('complete');
                    return;
                }

                // New invited user with fresh session - proceed
                if (currentUserEmail) {
                    setUserEmail(currentUserEmail);
                    persistInviteState(currentUserEmail);
                    setState('ready');
                    return;
                }
            }

            // No session - check for persisted state (page refresh scenario)
            const persistedState = getPersistedState();
            if (persistedState) {
                // Wait for auth state to be restored
                setState('loading');
            } else {
                // No session and no persisted state - token might be invalid
                setErrorMessage('Your session could not be established. Please try clicking the invite link again.');
                setState('error');
            }
        };

        initializeOnboarding();

        // Listen for auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session) {
                const email = session.user.email;

                // Check if we need to clear a different user's session
                const persistedState = getPersistedState();

                if (persistedState && persistedState.email !== email) {
                    // Different user is now signed in - this IS the invited user
                    // The old session was already cleared by the token exchange
                    clearPersistedState();
                }

                // Check if already onboarded
                if (session.user.user_metadata?.onboarding_complete) {
                    // toast.info('Your account is already set up!');
                    setState('complete');
                    return;
                }

                setUserEmail(email ?? null);
                if (email) persistInviteState(email);
                setState('ready');
            }
        });

        return () => subscription.unsubscribe();
    }, [isInviteFlow, router, supabase, getPersistedState, persistInviteState, clearPersistedState]);

    /**
     * Handle password form submission
     */
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            toast.error("Passwords don't match");
            return;
        }

        if (password.length < 8) {
            toast.error("Password must be at least 8 characters");
            return;
        }

        setState('submitting');

        try {
            // Update password and mark onboarding complete
            const { error } = await supabase.auth.updateUser({
                password: password,
                data: { onboarding_complete: true }
            });

            if (error) throw error;

            setState('complete');
            clearPersistedState();
            toast.success("Account set up successfully!");

            // Brief delay to show success state
            setTimeout(() => {
                router.push('/dashboard');
                router.refresh();
            }, 1000);

        } catch (error: unknown) {
            console.error('Onboarding error:', error);
            const message = error instanceof Error ? error.message : 'Failed to complete onboarding';
            toast.error(message);
            setState('ready');
        }
    };

    // Error state
    if (state === 'error') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
                <Card className="w-full max-w-md bg-slate-800/50 border-slate-700 backdrop-blur-sm">
                    <CardHeader className="text-center space-y-4">
                        <div className="mx-auto w-16 h-16 bg-gradient-to-br from-red-500 to-orange-400 rounded-2xl flex items-center justify-center shadow-lg">
                            <Wrench className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <CardTitle className="text-2xl font-bold text-white">
                                Invitation Error
                            </CardTitle>
                            <CardDescription className="text-slate-400 mt-2">
                                {errorMessage || 'Something went wrong with your invitation.'}
                            </CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Button
                            onClick={() => router.push('/login')}
                            className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-medium"
                        >
                            Return to Login
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Loading/clearing states
    if (state === 'loading' || state === 'clearing_session') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
                <Card className="w-full max-w-md bg-slate-800/50 border-slate-700 backdrop-blur-sm">
                    <CardContent className="py-12">
                        <div className="flex flex-col items-center gap-4">
                            <Loader2 className="h-12 w-12 animate-spin text-blue-400" />
                            <p className="text-slate-300 text-lg font-medium">
                                {state === 'clearing_session'
                                    ? 'Switching accounts...'
                                    : 'Preparing your account...'}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Complete state
    if (state === 'complete') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
                <Card className="w-full max-w-md bg-slate-800/50 border-slate-700 backdrop-blur-sm">
                    <CardContent className="py-12">
                        <div className="flex flex-col items-center gap-4">
                            <CheckCircle className="h-12 w-12 text-green-400" />
                            <p className="text-slate-300 text-lg font-medium">
                                Account setup complete!
                            </p>
                            <p className="text-slate-400 text-sm">
                                Your account is ready.
                            </p>
                            <Button
                                onClick={() => router.push('/dashboard')}
                                className="bg-green-600 hover:bg-green-700 text-white"
                            >
                                Go to Dashboard
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Ready state - show password form
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
            <Card className="w-full max-w-md bg-slate-800/50 border-slate-700 backdrop-blur-sm">
                <CardHeader className="text-center space-y-4">
                    <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                        <Wrench className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <CardTitle className="text-2xl font-bold text-white">
                            Welcome to Field Service
                        </CardTitle>
                        <CardDescription className="text-slate-400">
                            {userEmail ? (
                                <>Set up your password for <span className="text-blue-400">{userEmail}</span></>
                            ) : (
                                'Set up your password to get started'
                            )}
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-slate-300">New Password</Label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={8}
                                placeholder="Enter your password"
                                className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword" className="text-slate-300">Confirm Password</Label>
                            <Input
                                id="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                minLength={8}
                                placeholder="Confirm your password"
                                className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500"
                            />
                            <p className="text-xs text-slate-500">
                                Password must be at least 8 characters
                            </p>
                        </div>
                        <Button
                            type="submit"
                            className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-medium"
                            disabled={state === 'submitting'}
                        >
                            {state === 'submitting' ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Setting up...
                                </>
                            ) : (
                                'Complete Setup'
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
