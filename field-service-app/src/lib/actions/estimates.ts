'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { estimateSchema, type EstimateItem } from '@/lib/validations/estimates';

export type ActionResult<T = void> =
    | { success: true; data?: T }
    | { success: false; error: string };

/**
 * Upsert an estimate and its items.
 * Strategy:
 * 1. Upsert Estimate Record
 * 2. Delete all existing items for this estimate (if updating)
 * 3. Insert new items
 */
export async function upsertEstimate(jobId: string, items: EstimateItem[], status: 'DRAFT' | 'SENT' | 'ACCEPTED' = 'DRAFT'): Promise<ActionResult> {
    try {
        const supabase = await createClient();

        // 1. Get Org ID securely
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: 'Unauthorized' };

        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single();

        if (!profile?.organization_id) return { success: false, error: 'No Organization Found' };

        // 2. Validate Items
        // Simple check, z.array(estimateItemSchema).parse(items);

        // Calculate Total
        const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

        // 3. Upsert Estimate Header
        // First check if an estimate already exists for this job? Or are we passing estimateId?
        // Requirement says "UpsertEstimate(jobId, items)".
        // Let's check if there is an existing estimate for this job.
        // If multiple estimates per job are allowed in future, this logic changes.
        // For now, assume ONE estimate per job (or the 'main' one).
        // Let's fetch existing first.



        // 4. Validate Job & Get Customer
        const { data: jobData, error: jobError } = await supabase
            .from('fs_jobs')
            .select('customer_id')
            .eq('id', jobId)
            .single();

        if (jobError || !jobData?.customer_id) {
            console.error('Job fetch error or missing customer:', jobError);
            return { success: false, error: 'Failed to retrieve job or customer information' };
        }

        const customerId = jobData.customer_id;

        // Force status to be valid
        const finalStatus = (status || 'DRAFT').toUpperCase();

        // 5. Upsert Estimate Header
        const { data: existingEstimate, error: fetchError } = await supabase
            .from('estimates')
            .select('id')
            .eq('job_id', jobId)
            .maybeSingle();

        if (fetchError) {
            console.error('Check existing estimate error:', fetchError);
            return { success: false, error: 'Failed to checked for existing estimate: ' + fetchError.message };
        }

        let estimateId = existingEstimate?.id;

        const estimateData = {
            job_id: jobId,
            organization_id: profile.organization_id,
            customer_id: customerId,
            total_amount: totalAmount,
            status: finalStatus,
            updated_at: new Date().toISOString()
        };

        let result;
        if (estimateId) {
            result = await supabase
                .from('estimates')
                .update(estimateData)
                .eq('id', estimateId)
                .select()
                .single();
        } else {
            result = await supabase
                .from('estimates')
                .insert(estimateData)
                .select()
                .single();
        }


        if (result.error) {
            console.error('Estimate upsert error:', result.error);
            return { success: false, error: 'Failed to save estimate header: ' + result.error.message + ' (' + result.error.code + ')' };
        }

        estimateId = result.data.id;

        // 4. Handle Items (Delete All + Insert All)
        // Note: DELETE FROM estimate_items WHERE estimate_id = ...

        const { error: deleteError } = await supabase
            .from('estimate_items')
            .delete()
            .eq('estimate_id', estimateId);

        if (deleteError) {
            console.error('Item delete error:', deleteError);
            return { success: false, error: 'Failed to clear old items' };
        }

        if (items.length > 0) {
            const itemsToInsert = items.map(item => ({
                estimate_id: estimateId,
                description: item.description,
                quantity: item.quantity,
                unit_price: item.unit_price,
                inventory_item_id: item.inventory_item_id || null
            }));

            const { error: insertError } = await supabase
                .from('estimate_items')
                .insert(itemsToInsert as any); // Type casting for convenience

            if (insertError) {
                console.error('Item insert error:', insertError);
                return { success: false, error: 'Failed to save items' };
            }
        }

        revalidatePath(`/dashboard/jobs/${jobId}`);
        return { success: true };

    } catch (error) {
        console.error('Upsert estimate exception:', error);
        return { success: false, error: 'Unexpected error' };
    }
}

/**
 * Fetch estimate for a job
 */
export async function getEstimate(jobId: string) {
    const supabase = await createClient();

    // Fetch Estimate
    const { data: estimate, error } = await supabase
        .from('estimates')
        .select('*')
        .eq('job_id', jobId)
        .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        console.error('Fetch estimate error:', error);
        return null;
    }

    if (!estimate) return null;

    // Fetch Items
    const { data: items } = await supabase
        .from('estimate_items')
        .select('*')
        .eq('estimate_id', estimate.id);

    return {
        ...estimate,
        items: items || []
    };
}
