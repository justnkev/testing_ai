'use client';

export const dynamic = 'force-dynamic';


import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createJob } from '@/lib/actions/jobs';
import { getCustomers } from '@/lib/actions/customers';
import { jobSchema, type JobFormData } from '@/lib/validations/job';
import type { Customer } from '@/lib/validations/customer';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Plus } from 'lucide-react';
import Link from 'next/link';

export default function NewJobPage() {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
    const router = useRouter();

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<JobFormData>({
        resolver: zodResolver(jobSchema),
        defaultValues: {
            customer_id: '',
            title: '',
            description: '',
            status: 'scheduled',
            scheduled_date: new Date().toISOString().split('T')[0],
            scheduled_time: '',
            priority: 'normal',
            notes: '',
        },
    });

    useEffect(() => {
        async function loadCustomers() {
            const result = await getCustomers();
            if (result.success) {
                setCustomers(result.data);
            }
            setIsLoadingCustomers(false);
        }
        loadCustomers();
    }, []);

    const onSubmit = async (data: JobFormData) => {
        setIsSubmitting(true);

        // Retry logic for network issues
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            attempts++;

            try {
                const result = await createJob(data);

                if (result.success) {
                    toast.success('Job created successfully!');
                    router.push('/dashboard');
                    router.refresh();
                    return;
                } else {
                    if (attempts < maxAttempts) {
                        toast.loading('Retrying...', { id: 'retry-toast' });
                        await new Promise((r) => setTimeout(r, 1000));
                    } else {
                        toast.dismiss('retry-toast');
                        toast.error(result.error);
                    }
                }
            } catch {
                if (attempts < maxAttempts) {
                    toast.loading('Connection issue. Retrying...', { id: 'retry-toast' });
                    await new Promise((r) => setTimeout(r, 1000));
                } else {
                    toast.dismiss('retry-toast');
                    toast.error('Failed to create job. Please try again.');
                }
            }
        }

        setIsSubmitting(false);
    };

    return (
        <div className="p-4 md:p-8 max-w-2xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <Link href="/dashboard">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-slate-400 hover:text-white hover:bg-slate-700"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-white">New Job</h1>
                    <p className="text-slate-400 mt-1">Schedule a new service call</p>
                </div>
            </div>

            <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                    <CardTitle className="text-white">Job Details</CardTitle>
                </CardHeader>
                <CardContent>
                    {customers.length === 0 && !isLoadingCustomers && (
                        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
                            <p className="text-yellow-400 text-sm">
                                You need to add a customer before creating a job.
                            </p>
                            <Link href="/dashboard/customers">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="mt-2 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20"
                                >
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add Customer
                                </Button>
                            </Link>
                        </div>
                    )}

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        {/* Customer Selection */}
                        <div className="space-y-2">
                            <Label htmlFor="customer_id" className="text-slate-300">
                                Customer <span className="text-red-400">*</span>
                            </Label>
                            <select
                                id="customer_id"
                                {...register('customer_id')}
                                disabled={isLoadingCustomers}
                                className="w-full h-10 px-3 rounded-md bg-slate-700/50 border border-slate-600 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                            >
                                <option value="">Select a customer...</option>
                                {customers.map((customer) => (
                                    <option key={customer.id} value={customer.id}>
                                        {customer.name} - {customer.address}
                                    </option>
                                ))}
                            </select>
                            {errors.customer_id && (
                                <p className="text-sm text-red-400">{errors.customer_id.message}</p>
                            )}
                        </div>

                        {/* Job Title */}
                        <div className="space-y-2">
                            <Label htmlFor="title" className="text-slate-300">
                                Job Title <span className="text-red-400">*</span>
                            </Label>
                            <Input
                                id="title"
                                {...register('title')}
                                placeholder="e.g., HVAC Maintenance"
                                className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                            />
                            {errors.title && (
                                <p className="text-sm text-red-400">{errors.title.message}</p>
                            )}
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                            <Label htmlFor="description" className="text-slate-300">
                                Description
                            </Label>
                            <Input
                                id="description"
                                {...register('description')}
                                placeholder="Brief description of the work..."
                                className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                            />
                        </div>

                        {/* Date and Time */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="scheduled_date" className="text-slate-300">
                                    Date <span className="text-red-400">*</span>
                                </Label>
                                <Input
                                    id="scheduled_date"
                                    type="date"
                                    {...register('scheduled_date')}
                                    className="bg-slate-700/50 border-slate-600 text-white"
                                />
                                {errors.scheduled_date && (
                                    <p className="text-sm text-red-400">{errors.scheduled_date.message}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="scheduled_time" className="text-slate-300">
                                    Time
                                </Label>
                                <Input
                                    id="scheduled_time"
                                    type="time"
                                    {...register('scheduled_time')}
                                    className="bg-slate-700/50 border-slate-600 text-white"
                                />
                            </div>
                        </div>

                        {/* Priority and Status */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="priority" className="text-slate-300">
                                    Priority
                                </Label>
                                <select
                                    id="priority"
                                    {...register('priority')}
                                    className="w-full h-10 px-3 rounded-md bg-slate-700/50 border border-slate-600 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                >
                                    <option value="low">Low</option>
                                    <option value="normal">Normal</option>
                                    <option value="high">High</option>
                                    <option value="urgent">Urgent</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="status" className="text-slate-300">
                                    Status
                                </Label>
                                <select
                                    id="status"
                                    {...register('status')}
                                    className="w-full h-10 px-3 rounded-md bg-slate-700/50 border border-slate-600 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                >
                                    <option value="scheduled">Scheduled</option>
                                    <option value="in_progress">In Progress</option>
                                    <option value="completed">Completed</option>
                                    <option value="cancelled">Cancelled</option>
                                </select>
                            </div>
                        </div>

                        {/* Notes */}
                        <div className="space-y-2">
                            <Label htmlFor="notes" className="text-slate-300">
                                Notes
                            </Label>
                            <Input
                                id="notes"
                                {...register('notes')}
                                placeholder="Any additional notes..."
                                className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                            />
                        </div>

                        {/* Submit Button */}
                        <Button
                            type="submit"
                            disabled={isSubmitting || customers.length === 0}
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
                                    Create Job
                                </>
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
