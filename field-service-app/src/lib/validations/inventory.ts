import { z } from 'zod';

export const inventoryItemSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1, 'Name is required'),
    sku: z.string().min(1, 'SKU is required'),
    description: z.string().optional(),
    cost_price: z.coerce.number().min(0, 'Cost price must be positive'),
    retail_price: z.coerce.number().min(0, 'Retail price must be positive'),
    stock_quantity: z.coerce.number().int().min(0, 'Stock cannot be negative'),
    min_stock_level: z.coerce.number().int().min(0).default(5),
});

export type InventoryItem = z.infer<typeof inventoryItemSchema> & {
    id: string;
    organization_id: string;
    created_at: string;
    updated_at: string;
};

export const partUsageSchema = z.object({
    item_id: z.string().uuid('Invalid item ID'),
    quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1'),
});

export type PartUsageData = z.infer<typeof partUsageSchema>;

/** Quick Add: custom part not in inventory */
export const customPartSchema = z.object({
    name: z.string().min(1, 'Part name is required').max(100),
    estimated_price: z.coerce.number().min(0, 'Price must be positive'),
    quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1'),
});

export type CustomPartData = z.infer<typeof customPartSchema>;

export interface JobPart {
    id: string;
    job_id: string;
    item_id: string | null;
    quantity_used: number;
    unit_price_at_time_of_use: number;
    is_custom_entry: boolean;
    custom_item_name: string | null;
    custom_item_price: number | null;
    admin_reviewed: boolean;
    created_at: string;
    item: {
        name: string;
        sku: string;
        description: string | null;
    } | null;
}
