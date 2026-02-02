import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Calendar, DollarSign, ChevronRight, Calculator } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { createPayrollRun } from '@/lib/actions/payroll';

function getStatusColor(status: string) {
    switch (status) {
        case 'paid':
            return 'bg-green-500/20 text-green-400 border-green-500/30';
        case 'pending':
            return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
        case 'draft':
            return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
        default:
            return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
}

export default async function PayrollPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    // Admin check
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profile?.role !== 'admin') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4">
                <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
                <p className="text-muted-foreground">You do not have permission to view this page.</p>
            </div>
        );
    }

    const { data: runs } = await supabase
        .from('payroll_runs')
        .select('*')
        .order('created_at', { ascending: false });

    return (
        <div className="p-4 md:p-8 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-white">Payroll</h1>
                    <p className="text-slate-400 mt-1">Manage technician pay and process payouts</p>
                </div>

                {/* Simple form for now to trigger new run for 'Last Week' */}
                <form action={async () => {
                    'use server';
                    const end = new Date();
                    const start = new Date();
                    start.setDate(end.getDate() - 7);

                    const formData = new FormData();
                    formData.set('period_start', start.toISOString());
                    formData.set('period_end', end.toISOString());
                    await createPayrollRun(formData);
                }}>
                    <Button type="submit" className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white shadow-lg shadow-blue-500/20">
                        <Plus className="mr-2 h-4 w-4" />
                        Run Payroll (Last 7 Days)
                    </Button>
                </form>
            </div>

            {/* Stats Card */}
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 inline-block">
                <p className="text-sm text-slate-400">Total Runs</p>
                <p className="text-2xl font-bold text-white">{runs?.length || 0}</p>
            </div>

            {/* Main Content */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <div className="p-4 border-b border-slate-700">
                    <h2 className="text-lg font-semibold text-white">Payroll History</h2>
                </div>

                {runs?.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                        <div className="w-16 h-16 mx-auto bg-slate-700 rounded-full flex items-center justify-center mb-4">
                            <Calculator className="w-8 h-8 text-slate-400" />
                        </div>
                        <p>No payroll runs found. Start a new one above.</p>
                    </div>
                ) : (
                    <>
                        {/* Desktop View */}
                        <div className="hidden md:block overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-slate-700 hover:bg-transparent">
                                        <TableHead className="text-slate-400">Period</TableHead>
                                        <TableHead className="text-slate-400">Status</TableHead>
                                        <TableHead className="text-slate-400">Total Amount</TableHead>
                                        <TableHead className="text-slate-400">Created At</TableHead>
                                        <TableHead className="text-right text-slate-400">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {runs?.map((run) => (
                                        <TableRow key={run.id} className="border-slate-700 hover:bg-slate-700/30">
                                            <TableCell className="font-medium text-white">
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="w-4 h-4 text-slate-400" />
                                                    {format(new Date(run.period_start), 'MMM d')} - {format(new Date(run.period_end), 'MMM d, yyyy')}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={getStatusColor(run.status)}>
                                                    {run.status.toUpperCase()}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-slate-300 font-mono">
                                                ${run.total_amount?.toFixed(2)}
                                            </TableCell>
                                            <TableCell className="text-slate-400">
                                                {format(new Date(run.created_at), 'MMM d, h:mm a')}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button asChild variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/20">
                                                    <Link href={`/dashboard/payroll/${run.id}`}>
                                                        View Details
                                                    </Link>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Mobile View */}
                        <div className="md:hidden bg-slate-900/50 p-4 space-y-4">
                            {runs?.map((run) => (
                                <Link key={run.id} href={`/dashboard/payroll/${run.id}`} className="block">
                                    <Card className="bg-slate-800 border-slate-700 hover:border-slate-600 transition-colors">
                                        <CardContent className="p-4">
                                            <div className="flex items-start justify-between mb-3">
                                                <div>
                                                    <div className="flex items-center gap-2 text-white font-medium mb-1">
                                                        <Calendar className="w-4 h-4 text-slate-400" />
                                                        {format(new Date(run.period_start), 'MMM d')} - {format(new Date(run.period_end), 'MMM d')}
                                                    </div>
                                                    <p className="text-xs text-slate-400">
                                                        Created: {format(new Date(run.created_at), 'MMM d')}
                                                    </p>
                                                </div>
                                                <ChevronRight className="w-5 h-5 text-slate-500" />
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <Badge variant="outline" className={getStatusColor(run.status)}>
                                                    {run.status.toUpperCase()}
                                                </Badge>
                                                <div className="flex items-center text-white font-mono font-bold">
                                                    <DollarSign className="w-4 h-4 text-slate-400 mr-1" />
                                                    {run.total_amount?.toFixed(2)}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </Link>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
