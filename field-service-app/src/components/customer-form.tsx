'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { customerSchema, type CustomerFormData, type Customer } from '@/lib/validations/customer';
import { Loader2 } from 'lucide-react';

interface CustomerFormProps {
    initialData?: Customer;
    onSubmit: (data: CustomerFormData, dirtyFields?: Partial<Record<keyof CustomerFormData, boolean>>) => Promise<void>;
    onCancel?: () => void;
    isLoading?: boolean;
}

export function CustomerForm({ initialData, onSubmit, onCancel, isLoading = false }: CustomerFormProps) {
    const {
        register,
        handleSubmit,
        formState: { errors, dirtyFields },
    } = useForm<CustomerFormData>({
        resolver: zodResolver(customerSchema),
        defaultValues: initialData ? {
            name: initialData.name,
            email: initialData.email || '',
            phone: initialData.phone || '',
            address: initialData.address,
            city: initialData.city || '',
            state: initialData.state || '',
            zip_code: initialData.zip_code || '',
            notes: initialData.notes || '',
        } : {
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

    const handleFormSubmit = async (data: CustomerFormData) => {
        await onSubmit(data, dirtyFields);
    };

    const isEditing = !!initialData;

    return (
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                    id="name"
                    {...register('name')}
                    placeholder="Customer name"
                    className="bg-slate-800 border-slate-600"
                />
                {errors.name && (
                    <p className="text-red-400 text-sm">{errors.name.message}</p>
                )}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                        id="email"
                        type="email"
                        {...register('email')}
                        placeholder="email@example.com"
                        className="bg-slate-800 border-slate-600"
                    />
                    {errors.email && (
                        <p className="text-red-400 text-sm">{errors.email.message}</p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                        id="phone"
                        {...register('phone')}
                        placeholder="(555) 123-4567"
                        className="bg-slate-800 border-slate-600"
                    />
                    {errors.phone && (
                        <p className="text-red-400 text-sm">{errors.phone.message}</p>
                    )}
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="address">Address *</Label>
                <Input
                    id="address"
                    {...register('address')}
                    placeholder="Street address"
                    className="bg-slate-800 border-slate-600"
                />
                {errors.address && (
                    <p className="text-red-400 text-sm">{errors.address.message}</p>
                )}
            </div>

            <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                        id="city"
                        {...register('city')}
                        placeholder="City"
                        className="bg-slate-800 border-slate-600"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input
                        id="state"
                        {...register('state')}
                        placeholder="State"
                        className="bg-slate-800 border-slate-600"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="zip_code">ZIP</Label>
                    <Input
                        id="zip_code"
                        {...register('zip_code')}
                        placeholder="12345"
                        className="bg-slate-800 border-slate-600"
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                    id="notes"
                    {...register('notes')}
                    placeholder="Additional notes about the customer..."
                    className="bg-slate-800 border-slate-600 min-h-[80px]"
                />
            </div>

            <div className="flex gap-3 pt-4">
                {onCancel && (
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onCancel}
                        className="flex-1 border-slate-600"
                        disabled={isLoading}
                    >
                        Cancel
                    </Button>
                )}
                <Button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            {isEditing ? 'Saving...' : 'Creating...'}
                        </>
                    ) : (
                        isEditing ? 'Save Changes' : 'Create Customer'
                    )}
                </Button>
            </div>
        </form>
    );
}
