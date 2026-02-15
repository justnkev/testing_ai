'use client';

import { usePermission } from '@/hooks/usePermission';
import { UserRole } from '@/constants/roles';

interface RoleGateProps {
    children: React.ReactNode;
    allowedRoles: UserRole[];
    fallback?: React.ReactNode;
}

export function RoleGate({ children, allowedRoles, fallback = null }: RoleGateProps) {
    const { role, isLoading } = usePermission();

    if (isLoading) {
        // Option: return null or a skeleton. returning null avoids flash of protected content
        return null;
    }

    if (role && allowedRoles.includes(role)) {
        return <>{children}</>;
    }

    return <>{fallback}</>;
}
