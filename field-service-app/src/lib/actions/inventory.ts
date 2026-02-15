'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { inventoryItemSchema, partUsageSchema } from '@/lib/validations/inventory';
import type { InventoryItem, JobPart } from '@/lib/validations/inventory';

export type ActionResult<T = void> =
    | { success: true; data?: T }
    | { success: false; error: string };

/**
 * Fetch all inventory items for the organization
 */
export async function getInventoryItems(search?: string): Promise<ActionResult<InventoryItem[]>> {
    try {
        const supabase = await createClient();

        let query = supabase
            .from('fs_inventory_items')
            .select('*')
            .order('name');

        if (search) {
            query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Fetch inventory error:', error);
            return { success: false, error: 'Failed to fetch inventory' };
        }

        return { success: true, data: data as InventoryItem[] };
    } catch (error) {
        return { success: false, error: 'Unexpected error' };
    }
}

/**
 * Create a new inventory item
 */
export async function createInventoryItem(formData: unknown): Promise<ActionResult<InventoryItem>> {
    try {
        const validated = inventoryItemSchema.parse(formData);
        const supabase = await createClient();

        // Get Org ID
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: 'Not authenticated' };

        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single();

        if (!profile?.organization_id) {
            return { success: false, error: 'No organization found' };
        }

        const { data, error } = await supabase
            .from('fs_inventory_items')
            .insert({
                ...validated,
                organization_id: profile.organization_id
            })
            .select()
            .single();

        if (error) {
            console.error('Create item error:', error);
            return { success: false, error: 'Failed to create item' };
        }

        revalidatePath('/dashboard/inventory');
        return { success: true, data: data as InventoryItem };
    } catch (error) {
        console.error('Create item exception:', error);
        return { success: false, error: 'Invalid data or server error' };
    }
}

/**
 * Add a part to a job (Decrement Stock)
 */
export async function addPartToJob(jobId: string, itemId: string, quantity: number): Promise<ActionResult> {
    try {
        const supabase = await createClient();

        // 1. Get Item Price first to lock it in
        const { data: item, error: itemError } = await supabase
            .from('fs_inventory_items')
            .select('retail_price, stock_quantity')
            .eq('id', itemId)
            .single();

        if (itemError || !item) return { success: false, error: 'Item not found' };

        // 2. Decrement Stock via RPC (Transactional)
        const { error: rpcError } = await supabase.rpc('decrement_stock', {
            p_item_id: itemId,
            p_quantity: quantity
        });

        if (rpcError) {
            console.error('Stock decrement error:', rpcError);
            return { success: false, error: rpcError.message }; // Likely "Insufficient stock"
        }

        // 3. Record Usage
        const { error: usageError } = await supabase.from('fs_job_parts').insert({
            job_id: jobId,
            item_id: itemId,
            quantity_used: quantity,
            unit_price_at_time_of_use: item.retail_price
        });

        if (usageError) {
            // CRITICAL: If insert fails, we technically should rollback stock. 
            // Valid concern for production code. Since RPC committed, we'd need to manually compensation.
            // For now, assume this insert is safe if item exists.
            console.error('Usage insert error:', usageError);
            // Attempt rollback
            await supabase.rpc('increment_stock', { p_item_id: itemId, p_quantity: quantity });
            return { success: false, error: 'Failed to record usage' };
        }

        revalidatePath(`/dashboard/jobs/${jobId}`);
        revalidatePath('/dashboard/inventory'); // Stock changed

        return { success: true };

    } catch (error) {
        console.error('Add part error:', error);
        return { success: false, error: 'Unexpected error' };
    }
}

/**
 * Remove a part from a job (Increment Stock)
 */
export async function removePartFromJob(usageId: string): Promise<ActionResult> {
    try {
        const supabase = await createClient();

        // Get usage details
        const { data: usage, error: fetchError } = await supabase
            .from('fs_job_parts')
            .select('item_id, quantity_used, job_id')
            .eq('id', usageId)
            .single();

        if (fetchError || !usage) return { success: false, error: 'Usage record not found' };

        // Increment Stock
        const { error: rpcError } = await supabase.rpc('increment_stock', {
            p_item_id: usage.item_id,
            p_quantity: usage.quantity_used
        });

        if (rpcError) {
            return { success: false, error: 'Failed to restore stock' };
        }

        // Delete Usage Record
        const { error: deleteError } = await supabase
            .from('fs_job_parts')
            .delete()
            .eq('id', usageId);

        if (deleteError) {
            return { success: false, error: 'Failed to delete usage record' };
        }

        revalidatePath(`/dashboard/jobs/${usage.job_id}`);
        revalidatePath('/dashboard/inventory');

        return { success: true };
    } catch (error) {
        return { success: false, error: 'Unexpected error' };
    }
}

/**
 * Get parts used for a job
 */
export async function getJobParts(jobId: string): Promise<ActionResult<JobPart[]>> {
    try {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from('fs_job_parts')
            .select(`
                *,
                item:fs_inventory_items(name, sku, description)
            `)
            .eq('job_id', jobId)
            .order('created_at', { ascending: true });

        if (error) return { success: false, error: 'Failed to fetch parts' };

        return { success: true, data: data as JobPart[] };
    } catch (error) {
        return { success: false, error: 'Unexpected error' };
    }
}
