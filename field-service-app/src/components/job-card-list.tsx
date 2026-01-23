'use client';

import { JobWithCustomer } from '@/lib/validations/job';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    MapPin,
    Clock,
    Phone,
    Calendar,
    Navigation,
    ChevronRight,
    Edit,
    Trash2
} from 'lucide-react';
import { format, isToday, isTomorrow } from 'date-fns';
import Link from 'next/link';

interface JobCardProps {
    job: JobWithCustomer;
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

export function JobCard({ job, onEdit, onDelete }: JobCardProps) {
    const mapUrl = getMapUrl(
        job.customer.address,
        job.customer.city,
        job.customer.state,
        job.customer.zip_code
    );

    return (
        <Link href={`/dashboard/jobs/${job.id}`} className="block">
            <Card className="bg-slate-800 border-slate-700 overflow-hidden hover:border-slate-600 transition-colors cursor-pointer">
                <CardContent className="p-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-white truncate">{job.title}</h3>
                            <p className="text-sm text-slate-400 truncate">{job.customer.name}</p>
                        </div>
                        <div className="flex items-center gap-1">
                            {onEdit && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-slate-400 hover:text-white"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        onEdit(job);
                                    }}
                                >
                                    <Edit className="w-4 h-4" />
                                </Button>
                            )}
                            {onDelete && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        onDelete(job);
                                    }}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            )}
                            <ChevronRight className="w-5 h-5 text-slate-500 flex-shrink-0" />
                        </div>
                    </div>

                    {/* Badges */}
                    <div className="flex flex-wrap gap-2 mb-3">
                        <Badge variant="outline" className={getStatusColor(job.status)}>
                            {job.status.replace('_', ' ')}
                        </Badge>
                        {job.priority !== 'normal' && (
                            <Badge variant="outline" className={getPriorityColor(job.priority)}>
                                {job.priority}
                            </Badge>
                        )}
                    </div>

                    {/* Details */}
                    <div className="space-y-2 mb-4">
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                            <Calendar className="w-4 h-4 flex-shrink-0" />
                            <span>{formatScheduledDate(job.scheduled_date)}</span>
                            {job.scheduled_time && (
                                <>
                                    <Clock className="w-4 h-4 ml-2 flex-shrink-0" />
                                    <span>{job.scheduled_time.slice(0, 5)}</span>
                                </>
                            )}
                        </div>
                        <div
                            onClick={(e) => { e.preventDefault(); window.open(mapUrl, '_blank'); }}
                            className="flex items-start gap-2 text-sm text-slate-400 hover:text-blue-400 transition-colors"
                        >
                            <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <span className="line-clamp-2">
                                {[job.customer.address, job.customer.city, job.customer.state]
                                    .filter(Boolean)
                                    .join(', ')}
                            </span>
                        </div>
                        {job.customer.phone && (
                            <div
                                onClick={(e) => { e.preventDefault(); window.location.href = `tel:${job.customer.phone}`; }}
                                className="flex items-center gap-2 text-sm text-slate-400 hover:text-blue-400 transition-colors"
                            >
                                <Phone className="w-4 h-4 flex-shrink-0" />
                                <span>{job.customer.phone}</span>
                            </div>
                        )}
                    </div>

                    {/* Navigate Button */}
                    <div
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(mapUrl, '_blank'); }}
                    >
                        <Button className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600">
                            <Navigation className="w-4 h-4 mr-2" />
                            Click to Navigate
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </Link>
    );
}

interface JobCardListProps {
    jobs: JobWithCustomer[];
    onEdit?: (job: JobWithCustomer) => void;
    onDelete?: (job: JobWithCustomer) => void;
}

export function JobCardList({ jobs, onEdit, onDelete }: JobCardListProps) {
    return (
        <div className="space-y-4">
            {jobs.map((job) => (
                <JobCard
                    key={job.id}
                    job={job}
                    onEdit={onEdit}
                    onDelete={onDelete}
                />
            ))}
        </div>
    );
}
