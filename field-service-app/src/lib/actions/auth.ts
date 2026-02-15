'use server';

import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// ── Zod Schemas ──────────────────────────────────────────────────────
const emailSchema = z.string().email('Please enter a valid email address.');

const passwordSchema = z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .regex(
        /[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
        'Password must contain at least one number or special character.'
    );

// ── Types ────────────────────────────────────────────────────────────
export type AuthActionState = {
    error?: string;
    success?: string;
    fieldErrors?: Record<string, string[]>;
};

// ── Request Password Reset ───────────────────────────────────────────
/**
 * Sends a password-reset email via Supabase.
 * The email contains a link that redirects to /auth/callback?next=/auth/set-new-password
 */
export async function requestPasswordReset(
    _prevState: AuthActionState,
    formData: FormData
): Promise<AuthActionState> {
    const raw = formData.get('email') as string;
    const parsed = emailSchema.safeParse(raw);

    if (!parsed.success) {
        return { fieldErrors: { email: parsed.error.flatten().formErrors } };
    }

    try {
        const supabase = await createClient();
        const siteUrl =
            process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

        const { error } = await supabase.auth.resetPasswordForEmail(
            parsed.data,
            {
                redirectTo: `${siteUrl}/auth/callback?next=/auth/set-new-password`,
            }
        );

        if (error) {
            console.error('Reset email error:', error);
            return { error: error.message };
        }

        // Always show success even if email not found (prevent enumeration)
        return {
            success:
                'If an account exists with that email, you will receive a password reset link shortly.',
        };
    } catch (err) {
        console.error('Unexpected reset error:', err);
        return { error: 'An unexpected error occurred.' };
    }
}

// ── Update Password ──────────────────────────────────────────────────
/**
 * Updates the password for the currently authenticated user.
 * Called from the /auth/set-new-password page after a recovery/invite code exchange.
 */
export async function updatePassword(
    _prevState: AuthActionState,
    formData: FormData
): Promise<AuthActionState> {
    const raw = formData.get('password') as string;
    const confirm = formData.get('confirmPassword') as string;

    // Validate password strength
    const parsed = passwordSchema.safeParse(raw);
    if (!parsed.success) {
        return { fieldErrors: { password: parsed.error.flatten().formErrors } };
    }

    // Confirm match
    if (raw !== confirm) {
        return { fieldErrors: { confirmPassword: ['Passwords do not match.'] } };
    }

    try {
        const supabase = await createClient();

        // Verify the user has a valid session (from recovery/invite code exchange)
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return {
                error:
                    'Your session has expired. Please request a new password reset link.',
            };
        }

        const { error } = await supabase.auth.updateUser({
            password: parsed.data,
        });

        if (error) {
            console.error('Password update error:', error);
            return { error: error.message };
        }

        return { success: 'Password updated successfully!' };
    } catch (err) {
        console.error('Unexpected password update error:', err);
        return { error: 'An unexpected error occurred.' };
    }
}
