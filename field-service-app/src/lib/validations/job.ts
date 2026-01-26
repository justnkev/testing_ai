import { z } from 'zod';

export const jobSchema = z.object({
    customer_id: z.string().uuid('Please select a customer'),
    title: z.string().min(1, 'Title is required').max(100, 'Title must be less than 100 characters'),
    description: z.string().max(500, 'Description must be less than 500 characters').optional().or(z.literal('')),
    status: z.enum(['requested', 'scheduled', 'in_progress', 'completed', 'cancelled']),
    scheduled_date: z.string().min(1, 'Scheduled date is required'),
    scheduled_time: z.string().optional().or(z.literal('')),
    estimated_duration_minutes: z.number().min(0).max(1440).optional(),
    priority: z.enum(['low', 'normal', 'high', 'urgent']),
    notes: z.string().max(500, 'Notes must be less than 500 characters').optional().or(z.literal('')),
    latitude: z.number(),
    longitude: z.number(),
});

export type JobFormData = z.infer<typeof jobSchema>;

export type JobStatus = 'requested' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type JobPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Job {
    id: string;
    user_id: string;
    customer_id: string;
    title: string;
    description: string | null;
    status: JobStatus;
    scheduled_date: string;
    scheduled_time: string | null;
    estimated_duration_minutes: number | null;
    priority: JobPriority;
    notes: string | null;
    created_at: string;
    updated_at: string;
    deleted_at?: string | null;
    last_modified_by?: string | null;
    latitude?: number | null;
    longitude?: number | null;
}

export interface JobWithCustomer extends Job {
    customer: {
        id: string;
        name: string;
        address: string;
        city: string | null;
        state: string | null;
        zip_code: string | null;
        phone: string | null;
    };
}
