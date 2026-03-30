'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BadgeDollarSign, Clock, Receipt } from 'lucide-react';

interface BillingKPIProps {
    totalReceivables: number;
    averageDSO: number;
    totalUnbilled: number;
    isLoading?: boolean;
}

export function BillingAnalyticsCards({
    totalReceivables,
    averageDSO,
    totalUnbilled,
    isLoading = false,
}: BillingKPIProps) {
    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(val);
    };

    return (
        <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-slate-800 border-slate-700 shadow-xl shadow-slate-900/20">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-slate-400">Total Receivables</CardTitle>
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                        <BadgeDollarSign className="w-4 h-4 text-blue-400" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-white">
                        {isLoading ? (
                            <div className="h-8 w-1/2 bg-slate-700 animate-pulse rounded"></div>
                        ) : (
                            formatCurrency(totalReceivables)
                        )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">Outstanding unpaid/partial invoices</p>
                </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700 shadow-xl shadow-slate-900/20">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-slate-400">Average DSO</CardTitle>
                    <div className="p-2 bg-emerald-500/10 rounded-lg">
                        <Clock className="w-4 h-4 text-emerald-400" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-white">
                        {isLoading ? (
                            <div className="h-8 w-1/2 bg-slate-700 animate-pulse rounded"></div>
                        ) : (
                            `${averageDSO.toFixed(1)} Days`
                        )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">Average Days Sales Outstanding</p>
                </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700 shadow-xl shadow-slate-900/20">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-slate-400">Total Unbilled</CardTitle>
                    <div className="p-2 bg-amber-500/10 rounded-lg">
                        <Receipt className="w-4 h-4 text-amber-400" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-white">
                        {isLoading ? (
                            <div className="h-8 w-1/2 bg-slate-700 animate-pulse rounded"></div>
                        ) : (
                            formatCurrency(totalUnbilled)
                        )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">Estimated revenue from unbilled jobs</p>
                </CardContent>
            </Card>
        </div>
    );
}
