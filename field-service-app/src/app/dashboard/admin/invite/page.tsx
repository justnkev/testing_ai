import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { InviteUserForm } from '@/components/auth/invite-user-form';
import { ROLES } from '@/constants/roles';
import { UserPlus } from 'lucide-react';

export const metadata = {
    title: 'Invite Team Member | Field Service Pro',
};

export default async function AdminInvitePage() {
    // Server-side auth check
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect('/login');

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (!profile || (profile.role !== ROLES.ADMIN && profile.role !== ROLES.MANAGER)) {
        redirect('/dashboard?error=access_denied');
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
            <Card className="w-full max-w-md bg-slate-800/50 border-slate-700 backdrop-blur-sm">
                <CardHeader className="text-center space-y-4">
                    <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                        <UserPlus className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <CardTitle className="text-2xl font-bold text-white">
                            Invite Team Member
                        </CardTitle>
                        <CardDescription className="text-slate-400">
                            Send an invitation to a new technician, manager, or admin.
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent>
                    <InviteUserForm />
                </CardContent>
            </Card>
        </div>
    );
}
