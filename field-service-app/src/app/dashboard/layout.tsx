'use client';

import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import {
    LayoutDashboard,
    Users,
    ClipboardList,
    Calendar,
    LogOut,
    Menu,
    X,
    BarChart3,
    Settings,
    Map,
    Box
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { usePermission } from '@/hooks/usePermission';
import { Suspense } from 'react';
import { DashboardAuthCheck } from '@/components/dashboard/auth-check';

const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/dashboard/map', label: 'Map View', icon: Map },
    { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
    { href: '/dashboard/calendar', label: 'Schedule', icon: Calendar },
    { href: '/dashboard/customers', label: 'Customers', icon: Users },
    { href: '/dashboard/jobs', label: 'Jobs', icon: ClipboardList },
    { href: '/dashboard/inventory', label: 'Inventory', icon: Box },
    { href: '/dashboard/settings/organization', label: 'Settings', icon: Settings },
];

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const router = useRouter();
    const pathname = usePathname();
    // Removed useSearchParams from here
    const supabase = createClient();
    const { isTechnician } = usePermission();

    // Was useEffect for search params - Moved to DashboardAuthCheck

    // Filter nav items based on role

    // Filter nav items based on role
    const filteredNavItems = navItems.filter(item => {
        if (isTechnician) {
            if (item.href === '/dashboard/analytics') return false;
            if (item.href.startsWith('/dashboard/settings')) return false;
        }
        return true;
    });

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        toast.success('Signed out successfully');
        router.push('/login');
        router.refresh();
    };

    return (
        <div className="min-h-screen bg-slate-900">
            <Suspense fallback={null}>
                <DashboardAuthCheck />
            </Suspense>
            {/* Mobile Header */}
            <header className="md:hidden fixed top-0 left-0 right-0 z-50 bg-slate-800/95 backdrop-blur-sm border-b border-slate-700">
                <div className="flex items-center justify-between px-4 py-3">
                    <Link href="/dashboard" className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-lg flex items-center justify-center">
                            <ClipboardList className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-semibold text-white">FSM</span>
                    </Link>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        className="text-slate-300 hover:text-white hover:bg-slate-700"
                    >
                        {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </Button>
                </div>

                {/* Mobile Navigation */}
                {isMobileMenuOpen && (
                    <nav className="px-4 pb-4 space-y-1">
                        {filteredNavItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${pathname === item.href
                                    ? 'bg-blue-600/20 text-blue-400'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                                    }`}
                            >
                                <item.icon className="w-5 h-5" />
                                {item.label}
                            </Link>
                        ))}
                        <button
                            onClick={handleSignOut}
                            className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors w-full text-slate-400 hover:text-red-400 hover:bg-slate-700/50"
                        >
                            <LogOut className="w-5 h-5" />
                            Sign Out
                        </button>
                    </nav>
                )}
            </header>

            {/* Desktop Sidebar */}
            <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:w-64 bg-slate-800 border-r border-slate-700">
                <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-700">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                        <ClipboardList className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="font-bold text-white">Field Service</h1>
                        <p className="text-xs text-slate-400">Management</p>
                    </div>
                </div>

                <nav className="flex-1 px-4 py-6 space-y-1">
                    {filteredNavItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${pathname === item.href
                                ? 'bg-blue-600/20 text-blue-400 font-medium'
                                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                                }`}
                        >
                            <item.icon className="w-5 h-5" />
                            {item.label}
                        </Link>
                    ))}
                </nav>

                <div className="p-4 border-t border-slate-700">
                    <Button
                        variant="ghost"
                        onClick={handleSignOut}
                        className="w-full justify-start text-slate-400 hover:text-red-400 hover:bg-slate-700/50"
                    >
                        <LogOut className="w-5 h-5 mr-3" />
                        Sign Out
                    </Button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="md:ml-64 pt-16 md:pt-0 min-h-screen">
                {children}
            </main>
        </div>
    );
}
