import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        console.log('[API] Fetching job with ID:', id);

        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) {
            console.log('[API] Auth error:', authError);
            return NextResponse.json({ error: 'Authentication error' }, { status: 401 });
        }
        if (!user) {
            console.log('[API] No user found');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        console.log('[API] User authenticated:', user.id);

        // First, try a simple query to check if the job exists at all
        const { data: simpleJob, error: simpleError } = await supabase
            .from('fs_jobs')
            .select('id, title, customer_id')
            .eq('id', id)
            .single();

        if (simpleError) {
            console.log('[API] Simple query error:', simpleError);
            return NextResponse.json({
                error: 'Job not found',
                details: simpleError.message
            }, { status: 404 });
        }
        console.log('[API] Simple job found:', simpleJob);

        // Now get the full job with relations (use left join, not inner)
        const { data: job, error } = await supabase
            .from('fs_jobs')
            .select(`
                id,
                title,
                description,
                status,
                priority,
                scheduled_date,
                scheduled_time,
                estimated_duration_minutes,
                check_in_at,
                completed_at,
                customer:fs_customers(
                    id,
                    name,
                    email,
                    phone,
                    address,
                    city,
                    state,
                    zip_code
                ),
                technician:profiles(
                    id,
                    display_name
                )
            `)
            .eq('id', id)
            .single();

        if (error) {
            console.log('[API] Full query error:', error);
            return NextResponse.json({
                error: 'Failed to fetch job details',
                details: error.message
            }, { status: 500 });
        }

        if (!job) {
            console.log('[API] No job data returned');
            return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        }

        console.log('[API] Full job fetched successfully');

        // Handle Supabase relation return types
        const formattedJob = {
            ...job,
            customer: Array.isArray(job.customer) ? job.customer[0] : job.customer,
            technician: Array.isArray(job.technician) ? job.technician[0] : job.technician
        };

        return NextResponse.json(formattedJob);
    } catch (err) {
        console.error('[API] Unexpected error:', err);
        return NextResponse.json({
            error: 'Internal server error',
            details: err instanceof Error ? err.message : 'Unknown error'
        }, { status: 500 });
    }
}
