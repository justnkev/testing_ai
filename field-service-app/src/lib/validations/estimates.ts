import { z } from 'zod';

export const estimateItemSchema = z.object({
    id: z.string().optional(), // Optional for new items
    inventory_item_id: z.string().uuid().optional().nullable(),
    description: z.string().min(1, 'Description is required'),
    quantity: z.coerce.number().min(0.01, 'Quantity must be greater than 0'),
    unit_price: z.coerce.number().min(0, 'Price must be positive'),
});

export const estimateSchema = z.object({
    id: z.string().optional(),
    job_id: z.string().uuid(),
    status: z.enum(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED']).default('DRAFT'),
    items: z.array(estimateItemSchema).min(1, 'At least one item is required'),
});

export type EstimateItem = z.infer<typeof estimateItemSchema>;
export type Estimate = z.infer<typeof estimateSchema> & {
    total_amount: number;
    created_at?: string;
};
