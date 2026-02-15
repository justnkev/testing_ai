'use client';

import { useState, useEffect } from 'react';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { JobForm } from '@/components/job-form';
import { updateJob, getJobById } from '@/lib/actions/jobs';
import { getCustomers } from '@/lib/actions/customers';
import { toast } from 'sonner';
import type { JobWithCustomer, JobFormData } from '@/lib/validations/job';
import type { Customer } from '@/lib/validations/customer';
import { Loader2 } from 'lucide-react';

interface JobEditSheetProps {
    jobId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

export function JobEditSheet({
    jobId,
    open,
    onOpenChange,
    onSuccess,
}: JobEditSheetProps) {
    const [job, setJob] = useState<JobWithCustomer | null>(null);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (open && jobId) {
            loadData();
        } else if (!open) {
            setJob(null);
        }
    }, [open, jobId]);

    const loadData = async () => {
        if (!jobId) return;

        setIsLoading(true);

        // Load job and customers in parallel
        // Load job and customers in parallel
        const [jobResult, customersResult] = await Promise.all([
            getJobById(jobId),
            getCustomers(),
        ]);

        if (jobResult.success) {
            if (jobResult.data) {
                setJob(jobResult.data.job);
            }
        } else {
            console.error('Failed to load job:', jobResult.error);
            toast.error(jobResult.error || 'Failed to load job details');
            onOpenChange(false);
        }

        if (customersResult.success) {
            setCustomers(customersResult.data as Customer[]);
        }

        setIsLoading(false);
    };

    const handleSubmit = async (
        data: JobFormData,
        dirtyFields?: Partial<Record<keyof JobFormData, boolean>>
    ) => {
        if (!jobId || !job) return;

        setIsSaving(true);

        // Only send fields that actually changed
        const updates: Partial<JobFormData> = {};
        if (dirtyFields) {
            Object.keys(dirtyFields).forEach((key) => {
                const field = key as keyof JobFormData;
                if (dirtyFields[field]) {
                    updates[field] = data[field] as any;
                }
            });
        } else {
            Object.assign(updates, data);
        }

        if (Object.keys(updates).length === 0) {
            toast.info('No changes to save');
            setIsSaving(false);
            return;
        }

        const result = await updateJob(jobId, updates, job.updated_at);

        if (result.success) {
            toast.success('Job updated successfully');
            onOpenChange(false);
            onSuccess?.();
        } else {
            toast.error(result.error || 'Failed to update job');
        }

        setIsSaving(false);
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="bg-slate-900 border-slate-700 w-full sm:max-w-lg overflow-y-auto">
                <SheetHeader>
                    <SheetTitle className="text-white">Edit Job</SheetTitle>
                    <SheetDescription className="text-slate-400">
                        Make changes to the job details. Click save when done.
                    </SheetDescription>
                </SheetHeader>

                <div className="mt-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                        </div>
                    ) : job ? (
                        <JobForm
                            initialData={job}
                            customers={customers}
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
