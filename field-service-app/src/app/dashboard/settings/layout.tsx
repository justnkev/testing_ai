'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const settingsTabs = [
    { name: 'Organization', href: '/dashboard/settings/organization' },
    { name: 'Team Management', href: '/dashboard/settings/team' },
    { name: 'Invite Staff', href: '/dashboard/settings/invite' },
];

export default function SettingsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();

    return (
        <div className="p-4 md:p-8 max-w-6xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
                <p className="text-slate-400">Manage your organization preferences and team access.</p>
            </div>

            {/* Navigation Tabs */}
            <div className="mb-8 border-b border-slate-700">
                <div className="flex gap-4">
                    {settingsTabs.map((tab) => {
                        const isActive = pathname === tab.href;
                        return (
                            <Link
                                key={tab.href}
                                href={tab.href}
                                className={`
                                    px-4 py-2 text-sm font-medium border-b-2 transition-colors
                                    ${isActive
                                        ? 'border-blue-500 text-blue-400'
                                        : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'}
                                `}
                            >
                                {tab.name}
                            </Link>
                        );
                    })}
                </div>
            </div>

            {children}
        </div>
    );
}
