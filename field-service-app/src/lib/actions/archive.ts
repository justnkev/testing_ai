'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { Customer } from '@/lib/validations/customer';
import type { JobWithCustomer } from '@/lib/validations/job';

export type ActionResult<T = void> =
    | { success: true; data?: T }
    | { success: false; error: string };

type ArchivableTable = 'fs_customers' | 'fs_jobs';

/**
 * Archive or restore a record by setting/clearing deleted_at timestamp
 */
export async function toggleArchiveStatus(
    table: ArchivableTable,
    id: string,
    restore: boolean = false
): Promise<ActionResult> {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return { success: false, error: 'Not authenticated' };
        }

        const { error } = await supabase
            .from(table)
            .update({ deleted_at: restore ? null : new Date().toISOString() })
            .eq('id', id);

        if (error) {
            console.error('Supabase error:', JSON.stringify(error, null, 2));
            return { success: false, error: `Failed to ${restore ? 'restore' : 'archive'} item` };
        }

        // Revalidate relevant paths
        revalidatePath('/dashboard');
        revalidatePath('/dashboard/customers');
        revalidatePath('/dashboard/jobs');
        revalidatePath('/dashboard/settings/archived');

        return { success: true };
    } catch (error) {
        console.error('Toggle archive status error:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
}

/**
 * Get archived items (where deleted_at is not null)
 */
export async function getArchivedItems(): Promise<{
    success: boolean;
    data: {
        customers: Customer[];
        jobs: JobWithCustomer[];
    };
    error?: string;
}> {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return { success: false, error: 'Not authenticated', data: { customers: [], jobs: [] } };
        }

        // Get archived customers
        const { data: customers, error: customersError } = await supabase
            .from('fs_customers')
            .select('*')
            .not('deleted_at', 'is', null)
            .order('deleted_at', { ascending: false });

        if (customersError) {
            console.error('Error fetching archived customers:', customersError);
        }

        // Get archived jobs with customer info
        const { data: jobs, error: jobsError } = await supabase
            .from('fs_jobs')
            .select(`
                *,
                customer:fs_customers (
                    id,
                    name,
                    address,
                    city,
                    state,
                    zip_code,
                    phone
                )
            `)
            .not('deleted_at', 'is', null)
            .order('deleted_at', { ascending: false });

        if (jobsError) {
            console.error('Error fetching archived jobs:', jobsError);
        }

        return {
            success: true,
            data: {
                customers: (customers || []) as Customer[],
                jobs: (jobs || []) as JobWithCustomer[]
            }
        };
    } catch (error) {
        console.error('Get archived items error:', error);
        return { success: false, error: 'An unexpected error occurred', data: { customers: [], jobs: [] } };
    }
}

/**
 * Permanently delete a record (hard delete)
 * Only allowed for items archived more than 30 days ago
 */
export async function permanentlyDelete(
    table: ArchivableTable,
    id: string
): Promise<ActionResult> {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return { success: false, error: 'Not authenticated' };
        }

        // Check if item was archived more than 30 days ago
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: record, error: fetchError } = await supabase
            .from(table)
            .select('id, deleted_at')
            .eq('id', id)
            .single();

        if (fetchError || !record) {
            return { success: false, error: 'Record not found' };
        }

        if (!record.deleted_at) {
            return { success: false, error: 'Cannot permanently delete an active record. Archive it first.' };
        }

        const deletedDate = new Date(record.deleted_at);
        if (deletedDate > thirtyDaysAgo) {
            const daysRemaining = Math.ceil((deletedDate.getTime() - thirtyDaysAgo.getTime()) / (1000 * 60 * 60 * 24));
            return { success: false, error: `Cannot permanently delete yet. Wait ${daysRemaining} more days.` };
        }

        // Perform hard delete
        const { error } = await supabase
            .from(table)
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Supabase error:', JSON.stringify(error, null, 2));
            return { success: false, error: 'Failed to permanently delete item' };
        }

        revalidatePath('/dashboard/settings/archived');

        return { success: true };
    } catch (error) {
        console.error('Permanent delete error:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
}

/**
 * Check if a soft-deleted customer exists with the given email
 * Used to handle unique constraint edge case
 */
export async function checkSoftDeletedCustomerByEmail(
    email: string
): Promise<{ exists: boolean; customerId?: string }> {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return { exists: false };
        }

        const { data, error } = await supabase
            .from('fs_customers')
            .select('id')
            .eq('email', email)
            .not('deleted_at', 'is', null)
            .single();

        if (error || !data) {
            return { exists: false };
        }

        return { exists: true, customerId: data.id };
    } catch {
        return { exists: false };
    }
}
