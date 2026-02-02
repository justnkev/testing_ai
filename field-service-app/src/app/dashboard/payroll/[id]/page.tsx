import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function PayrollRunPage({ params }: PageProps) {
    const { id } = await params;
    const supabase = await createClient();

    const { data: run } = await supabase
        .from('payroll_runs')
        .select('*')
        .eq('id', id)
        .single();

    if (!run) notFound();

    // Fetch timesheets with user details
    const { data: timesheets } = await supabase
        .from('timesheets')
        .select(`
            *,
            user:profiles(display_name, email, stripe_connect_id)
        `)
        .eq('payroll_run_id', id);

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/dashboard/payroll">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Payroll Run Details</h1>
                    <p className="text-muted-foreground">
                        {format(new Date(run.period_start), 'MMM d')} - {format(new Date(run.period_end), 'MMM d, yyyy')}
                    </p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <Badge variant={run.status === 'paid' ? 'default' : 'secondary'}>
                        {run.status.toUpperCase()}
                    </Badge>
                    {run.status === 'pending' && (
                        <Button>Process Payroll</Button>
                    )}
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Total Payout</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${run.total_amount?.toFixed(2)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Technicians</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{timesheets?.length || 0}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold capitalize">{run.status}</div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Timesheets</CardTitle>
                    <CardDescription>Review hours and pay for each technician.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Technician</TableHead>
                                <TableHead>Regular Hrs</TableHead>
                                <TableHead>Overtime Hrs</TableHead>
                                <TableHead>Gross Pay</TableHead>
                                <TableHead>Stripe Status</TableHead>
                                <TableHead>Timesheet Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {timesheets?.map((ts: any) => (
                                <TableRow key={ts.id}>
                                    <TableCell>
                                        <div className="font-medium">{ts.user?.display_name || 'Unknown'}</div>
                                        <div className="text-xs text-muted-foreground">{ts.user?.email}</div>
                                    </TableCell>
                                    <TableCell>{ts.regular_hours}</TableCell>
                                    <TableCell>{ts.overtime_hours}</TableCell>
                                    <TableCell className="font-bold">${ts.gross_pay?.toFixed(2)}</TableCell>
                                    <TableCell>
                                        {ts.user?.stripe_connect_id ? (
                                            <Badge variant="outline" className="border-green-500 text-green-500">
                                                Connected
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="border-yellow-500 text-yellow-500">
                                                Not Linked
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={ts.status === 'approved' ? 'default' : 'secondary'}>
                                            {ts.status}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {timesheets?.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                                        No active technicians found for this period.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
