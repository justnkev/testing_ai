'use client';

import { useActionState } from 'react';
import { updatePassword, type AuthActionState } from '@/lib/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Lock, CheckCircle, AlertTriangle } from 'lucide-react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const initialState: AuthActionState = {};

interface SetPasswordFormProps {
    /** True when the user arrived via an invite link */
    isInvite?: boolean;
    /** True when the link has expired (no valid session) */
    isExpired?: boolean;
}

export function SetPasswordForm({
    isInvite = false,
    isExpired = false,
}: SetPasswordFormProps) {
    const [state, formAction, isPending] = useActionState(
        updatePassword,
        initialState
    );
    const router = useRouter();

    useEffect(() => {
        if (state.success) {
            toast.success(state.success);
            // Redirect after a short delay so the toast is visible
            const timer = setTimeout(() => {
                router.push('/dashboard');
                router.refresh();
            }, 1500);
            return () => clearTimeout(timer);
        }
        if (state.error) {
            toast.error(state.error);
        }
    }, [state, router]);

    // ── Expired Link State ───────────────────────────────────────────
    if (isExpired) {
        return (
            <div className="text-center space-y-4">
                <div className="mx-auto w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center">
                    <AlertTriangle className="w-8 h-8 text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">
                    Link Expired
                </h3>
                <p className="text-slate-400 text-sm">
                    This {isInvite ? 'invitation' : 'password reset'} link has
                    expired. Please request a new one.
                </p>
                <Link
                    href={isInvite ? '/login' : '/auth/reset-password'}
                    className="inline-block"
                >
                    <Button
                        variant="outline"
                        className="border-slate-600 text-slate-300 hover:text-white"
                    >
                        {isInvite ? 'Return to Login' : 'Request New Link'}
                    </Button>
                </Link>
            </div>
        );
    }

    // ── Success State ────────────────────────────────────────────────
    if (state.success) {
        return (
            <div className="text-center space-y-4">
                <div className="mx-auto w-16 h-16 bg-green-500/10 border border-green-500/30 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-green-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">
                    Password Updated!
                </h3>
                <p className="text-slate-400 text-sm">
                    Redirecting you to the dashboard…
                </p>
                <Loader2 className="mx-auto h-5 w-5 animate-spin text-blue-400" />
            </div>
        );
    }

    // ── Form ─────────────────────────────────────────────────────────
    return (
        <form action={formAction} className="space-y-5">
            <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300">
                    New Password
                </Label>
                <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    required
                    minLength={8}
                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500"
                />
                {state.fieldErrors?.password && (
                    <p className="text-sm text-red-400">
                        {state.fieldErrors.password[0]}
                    </p>
                )}
                <p className="text-xs text-slate-500">
                    Minimum 8 characters, at least 1 number or special character.
                </p>
            </div>

            <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-slate-300">
                    Confirm Password
                </Label>
                <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    required
                    minLength={8}
                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500"
                />
                {state.fieldErrors?.confirmPassword && (
                    <p className="text-sm text-red-400">
                        {state.fieldErrors.confirmPassword[0]}
                    </p>
                )}
            </div>

            <Button
                type="submit"
                disabled={isPending}
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-medium"
            >
                {isPending ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating Password…
                    </>
                ) : (
                    <>
                        <Lock className="mr-2 h-4 w-4" />
                        {isInvite ? 'Set Password & Continue' : 'Update Password'}
                    </>
                )}
            </Button>
        </form>
    );
}
