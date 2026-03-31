import { z } from 'zod';

// ── Status Enum ──────────────────────────────────────────────────
export const TimeEntryStatusEnum = z.enum([
    'pending',
    'approved',
    'rejected',
    'manual_review',
]);
export type TimeEntryStatus = z.infer<typeof TimeEntryStatusEnum>;

// ── Zod Schemas ──────────────────────────────────────────────────

/** Clock-in: start tracking time against a job */
export const clockInSchema = z.object({
    job_id: z.string().uuid('Invalid job ID'),
    is_travel_time: z.boolean().default(false),
    latitude: z.number().nullable(),
    longitude: z.number().nullable(),
});
export type ClockInData = z.infer<typeof clockInSchema>;

/** Clock-out: stop tracking time */
export const clockOutSchema = z.object({
    entry_id: z.string().uuid('Invalid entry ID'),
    latitude: z.number().nullable(),
    longitude: z.number().nullable(),
});
export type ClockOutData = z.infer<typeof clockOutSchema>;

/** Bulk approval: admin approves or rejects multiple entries */
export const bulkApprovalSchema = z.object({
    entry_ids: z.array(z.string().uuid()).min(1, 'Select at least one entry'),
    action: z.enum(['approved', 'rejected']),
    notes: z.string().max(500).optional(),
});
export type BulkApprovalData = z.infer<typeof bulkApprovalSchema>;

/** Pay period query parameters */
export const payPeriodSchema = z.object({
    start_date: z.string().datetime({ message: 'Invalid start date' }),
    end_date: z.string().datetime({ message: 'Invalid end date' }),
    format: z.enum(['json', 'csv']).default('json'),
});
export type PayPeriodParams = z.infer<typeof payPeriodSchema>;

// ── TypeScript Interfaces ────────────────────────────────────────

/** Core time entry record — mirrors the database row */
export interface TimeEntry {
    id: string;
    organization_id: string;
    user_id: string;
    job_id: string | null;
    clock_in_at: string;
    clock_out_at: string | null;
    is_travel_time: boolean;
    status: TimeEntryStatus;
    clock_in_latitude: number | null;
    clock_in_longitude: number | null;
    clock_out_latitude: number | null;
    clock_out_longitude: number | null;
    total_hours: number | null;
    gross_pay: number | null;
    applied_rate: number | null;
    applied_multiplier: number | null;
    reviewed_by: string | null;
    reviewed_at: string | null;
    review_notes: string | null;
    flagged_reason: string | null;
    job_snapshot: {
        title: string;
        customer_name: string;
        scheduled_date: string;
    } | null;
    created_at: string;
    updated_at: string;
}

/** Time entry with joined user + job details (for admin audit table) */
export interface TimeEntryWithDetails extends TimeEntry {
    user: {
        full_name: string;
        base_hourly_rate: number;
    } | null;
    job: {
        title: string;
        status: string;
        customer: {
            name: string;
        } | null;
    } | null;
}

/** Pay period summary row — matches RPC return type */
export interface PayPeriodSummary {
    user_id: string;
    full_name: string;
    base_rate: number;
    total_regular_hours: number;
    total_overtime_hours: number;
    total_travel_hours: number;
    total_gross_pay: number;
    entry_count: number;
    pending_count: number;
}

/** Labor cost calculation result from RPC */
export interface LaborCostResult {
    total_hours: number;
    gross_pay: number;
    rate: number;
    multiplier: number;
    weekly_hours_before: number;
    is_overtime: boolean;
    flagged_reason: string | null;
}
