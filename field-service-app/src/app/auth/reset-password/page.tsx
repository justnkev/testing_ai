import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RequestResetForm } from '@/components/auth/request-reset-form';
import { KeyRound } from 'lucide-react';

export const metadata = {
    title: 'Reset Password | Field Service Pro',
};

export default async function ResetPasswordPage() {
    // If user is already logged in, redirect to dashboard settings
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (user) {
        redirect('/dashboard/settings?tab=account');
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
            <Card className="w-full max-w-md bg-slate-800/50 border-slate-700 backdrop-blur-sm">
                <CardHeader className="text-center space-y-4">
                    <div className="mx-auto w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-400 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/25">
                        <KeyRound className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <CardTitle className="text-2xl font-bold text-white">
                            Forgot Password?
                        </CardTitle>
                        <CardDescription className="text-slate-400">
                            Enter your email and we&apos;ll send you a link to reset your password.
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent>
                    <RequestResetForm />
                </CardContent>
            </Card>
        </div>
    );
}
