'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { checkInJob, pauseJob, resumeJob } from '@/lib/actions/job-execution';
import { toast } from 'sonner';
import {
    MapPin,
    Play,
    Pause,
    CheckCircle,
    Loader2,
    Navigation,
} from 'lucide-react';

interface JobActionBarProps {
    jobId: string;
    status: string;
    checkInAt: string | null;
    customerAddress?: string;
    onStatusChange: () => void;
    canComplete: boolean;
    onCompleteClick: () => void;
}

export function JobActionBar({
    jobId,
    status,
    checkInAt,
    customerAddress,
    onStatusChange,
    canComplete,
    onCompleteClick,
}: JobActionBarProps) {
    const [isLoading, setIsLoading] = useState<string | null>(null);
    const isCheckedIn = !!checkInAt || status === 'in_progress';

    // Get current location
    const getCurrentLocation = useCallback((): Promise<{ lat: number; lng: number } | null> => {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                resolve(null);
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    });
                },
                () => resolve(null),
                { enableHighAccuracy: true, timeout: 10000 }
            );
        });
    }, []);

    // Check in handler with offline support
    const handleCheckIn = useCallback(async () => {
        setIsLoading('check_in');

        // Get location
        const location = await getCurrentLocation();

        // Try to sync immediately
        const result = await checkInJob(
            jobId,
            location?.lat || null,
            location?.lng || null
        );

        if (result.success) {
            toast.success('Checked in successfully!', {
                description: location
                    ? `Location: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`
                    : 'Location unavailable',
            });
            onStatusChange();
        } else {
            // Cache for offline sync
            const offlineData = {
                jobId,
                action: 'check_in',
                latitude: location?.lat,
                longitude: location?.lng,
                timestamp: new Date().toISOString(),
            };
            localStorage.setItem(`offline_checkin_${jobId}`, JSON.stringify(offlineData));
            toast.warning('Saved offline - will sync when connected', {
                description: result.error,
            });
        }

        setIsLoading(null);
    }, [jobId, getCurrentLocation, onStatusChange]);

    // Pause handler
    const handlePause = useCallback(async () => {
        setIsLoading('pause');
        const result = await pauseJob(jobId);
        if (result.success) {
            toast.info('Job paused');
            onStatusChange();
        } else {
            toast.error(result.error);
        }
        setIsLoading(null);
    }, [jobId, onStatusChange]);

    // Resume handler
    const handleResume = useCallback(async () => {
        setIsLoading('resume');
        const result = await resumeJob(jobId);
        if (result.success) {
            toast.success('Job resumed');
            onStatusChange();
        } else {
            toast.error(result.error);
        }
        setIsLoading(null);
    }, [jobId, onStatusChange]);

    // Navigate to customer
    const handleNavigate = useCallback(() => {
        if (customerAddress) {
            const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(customerAddress)}`;
            window.open(url, '_blank');
        }
    }, [customerAddress]);

    if (status === 'completed') {
        return (
            <div className="bg-green-500/20 border border-green-500/30 rounded-xl p-4 flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-green-400" />
                <span className="text-green-300 font-medium">Job Completed</span>
            </div>
        );
    }

    return (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 space-y-3">
            {/* Navigate Button */}
            {customerAddress && (
                <Button
                    onClick={handleNavigate}
                    variant="outline"
                    className="w-full h-14 text-base border-slate-600 hover:bg-slate-700 flex items-center gap-3"
                >
                    <Navigation className="w-5 h-5 text-blue-400" />
                    Navigate to Job Site
                </Button>
            )}

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
                {!isCheckedIn ? (
                    <Button
                        onClick={handleCheckIn}
                        disabled={isLoading !== null}
                        className="col-span-2 h-14 text-lg bg-green-600 hover:bg-green-700"
                    >
                        {isLoading === 'check_in' ? (
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        ) : (
                            <MapPin className="w-5 h-5 mr-2" />
                        )}
                        Check In
                    </Button>
                ) : (
                    <>
                        <Button
                            onClick={handlePause}
                            disabled={isLoading !== null}
                            variant="outline"
                            className="h-14 text-base border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/20"
                        >
                            {isLoading === 'pause' ? (
                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            ) : (
                                <Pause className="w-5 h-5 mr-2" />
                            )}
                            Pause
                        </Button>
                        <Button
                            onClick={onCompleteClick}
                            disabled={!canComplete || isLoading !== null}
                            className="h-14 text-base bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                        >
                            <CheckCircle className="w-5 h-5 mr-2" />
                            Complete
                        </Button>
                    </>
                )}
            </div>

            {/* Status indicator */}
            {isCheckedIn && (
                <p className="text-center text-sm text-slate-400">
                    Checked in at {new Date(checkInAt || Date.now()).toLocaleTimeString()}
                </p>
            )}

            {!canComplete && isCheckedIn && (
                <p className="text-center text-xs text-amber-400">
                    Add an &quot;After&quot; photo and signature to complete
                </p>
            )}
        </div>
    );
}
