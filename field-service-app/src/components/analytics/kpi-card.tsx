import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KPICardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    trend?: {
        value: number;
        isPositive: boolean;
    };
    format?: 'currency' | 'percentage' | 'number';
    colorClass?: string;
}

export function KPICard({
    title,
    value,
    icon: Icon,
    trend,
    format = 'number',
    colorClass = 'text-blue-400'
}: KPICardProps) {
    const formatValue = (val: string | number) => {
        if (typeof val === 'string') return val;

        switch (format) {
            case 'currency':
                return new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                }).format(val);
            case 'percentage':
                return `${val}%`;
            default:
                return new Intl.NumberFormat('en-US').format(val);
        }
    };

    return (
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 hover:border-slate-600 transition-colors">
            <div className="flex items-center justify-between">
                <div className={cn('flex items-center gap-2', colorClass)}>
                    <Icon className="w-5 h-5" />
                    <span className="text-sm font-medium text-slate-400">{title}</span>
                </div>
                {trend && (
                    <div className={cn(
                        'text-xs font-medium px-2 py-1 rounded-full',
                        trend.isPositive
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                    )}>
                        {trend.isPositive ? '+' : ''}{trend.value}%
                    </div>
                )}
            </div>
            <p className="text-3xl font-bold text-white mt-3">
                {formatValue(value)}
            </p>
        </div>
    );
}
