'use client';

import { useState, useEffect } from 'react';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { CustomerForm } from '@/components/customer-form';
import { updateCustomer, getCustomerById } from '@/lib/actions/customers';
import { toast } from 'sonner';
import type { Customer, CustomerFormData } from '@/lib/validations/customer';
import { Loader2 } from 'lucide-react';

interface CustomerEditSheetProps {
    customerId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

export function CustomerEditSheet({
    customerId,
    open,
    onOpenChange,
    onSuccess,
}: CustomerEditSheetProps) {
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (open && customerId) {
            loadCustomer();
        } else if (!open) {
            setCustomer(null);
        }
    }, [open, customerId]);

    const loadCustomer = async () => {
        if (!customerId) return;

        setIsLoading(true);
        const result = await getCustomerById(customerId);
        if (result.success && result.data) {
            setCustomer(result.data.customer);
        } else if (!result.success) {
            toast.error(result.error || 'Failed to load customer');
            onOpenChange(false);
        }
        setIsLoading(false);
    };

    const handleSubmit = async (
        data: CustomerFormData,
        dirtyFields?: Partial<Record<keyof CustomerFormData, boolean>>
    ) => {
        if (!customerId || !customer) return;

        setIsSaving(true);

        // Only send fields that actually changed (dirty checking)
        const updates: Partial<CustomerFormData> = {};
        if (dirtyFields) {
            Object.keys(dirtyFields).forEach((key) => {
                const field = key as keyof CustomerFormData;
                if (dirtyFields[field]) {
                    updates[field] = data[field] as any;
                }
            });
        } else {
            Object.assign(updates, data);
        }

        // Skip if nothing changed
        if (Object.keys(updates).length === 0) {
            toast.info('No changes to save');
            setIsSaving(false);
            return;
        }

        const result = await updateCustomer(customerId, updates, customer.updated_at);

        if (result.success) {
            toast.success('Customer updated successfully');
            onOpenChange(false);
            onSuccess?.();
        } else {
            toast.error(result.error || 'Failed to update customer');
        }

        setIsSaving(false);
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="bg-slate-900 border-slate-700 w-full sm:max-w-lg overflow-y-auto">
                <SheetHeader>
                    <SheetTitle className="text-white">Edit Customer</SheetTitle>
                    <SheetDescription className="text-slate-400">
                        Make changes to customer information. Click save when done.
                    </SheetDescription>
                </SheetHeader>

                <div className="mt-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                        </div>
                    ) : customer ? (
                        <CustomerForm
                            initialData={customer}
                            onSubmit={handleSubmit}
                            onCancel={() => onOpenChange(false)}
                            isLoading={isSaving}
                        />
                    ) : null}
                </div>
            </SheetContent>
        </Sheet>
    );
}
