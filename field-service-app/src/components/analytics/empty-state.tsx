'use client';

import { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
    onToggleDemo: (enabled: boolean) => void;
}

export function EmptyState({ onToggleDemo }: EmptyStateProps) {
    const [demoEnabled, setDemoEnabled] = useState(false);

    const handleToggle = () => {
        const newState = !demoEnabled;
        setDemoEnabled(newState);
        onToggleDemo(newState);
    };

    return (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-8 text-center">
            <div className="w-16 h-16 mx-auto bg-slate-700 rounded-full flex items-center justify-center mb-4">
                <BarChart3 className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
                Not enough data to generate trends
            </h3>
            <p className="text-slate-400 mb-6 max-w-md mx-auto">
                Analytics require at least one completed job or paid invoice. As your business grows,
                you&apos;ll see valuable insights about revenue, performance, and growth here.
            </p>
            <Button
                onClick={handleToggle}
                variant={demoEnabled ? 'default' : 'outline'}
                className={
                    demoEnabled
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600 hover:text-white'
                }
            >
                {demoEnabled ? 'Hide Demo Data' : 'Show Demo Data'}
            </Button>
        </div>
    );
}

// Demo data for testing/preview
export const DEMO_DATA = {
    kpiMetrics: {
        totalRevenue: 47580,
        pendingRevenue: 12350,
        jobSuccessRate: 94,
        newLeadsThisMonth: 23,
    },
    monthlyRevenue: [
        { month: '2025-08', monthLabel: 'Aug 2025', totalRevenue: 6200, invoiceCount: 12 },
        { month: '2025-09', monthLabel: 'Sep 2025', totalRevenue: 7800, invoiceCount: 15 },
        { month: '2025-10', monthLabel: 'Oct 2025', totalRevenue: 9100, invoiceCount: 18 },
        { month: '2025-11', monthLabel: 'Nov 2025', totalRevenue: 8500, invoiceCount: 16 },
        { month: '2025-12', monthLabel: 'Dec 2025', totalRevenue: 7200, invoiceCount: 14 },
        { month: '2026-01', monthLabel: 'Jan 2026', totalRevenue: 8780, invoiceCount: 17 },
    ],
    serviceTypeRevenue: [
        { serviceType: 'hvac', serviceTypeLabel: 'HVAC', totalRevenue: 18500, jobCount: 24 },
        { serviceType: 'plumbing', serviceTypeLabel: 'Plumbing', totalRevenue: 14200, jobCount: 31 },
        { serviceType: 'electrical', serviceTypeLabel: 'Electrical', totalRevenue: 9880, jobCount: 19 },
        { serviceType: 'general', serviceTypeLabel: 'General', totalRevenue: 5000, jobCount: 18 },
    ],
    leadSources: [
        { leadSource: 'google', leadSourceLabel: 'Google', customerCount: 45 },
        { leadSource: 'referral', leadSourceLabel: 'Referral', customerCount: 32 },
        { leadSource: 'facebook', leadSourceLabel: 'Facebook', customerCount: 18 },
        { leadSource: 'website', leadSourceLabel: 'Website', customerCount: 12 },
        { leadSource: 'other', leadSourceLabel: 'Other', customerCount: 8 },
    ],
    technicianLeaderboard: [
        { technicianId: '1', technicianName: 'Alex Martinez', jobsCompleted: 42, jobsCancelled: 2, totalRevenue: 18500 },
        { technicianId: '2', technicianName: 'Jordan Lee', jobsCompleted: 38, jobsCancelled: 1, totalRevenue: 15200 },
        { technicianId: '3', technicianName: 'Sam Wilson', jobsCompleted: 31, jobsCancelled: 3, totalRevenue: 13880 },
    ],
};
