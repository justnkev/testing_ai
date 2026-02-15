'use client';

import { useState } from 'react';
import { JobWithCustomer } from '@/lib/validations/job';
import { JobCardList } from '@/components/job-card-list';
import { JobTable } from '@/components/job-table';
import { JobEditSheet } from '@/components/job-edit-sheet';
import { DeleteConfirmModal } from '@/components/delete-confirm-modal';
import { deleteJob } from '@/lib/actions/jobs';
import { useTableManagement } from '@/hooks/use-table-management';
import { toast } from 'sonner';

interface JobListProps {
    initialJobs: JobWithCustomer[];
}

export function JobList({ initialJobs }: JobListProps) {
    const [jobs, setJobs] = useState(initialJobs);

    const {
        selectedRecord: editItem,
        recordToDelete: deleteItem,
        setSelectedRecord,
        openDrawer: openEdit,
        closeDrawer: closeEdit,
        openDeleteModal: openDelete,
        closeDeleteModal: closeDelete,
    } = useTableManagement<JobWithCustomer>();

    const handleEdit = (job: JobWithCustomer) => {
        setSelectedRecord(job);
        openEdit();
    };

    const handleDelete = (job: JobWithCustomer) => {
        openDelete(job);
    };

    const onDeleteConfirm = async () => {
        if (!deleteItem) return;

        // Optimistic update
        const previousJobs = [...jobs];
        setJobs(jobs.filter(j => j.id !== deleteItem.id));
        closeDelete();

        const result = await deleteJob(deleteItem.id);

        if (!result.success) {
            // Rollback
            setJobs(previousJobs);
            toast.error(result.error || 'Failed to delete job');
        } else {
            toast.success('Job deleted', {
                description: 'Job and related items have been archived.'
            });
        }
    };

    const handleSuccess = () => {
        window.location.reload();
    };

    return (
        <>
            {/* Mobile: Card List */}
            <div className="block md:hidden">
                <JobCardList
                    jobs={jobs}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                />
            </div>

            {/* Desktop: Data Table */}
            <div className="hidden md:block">
                <JobTable
                    jobs={jobs}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                />
            </div>

            <JobEditSheet
                jobId={editItem?.id || null}
                open={!!editItem}
                onOpenChange={(open) => !open && closeEdit()}
                onSuccess={handleSuccess}
            />

            <DeleteConfirmModal
                open={!!deleteItem}
                onOpenChange={(open) => !open && closeDelete()}
                onConfirm={onDeleteConfirm}
                itemName={deleteItem?.title}
            />
        </>
    );
}
