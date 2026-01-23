'use client';

import { useState } from 'react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, Trash2, ArchiveIcon } from 'lucide-react';

interface DeleteConfirmModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => Promise<void>;
    title?: string;
    description?: string;
    itemName?: string;
    isPermanent?: boolean;
}

export function DeleteConfirmModal({
    open,
    onOpenChange,
    onConfirm,
    title,
    description,
    itemName,
    isPermanent = false,
}: DeleteConfirmModalProps) {
    const [isLoading, setIsLoading] = useState(false);

    const handleConfirm = async () => {
        setIsLoading(true);
        try {
            await onConfirm();
        } finally {
            setIsLoading(false);
        }
    };

    const defaultTitle = isPermanent ? 'Permanently Delete' : 'Archive Item';
    const defaultDescription = isPermanent
        ? `This will permanently delete "${itemName || 'this item'}" and all associated data. This action cannot be undone.`
        : `This will archive "${itemName || 'this item'}". Archived items can be restored from Settings > Archived Items.`;

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                        {isPermanent ? (
                            <Trash2 className="h-5 w-5 text-red-500" />
                        ) : (
                            <ArchiveIcon className="h-5 w-5 text-amber-500" />
                        )}
                        {title || defaultTitle}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        {description || defaultDescription}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleConfirm}
                        disabled={isLoading}
                        className={isPermanent ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {isPermanent ? 'Deleting...' : 'Archiving...'}
                            </>
                        ) : (
                            <>
                                {isPermanent ? (
                                    <Trash2 className="mr-2 h-4 w-4" />
                                ) : (
                                    <ArchiveIcon className="mr-2 h-4 w-4" />
                                )}
                                {isPermanent ? 'Delete Forever' : 'Archive'}
                            </>
                        )}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
