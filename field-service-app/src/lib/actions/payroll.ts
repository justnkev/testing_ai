'use server';

import { createServiceClient } from '@/lib/supabase/service';
import { createClient } from '@/lib/supabase/server';
import { Decimal } from 'decimal.js';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';

const PayrollRunSchema = z.object({
    period_start: z.string(),
    period_end: z.string(),
});

/**
 * Calculate hours for a user within a pay period
 * Logic:
 * - Fetch all job events for the user in the range
 * - Sort by timestamp
 * - Match Check-In with next Check-Out
 * - Sum durations
 * - Calculate overtime (> 40 hrs/week) - *Simplified for now to > 40 hrs in total period if period is week*
 */
export async function calculatePayPeriod(userId: string, start: Date, end: Date) {
    const supabase = createServiceClient();

    // Fetch events
    const { data: events, error } = await supabase
        .from('fs_job_events')
        .select('*')
        .eq('user_id', userId)
        .gte('timestamp', start.toISOString())
        .lte('timestamp', end.toISOString())
        .order('timestamp', { ascending: true });

    if (error) throw error;

    let totalMinutes = new Decimal(0);
    let lastCheckIn: Date | null = null;
    const missingCheckOuts: string[] = [];

    events.forEach((event: any) => {
        const eventTime = new Date(event.timestamp);

        if (event.event_type === 'check_in') {
            if (lastCheckIn) {
                // Double check-in? Log it or ignore previous? 
                // For now, let's assume missing check-out for previous
                missingCheckOuts.push(lastCheckIn.toISOString());
            }
            lastCheckIn = eventTime;
        } else if (event.event_type === 'check_out') {
            if (lastCheckIn) {
                const durationMs = eventTime.getTime() - lastCheckIn.getTime();
                const durationMins = durationMs / (1000 * 60);
                totalMinutes = totalMinutes.plus(durationMins);
                lastCheckIn = null;
            } else {
                // Check-out without check-in? Ignore or flag
            }
        }
    });

    if (lastCheckIn) {
        missingCheckOuts.push(lastCheckIn.toISOString());
    }

    const totalHours = totalMinutes.dividedBy(60);
    const regularHours = Decimal.min(totalHours, 40);
    const overtimeHours = Decimal.max(0, totalHours.minus(40));

    return {
        total_hours: totalHours.toNumber(),
        regular_hours: regularHours.toNumber(),
        overtime_hours: overtimeHours.toNumber(),
        missing_check_outs: missingCheckOuts.length > 0,
        missing_check_out_times: missingCheckOuts,
    };
}

export async function createPayrollRun(formData: FormData) {
    const supabase = await createClient(); // Use user client for auth check
    const serviceSupabase = createServiceClient(); // Service client for writes

    // Auth check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        throw new Error('Unauthorized');
    }
    // Check role
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profile?.role !== 'admin') {
        throw new Error('Unauthorized: Admin access required');
    }

    const rawData = {
        period_start: formData.get('period_start'),
        period_end: formData.get('period_end'),
    };

    const validated = PayrollRunSchema.parse(rawData);
    const start = new Date(validated.period_start);
    const end = new Date(validated.period_end);

    // 1. Create Run
    const { data: run, error: runError } = await serviceSupabase
        .from('payroll_runs')
        .insert({
            period_start: start.toISOString(),
            period_end: end.toISOString(),
            status: 'pending',
        })
        .select()
        .single();

    if (runError) throw runError;

    // 2. Fetch Technicians
    const { data: technicians } = await serviceSupabase
        .from('profiles')
        .select('*')
        .eq('role', 'technician')
        .eq('is_active', true);

    if (!technicians) return;

    // 3. Generate Timesheets
    let totalRunAmount = new Decimal(0);

    for (const tech of technicians) {
        const calc = await calculatePayPeriod(tech.id, start, end);
        const hourlyRate = new Decimal(tech.hourly_rate || 0);

        // 1.5x for overtime
        const regPay = hourlyRate.times(calc.regular_hours);
        const otPay = hourlyRate.times(1.5).times(calc.overtime_hours);
        const grossPay = regPay.plus(otPay);

        totalRunAmount = totalRunAmount.plus(grossPay);

        await serviceSupabase.from('timesheets').insert({
            user_id: tech.id,
            payroll_run_id: run.id,
            period_start: start.toISOString(),
            period_end: end.toISOString(),
            total_hours: calc.total_hours,
            regular_hours: calc.regular_hours,
            overtime_hours: calc.overtime_hours,
            gross_pay: grossPay.toNumber(),
            status: calc.missing_check_outs ? 'draft' : 'approved', // Auto-approve if clean
        });
    }

    // Update Run Total
    await serviceSupabase
        .from('payroll_runs')
        .update({ total_amount: totalRunAmount.toNumber() })
        .eq('id', run.id);

    revalidatePath('/dashboard/payroll');
    return { success: true, runId: run.id };
}

export async function approveTimesheet(timesheetId: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    // Should verify admin here too...

    const { error } = await createServiceClient()
        .from('timesheets')
        .update({ status: 'approved' })
        .eq('id', timesheetId);

    if (error) throw error;
    revalidatePath(`/dashboard/payroll`);
}
