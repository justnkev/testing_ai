'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Wrench, Package, AlertTriangle, Loader2 } from 'lucide-react';
import { getJobProfitability } from '@/lib/actions/profitability';
import type { JobProfitability } from '@/lib/validations/profitability';
import { createClient } from '@/lib/supabase/client';

interface JobProfitabilityCardProps {
    jobId: string;
}

export function JobProfitabilityCard({ jobId }: JobProfitabilityCardProps) {
    const [data, setData] = useState<JobProfitability | null>(null);
    const [loading, setLoading] = useState(true);
    const [isAllowed, setIsAllowed] = useState(false);

    useEffect(() => {
        // Check role + fetch profitability in parallel
        const supabase = createClient();
        Promise.all([
            supabase.auth.getUser().then(async ({ data: { user } }) => {
                if (!user) return false;
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', user.id)
                    .single();
                return profile?.role === 'admin' || profile?.role === 'manager';
            }),
            getJobProfitability(jobId),
        ]).then(([allowed, result]) => {
            setIsAllowed(allowed);
            if (result.success && result.data) {
                setData(result.data);
            }
            setLoading(false);
        });
    }, [jobId]);

    // Don't render for technicians
    if (!loading && !isAllowed) return null;

    if (loading) {
        return (
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 flex items-center justify-center h-20">
                <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
            </div>
        );
    }

    if (!data) return null;

    const isOverBudget = data.is_over_budget;
    const hasRevenue = data.total_revenue > 0;

    return (
        <div className={`rounded-xl border p-4 space-y-3 ${
            isOverBudget
                ? 'bg-red-500/10 border-red-500/30'
                : 'bg-slate-800 border-slate-700'
        }`}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <TrendingUp className={`w-5 h-5 ${isOverBudget ? 'text-red-400' : 'text-cyan-400'}`} />
                    <h3 className="text-white font-medium">Job Profitability</h3>
                </div>
                {isOverBudget && (
                    <div className="flex items-center gap-1 text-red-400 text-xs font-medium">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Over Budget
                    </div>
                )}
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-900/50 rounded-lg p-2.5">
                    <div className="flex items-center gap-1.5 mb-1">
                        <DollarSign className="w-3.5 h-3.5 text-cyan-400" />
                        <span className="text-[11px] text-slate-400">Revenue</span>
                    </div>
                    <p className="text-white font-semibold text-sm">
                        ${data.total_revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                </div>

                <div className="bg-slate-900/50 rounded-lg p-2.5">
                    <div className="flex items-center gap-1.5 mb-1">
                        <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                        <span className="text-[11px] text-slate-400">Margin</span>
                    </div>
                    <p className={`font-semibold text-sm ${
                        isOverBudget ? 'text-red-400' :
                        data.gross_margin_pct > 30 ? 'text-green-400' : 'text-yellow-400'
                    }`}>
                        {hasRevenue ? `${data.gross_margin_pct.toFixed(1)}%` : 'N/A'}
                    </p>
                </div>

                <div className="bg-slate-900/50 rounded-lg p-2.5">
                    <div className="flex items-center gap-1.5 mb-1">
                        <Wrench className="w-3.5 h-3.5 text-orange-400" />
                        <span className="text-[11px] text-slate-400">Labor</span>
                    </div>
                    <p className="text-orange-400 font-semibold text-sm">
                        ${data.total_labor_cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                </div>

                <div className="bg-slate-900/50 rounded-lg p-2.5">
                    <div className="flex items-center gap-1.5 mb-1">
                        <Package className="w-3.5 h-3.5 text-purple-400" />
                        <span className="text-[11px] text-slate-400">Materials</span>
                    </div>
                    <p className="text-purple-400 font-semibold text-sm">
                        ${data.total_material_cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                </div>
            </div>
        </div>
    );
}
