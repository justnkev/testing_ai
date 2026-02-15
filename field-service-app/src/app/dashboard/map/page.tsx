import { getMapJobs } from '@/lib/actions/jobs';
import MapClient from '@/components/dashboard/map/MapClient';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Job Map | Field Service App',
    description: 'Geographic view of all active service jobs',
};

export default async function MapPage() {
    const { success, data } = await getMapJobs();

    if (!success) {
        // Fallback or error handling
        return (
            <div className="p-8 text-center">
                <h2 className="text-xl font-bold text-red-500">Failed to load map data</h2>
                <p className="text-slate-500">Please try again later.</p>
            </div>
        );
    }

    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

    if (!mapboxToken) {
        return (
            <div className="p-8 text-center space-y-4">
                <h2 className="text-xl font-bold text-amber-500">Map Configuration Missing</h2>
                <p className="text-slate-500">
                    The <code>NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</code> environment variable is not set.
                </p>
                <p className="text-sm text-slate-400">
                    Please add your Mapbox public token to your environment variables to enable the map view.
                </p>
            </div>
        );
    }

    return <MapClient jobs={data || []} mapboxToken={mapboxToken} />;
}
