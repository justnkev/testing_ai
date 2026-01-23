'use client';

import { useState } from 'react';
import { generatePortalToken, sendPortalLinkEmail } from '@/lib/actions/portal-auth';
import { Button } from '@/components/ui/button';
import { Link2, Copy, Mail, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface GeneratePortalLinkButtonProps {
    customerId: string;
    customerEmail?: string | null;
}

export function GeneratePortalLinkButton({ customerId, customerEmail }: GeneratePortalLinkButtonProps) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedLink, setGeneratedLink] = useState<string | null>(null);

    const handleGenerate = async () => {
        setIsGenerating(true);

        const result = await generatePortalToken(customerId);

        if (result.success && result.token) {
            const baseUrl = typeof window !== 'undefined'
                ? window.location.origin
                : process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

            const portalUrl = `${baseUrl}/portal/${result.token}`;
            setGeneratedLink(portalUrl);
            toast.success('Portal link generated!');
        } else {
            toast.error(result.error || 'Failed to generate link');
        }

        setIsGenerating(false);
    };

    const handleCopy = () => {
        if (generatedLink) {
            navigator.clipboard.writeText(generatedLink);
            toast.success('Link copied to clipboard!');
        }
    };

    const handleEmail = async () => {
        if (!generatedLink || !customerEmail) {
            toast.error('Customer email not found');
            return;
        }

        setIsGenerating(true);

        const token = generatedLink.split('/').pop();
        if (token) {
            const result = await sendPortalLinkEmail(customerId, token);

            if (result.success) {
                toast.success('Portal link sent via email!');
            } else {
                toast.error(result.error || 'Failed to send email');
            }
        }

        setIsGenerating(false);
    };

    if (generatedLink) {
        return (
            <div className="flex flex-col gap-2">
                <div className="p-3 bg-slate-700 border border-slate-600 rounded-lg">
                    <p className="text-xs text-slate-400 mb-1">Customer Portal Link</p>
                    <p className="text-xs text-white font-mono truncate">{generatedLink}</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        onClick={handleCopy}
                        variant="outline"
                        size="sm"
                        className="flex-1 h-9 text-xs"
                    >
                        <Copy className="w-3 h-3 mr-1" />
                        Copy
                    </Button>
                    {customerEmail && (
                        <Button
                            onClick={handleEmail}
                            variant="outline"
                            size="sm"
                            className="flex-1 h-9 text-xs"
                            disabled={isGenerating}
                        >
                            {isGenerating ? (
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            ) : (
                                <Mail className="w-3 h-3 mr-1" />
                            )}
                            Email
                        </Button>
                    )}
                    <Button
                        onClick={() => setGeneratedLink(null)}
                        variant="ghost"
                        size="sm"
                        className="h-9 text-xs"
                    >
                        New Link
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <Button
            onClick={handleGenerate}
            disabled={isGenerating}
            variant="outline"
            size="sm"
            className="w-full h-9 text-xs border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
        >
            {isGenerating ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
                <Link2 className="w-3 h-3 mr-1" />
            )}
            Generate Portal Link
        </Button>
    );
}
