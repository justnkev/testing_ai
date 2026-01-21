import { notFound } from 'next/navigation';
import { getJobExecutionData } from '@/lib/actions/job-execution';
import { MobileJobClient } from '@/components/mobile/mobile-job-client';

interface MobileJobPageProps {
    params: Promise<{ id: string }>;
}

export default async function MobileJobPage({ params }: MobileJobPageProps) {
    const { id } = await params;

    const result = await getJobExecutionData(id);

    if (!result.success || !result.data) {
        notFound();
    }

    return <MobileJobClient initialData={result.data} />;
}

// Optimize for mobile viewport
export function generateViewport() {
    return {
        width: 'device-width',
        initialScale: 1,
        maximumScale: 1,
        userScalable: false,
    };
}
