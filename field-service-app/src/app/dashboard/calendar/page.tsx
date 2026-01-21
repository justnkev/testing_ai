import { Suspense } from 'react';
import { getJobsForCalendar, getTechnicians } from '@/lib/actions/calendar';
import { CalendarClient } from '@/components/calendar/calendar-client';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar } from 'lucide-react';

// Loading skeleton for calendar
function CalendarSkeleton() {
    return (
        <div className="flex h-[calc(100vh-120px)] gap-4">
            {/* Sidebar skeleton */}
            <div className="hidden lg:block w-64 flex-shrink-0">
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 h-full">
                    <Skeleton className="h-6 w-32 mb-4 bg-slate-700" />
                    {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-10 w-full mb-2 bg-slate-700" />
                    ))}
                </div>
            </div>

            {/* Calendar skeleton */}
            <div className="flex-1 bg-slate-800 rounded-xl border border-slate-700 p-4">
                <div className="flex justify-between items-center mb-4">
                    <Skeleton className="h-8 w-24 bg-slate-700" />
                    <Skeleton className="h-8 w-48 bg-slate-700" />
                    <Skeleton className="h-8 w-32 bg-slate-700" />
                </div>
                <div className="grid grid-cols-7 gap-1">
                    {[...Array(35)].map((_, i) => (
                        <Skeleton key={i} className="h-24 bg-slate-700" />
                    ))}
                </div>
            </div>
        </div>
    );
}

async function CalendarContent() {
    // Get initial date range (current month)
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const [eventsResult, techniciansResult] = await Promise.all([
        getJobsForCalendar(
            startDate.toISOString().split('T')[0],
            endDate.toISOString().split('T')[0]
        ),
        getTechnicians(),
    ]);

    const events = eventsResult.success ? eventsResult.data || [] : [];
    const technicians = techniciansResult.success ? techniciansResult.data || [] : [];

    return <CalendarClient initialEvents={events} initialTechnicians={technicians} />;
}

export default function CalendarPage() {
    return (
        <div className="p-4 md:p-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                        <Calendar className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-white">Schedule</h1>
                        <p className="text-slate-400 text-sm">Drag jobs to reschedule • Click to edit</p>
                    </div>
                </div>
            </div>

            {/* Calendar */}
            <Suspense fallback={<CalendarSkeleton />}>
                <CalendarContent />
            </Suspense>
        </div>
    );
}
