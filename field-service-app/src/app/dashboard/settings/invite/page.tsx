'use client';

export const dynamic = 'force-dynamic';


import { useActionState } from 'react';
import { inviteStaff } from '@/lib/actions/invite';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ROLES, ROLE_LABELS } from '@/constants/roles';
import { toast } from 'sonner';
import { useEffect } from 'react';

const initialState = {
    error: '',
    success: '',
};

export default function InviteStaffPage() {
    // Cast inviteStaff to any to bypass strict type check for now if types mismatch
    const [state, formAction, isPending] = useActionState(inviteStaff as any, initialState);

    useEffect(() => {
        if (state?.error) {
            toast.error(state.error);
        }
        if (state?.success) {
            toast.success(state.success);
        }
    }, [state]);

    return (
        <div className="max-w-2xl mx-auto py-8 px-4">
            <h1 className="text-2xl font-bold mb-6 text-white">Invite Staff</h1>
            <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
                <form action={formAction} className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="fullName" className="text-white">Full Name</Label>
                        <Input
                            id="fullName"
                            name="fullName"
                            placeholder="John Doe"
                            required
                            className="bg-slate-900 border-slate-700 text-white"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email" className="text-white">Email Address</Label>
                        <Input
                            id="email"
                            name="email"
                            type="email"
                            placeholder="john@example.com"
                            required
                            className="bg-slate-900 border-slate-700 text-white"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="role" className="text-white">Role</Label>
                        <Select name="role" required defaultValue={ROLES.TECHNICIAN}>
                            <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                                <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-700">
                                {Object.values(ROLES).map((role) => (
                                    <SelectItem key={role} value={role} className="text-white focus:bg-slate-700 focus:text-white">
                                        {ROLE_LABELS[role]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-sm text-slate-400">
                            Technicians have access to assigned jobs only.<br />
                            Managers have full access except billing.<br />
                            Admins have full system access.
                        </p>
                    </div>

                    <Button type="submit" className="w-full" disabled={isPending}>
                        {isPending ? 'Sending Invitation...' : 'Send Invitation'}
                    </Button>
                </form>
            </div>
        </div>
    );
}
