'use client';

import { useState, useMemo } from 'react';
import Map, { Marker, Popup, NavigationControl, FullscreenControl } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { MapPin, Navigation, ExternalLink, Menu } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// Types for map data
interface JobMapData {
    id: string;
    title: string;
    status: string;
    latitude: number;
    longitude: number;
    customer: {
        name: string;
        address: string;
        city: string;
        state: string;
        zip_code: string;
    };
}

interface MapClientProps {
    jobs: JobMapData[];
    mapboxToken: string;
}

const STATUS_COLORS: Record<string, string> = {
    scheduled: 'text-blue-500',
    in_progress: 'text-amber-500',
    completed: 'text-green-500',
    cancelled: 'text-red-500',
    pending: 'text-slate-500'
};

const MARKER_COLORS: Record<string, string> = {
    scheduled: '#3b82f6', // blue-500
    in_progress: '#f59e0b', // amber-500
    completed: '#22c55e', // green-500
    cancelled: '#ef4444', // red-500
    pending: '#64748b' // slate-500
};

export default function MapClient({ jobs, mapboxToken }: MapClientProps) {
    const [viewState, setViewState] = useState({
        latitude: jobs[0]?.latitude || 40.7128,
        longitude: jobs[0]?.longitude || -74.0060,
        zoom: 11
    });
    const [selectedJob, setSelectedJob] = useState<JobMapData | null>(null);
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    // Filter valid jobs just in case
    const validJobs = useMemo(() => jobs.filter(j => j.latitude && j.longitude), [jobs]);

    const flyToJob = (job: JobMapData) => {
        setViewState({
            latitude: job.latitude,
            longitude: job.longitude,
            zoom: 14
        });
        setSelectedJob(job);
        setIsMobileOpen(false); // Close mobile drawer if open
    };

    const StatusBadge = ({ status }: { status: string }) => {
        const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
            scheduled: 'default',
            in_progress: 'secondary',
            completed: 'outline',
            cancelled: 'destructive'
        };

        return (
            <Badge variant={variants[status] || 'secondary'} className="capitalize">
                {status.replace('_', ' ')}
            </Badge>
        );
    };

    const JobList = () => (
        <div className="space-y-4 p-4">
            <h2 className="font-semibold text-lg flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Job Locations ({validJobs.length})
            </h2>
            <div className="space-y-2">
                {validJobs.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                        No jobs with location data found.
                    </p>
                ) : (
                    validJobs.map(job => (
                        <Card
                            key={job.id}
                            className={cn(
                                "cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800",
                                selectedJob?.id === job.id ? "border-primary ring-1 ring-primary" : ""
                            )}
                            onClick={() => flyToJob(job)}
                        >
                            <CardContent className="p-3">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-medium text-sm truncate pr-2">{job.title}</h3>
                                    <StatusBadge status={job.status} />
                                </div>
                                <div className="text-xs text-muted-foreground space-y-1">
                                    <p className="font-medium text-slate-700 dark:text-slate-300">
                                        {job.customer?.name || 'Unknown Customer'}
                                    </p>
                                    <p className="truncate">
                                        {job.customer?.address || 'No address'}, {job.customer?.city || ''}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );

    return (
        <div className="flex h-[calc(100vh-4rem)] w-full overflow-hidden bg-slate-50 dark:bg-slate-950">
            {/* Desktop Sidebar */}
            <div className="hidden md:block w-80 lg:w-96 border-r bg-white dark:bg-slate-900 flex-shrink-0 z-10">
                <ScrollArea className="h-full">
                    <JobList />
                </ScrollArea>
            </div>

            {/* Map Container */}
            <div className="flex-1 relative">
                {/* Mobile Menu Trigger */}
                <div className="md:hidden absolute top-4 left-4 z-10">
                    <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
                        <SheetTrigger asChild>
                            <Button variant="secondary" size="icon" className="shadow-md">
                                <Menu className="h-5 w-5" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="left" className="p-0 w-80">
                            <ScrollArea className="h-full">
                                <JobList />
                            </ScrollArea>
                        </SheetContent>
                    </Sheet>
                </div>

                {validJobs.length === 0 && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-100/50 backdrop-blur-sm">
                        <Card className="w-full max-w-sm mx-4">
                            <CardContent className="flex flex-col items-center justify-center py-10 text-center space-y-4">
                                <div className="p-3 bg-slate-100 rounded-full">
                                    <MapPin className="h-8 w-8 text-slate-400" />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="font-semibold text-lg">No Mapped Jobs</h3>
                                    <p className="text-sm text-muted-foreground">
                                        There are no active jobs with coordinate data available to display.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                <Map
                    {...viewState}
                    onMove={(evt: { viewState: any }) => setViewState(evt.viewState)}
                    style={{ width: '100%', height: '100%' }}
                    mapStyle="mapbox://styles/mapbox/streets-v12"
                    mapboxAccessToken={mapboxToken}
                >
                    <NavigationControl position="top-right" />
                    <FullscreenControl position="top-right" />

                    {validJobs.map(job => (
                        <Marker
                            key={job.id}
                            latitude={job.latitude}
                            longitude={job.longitude}
                            anchor="bottom"
                            onClick={(e: { originalEvent: { stopPropagation: () => void; }; }) => {
                                e.originalEvent.stopPropagation();
                                setSelectedJob(job);
                            }}
                        >
                            <MapPin
                                className={cn(
                                    "h-8 w-8 drop-shadow-md cursor-pointer hover:scale-110 transition-transform",
                                    STATUS_COLORS[job.status] || 'text-slate-500'
                                )}
                                fill="currentColor"
                                stroke="white"
                                strokeWidth={1.5}
                            />
                        </Marker>
                    ))}

                    {selectedJob && (
                        <Popup
                            latitude={selectedJob.latitude}
                            longitude={selectedJob.longitude}
                            anchor="top"
                            onClose={() => setSelectedJob(null)}
                            closeOnClick={false}
                            className="z-20 min-w-[200px]"
                        >
                            <div className="p-1 space-y-2">
                                <div className="flex justify-between items-start gap-2">
                                    <h4 className="font-semibold text-sm">{selectedJob.title}</h4>
                                    <StatusBadge status={selectedJob.status} />
                                </div>
                                <div className="text-xs space-y-0.5">
                                    <p className="font-medium">{selectedJob.customer?.name || 'Unknown Customer'}</p>
                                    <p className="text-muted-foreground">{selectedJob.customer?.address || 'No address'}</p>
                                </div>
                                <Button size="sm" className="w-full h-7 text-xs" asChild>
                                    <Link href={`/dashboard/jobs/${selectedJob.id}`}>
                                        View Details <ExternalLink className="ml-1 h-3 w-3" />
                                    </Link>
                                </Button>
                            </div>
                        </Popup>
                    )}
                </Map>
            </div>
        </div>
    );
}
