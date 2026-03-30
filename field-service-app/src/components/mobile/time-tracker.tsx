'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { clockIn, clockOut, getActiveTimeEntry } from '@/lib/actions/payroll';
import type { TimeEntry } from '@/lib/validations/payroll';
import { toast } from 'sonner';
import {
    Timer,
    Square,
    Car,
    Wrench,
    Loader2,
    AlertTriangle,
} from 'lucide-react';

interface TimeTrackerProps {
    jobId: string;
    onStatusChange?: () => void;
}

function formatElapsed(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return [
        hrs.toString().padStart(2, '0'),
        mins.toString().padStart(2, '0'),
        secs.toString().padStart(2, '0'),
    ].join(':');
}

export function TimeTracker({ jobId, onStatusChange }: TimeTrackerProps) {
    const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isTravelMode, setIsTravelMode] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Load active entry on mount
    useEffect(() => {
        async function loadActive() {
            const result = await getActiveTimeEntry();
            if (result.success && result.data) {
                setActiveEntry(result.data);
                setIsTravelMode(result.data.is_travel_time);
            }
        }
        loadActive();
    }, []);

    // Live clock
    useEffect(() => {
        if (activeEntry?.clock_in_at) {
            const updateElapsed = () => {
                const clockInTime = new Date(activeEntry.clock_in_at).getTime();
                const now = Date.now();
                setElapsed(Math.floor((now - clockInTime) / 1000));
            };
            updateElapsed();
            timerRef.current = setInterval(updateElapsed, 1000);
            return () => {
                if (timerRef.current) clearInterval(timerRef.current);
            };
        } else {
            setElapsed(0);
        }
    }, [activeEntry]);

    // Get geolocation
    const getCurrentLocation = useCallback((): Promise<{ lat: number; lng: number } | null> => {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                resolve(null);
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                () => resolve(null),
                { enableHighAccuracy: true, timeout: 10000 }
            );
        });
    }, []);

    // Start timer
    const handleStart = useCallback(async () => {
        setIsLoading(true);
        const location = await getCurrentLocation();

        const result = await clockIn(
            jobId,
            isTravelMode,
            location?.lat ?? null,
            location?.lng ?? null
        );

        if (result.success && result.data) {
            setActiveEntry(result.data);
            // Offline fallback
            localStorage.setItem(
                `payroll_clockin_${jobId}`,
                JSON.stringify({
                    entryId: result.data.id,
                    clockInAt: result.data.clock_in_at,
                    isTravelTime: isTravelMode,
                })
            );
            toast.success('Timer started!', {
                description: isTravelMode ? '🚗 Travel mode active' : '🔧 Wrench time active',
            });
            onStatusChange?.();
        } else if (!result.success) {
            toast.error(result.error);
        }

        setIsLoading(false);
    }, [jobId, isTravelMode, getCurrentLocation, onStatusChange]);

    // Stop timer
    const handleStop = useCallback(async () => {
        if (!activeEntry) return;

        setIsLoading(true);
        const location = await getCurrentLocation();

        const result = await clockOut(
            activeEntry.id,
            location?.lat ?? null,
            location?.lng ?? null
        );

        if (result.success) {
            setActiveEntry(null);
            localStorage.removeItem(`payroll_clockin_${jobId}`);

            const costData = result.data;
            if (costData) {
                toast.success('Timer stopped!', {
                    description: `${costData.total_hours.toFixed(2)} hrs • $${costData.gross_pay.toFixed(2)} gross`,
                });
                if (costData.is_overtime) {
                    toast.warning('⚠️ Overtime Warning', {
                        description: 'This entry pushed you past 40 weekly hours.',
                    });
                }
            } else {
                toast.success('Timer stopped!');
            }
            onStatusChange?.();
        } else if (!result.success) {
            toast.error(result.error);
        }

        setIsLoading(false);
    }, [activeEntry, jobId, getCurrentLocation, onStatusChange]);

    const isActive = !!activeEntry && activeEntry.job_id === jobId;
    const isOtherJobActive = !!activeEntry && activeEntry.job_id !== jobId;
    const isOvertime = elapsed > 12 * 3600; // > 12 hours warning

    // If timer is active on another job
    if (isOtherJobActive) {
        return (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                <div className="flex items-center gap-2 text-amber-400 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Timer active on another job. Clock out first.</span>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-800/80 backdrop-blur-sm rounded-xl border border-slate-700 p-4 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Timer className="w-5 h-5 text-blue-400" />
                    <span className="font-medium text-slate-200">Time Tracker</span>
                </div>
                {isActive && (
                    <span className="flex items-center gap-1.5 text-xs text-green-400">
                        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                        Recording
                    </span>
                )}
            </div>

            {/* Live Clock Display */}
            {isActive && (
                <div className="text-center py-3">
                    <p
                        className={`text-4xl font-mono font-bold tracking-wider ${
                            isOvertime ? 'text-red-400 animate-pulse' : 'text-white'
                        }`}
                    >
                        {formatElapsed(elapsed)}
                    </p>
                    {isOvertime && (
                        <p className="text-xs text-red-400 mt-1 flex items-center justify-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Exceeds 12 hours — will be flagged for review
                        </p>
                    )}
                    <p className="text-xs text-slate-400 mt-1">
                        Started at {new Date(activeEntry!.clock_in_at).toLocaleTimeString()}
                    </p>
                </div>
            )}

            {/* Travel / Wrench Toggle */}
            {!isActive && (
                <div className="flex items-center justify-between bg-slate-900/50 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                        {isTravelMode ? (
                            <Car className="w-4 h-4 text-blue-400" />
                        ) : (
                            <Wrench className="w-4 h-4 text-amber-400" />
                        )}
                        <Label
                            htmlFor="travel-mode"
                            className="text-sm text-slate-300 cursor-pointer"
                        >
                            {isTravelMode ? 'Travel Time' : 'Wrench Time'}
                        </Label>
                    </div>
                    <Switch
                        id="travel-mode"
                        checked={isTravelMode}
                        onCheckedChange={setIsTravelMode}
                    />
                </div>
            )}

            {/* Active state: show mode indicator */}
            {isActive && (
                <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
                    {activeEntry!.is_travel_time ? (
                        <>
                            <Car className="w-4 h-4 text-blue-400" />
                            Travel Time
                        </>
                    ) : (
                        <>
                            <Wrench className="w-4 h-4 text-amber-400" />
                            Wrench Time
                        </>
                    )}
                </div>
            )}

            {/* Action Button */}
            {!isActive ? (
                <Button
                    onClick={handleStart}
                    disabled={isLoading}
                    className="w-full h-12 text-base bg-emerald-600 hover:bg-emerald-700 transition-colors"
                >
                    {isLoading ? (
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    ) : (
                        <Timer className="w-5 h-5 mr-2" />
                    )}
                    Start Timer
                </Button>
            ) : (
                <Button
                    onClick={handleStop}
                    disabled={isLoading}
                    variant="outline"
                    className="w-full h-12 text-base border-red-500/50 text-red-400 hover:bg-red-500/20 transition-colors"
                >
                    {isLoading ? (
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    ) : (
                        <Square className="w-5 h-5 mr-2" />
                    )}
                    Stop Timer
                </Button>
            )}
        </div>
    );
}
