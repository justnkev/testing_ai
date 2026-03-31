const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://skolvxmcritlzepnaogd.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Service Role Key for bypassing RLS locally

const supabase = createClient(supabaseUrl, supabaseKey);

async function runQuery() {
  const id = 'ac142af3-2148-4364-8074-f8fde2833241'; // Known good ID

  console.log('Running query with explicit FK...');
  const result = await supabase
    .from('fs_jobs')
    .select(`
        *,
        customer:fs_customers (
          id,
          name
        ),
        technician:profiles!fs_jobs_technician_id_fkey (
          display_name,
          email
        )
      `)
    .eq('id', id)
    .single();

  if (result.error) {
    console.error('Error with explicit FK:', result.error);
  } else {
    console.log('Success with explicit FK:', JSON.stringify(result.data, null, 2));
  }

  console.log('\nRunning query with column alias...');
  const result2 = await supabase
    .from('fs_jobs')
    .select(`
        *,
        customer:fs_customers (
          id,
          name
        ),
        technician:technician_id (
            display_name,
            email
        )
      `)
    .eq('id', id)
    .single();

  if (result2.error) {
    console.error('Error with column alias:', result2.error);
  } else {
    console.log('Success with column alias:', JSON.stringify(result2.data, null, 2));
  }
}

runQuery();
