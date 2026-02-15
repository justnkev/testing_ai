'use client';

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Shield, ShieldAlert, ShieldCheck } from 'lucide-react';
import { UserRole, ROLE_LABELS, ROLES } from '@/constants/roles';
import { updateMemberRole, toggleMemberStatus } from '@/lib/actions/team';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { usePermission } from '@/hooks/usePermission';

interface Member {
    id: string;
    display_name: string | null;
    email?: string;
    // display_name is the column name in profiles table
    // Profiles table often doesn't have email in Supabase examples unless synced.
    // Let's assume for now we only display Name and Role, or we added email to profile in a previous step?
    // I didn't add email to profiles in migration.
    // This is a common gap.
    // Strategy: We can't easily get emails of other users from Client without an Edge Function or secure View.
    // For this MVP, we will just show Name.
    role: UserRole;
    is_active: boolean;
}

interface MemberListProps {
    members: Member[];
}

export function MemberList({ members }: MemberListProps) {
    const { role: currentUserRole } = usePermission();
    const isAdmin = currentUserRole === ROLES.ADMIN;

    async function handleRoleChange(userId: string, newRole: UserRole) {
        const result = await updateMemberRole(userId, newRole);
        if (result.error) toast.error(result.error);
        else toast.success(result.success);
    }

    async function handleStatusToggle(userId: string, currentStatus: boolean) {
        const result = await toggleMemberStatus(userId, !currentStatus);
        if (result.error) toast.error(result.error);
        else toast.success(result.success);
    }

    return (
        <Table>
            <TableHeader>
                <TableRow className="border-slate-700 hover:bg-transparent">
                    <TableHead className="text-slate-300">Name</TableHead>
                    <TableHead className="text-slate-300">Role</TableHead>
                    <TableHead className="text-slate-300">Status</TableHead>
                    <TableHead className="text-right text-slate-300">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {members.map((member) => (
                    <TableRow key={member.id} className="border-slate-700 hover:bg-slate-700/50">
                        <TableCell className="font-medium text-slate-200">
                            {member.display_name || member.email || 'N/A'}
                        </TableCell>
                        <TableCell>
                            <Badge
                                variant="outline"
                                className={`
                                    ${member.role === 'admin' ? 'border-purple-500 text-purple-400' :
                                        member.role === 'manager' ? 'border-blue-500 text-blue-400' :
                                            'border-slate-500 text-slate-400'}
                                `}
                            >
                                {ROLE_LABELS[member.role]}
                            </Badge>
                        </TableCell>
                        <TableCell>
                            <Badge variant={member.is_active ? 'default' : 'destructive'}>
                                {member.is_active ? 'Active' : 'Deactivated'}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                            {isAdmin && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                            <span className="sr-only">Open menu</span>
                                            <MoreHorizontal className="h-4 w-4 text-slate-400" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700 text-white">
                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                        <DropdownMenuItem onClick={() => handleRoleChange(member.id, ROLES.ADMIN)}>
                                            <ShieldCheck className="mr-2 h-4 w-4" /> Make Admin
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleRoleChange(member.id, ROLES.MANAGER)}>
                                            <Shield className="mr-2 h-4 w-4" /> Make Manager
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleRoleChange(member.id, ROLES.TECHNICIAN)}>
                                            <Shield className="mr-2 h-4 w-4" /> Make Technician
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator className="bg-slate-700" />
                                        <DropdownMenuItem
                                            onClick={() => handleStatusToggle(member.id, member.is_active)}
                                            className={member.is_active ? 'text-red-400 focus:text-red-400' : 'text-green-400 focus:text-green-400'}
                                        >
                                            <ShieldAlert className="mr-2 h-4 w-4" />
                                            {member.is_active ? 'Deactivate User' : 'Activate User'}
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
