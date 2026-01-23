'use client';

import { useState } from 'react';
import type {
    MonthlyRevenue,
    ServiceTypeRevenue,
    LeadSource,
    TechnicianPerformance
} from '@/lib/validations/analytics';
import { RevenueAreaChart } from '@/components/analytics/revenue-area-chart';
import { ServiceTypeBarChart } from '@/components/analytics/service-type-bar-chart';
import { LeadSourceDonutChart } from '@/components/analytics/lead-source-donut-chart';
import { TechnicianLeaderboard } from '@/components/analytics/technician-leaderboard';
import { EmptyState, DEMO_DATA } from '@/components/analytics/empty-state';

interface AnalyticsChartsProps {
    hasData: boolean;
    monthlyRevenue: MonthlyRevenue[];
    serviceTypeRevenue: ServiceTypeRevenue[];
    leadSources: LeadSource[];
    technicianLeaderboard: TechnicianPerformance[];
}

export function AnalyticsCharts({
    hasData,
    monthlyRevenue,
    serviceTypeRevenue,
    leadSources,
    technicianLeaderboard,
}: AnalyticsChartsProps) {
    const [showDemo, setShowDemo] = useState(false);

    // Use demo data if enabled and there's no real data
    const displayMonthly = showDemo && !hasData ? DEMO_DATA.monthlyRevenue : monthlyRevenue;
    const displayService = showDemo && !hasData ? DEMO_DATA.serviceTypeRevenue : serviceTypeRevenue;
    const displayLeads = showDemo && !hasData ? DEMO_DATA.leadSources : leadSources;
    const displayTech = showDemo && !hasData ? DEMO_DATA.technicianLeaderboard : technicianLeaderboard;

    // Show empty state only when there's no data and demo is off
    if (!hasData && !showDemo) {
        return <EmptyState onToggleDemo={setShowDemo} />;
    }

    return (
        <div className="space-y-6">
            {/* Demo mode indicator */}
            {showDemo && !hasData && (
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg px-4 py-3 flex items-center justify-between">
                    <p className="text-purple-300 text-sm">
                        📊 Showing demo data for preview purposes
                    </p>
                    <button
                        onClick={() => setShowDemo(false)}
                        className="text-purple-400 hover:text-purple-300 text-sm underline"
                    >
                        Hide demo
                    </button>
                </div>
            )}

            {/* Main Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <RevenueAreaChart data={displayMonthly} />
                <ServiceTypeBarChart data={displayService} />
            </div>

            {/* Secondary Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <LeadSourceDonutChart data={displayLeads} />
                <div className="lg:col-span-2">
                    <TechnicianLeaderboard data={displayTech} />
                </div>
            </div>
        </div>
    );
}
