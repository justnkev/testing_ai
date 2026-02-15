'use client';

export const dynamic = 'force-dynamic';


import { useEffect, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DeleteConfirmModal } from '@/components/delete-confirm-modal';
import { getArchivedItems, toggleArchiveStatus, permanentlyDelete } from '@/lib/actions/archive';
import { toast } from 'sonner';
import { RotateCcw, Trash2, Users, Briefcase, Loader2, Archive } from 'lucide-react';
import type { Customer } from '@/lib/validations/customer';
import type { JobWithCustomer } from '@/lib/validations/job';

export default function ArchivedItemsPage() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [jobs, setJobs] = useState<JobWithCustomer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPending, startTransition] = useTransition();

    // Delete modal state
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<{ type: 'customer' | 'job'; id: string; name: string } | null>(null);

    const loadArchivedItems = async () => {
        setIsLoading(true);
        const result = await getArchivedItems();
        if (result.success) {
            setCustomers(result.data.customers);
            setJobs(result.data.jobs);
        } else {
            toast.error(result.error || 'Failed to load archived items');
        }
        setIsLoading(false);
    };

    useEffect(() => {
        loadArchivedItems();
    }, []);

    const handleRestore = async (type: 'customer' | 'job', id: string, name: string) => {
        startTransition(async () => {
            const table = type === 'customer' ? 'fs_customers' : 'fs_jobs';
            const result = await toggleArchiveStatus(table, id, true);

            if (result.success) {
                toast.success(`${name} has been restored`, {
                    action: {
                        label: 'Undo',
                        onClick: async () => {
                            await toggleArchiveStatus(table, id, false);
                            loadArchivedItems();
                        }
                    }
                });
                loadArchivedItems();
            } else {
                toast.error(result.error || 'Failed to restore item');
            }
        });
    };

    const handlePermanentDelete = async () => {
        if (!itemToDelete) return;

        const table = itemToDelete.type === 'customer' ? 'fs_customers' : 'fs_jobs';
        const result = await permanentlyDelete(table, itemToDelete.id);

        if (result.success) {
            toast.success(`${itemToDelete.name} has been permanently deleted`);
            setDeleteModalOpen(false);
            setItemToDelete(null);
            loadArchivedItems();
        } else {
            toast.error(result.error || 'Failed to delete item');
        }
    };

    const openDeleteModal = (type: 'customer' | 'job', id: string, name: string) => {
        setItemToDelete({ type, id, name });
        setDeleteModalOpen(true);
    };

    const getDaysArchived = (deletedAt: string) => {
        const deleted = new Date(deletedAt);
        const now = new Date();
        return Math.floor((now.getTime() - deleted.getTime()) / (1000 * 60 * 60 * 24));
    };

    const canPermanentlyDelete = (deletedAt: string) => {
        return getDaysArchived(deletedAt) >= 30;
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const totalArchived = customers.length + jobs.length;

    return (
        <div className="container max-w-4xl py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight">Archived Items</h1>
                <p className="text-muted-foreground mt-2">
                    View and manage archived customers and jobs. Items can be restored or permanently deleted after 30 days.
                </p>
            </div>

            {totalArchived === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Archive className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold">No Archived Items</h3>
                        <p className="text-muted-foreground text-center mt-2">
                            When you archive customers or jobs, they will appear here.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <Tabs defaultValue="all" className="space-y-4">
                    <TabsList>
                        <TabsTrigger value="all">All ({totalArchived})</TabsTrigger>
                        <TabsTrigger value="customers">
                            <Users className="h-4 w-4 mr-2" />
                            Customers ({customers.length})
                        </TabsTrigger>
                        <TabsTrigger value="jobs">
                            <Briefcase className="h-4 w-4 mr-2" />
                            Jobs ({jobs.length})
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="all" className="space-y-4">
                        {customers.map((customer) => (
                            <ArchivedItemCard
                                key={`customer-${customer.id}`}
                                type="customer"
                                name={customer.name}
                                subtitle={customer.email || customer.phone || 'No contact info'}
                                deletedAt={customer.deleted_at!}
                                onRestore={() => handleRestore('customer', customer.id, customer.name)}
                                onDelete={() => openDeleteModal('customer', customer.id, customer.name)}
                                canDelete={canPermanentlyDelete(customer.deleted_at!)}
                                daysArchived={getDaysArchived(customer.deleted_at!)}
                                isPending={isPending}
                            />
                        ))}
                        {jobs.map((job) => (
                            <ArchivedItemCard
                                key={`job-${job.id}`}
                                type="job"
                                name={job.title}
                                subtitle={job.customer?.name || 'Unknown customer'}
                                deletedAt={job.deleted_at!}
                                onRestore={() => handleRestore('job', job.id, job.title)}
                                onDelete={() => openDeleteModal('job', job.id, job.title)}
                                canDelete={canPermanentlyDelete(job.deleted_at!)}
                                daysArchived={getDaysArchived(job.deleted_at!)}
                                isPending={isPending}
                            />
                        ))}
                    </TabsContent>

                    <TabsContent value="customers" className="space-y-4">
                        {customers.length === 0 ? (
                            <p className="text-muted-foreground text-center py-8">No archived customers</p>
                        ) : (
                            customers.map((customer) => (
                                <ArchivedItemCard
                                    key={customer.id}
                                    type="customer"
                                    name={customer.name}
                                    subtitle={customer.email || customer.phone || 'No contact info'}
                                    deletedAt={customer.deleted_at!}
                                    onRestore={() => handleRestore('customer', customer.id, customer.name)}
                                    onDelete={() => openDeleteModal('customer', customer.id, customer.name)}
                                    canDelete={canPermanentlyDelete(customer.deleted_at!)}
                                    daysArchived={getDaysArchived(customer.deleted_at!)}
                                    isPending={isPending}
                                />
                            ))
                        )}
                    </TabsContent>

                    <TabsContent value="jobs" className="space-y-4">
                        {jobs.length === 0 ? (
                            <p className="text-muted-foreground text-center py-8">No archived jobs</p>
                        ) : (
                            jobs.map((job) => (
                                <ArchivedItemCard
                                    key={job.id}
                                    type="job"
                                    name={job.title}
                                    subtitle={job.customer?.name || 'Unknown customer'}
                                    deletedAt={job.deleted_at!}
                                    onRestore={() => handleRestore('job', job.id, job.title)}
                                    onDelete={() => openDeleteModal('job', job.id, job.title)}
                                    canDelete={canPermanentlyDelete(job.deleted_at!)}
                                    daysArchived={getDaysArchived(job.deleted_at!)}
                                    isPending={isPending}
                                />
                            ))
                        )}
                    </TabsContent>
                </Tabs>
            )}

            <DeleteConfirmModal
                open={deleteModalOpen}
                onOpenChange={setDeleteModalOpen}
                onConfirm={handlePermanentDelete}
                itemName={itemToDelete?.name}
                isPermanent={true}
            />
        </div>
    );
}

interface ArchivedItemCardProps {
    type: 'customer' | 'job';
    name: string;
    subtitle: string;
    deletedAt: string;
    onRestore: () => void;
    onDelete: () => void;
    canDelete: boolean;
    daysArchived: number;
    isPending: boolean;
}

function ArchivedItemCard({
    type,
    name,
    subtitle,
    deletedAt,
    onRestore,
    onDelete,
    canDelete,
    daysArchived,
    isPending,
}: ArchivedItemCardProps) {
    const Icon = type === 'customer' ? Users : Briefcase;

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-muted">
                            <Icon className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                            <CardTitle className="text-base">{name}</CardTitle>
                            <CardDescription>{subtitle}</CardDescription>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onRestore}
                            disabled={isPending}
                        >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Restore
                        </Button>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={onDelete}
                            disabled={!canDelete || isPending}
                            title={canDelete ? 'Permanently delete' : `Can delete in ${30 - daysArchived} days`}
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground">
                    Archived {daysArchived} day{daysArchived !== 1 ? 's' : ''} ago •{' '}
                    {canDelete ? (
                        <span className="text-red-500">Can be permanently deleted</span>
                    ) : (
                        <span>Permanent deletion available in {30 - daysArchived} days</span>
                    )}
                </p>
            </CardContent>
        </Card>
    );
}
