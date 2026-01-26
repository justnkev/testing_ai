'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';

const presets = [
    { label: '7 Days', days: 7 },
    { label: '30 Days', days: 30 },
    { label: '90 Days', days: 90 },
    { label: '6 Months', days: 180 },
    { label: '1 Year', days: 365 },
];

export function DateRangePicker() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const currentFrom = searchParams.get('from');
    const currentTo = searchParams.get('to');

    // Calculate which preset is active
    const getActiveDays = () => {
        if (!currentFrom || !currentTo) return 180; // default 6 months
        const from = new Date(currentFrom);
        const to = new Date(currentTo);
        const diffDays = Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays;
    };

    const activeDays = getActiveDays();

    const handlePresetClick = (days: number) => {
        const to = new Date();
        const from = new Date();
        from.setDate(from.getDate() - days);

        const params = new URLSearchParams();
        params.set('from', from.toISOString().split('T')[0]);
        params.set('to', to.toISOString().split('T')[0]);

        router.push(`/dashboard/analytics?${params.toString()}`);
    };

    return (
        <div className="flex items-center gap-2 flex-wrap">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-400 mr-2">Period:</span>
            {presets.map(preset => (
                <Button
                    key={preset.days}
                    variant={activeDays === preset.days ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handlePresetClick(preset.days)}
                    className={
                        activeDays === preset.days
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600 hover:text-white'
                    }
                >
                    {preset.label}
                </Button>
            ))}
        </div>
    );
}
