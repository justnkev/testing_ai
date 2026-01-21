'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Drawer } from 'vaul';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createCustomer } from '@/lib/actions/customers';
import { customerSchema, type CustomerFormData } from '@/lib/validations/customer';
import { toast } from 'sonner';
import { Plus, Loader2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface CustomerDrawerProps {
    onSuccess?: () => void;
}

export function CustomerDrawer({ onSuccess }: CustomerDrawerProps) {
    const [open, setOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const router = useRouter();

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<CustomerFormData>({
        resolver: zodResolver(customerSchema),
        defaultValues: {
            name: '',
            email: '',
            phone: '',
            address: '',
            city: '',
            state: '',
            zip_code: '',
            notes: '',
        },
    });

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
                    reset();
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

                        {/* Form */}
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name" className="text-slate-300">
                                    Name <span className="text-red-400">*</span>
                                </Label>
                                <Input
                                    id="name"
                                    {...register('name')}
                                    placeholder="John Smith"
                                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                                />
                                {errors.name && (
                                    <p className="text-sm text-red-400">{errors.name.message}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="address" className="text-slate-300">
                                    Address <span className="text-red-400">*</span>
                                </Label>
                                <Input
                                    id="address"
                                    {...register('address')}
                                    placeholder="123 Main Street"
                                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                                />
                                {errors.address && (
                                    <p className="text-sm text-red-400">{errors.address.message}</p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="city" className="text-slate-300">City</Label>
                                    <Input
                                        id="city"
                                        {...register('city')}
                                        placeholder="New York"
                                        className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="state" className="text-slate-300">State</Label>
                                    <Input
                                        id="state"
                                        {...register('state')}
                                        placeholder="NY"
                                        className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="zip_code" className="text-slate-300">ZIP Code</Label>
                                <Input
                                    id="zip_code"
                                    {...register('zip_code')}
                                    placeholder="10001"
                                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="email" className="text-slate-300">Email</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        {...register('email')}
                                        placeholder="john@example.com"
                                        className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                                    />
                                    {errors.email && (
                                        <p className="text-sm text-red-400">{errors.email.message}</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="phone" className="text-slate-300">Phone</Label>
                                    <Input
                                        id="phone"
                                        type="tel"
                                        {...register('phone')}
                                        placeholder="(555) 123-4567"
                                        className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="notes" className="text-slate-300">Notes</Label>
                                <Input
                                    id="notes"
                                    {...register('notes')}
                                    placeholder="Any special instructions..."
                                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                                />
                            </div>

                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full mt-6 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Creating...
                                    </>
                                ) : (
                                    <>
                                        <Plus className="w-4 h-4 mr-2" />
                                        Create Customer
                                    </>
                                )}
                            </Button>
                        </form>
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
}
