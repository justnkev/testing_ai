import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
    console.log("Checking stale entries...");
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    const { data: staleEntries, error: staleErr } = await supabase
        .from('time_entries')
        .select('id, user_id')
        .is('clock_out_at', null)
        .lt('clock_in_at', twelveHoursAgo)
        .neq('status', 'manual_review');
    
    if (staleErr) {
        console.error("STALE ENTRIES ERROR:", staleErr);
    } else {
        console.log("Stale entries OK:", staleEntries?.length);
    }

    console.log("Checking main query...");
    let query = supabase
        .from('time_entries')
        .select(`
            *,
            user:profiles(display_name, base_hourly_rate),
            job:fs_jobs(title, status, customer:fs_customers(name))
        `)
        .order('clock_in_at', { ascending: false });

    const { data: entries, error } = await query;
    if (error) {
        console.error("MAIN QUERY ERROR:", error);
    } else {
        console.log("Main query OK, count:", entries?.length);
    }
}
check();
