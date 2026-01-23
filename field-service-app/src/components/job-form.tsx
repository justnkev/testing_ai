'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { jobSchema, type JobFormData, type Job } from '@/lib/validations/job';
import { Loader2 } from 'lucide-react';
import type { Customer } from '@/lib/validations/customer';

interface JobFormProps {
    initialData?: Job;
    customers: Customer[];
    onSubmit: (data: JobFormData, dirtyFields?: Partial<Record<keyof JobFormData, boolean>>) => Promise<void>;
    onCancel?: () => void;
    isLoading?: boolean;
}

export function JobForm({ initialData, customers, onSubmit, onCancel, isLoading = false }: JobFormProps) {
    const {
        register,
        handleSubmit,
        formState: { errors, dirtyFields },
    } = useForm<JobFormData>({
        resolver: zodResolver(jobSchema),
        defaultValues: initialData ? {
            customer_id: initialData.customer_id,
            title: initialData.title,
            description: initialData.description || '',
            status: initialData.status,
            scheduled_date: initialData.scheduled_date,
            scheduled_time: initialData.scheduled_time || '',
            estimated_duration_minutes: initialData.estimated_duration_minutes || undefined,
            priority: initialData.priority,
            notes: initialData.notes || '',
        } : {
            customer_id: '',
            title: '',
            description: '',
            status: 'scheduled',
            scheduled_date: new Date().toISOString().split('T')[0],
            scheduled_time: '',
            estimated_duration_minutes: 60,
            priority: 'normal',
            notes: '',
        },
    });

    const handleFormSubmit = async (data: JobFormData) => {
        await onSubmit(data, dirtyFields);
    };

    const isEditing = !!initialData;

    return (
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="customer_id">Customer *</Label>
                <select
                    id="customer_id"
                    {...register('customer_id')}
                    className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500"
                >
                    <option value="">Select a customer</option>
                    {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                            {customer.name}
                        </option>
                    ))}
                </select>
                {errors.customer_id && (
                    <p className="text-red-400 text-sm">{errors.customer_id.message}</p>
                )}
            </div>

            <div className="space-y-2">
                <Label htmlFor="title">Job Title *</Label>
                <Input
                    id="title"
                    {...register('title')}
                    placeholder="e.g., Annual HVAC Maintenance"
                    className="bg-slate-800 border-slate-600"
                />
                {errors.title && (
                    <p className="text-red-400 text-sm">{errors.title.message}</p>
                )}
            </div>

            <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                    id="description"
                    {...register('description')}
                    placeholder="Details about the job..."
                    className="bg-slate-800 border-slate-600 min-h-[80px]"
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="scheduled_date">Date *</Label>
                    <Input
                        id="scheduled_date"
                        type="date"
                        {...register('scheduled_date')}
                        className="bg-slate-800 border-slate-600"
                    />
                    {errors.scheduled_date && (
                        <p className="text-red-400 text-sm">{errors.scheduled_date.message}</p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="scheduled_time">Time</Label>
                    <Input
                        id="scheduled_time"
                        type="time"
                        {...register('scheduled_time')}
                        className="bg-slate-800 border-slate-600"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <select
                        id="status"
                        {...register('status')}
                        className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg p-2.5"
                    >
                        <option value="scheduled">Scheduled</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <select
                        id="priority"
                        {...register('priority')}
                        className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg p-2.5"
                    >
                        <option value="low">Low</option>
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                    </select>
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="estimated_duration_minutes">Duration (minutes)</Label>
                <Input
                    id="estimated_duration_minutes"
                    type="number"
                    {...register('estimated_duration_minutes', { valueAsNumber: true })}
                    placeholder="60"
                    className="bg-slate-800 border-slate-600"
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                    id="notes"
                    {...register('notes')}
                    placeholder="Additional notes..."
                    className="bg-slate-800 border-slate-600"
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
                        isEditing ? 'Save Changes' : 'Create Job'
                    )}
                </Button>
            </div>
        </form>
    );
}
