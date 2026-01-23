'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { customerSchema, type CustomerFormData } from '@/lib/validations/customer';

export type ActionResult<T = void> =
    | { success: true; data?: T }
    | { success: false; error: string };

export async function createCustomer(formData: CustomerFormData): Promise<ActionResult<{ id: string }>> {
    try {
        const supabase = await createClient();

        // Verify user is authenticated
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return { success: false, error: 'You must be logged in to create a customer' };
        }

        // Validate form data on server
        const validatedData = customerSchema.safeParse(formData);
        if (!validatedData.success) {
            return { success: false, error: validatedData.error.issues[0]?.message || 'Invalid form data' };
        }

        // Insert customer into fs_customers table (public schema)
        const { data, error } = await supabase
            .from('fs_customers')
            .insert({
                user_id: user.id,
                name: validatedData.data.name,
                email: validatedData.data.email || null,
                phone: validatedData.data.phone || null,
                address: validatedData.data.address,
                city: validatedData.data.city || null,
                state: validatedData.data.state || null,
                zip_code: validatedData.data.zip_code || null,
                notes: validatedData.data.notes || null,
            })
            .select('id')
            .single();

        if (error) {
            console.error('Supabase error:', JSON.stringify(error, null, 2));
            return { success: false, error: `Failed to create customer: ${error.message}` };
        }

        revalidatePath('/dashboard');
        revalidatePath('/dashboard/customers');

        return { success: true, data: { id: data.id } };
    } catch (error) {
        console.error('Create customer error:', error);
        return { success: false, error: 'An unexpected error occurred. Please try again.' };
    }
}

export async function getCustomers() {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return { success: false, error: 'Not authenticated', data: [] };
        }

        const { data, error } = await supabase
            .from('fs_customers')
            .select('*')
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Supabase error:', JSON.stringify(error, null, 2));
            return { success: false, error: `Failed to fetch customers: ${error.message}`, data: [] };
        }

        return { success: true, data: data || [] };
    } catch (error) {
        console.error('Get customers error:', error);
        return { success: false, error: 'An unexpected error occurred', data: [] };
    }
}

export async function deleteCustomer(id: string): Promise<ActionResult> {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return { success: false, error: 'Not authenticated' };
        }

        // Soft delete: set deleted_at timestamp instead of hard delete
        const { error } = await supabase
            .from('fs_customers')
            .update({ deleted_at: new Date().toISOString(), last_modified_by: user.id })
            .eq('id', id);

        if (error) {
            console.error('Supabase error:', JSON.stringify(error, null, 2));
            return { success: false, error: 'Failed to delete customer' };
        }

        revalidatePath('/dashboard');
        revalidatePath('/dashboard/customers');

        return { success: true };
    } catch (error) {
        console.error('Delete customer error:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
}

export async function getCustomerById(id: string): Promise<ActionResult<{ customer: import('@/lib/validations/customer').Customer; hasChanged?: boolean }>> {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return { success: false, error: 'Not authenticated' };
        }

        const { data, error } = await supabase
            .from('fs_customers')
            .select('*')
            .eq('id', id)
            .is('deleted_at', null)
            .single();

        if (error || !data) {
            console.error('Supabase error:', error);
            return { success: false, error: 'Customer not found' };
        }

        return { success: true, data: { customer: data } };
    } catch (error) {
        console.error('Get customer by id error:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
}

export async function updateCustomer(
    id: string,
    updates: Partial<CustomerFormData>,
    originalUpdatedAt?: string
): Promise<ActionResult<{ hasConflict?: boolean }>> {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return { success: false, error: 'Not authenticated' };
        }

        // Check for concurrent edit if originalUpdatedAt provided
        if (originalUpdatedAt) {
            const { data: current } = await supabase
                .from('fs_customers')
                .select('updated_at')
                .eq('id', id)
                .single();

            if (current && current.updated_at !== originalUpdatedAt) {
                // Data has changed since form was opened - warn but allow save
                console.warn('Concurrent edit detected for customer', id);
            }
        }

        // Build update object with only non-empty values
        const updateData: Record<string, unknown> = {
            last_modified_by: user.id,
        };

        // Only include fields that are explicitly provided (dirty check)
        if (updates.name !== undefined) updateData.name = updates.name;
        if (updates.email !== undefined) updateData.email = updates.email || null;
        if (updates.phone !== undefined) updateData.phone = updates.phone || null;
        if (updates.address !== undefined) updateData.address = updates.address;
        if (updates.city !== undefined) updateData.city = updates.city || null;
        if (updates.state !== undefined) updateData.state = updates.state || null;
        if (updates.zip_code !== undefined) updateData.zip_code = updates.zip_code || null;
        if (updates.notes !== undefined) updateData.notes = updates.notes || null;

        const { error } = await supabase
            .from('fs_customers')
            .update(updateData)
            .eq('id', id);

        if (error) {
            console.error('Supabase error:', JSON.stringify(error, null, 2));
            return { success: false, error: `Failed to update customer: ${error.message}` };
        }

        revalidatePath('/dashboard');
        revalidatePath('/dashboard/customers');
        revalidatePath('/dashboard/jobs');

        return { success: true };
    } catch (error) {
        console.error('Update customer error:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
}

