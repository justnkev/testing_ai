'use client';

import { useState, useCallback } from 'react';

interface UseTableManagementOptions<T> {
    onDelete?: (item: T) => Promise<void>;
    onRestore?: (item: T) => Promise<void>;
}

interface TableManagementState<T> {
    // Drawer state
    isDrawerOpen: boolean;
    openDrawer: () => void;
    closeDrawer: () => void;

    // Selected record for editing
    selectedRecord: T | null;
    setSelectedRecord: (record: T | null) => void;

    // Delete modal state
    isDeleteModalOpen: boolean;
    recordToDelete: T | null;
    openDeleteModal: (record: T) => void;
    closeDeleteModal: () => void;
    confirmDelete: () => Promise<void>;

    // Loading states
    isDeleting: boolean;
}

export function useTableManagement<T extends { id: string }>(
    options: UseTableManagementOptions<T> = {}
): TableManagementState<T> {
    const { onDelete, onRestore } = options;

    // Drawer state
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<T | null>(null);

    // Delete modal state
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [recordToDelete, setRecordToDelete] = useState<T | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const openDrawer = useCallback(() => {
        setIsDrawerOpen(true);
    }, []);

    const closeDrawer = useCallback(() => {
        setIsDrawerOpen(false);
        setSelectedRecord(null);
    }, []);

    const openDeleteModal = useCallback((record: T) => {
        setRecordToDelete(record);
        setIsDeleteModalOpen(true);
    }, []);

    const closeDeleteModal = useCallback(() => {
        setIsDeleteModalOpen(false);
        setRecordToDelete(null);
    }, []);

    const confirmDelete = useCallback(async () => {
        if (!recordToDelete || !onDelete) return;

        setIsDeleting(true);
        try {
            await onDelete(recordToDelete);
            closeDeleteModal();
        } finally {
            setIsDeleting(false);
        }
    }, [recordToDelete, onDelete, closeDeleteModal]);

    return {
        isDrawerOpen,
        openDrawer,
        closeDrawer,
        selectedRecord,
        setSelectedRecord,
        isDeleteModalOpen,
        recordToDelete,
        openDeleteModal,
        closeDeleteModal,
        confirmDelete,
        isDeleting,
    };
}
