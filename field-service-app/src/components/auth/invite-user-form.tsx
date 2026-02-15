'use client';

import { useActionState } from 'react';
import { inviteUser, type InviteState } from '@/lib/actions/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ROLES, ROLE_LABELS, type UserRole } from '@/constants/roles';
import { toast } from 'sonner';
import { Loader2, UserPlus, CheckCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const initialState: InviteState = {};

export function InviteUserForm() {
    const [state, formAction, isPending] = useActionState(inviteUser, initialState);
    const [role, setRole] = useState<UserRole>(ROLES.TECHNICIAN);
    const formRef = useRef<HTMLFormElement>(null);

    useEffect(() => {
        if (state.success) {
            toast.success(state.success);
            formRef.current?.reset();
            setRole(ROLES.TECHNICIAN);
        }
        if (state.error) {
            toast.error(state.error);
        }
    }, [state]);

    return (
        <form ref={formRef} action={formAction} className="space-y-5">
            <div className="space-y-2">
                <Label htmlFor="fullName" className="text-slate-300">
                    Full Name
                </Label>
                <Input
                    id="fullName"
                    name="fullName"
                    placeholder="Jane Smith"
                    required
                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500"
                />
                {state.fieldErrors?.fullName && (
                    <p className="text-sm text-red-400">{state.fieldErrors.fullName[0]}</p>
                )}
            </div>

            <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">
                    Email Address
                </Label>
                <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="jane@company.com"
                    required
                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500"
                />
                {state.fieldErrors?.email && (
                    <p className="text-sm text-red-400">{state.fieldErrors.email[0]}</p>
                )}
            </div>

            <div className="space-y-2">
                <Label htmlFor="role" className="text-slate-300">
                    Role
                </Label>
                <input type="hidden" name="role" value={role} />
                <Select
                    value={role}
                    onValueChange={(val) => setRole(val as UserRole)}
                >
                    <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
                        <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                        {Object.entries(ROLE_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                                {label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {state.fieldErrors?.role && (
                    <p className="text-sm text-red-400">{state.fieldErrors.role[0]}</p>
                )}
            </div>

            <Button
                type="submit"
                disabled={isPending}
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-medium"
            >
                {isPending ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending Invitation…
                    </>
                ) : (
                    <>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Send Invitation
                    </>
                )}
            </Button>
        </form>
    );
}
