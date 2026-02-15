'use client';

import { useActionState } from 'react';
import { requestPasswordReset, type AuthActionState } from '@/lib/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Mail, ArrowLeft } from 'lucide-react';
import { useEffect, useRef } from 'react';
import Link from 'next/link';

const initialState: AuthActionState = {};

export function RequestResetForm() {
    const [state, formAction, isPending] = useActionState(
        requestPasswordReset,
        initialState
    );
    const formRef = useRef<HTMLFormElement>(null);

    useEffect(() => {
        if (state.success) {
            toast.success(state.success);
        }
        if (state.error) {
            toast.error(state.error);
        }
    }, [state]);

    return (
        <div className="space-y-6">
            {state.success ? (
                <div className="text-center space-y-4">
                    <div className="mx-auto w-16 h-16 bg-green-500/10 border border-green-500/30 rounded-full flex items-center justify-center">
                        <Mail className="w-8 h-8 text-green-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">Check Your Email</h3>
                    <p className="text-slate-400 text-sm">
                        {state.success}
                    </p>
                    <Link
                        href="/login"
                        className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Sign In
                    </Link>
                </div>
            ) : (
                <form ref={formRef} action={formAction} className="space-y-5">
                    <div className="space-y-2">
                        <Label htmlFor="email" className="text-slate-300">
                            Email Address
                        </Label>
                        <Input
                            id="email"
                            name="email"
                            type="email"
                            placeholder="you@company.com"
                            required
                            className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500"
                        />
                        {state.fieldErrors?.email && (
                            <p className="text-sm text-red-400">
                                {state.fieldErrors.email[0]}
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
                                Sending Reset Link…
                            </>
                        ) : (
                            <>
                                <Mail className="mr-2 h-4 w-4" />
                                Send Reset Link
                            </>
                        )}
                    </Button>

                    <div className="text-center">
                        <Link
                            href="/login"
                            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-blue-400 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back to Sign In
                        </Link>
                    </div>
                </form>
            )}
        </div>
    );
}
