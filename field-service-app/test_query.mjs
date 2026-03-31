import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testQuery() {
    let { data, error } = await supabase
        .from('time_entries')
        .select(`
            *,
            user:profiles(full_name:display_name, base_hourly_rate),
            job:fs_jobs(title, status, customer:fs_customers(name))
        `);
    
    console.log('Error:', error);
    console.log('Data count:', data ? data.length : 0);
}

testQuery();
