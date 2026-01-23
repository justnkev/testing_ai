export const dynamic = 'force-dynamic';

import { getTeamMembers } from '@/lib/actions/team';
import { InviteMemberModal } from '@/components/team/InviteMemberModal';
import { RolePermissionsTable } from '@/components/team/RolePermissionsTable';
import { MemberList } from '@/components/team/MemberList'; // We'll create this client component for actions
import { UserRole } from '@/constants/roles';

export default async function TeamSettingsPage() {
    const { data: members, error } = await getTeamMembers();

    if (error) {
        return <div className="p-8 text-red-400">Error loading team members: {error}</div>;
    }

    return (
        <div className="max-w-6xl mx-auto py-8 px-4 space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Team Management</h1>
                    <p className="text-slate-400 mt-1">Manage your staff, roles, and permissions.</p>
                </div>
                <InviteMemberModal />
            </div>

            {/* Team List */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-700">
                    <h3 className="font-semibold text-white">Staff Members</h3>
                </div>
                <MemberList members={members || []} />
            </div>

            {/* Permissions Reference */}
            <div>
                <h3 className="text-lg font-semibold text-white mb-4">Role Permissions Reference</h3>
                <RolePermissionsTable />
            </div>
        </div>
    );
}
