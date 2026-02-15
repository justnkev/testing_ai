import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SetPasswordForm } from '@/components/auth/set-password-form';
import { Lock } from 'lucide-react';

export const metadata = {
    title: 'Set New Password | Field Service Pro',
};

export default async function SetNewPasswordPage({
    searchParams,
}: {
    searchParams: Promise<{ type?: string; error?: string }>;
}) {
    const params = await searchParams;
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    // Determine context from query params or session type
    const isInvite = params.type === 'invite';
    const hasError = params.error === 'expired' || params.error === 'invalid';

    // No valid session — the link likely expired
    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
                <Card className="w-full max-w-md bg-slate-800/50 border-slate-700 backdrop-blur-sm">
                    <CardHeader className="text-center space-y-4">
                        <div className="mx-auto w-16 h-16 bg-gradient-to-br from-red-500 to-rose-400 rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/25">
                            <Lock className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <CardTitle className="text-2xl font-bold text-white">
                                {isInvite ? 'Set Your Password' : 'Reset Password'}
                            </CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <SetPasswordForm isInvite={isInvite} isExpired={true} />
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
            <Card className="w-full max-w-md bg-slate-800/50 border-slate-700 backdrop-blur-sm">
                <CardHeader className="text-center space-y-4">
                    <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                        <Lock className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <CardTitle className="text-2xl font-bold text-white">
                            {isInvite
                                ? 'Welcome! Set Your Password'
                                : 'Create New Password'}
                        </CardTitle>
                        <CardDescription className="text-slate-400">
                            {isInvite
                                ? 'You&apos;ve been invited to join the team. Set a password to get started.'
                                : 'Choose a strong password for your account.'}
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent>
                    <SetPasswordForm isInvite={isInvite} />
                </CardContent>
            </Card>
        </div>
    );
}
