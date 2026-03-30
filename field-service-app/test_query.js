require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Must use SERVICE ROLE to bypass RLS for this fast test
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
    
    if (error) {
        console.error('ERROR OCCURRED:', error);
    } else {
        console.log('SUCCESS! Entries count:', data?.length);
    }
}

testQuery();
