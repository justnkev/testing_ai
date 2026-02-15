'use client';

import { useCallback, useState } from 'react';
import { Drawer } from 'vaul';
import { CalendarEvent, Technician, STATUS_COLORS } from '@/lib/validations/calendar';
import { updateJobFromCalendar, assignTechnician } from '@/lib/actions/calendar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
    Calendar,
    Clock,
    MapPin,
    Phone,
    User,
    AlertCircle,
    CheckCircle,
    XCircle,
    Loader2,
    Navigation,
} from 'lucide-react';

interface JobEditDrawerProps {
    event: CalendarEvent | null;
    technicians: Technician[];
    isOpen: boolean;
    onClose: () => void;
    onUpdate: () => void;
}

export function JobEditDrawer({
    event,
    technicians,
    isOpen,
    onClose,
    onUpdate,
}: JobEditDrawerProps) {
    const [status, setStatus] = useState(event?.extendedProps.status || 'scheduled');
    const [selectedTechId, setSelectedTechId] = useState<string | null>(
        event?.extendedProps.technicianId || null
    );
    const [isLoading, setIsLoading] = useState(false);

    // Reset form when event changes
    const handleOpenChange = useCallback(
        (open: boolean) => {
            if (!open) {
                onClose();
            } else if (event) {
                setStatus(event.extendedProps.status);
                setSelectedTechId(event.extendedProps.technicianId || null);
            }
        },
        [event, onClose]
    );

    const handleSave = useCallback(async () => {
        if (!event) return;

        setIsLoading(true);
        try {
            // Update status if changed
            if (status !== event.extendedProps.status) {
                const result = await updateJobFromCalendar(event.extendedProps.jobId, { status });
                if (!result.success) {
                    toast.error(result.error || 'Failed to update status');
                    setIsLoading(false);
                    return;
                }
            }

            // Update technician if changed
            if (selectedTechId !== event.extendedProps.technicianId) {
                const result = await assignTechnician(event.extendedProps.jobId, selectedTechId);
                if (!result.success) {
                    toast.error(result.error || 'Failed to assign technician');
                    setIsLoading(false);
                    return;
                }
            }

            toast.success('Job updated successfully');
            onUpdate();
        } catch (error) {
            toast.error('An error occurred');
        } finally {
            setIsLoading(false);
        }
    }, [event, status, selectedTechId, onUpdate]);

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
        });
    };

    const formatTime = (dateStr: string) => {
        if (dateStr.includes('T')) {
            return new Date(dateStr).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
            });
        }
        return 'All Day';
    };

    const getGoogleMapsUrl = (address: string) => {
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    };

    if (!event) return null;

    const statusColors = STATUS_COLORS[event.extendedProps.status] || STATUS_COLORS.scheduled;

    return (
        <Drawer.Root open={isOpen} onOpenChange={handleOpenChange}>
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 bg-black/60 z-50" />
                <Drawer.Content className="bg-slate-900 flex flex-col rounded-t-[20px] md:rounded-l-[20px] md:rounded-tr-none h-[90vh] md:h-full mt-24 md:mt-0 fixed bottom-0 md:right-0 md:top-0 left-0 right-0 md:left-auto md:w-[400px] z-50 border-t md:border-l border-slate-700">
                    <div className="p-4 bg-slate-800 rounded-t-[20px] md:rounded-tl-[20px] md:rounded-tr-none flex-shrink-0">
                        <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-slate-600 mb-4 md:hidden" />
                        <Drawer.Title className="text-xl font-bold text-white">
                            {event.title}
                        </Drawer.Title>
                        <div className="flex items-center gap-2 mt-2">
                            <span
                                className="px-2 py-1 rounded-full text-xs font-medium"
                                style={{
                                    backgroundColor: statusColors.bg,
                                    color: statusColors.text,
                                }}
                            >
                                {event.extendedProps.status.replace('_', ' ').toUpperCase()}
                            </span>
                            {event.extendedProps.priority === 'urgent' && (
                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-500 text-white">
                                    URGENT
                                </span>
                            )}
                            {event.extendedProps.priority === 'high' && (
                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-500 text-white">
                                    HIGH PRIORITY
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto p-4 space-y-6">
                        {/* Customer Info */}
                        {event.extendedProps.customerName && (
                            <div className="space-y-2">
                                <Label className="text-slate-400 text-xs uppercase tracking-wide">Customer</Label>
                                <div className="flex items-start gap-3">
                                    <User className="w-5 h-5 text-slate-400 mt-0.5" />
                                    <div>
                                        <p className="text-white font-medium">{event.extendedProps.customerName}</p>
                                        {event.extendedProps.customerAddress && (
                                            <a
                                                href={getGoogleMapsUrl(event.extendedProps.customerAddress)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-1"
                                            >
                                                <MapPin className="w-4 h-4" />
                                                {event.extendedProps.customerAddress}
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Date & Time */}
                        <div className="space-y-2">
                            <Label className="text-slate-400 text-xs uppercase tracking-wide">Schedule</Label>
                            <div className="flex items-center gap-3">
                                <Calendar className="w-5 h-5 text-slate-400" />
                                <span className="text-white">{formatDate(event.start)}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <Clock className="w-5 h-5 text-slate-400" />
                                <span className="text-white">
                                    {formatTime(event.start)}
                                    {event.extendedProps.duration && ` (${event.extendedProps.duration} min)`}
                                </span>
                            </div>
                        </div>

                        {/* Description */}
                        {event.extendedProps.description && (
                            <div className="space-y-2">
                                <Label className="text-slate-400 text-xs uppercase tracking-wide">Description</Label>
                                <p className="text-slate-300 text-sm">{event.extendedProps.description}</p>
                            </div>
                        )}

                        {/* Status Update */}
                        <div className="space-y-2">
                            <Label className="text-slate-400 text-xs uppercase tracking-wide">Update Status</Label>
                            <div className="grid grid-cols-2 gap-2">
                                {(['scheduled', 'in_progress', 'completed', 'cancelled'] as const).map((s) => (
                                    <button
                                        key={s}
                                        onClick={() => setStatus(s)}
                                        className={`
                      flex items-center gap-2 p-3 rounded-lg border transition-colors
                      ${status === s
                                                ? 'border-blue-500 bg-blue-500/20'
                                                : 'border-slate-600 hover:border-slate-500'
                                            }
                    `}
                                    >
                                        {s === 'scheduled' && <Calendar className="w-4 h-4 text-blue-400" />}
                                        {s === 'in_progress' && <Loader2 className="w-4 h-4 text-green-400" />}
                                        {s === 'completed' && <CheckCircle className="w-4 h-4 text-gray-400" />}
                                        {s === 'cancelled' && <XCircle className="w-4 h-4 text-red-400" />}
                                        <span className="text-sm text-white capitalize">{s.replace('_', ' ')}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Technician Assignment */}
                        <div className="space-y-2">
                            <Label className="text-slate-400 text-xs uppercase tracking-wide">
                                Assigned Technician
                            </Label>
                            <select
                                value={selectedTechId || ''}
                                onChange={(e) => setSelectedTechId(e.target.value || null)}
                                className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="">Unassigned</option>
                                {technicians.map((tech) => (
                                    <option key={tech.id} value={tech.id}>
                                        {tech.display_name || tech.email || 'Unknown'}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Navigate Button */}
                        {event.extendedProps.customerAddress && (
                            <a
                                href={getGoogleMapsUrl(event.extendedProps.customerAddress)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 w-full p-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                            >
                                <Navigation className="w-5 h-5" />
                                Navigate to Job
                            </a>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className="p-4 border-t border-slate-700 flex gap-3">
                        <Button
                            variant="outline"
                            onClick={onClose}
                            className="flex-1 border-slate-600 text-slate-300"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={isLoading}
                            className="flex-1 bg-blue-600 hover:bg-blue-700"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                'Save Changes'
                            )}
                        </Button>
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
}
