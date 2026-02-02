'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const profileSchema = z.object({
    display_name: z.string().min(2, 'Name must be at least 2 characters'),
    username: z.string().min(3, 'Username must be at least 3 characters').regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
    email: z.string().email('Invalid email address'),
    phone: z.string().optional().or(z.literal('')),
    address: z.string().optional().or(z.literal('')),
});

export async function updateProfile(formData: FormData) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { error: 'Unauthorized' };
    }

    const rawData = {
        display_name: formData.get('display_name'),
        username: formData.get('username'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        address: formData.get('address'),
    };

    try {
        const validatedData = profileSchema.parse(rawData);

        // Check if email changed
        if (validatedData.email !== user.email) {
            const { error: emailError } = await supabase.auth.updateUser({ email: validatedData.email });
            if (emailError) return { error: `Email update failed: ${emailError.message}` };
        }

        // Check username uniqueness if changed
        // Note: This relies on a unique constraint on the database side for robust safety,
        // but a check here is good UX.
        // For simplicity with RLS, we'll let the DB constraint handle the final uniqueness check during update/insert.

        const { error: profileError } = await supabase
            .from('profiles')
            .update({
                display_name: validatedData.display_name,
                username: validatedData.username,
                phone: validatedData.phone,
                address: validatedData.address,
            })
            .eq('id', user.id);

        if (profileError) {
            if (profileError.code === '23505') { // Unique violation
                return { error: 'Username already taken' };
            }
            return { error: 'Failed to update profile details' };
        }

        // Update user metadata for display name/avatar consistency if needed
        // (Supabase Auth metadata is separate from profiles table)
        await supabase.auth.updateUser({
            data: { full_name: validatedData.display_name }
        });

        revalidatePath('/dashboard/settings');
        return { success: true };

    } catch (error) {
        if (error instanceof z.ZodError) {
            return { error: error.errors[0].message };
        }
        return { error: 'Something went wrong' };
    }
}

export async function resetPassword() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || !user.email) return { error: 'No user user found' };

    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/dashboard/settings/reset-password`,
    });

    if (error) return { error: error.message };
    return { success: true };
}
