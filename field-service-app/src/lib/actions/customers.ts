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

        const { error } = await supabase
            .from('fs_customers')
            .delete()
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
