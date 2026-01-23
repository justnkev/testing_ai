'use client';

import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';
import { ROLES, UserRole } from '@/constants/roles';

type PermissionState = {
    role: UserRole | null;
    isLoading: boolean;
    isAdmin: boolean;
    isManager: boolean;
    isTechnician: boolean;
    canDeleteProfiles: boolean;
    canEditInvoices: boolean;
};

export function usePermission() {
    const [state, setState] = useState<PermissionState>({
        role: null,
        isLoading: true,
        isAdmin: false,
        isManager: false,
        isTechnician: false,
        canDeleteProfiles: false,
        canEditInvoices: false,
    });

    useEffect(() => {
        const supabase = createClient();

        async function fetchRole() {
            try {
                const { data: { user } } = await supabase.auth.getUser();

                if (!user) {
                    setState(prev => ({ ...prev, isLoading: false }));
                    return;
                }

                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', user.id)
                    .single();

                const role = (profile?.role as UserRole) || ROLES.MANAGER; // Default to manager if undefined, or handle null

                setState({
                    role,
                    isLoading: false,
                    isAdmin: role === ROLES.ADMIN,
                    isManager: role === ROLES.MANAGER,
                    isTechnician: role === ROLES.TECHNICIAN,
                    canDeleteProfiles: role === ROLES.ADMIN,
                    canEditInvoices: role === ROLES.ADMIN || role === ROLES.MANAGER,
                });
            } catch (error) {
                console.error('Error fetching role:', error);
                setState(prev => ({ ...prev, isLoading: false }));
            }
        }

        fetchRole();
    }, []);

    return state;
}
