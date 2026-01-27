'use client';

import { JobWithCustomer } from '@/lib/validations/job';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Navigation, Phone, Eye, Edit, Trash2 } from 'lucide-react';
import { format, isToday, isTomorrow } from 'date-fns';
import Link from 'next/link';

interface JobTableProps {
    jobs: JobWithCustomer[];
    onEdit?: (job: JobWithCustomer) => void;
    onDelete?: (job: JobWithCustomer) => void;
}

function getMapUrl(address: string, city?: string | null, state?: string | null, zipCode?: string | null): string {
    const fullAddress = [address, city, state, zipCode].filter(Boolean).join(', ');
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
}

function getStatusColor(status: string): string {
    switch (status) {
        case 'scheduled':
            return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
        case 'in_progress':
            return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
        case 'completed':
            return 'bg-green-500/20 text-green-400 border-green-500/30';
        case 'cancelled':
            return 'bg-red-500/20 text-red-400 border-red-500/30';
        default:
            return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
}

function getPriorityColor(priority: string): string {
    switch (priority) {
        case 'urgent':
            return 'bg-red-500/20 text-red-400 border-red-500/30';
        case 'high':
            return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
        case 'normal':
            return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
        case 'low':
            return 'bg-slate-600/20 text-slate-500 border-slate-600/30';
        default:
            return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
}

function formatScheduledDate(dateStr: string): string {
    const date = new Date(dateStr);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'EEE, MMM d');
}

export function JobTable({ jobs, onEdit, onDelete }: JobTableProps) {
    return (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-700">
                <h2 className="text-lg font-semibold text-white">Upcoming Jobs</h2>
            </div>
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow className="border-slate-700 hover:bg-transparent">
                            <TableHead className="text-slate-400">Job</TableHead>
                            <TableHead className="text-slate-400">Customer</TableHead>
                            <TableHead className="text-slate-400">Technician</TableHead>
                            <TableHead className="text-slate-400">Date/Time</TableHead>
                            <TableHead className="text-slate-400">Status</TableHead>
                            <TableHead className="text-slate-400">Priority</TableHead>
                            <TableHead className="text-slate-400 text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {jobs.map((job) => {
                            const customer = job.customer || { name: 'Unknown Customer', address: '', city: '', state: '', zip_code: '', phone: '' };
                            const mapUrl = getMapUrl(
                                customer.address || '',
                                customer.city,
                                customer.state,
                                customer.zip_code
                            );

                            return (
                                <TableRow key={job.id} className="border-slate-700 hover:bg-slate-700/30">
                                    <TableCell>
                                        <div>
                                            <p className="font-medium text-white">{job.title}</p>
                                            {job.description && (
                                                <p className="text-sm text-slate-400 truncate max-w-xs">
                                                    {job.description}
                                                </p>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div>
                                            <p className="text-white">{customer.name}</p>
                                            <a
                                                href={mapUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-sm text-slate-400 hover:text-blue-400 transition-colors"
                                            >
                                                {customer.address || 'No address provided'}
                                            </a>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-white">
                                            {job.technician?.display_name || <span className="text-slate-500 italic">Unassigned</span>}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-white">
                                            {formatScheduledDate(job.scheduled_date)}
                                            {job.scheduled_time && (
                                                <span className="text-slate-400 ml-2">
                                                    {job.scheduled_time.slice(0, 5)}
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={getStatusColor(job.status)}>
                                            {job.status.replace('_', ' ')}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={getPriorityColor(job.priority)}>
                                            {job.priority}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {onEdit && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-slate-400 hover:text-white hover:bg-slate-700"
                                                    onClick={() => onEdit(job)}
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                            )}
                                            {onDelete && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                                                    onClick={() => onDelete(job)}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            )}
                                            <Link href={`/dashboard/jobs/${job.id}`}>
                                                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-slate-700">
                                                    <Eye className="w-4 h-4" />
                                                </Button>
                                            </Link>
                                            {customer.phone && (
                                                <a href={`tel:${customer.phone}`}>
                                                    <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-slate-700">
                                                        <Phone className="w-4 h-4" />
                                                    </Button>
                                                </a>
                                            )}
                                            <a href={mapUrl} target="_blank" rel="noopener noreferrer">
                                                <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                                                    <Navigation className="w-4 h-4 mr-1" />
                                                    Navigate
                                                </Button>
                                            </a>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
