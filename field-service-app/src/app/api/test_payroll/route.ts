import { getPayrollAuditData } from '@/lib/actions/payroll';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
    let query = (await createClient())
            .from('time_entries')
            .select(`
                *,
                user:profiles(display_name, base_hourly_rate),
                job:fs_jobs(title, status, customer:fs_customers(name))
            `)
            .order('clock_in_at', { ascending: false });

    const { data: entries, error } = await query;
    return new Response(JSON.stringify({ error, entriesCount: entries?.length }));
}
