'use client';

import { useState } from 'react';
import { requestNewPortalLink } from '@/lib/actions/portal-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, CheckCircle2 } from 'lucide-react';

export default function ExpiredPortalPage() {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email) return;

        setIsLoading(true);
        const result = await requestNewPortalLink(email);
        setIsLoading(false);

        if (result.success) {
            setIsSuccess(true);
        }
    };

    if (isSuccess) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
                    <div className="mb-6">
                        <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                            <CheckCircle2 className="w-10 h-10 text-green-600" />
                        </div>
                    </div>

                    <h1 className="text-2xl font-bold text-slate-900 mb-3">
                        Check Your Email
                    </h1>

                    <p className="text-slate-600 mb-6">
                        If an account exists for <strong>{email}</strong>, we've sent a new portal link. Please check your inbox.
                    </p>

                    <p className="text-sm text-slate-500">
                        Didn't receive it? Check your spam folder or try again in a few minutes.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
            <div className="max-w-md w-full">
                <div className="bg-white rounded-2xl shadow-xl p-8">
                    <div className="text-center mb-8">
                        <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                            <Mail className="w-10 h-10 text-amber-600" />
                        </div>

                        <h1 className="text-2xl font-bold text-slate-900 mb-2">
                            Link Expired
                        </h1>

                        <p className="text-slate-600">
                            This portal link has expired. Enter your email to receive a new one.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <Label htmlFor="email" className="text-slate-700">
                                Email Address
                            </Label>
                            <Input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="your.email@example.com"
                                className="mt-1.5 h-11"
                                required
                            />
                        </div>

                        <Button
                            type="submit"
                            disabled={isLoading || !email}
                            className="w-full h-11 bg-blue-600 hover:bg-blue-700"
                        >
                            {isLoading ? 'Sending...' : 'Request New Link'}
                        </Button>
                    </form>

                    <p className="text-xs text-slate-500 text-center mt-6">
                        For security reasons, we'll only send a link if your email matches our records.
                    </p>
                </div>
            </div>
        </div>
    );
}
