export const dynamic = 'force-dynamic';

import { getOrganization } from '@/lib/actions/organization';
import { OrganizationSettingsForm } from '@/components/organization/OrganizationSettingsForm';

export default async function OrganizationSettingsPage() {
    const { data: org, error } = await getOrganization();

    if (error) {
        return (
            <div className="p-8 text-red-400">
                Error loading organization settings: {error}
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-white">Organization Settings</h1>
                <p className="text-slate-400 mt-1">Manage your company profile and preferences.</p>
            </div>

            <OrganizationSettingsForm initialData={org || { name: '' }} />
        </div>
    );
}
