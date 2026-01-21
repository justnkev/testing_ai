import { z } from 'zod';

export const customerSchema = z.object({
    name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
    email: z.string().email('Invalid email address').optional().or(z.literal('')),
    phone: z.string().max(20, 'Phone must be less than 20 characters').optional().or(z.literal('')),
    address: z.string().min(1, 'Address is required').max(200, 'Address must be less than 200 characters'),
    city: z.string().max(100, 'City must be less than 100 characters').optional().or(z.literal('')),
    state: z.string().max(50, 'State must be less than 50 characters').optional().or(z.literal('')),
    zip_code: z.string().max(20, 'ZIP code must be less than 20 characters').optional().or(z.literal('')),
    notes: z.string().max(500, 'Notes must be less than 500 characters').optional().or(z.literal('')),
});

export type CustomerFormData = z.infer<typeof customerSchema>;

export interface Customer {
    id: string;
    user_id: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string;
    city: string | null;
    state: string | null;
    zip_code: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
}
