'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';

export function DashboardAuthCheck() {
    const searchParams = useSearchParams();
    const router = useRouter();

    useEffect(() => {
        const error = searchParams.get('error');
        if (error === 'access_denied') {
            toast.error('Access Denied', {
                description: 'You do not have permission to view that page.',
                duration: 5000,
            });
            // Clean up URL
            router.replace('/dashboard');
        }
    }, [searchParams, router]);

    return null;
}
