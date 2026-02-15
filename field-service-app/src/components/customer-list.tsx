'use client';

import { useState } from 'react';
import { Customer } from '@/lib/validations/customer';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Phone, Mail, Edit, Trash2 } from 'lucide-react';
import { CustomerEditSheet } from '@/components/customer-edit-sheet';
import { DeleteConfirmModal } from '@/components/delete-confirm-modal';
import { deleteCustomer } from '@/lib/actions/customers';
import { useTableManagement } from '@/hooks/use-table-management';
import { toast } from 'sonner';
import { GeneratePortalLinkButton } from '@/components/portal/GeneratePortalLinkButton';

interface CustomerListProps {
    initialCustomers: Customer[];
}

export function CustomerList({ initialCustomers }: CustomerListProps) {
    const [customers, setCustomers] = useState(initialCustomers);

    // Use the management hook
    const {
        selectedRecord: editItem,
        recordToDelete: deleteItem,
        setSelectedRecord,
        openDrawer: openEdit,
        closeDrawer: closeEdit,
        openDeleteModal: openDelete,
        closeDeleteModal: closeDelete,
    } = useTableManagement<Customer>();

    const handleEdit = (customer: Customer) => {
        setSelectedRecord(customer);
        openEdit();
    };

    const handleDelete = (customer: Customer) => {
        openDelete(customer);
    };

    const onDeleteConfirm = async () => {
        if (!deleteItem) return;

        // Optimistic update
        const previousCustomers = [...customers];
        setCustomers(customers.filter(c => c.id !== deleteItem.id));
        closeDelete();

        const result = await deleteCustomer(deleteItem.id);

        if (!result.success) {
            // Rollback
            setCustomers(previousCustomers);
            toast.error(result.error || 'Failed to delete customer');
        } else {
            toast.success('Customer deleted');
        }
    };

    const handleSuccess = () => {
        // In a real app with optimistic updates for edit, we might update state here.
        // For now, we rely on router.refresh() in the edit sheet or parent revalidation.
        // But since this is a client list initialized from server, we might need to refresh.
        // The server action revalidates path, so calling router.refresh() here is good.
        window.location.reload(); // Simple reload to get fresh data, or use router.refresh() if we had router instance
    };

    if (customers.length === 0) {
        return (
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-8 text-center">
                <div className="w-16 h-16 mx-auto bg-slate-700 rounded-full flex items-center justify-center mb-4">
                    <MapPin className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">No customers yet</h3>
                <p className="text-slate-400 mb-4">Add your first customer to get started.</p>
            </div>
        );
    }

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {customers.map((customer) => {
                    const fullAddress = [customer.address, customer.city, customer.state, customer.zip_code]
                        .filter(Boolean)
                        .join(', ');
                    const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;

                    return (
                        <Card key={customer.id} className="bg-slate-800 border-slate-700 group">
                            <CardContent className="p-4">
                                <div className="flex items-start justify-between mb-3">
                                    <h3 className="font-semibold text-white">{customer.name}</h3>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">
                                            Active
                                        </Badge>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-slate-400 hover:text-white"
                                                onClick={() => handleEdit(customer)}
                                            >
                                                <Edit className="h-3 w-3" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                                                onClick={() => handleDelete(customer)}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <a
                                        href={mapUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-start gap-2 text-sm text-slate-400 hover:text-blue-400 transition-colors"
                                    >
                                        <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                        <span className="line-clamp-2">{fullAddress}</span>
                                    </a>

                                    {customer.phone && (
                                        <a
                                            href={`tel:${customer.phone}`}
                                            className="flex items-center gap-2 text-sm text-slate-400 hover:text-blue-400 transition-colors"
                                        >
                                            <Phone className="w-4 h-4 flex-shrink-0" />
                                            <span>{customer.phone}</span>
                                        </a>
                                    )}

                                    {customer.email && (
                                        <a
                                            href={`mailto:${customer.email}`}
                                            className="flex items-center gap-2 text-sm text-slate-400 hover:text-blue-400 transition-colors"
                                        >
                                            <Mail className="w-4 h-4 flex-shrink-0" />
                                            <span className="truncate">{customer.email}</span>
                                        </a>
                                    )}
                                </div>

                                {customer.notes && (
                                    <p className="mt-3 text-sm text-slate-500 italic line-clamp-2">
                                        {customer.notes}
                                    </p>
                                )}

                                <div className="mt-4 pt-3 border-t border-slate-700">
                                    <GeneratePortalLinkButton
                                        customerId={customer.id}
                                        customerEmail={customer.email}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            <CustomerEditSheet
                customerId={editItem?.id || null}
                open={!!editItem}
                onOpenChange={(open) => !open && closeEdit()}
                onSuccess={handleSuccess}
            />

            <DeleteConfirmModal
                open={!!deleteItem}
                onOpenChange={(open) => !open && closeDelete()}
                onConfirm={onDeleteConfirm}
                itemName={deleteItem?.name}
            />
        </>
    );
}
