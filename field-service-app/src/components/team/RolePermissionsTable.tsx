'use client';

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Check, X } from 'lucide-react';

const PERMISSIONS = [
    { feature: 'View Dashboard', admin: true, manager: true, tech: true },
    { feature: 'View Assigned Jobs', admin: true, manager: true, tech: true },
    { feature: 'View All Jobs', admin: true, manager: true, tech: true }, // Actually Tech might be restricted, but for now assuming pool view
    { feature: 'Edit Jobs', admin: true, manager: true, tech: 'Assigned Only' },
    { feature: 'View Customers', admin: true, manager: true, tech: true },
    { feature: 'View Invoices', admin: true, manager: true, tech: false },
    { feature: 'Create/Edit Invoices', admin: true, manager: true, tech: false },
    { feature: 'View Analytics', admin: true, manager: true, tech: false },
    { feature: 'Manage Team', admin: true, manager: false, tech: false },
    { feature: 'Org Settings', admin: true, manager: false, tech: false },
];

export function RolePermissionsTable() {
    return (
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow className="border-slate-700 hover:bg-transparent">
                        <TableHead className="text-slate-300">Feature</TableHead>
                        <TableHead className="text-center text-slate-300">Admin</TableHead>
                        <TableHead className="text-center text-slate-300">Manager</TableHead>
                        <TableHead className="text-center text-slate-300">Technician</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {PERMISSIONS.map((perm) => (
                        <TableRow key={perm.feature} className="border-slate-700 hover:bg-slate-700/50">
                            <TableCell className="font-medium text-slate-200">{perm.feature}</TableCell>
                            <TableCell className="text-center text-slate-400">
                                <PermissionIcon value={perm.admin} />
                            </TableCell>
                            <TableCell className="text-center text-slate-400">
                                <PermissionIcon value={perm.manager} />
                            </TableCell>
                            <TableCell className="text-center text-slate-400">
                                <PermissionIcon value={perm.tech} />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

function PermissionIcon({ value }: { value: boolean | string }) {
    if (value === true) return <Check className="w-5 h-5 text-green-400 mx-auto" />;
    if (value === false) return <X className="w-5 h-5 text-red-400 mx-auto" />;
    return <span className="text-xs font-medium text-slate-300">{value}</span>;
}
