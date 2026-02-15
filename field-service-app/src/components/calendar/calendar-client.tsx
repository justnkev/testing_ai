'use client';

import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import { EventClickArg, EventDropArg, DateSelectArg } from '@fullcalendar/core';
import { toast } from 'sonner';
import { CalendarEvent, Technician, STATUS_COLORS } from '@/lib/validations/calendar';
import { getJobsForCalendar, rescheduleJob, getTechnicians } from '@/lib/actions/calendar';
import { TechnicianFilter } from './technician-filter';
import { JobEditDrawer } from './job-edit-drawer';

interface CalendarClientProps {
    initialEvents: CalendarEvent[];
    initialTechnicians: Technician[];
}

export function CalendarClient({ initialEvents, initialTechnicians }: CalendarClientProps) {
    const [events, setEvents] = useState<CalendarEvent[]>(initialEvents);
    const [technicians, setTechnicians] = useState<Technician[]>(initialTechnicians);
    const [selectedTechnicians, setSelectedTechnicians] = useState<Set<string>>(new Set());
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const calendarRef = useRef<FullCalendar>(null);
    const pendingUpdates = useRef<Map<string, NodeJS.Timeout>>(new Map());

    // Detect mobile for agenda view
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Filter events by selected technicians
    const filteredEvents = useMemo(() => {
        if (selectedTechnicians.size === 0) return events;
        return events.filter(
            (event) =>
                event.extendedProps.technicianId &&
                selectedTechnicians.has(event.extendedProps.technicianId)
        );
    }, [events, selectedTechnicians]);

    // Detect overlapping events for the same technician
    const eventsWithOverlapWarning = useMemo(() => {
        const eventsByTechnician = new Map<string, CalendarEvent[]>();

        // Group events by technician
        filteredEvents.forEach((event) => {
            const techId = event.extendedProps.technicianId;
            if (techId) {
                const existing = eventsByTechnician.get(techId) || [];
                existing.push(event);
                eventsByTechnician.set(techId, existing);
            }
        });

        // Check for overlaps
        return filteredEvents.map((event) => {
            const techId = event.extendedProps.technicianId;
            if (!techId) return event;

            const techEvents = eventsByTechnician.get(techId) || [];
            const hasOverlap = techEvents.some((other) => {
                if (other.id === event.id) return false;
                const eventStart = new Date(event.start).getTime();
                const eventEnd = event.end ? new Date(event.end).getTime() : eventStart + 3600000;
                const otherStart = new Date(other.start).getTime();
                const otherEnd = other.end ? new Date(other.end).getTime() : otherStart + 3600000;
                return eventStart < otherEnd && eventEnd > otherStart;
            });

            if (hasOverlap) {
                return {
                    ...event,
                    borderColor: '#EF4444',
                    classNames: [...(event.classNames || []), 'fc-event-overlap'],
                };
            }
            return event;
        });
    }, [filteredEvents]);

    // Debounced reschedule handler
    const handleEventDrop = useCallback(async (info: EventDropArg) => {
        const { event, revert } = info;
        const jobId = event.extendedProps.jobId;

        // Clear any pending update for this job
        const existingTimeout = pendingUpdates.current.get(jobId);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
        }

        // Optimistic update - already applied by FullCalendar
        toast.loading('Updating schedule...', { id: `reschedule-${jobId}` });

        // Debounce: wait 500ms before sending to server
        const timeout = setTimeout(async () => {
            const newDate = event.startStr.split('T')[0];
            const newTime = event.allDay ? null : event.startStr.split('T')[1]?.substring(0, 5) || null;

            const result = await rescheduleJob(jobId, newDate, newTime);

            if (!result.success) {
                // Rollback on error
                revert();
                toast.error(result.error || 'Failed to reschedule', { id: `reschedule-${jobId}` });
            } else {
                toast.success('Job rescheduled', { id: `reschedule-${jobId}` });
                // Update local state
                setEvents((prev) =>
                    prev.map((e) =>
                        e.id === jobId
                            ? { ...e, start: event.startStr, end: event.endStr || undefined }
                            : e
                    )
                );
            }

            pendingUpdates.current.delete(jobId);
        }, 500);

        pendingUpdates.current.set(jobId, timeout);
    }, []);

    // Handle event click - open drawer
    const handleEventClick = useCallback((info: EventClickArg) => {
        const eventData = events.find((e) => e.id === info.event.id);
        if (eventData) {
            setSelectedEvent(eventData);
            setIsDrawerOpen(true);
        }
    }, [events]);

    // Handle date range change - fetch new events
    const handleDatesSet = useCallback(async (dateInfo: { startStr: string; endStr: string }) => {
        const result = await getJobsForCalendar(
            dateInfo.startStr.split('T')[0],
            dateInfo.endStr.split('T')[0]
        );
        if (result.success && result.data) {
            setEvents(result.data);
        }
    }, []);

    // Toggle technician filter
    const handleTechnicianToggle = useCallback((techId: string) => {
        setSelectedTechnicians((prev) => {
            const next = new Set(prev);
            if (next.has(techId)) {
                next.delete(techId);
            } else {
                next.add(techId);
            }
            return next;
        });
    }, []);

    // Clear all technician filters
    const handleClearFilters = useCallback(() => {
        setSelectedTechnicians(new Set());
    }, []);

    // Refresh events after drawer edit
    const handleEventUpdate = useCallback(() => {
        if (calendarRef.current) {
            const api = calendarRef.current.getApi();
            const view = api.view;
            handleDatesSet({ startStr: view.activeStart.toISOString(), endStr: view.activeEnd.toISOString() });
        }
        setIsDrawerOpen(false);
        setSelectedEvent(null);
    }, [handleDatesSet]);

    return (
        <div className="flex h-[calc(100vh-120px)] gap-4">
            {/* Technician Filter Sidebar - Hidden on mobile */}
            <div className="hidden lg:block w-64 flex-shrink-0">
                <TechnicianFilter
                    technicians={technicians}
                    selectedTechnicians={selectedTechnicians}
                    onToggle={handleTechnicianToggle}
                    onClearAll={handleClearFilters}
                />
            </div>

            {/* Calendar */}
            <div className="flex-1 bg-slate-800 rounded-xl border border-slate-700 p-4 overflow-hidden">
                <FullCalendar
                    ref={calendarRef}
                    plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
                    initialView={isMobile ? 'listWeek' : 'dayGridMonth'}
                    headerToolbar={{
                        left: 'prev,next today',
                        center: 'title',
                        right: isMobile ? 'listWeek' : 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
                    }}
                    events={eventsWithOverlapWarning}
                    editable={true}
                    droppable={true}
                    selectable={true}
                    selectMirror={true}
                    dayMaxEvents={3}
                    weekends={true}
                    nowIndicator={true}
                    timeZone="local"
                    slotMinTime="06:00:00"
                    slotMaxTime="22:00:00"
                    eventDrop={handleEventDrop}
                    eventClick={handleEventClick}
                    datesSet={handleDatesSet}
                    height="100%"
                    eventContent={(eventInfo) => (
                        <div className="p-1 overflow-hidden">
                            <div className="font-medium text-xs truncate">{eventInfo.event.title}</div>
                            {eventInfo.event.extendedProps.customerName && (
                                <div className="text-xs opacity-75 truncate">
                                    {eventInfo.event.extendedProps.customerName}
                                </div>
                            )}
                        </div>
                    )}
                    // Custom styling
                    eventClassNames={(arg) => {
                        const classes = ['cursor-pointer', 'transition-transform', 'hover:scale-[1.02]'];
                        if (arg.event.extendedProps.priority === 'urgent') {
                            classes.push('ring-2', 'ring-red-500');
                        } else if (arg.event.extendedProps.priority === 'high') {
                            classes.push('ring-2', 'ring-orange-500');
                        }
                        return classes;
                    }}
                />
            </div>

            {/* Job Edit Drawer */}
            <JobEditDrawer
                event={selectedEvent}
                technicians={technicians}
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                onUpdate={handleEventUpdate}
            />
        </div>
    );
}
