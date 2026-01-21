import { z } from 'zod';

// Calendar event schema for API responses
export const calendarEventSchema = z.object({
    id: z.string().uuid(),
    title: z.string(),
    start: z.string(), // ISO datetime
    end: z.string().optional(), // ISO datetime
    allDay: z.boolean().optional(),
    backgroundColor: z.string().optional(),
    borderColor: z.string().optional(),
    textColor: z.string().optional(),
    classNames: z.array(z.string()).optional(),
    extendedProps: z.object({
        jobId: z.string().uuid(),
        customerId: z.string().uuid().optional(),
        customerName: z.string().optional(),
        customerAddress: z.string().optional(),
        technicianId: z.string().uuid().nullable().optional(),
        technicianName: z.string().nullable().optional(),
        status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']),
        priority: z.enum(['low', 'normal', 'high', 'urgent']),
        description: z.string().nullable().optional(),
        duration: z.number().optional(),
    }),
});

export type CalendarEvent = z.infer<typeof calendarEventSchema>;

// Technician type for filtering
export interface Technician {
    id: string;
    display_name: string | null;
    email: string | null;
    avatar_color: string | null;
    role: 'admin' | 'technician' | 'dispatcher';
}

// Job reschedule payload
export interface ReschedulePayload {
    jobId: string;
    newDate: string; // YYYY-MM-DD
    newTime: string | null; // HH:MM or null for all-day
    newEndTime?: string | null;
}

// Status color mapping
export const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
    scheduled: { bg: '#3B82F6', border: '#2563EB', text: '#FFFFFF' },
    in_progress: { bg: '#22C55E', border: '#16A34A', text: '#FFFFFF' },
    completed: { bg: '#6B7280', border: '#4B5563', text: '#FFFFFF' },
    cancelled: { bg: '#EF4444', border: '#DC2626', text: '#FFFFFF' },
};

// Priority border colors for visual emphasis
export const PRIORITY_STYLES: Record<string, string> = {
    low: '',
    normal: '',
    high: 'border-l-4 border-l-orange-500',
    urgent: 'border-l-4 border-l-red-500',
};
