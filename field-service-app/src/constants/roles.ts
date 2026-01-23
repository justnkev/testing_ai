export const ROLES = {
    ADMIN: 'admin',
    MANAGER: 'manager',
    TECHNICIAN: 'technician',
} as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<UserRole, string> = {
    [ROLES.ADMIN]: 'Administrator',
    [ROLES.MANAGER]: 'Manager',
    [ROLES.TECHNICIAN]: 'Technician',
};
