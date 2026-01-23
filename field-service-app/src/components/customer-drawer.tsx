'use client';

import { useState } from 'react';
import { Drawer } from 'vaul';
import { Button } from '@/components/ui/button';
import { createCustomer } from '@/lib/actions/customers';
import { type CustomerFormData } from '@/lib/validations/customer';
import { toast } from 'sonner';
import { Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { CustomerForm } from '@/components/customer-form';

interface CustomerDrawerProps {
    onSuccess?: () => void;
}

export function CustomerDrawer({ onSuccess }: CustomerDrawerProps) {
    const [open, setOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const router = useRouter();

    const onSubmit = async (data: CustomerFormData) => {
        setIsSubmitting(true);

        // Retry logic for network issues
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            attempts++;

            try {
                const result = await createCustomer(data);

                if (result.success) {
                    toast.success('Customer created successfully!');
                    setOpen(false);
                    router.refresh();
                    onSuccess?.();
                    return;
                } else {
                    if (attempts < maxAttempts) {
                        toast.loading('Retrying...', { id: 'retry-toast' });
                        await new Promise(r => setTimeout(r, 1000));
                    } else {
                        toast.dismiss('retry-toast');
                        toast.error(result.error);
                    }
                }
            } catch {
                if (attempts < maxAttempts) {
                    toast.loading('Connection issue. Retrying...', { id: 'retry-toast' });
                    await new Promise(r => setTimeout(r, 1000));
                } else {
                    toast.dismiss('retry-toast');
                    toast.error('Failed to create customer. Please try again.');
                }
            }
        }

        setIsSubmitting(false);
    };

    return (
        <Drawer.Root open={open} onOpenChange={setOpen}>
            <Drawer.Trigger asChild>
                <Button className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Customer
                </Button>
            </Drawer.Trigger>
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 bg-black/60 z-50" />
                <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 mt-24 flex h-[90vh] flex-col rounded-t-2xl bg-slate-800">
                    <div className="flex-1 overflow-y-auto px-4 pb-8">
                        {/* Handle */}
                        <div className="mx-auto mb-4 mt-4 h-1.5 w-12 shrink-0 rounded-full bg-slate-600" />

                        {/* Header */}
                        <div className="flex items-center justify-between mb-6">
                            <Drawer.Title className="text-xl font-semibold text-white">
                                Add New Customer
                            </Drawer.Title>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setOpen(false)}
                                className="text-slate-400 hover:text-white hover:bg-slate-700"
                            >
                                <X className="w-5 h-5" />
                            </Button>
                        </div>

                        <CustomerForm
                            onSubmit={onSubmit}
                            onCancel={() => setOpen(false)}
                            isLoading={isSubmitting}
                        />
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
}
