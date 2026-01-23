'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ROLES, ROLE_LABELS } from '@/constants/roles';
import { inviteStaff } from '@/lib/actions/invite';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';

export function InviteMemberModal() {
    const [open, setOpen] = useState(false);
    const [isPending, setIsPending] = useState(false);

    async function handleSubmit(formData: FormData) {
        setIsPending(true);
        const result = await inviteStaff(null, formData);
        setIsPending(false);

        if (result.error) {
            toast.error(result.error);
        } else if (result.success) {
            toast.success(result.success);
            setOpen(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                    <Plus className="w-4 h-4 mr-2" />
                    Invite Member
                </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-800 border-slate-700 text-white sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Invite Team Member</DialogTitle>
                    <DialogDescription className="text-slate-400">
                        Send an email invitation to a new staff member.
                    </DialogDescription>
                </DialogHeader>
                <form action={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="fullName">Full Name</Label>
                        <Input id="fullName" name="fullName" required className="bg-slate-900 border-slate-700" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email">Email Address</Label>
                        <Input id="email" name="email" type="email" required className="bg-slate-900 border-slate-700" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="role">Role</Label>
                        <Select name="role" defaultValue={ROLES.TECHNICIAN} required>
                            <SelectTrigger className="bg-slate-900 border-slate-700">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-700">
                                {Object.values(ROLES).map((role) => (
                                    <SelectItem key={role} value={role} className="text-white focus:bg-slate-700">
                                        {ROLE_LABELS[role]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="pt-4 flex justify-end gap-2">
                        <Button variant="ghost" type="button" onClick={() => setOpen(false)} className="text-slate-300">
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isPending}>
                            {isPending ? 'Sending...' : 'Send Invitation'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
