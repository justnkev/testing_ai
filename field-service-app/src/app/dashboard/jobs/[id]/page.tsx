'use client';

export const dynamic = 'force-dynamic';


import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    ArrowLeft,
    MapPin,
    Phone,
    Calendar,
    Clock,
    User,
    Navigation,
    Play,
    CheckCircle,
    Smartphone
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

interface JobDetail {
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    scheduled_date: string;
    scheduled_time: string | null;
    estimated_duration_minutes: number | null;
    check_in_at: string | null;
    completed_at: string | null;
    customer: {
        id: string;
        name: string;
        email: string | null;
        phone: string | null;
        address: string;
        city: string | null;
        state: string | null;
        zip_code: string | null;
    };
    technician: {
        id: string;
        display_name: string | null;
    } | null;
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

export default function JobDetailPage() {
    const router = useRouter();
    const params = useParams();
    const jobId = params.id as string;

    const [job, setJob] = useState<JobDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchJob() {
            try {
                const response = await fetch(`/api/jobs/${jobId}`);
                if (!response.ok) {
                    throw new Error('Job not found');
                }
                const data = await response.json();
                setJob(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load job');
            } finally {
                setLoading(false);
            }
        }

        if (jobId) {
            fetchJob();
        }
    }, [jobId]);

    if (loading) {
        return (
            <div className="p-4 md:p-8 space-y-6">
                <Skeleton className="h-10 w-64 bg-slate-700" />
                <Skeleton className="h-64 w-full bg-slate-700" />
                <Skeleton className="h-48 w-full bg-slate-700" />
            </div>
        );
    }

    if (error || !job) {
        return (
            <div className="p-4 md:p-8">
                <Card className="bg-slate-800 border-slate-700">
                    <CardContent className="p-8 text-center">
                        <p className="text-red-400 mb-4">{error || 'Job not found'}</p>
                        <Button onClick={() => router.push('/dashboard/jobs')}>
                            Back to Jobs
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        [job.customer.address, job.customer.city, job.customer.state, job.customer.zip_code]
            .filter(Boolean)
            .join(', ')
    )}`;

    return (
        <div className="p-4 md:p-8 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/jobs">
                        <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-slate-700">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-white">{job.title}</h1>
                        <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className={getStatusColor(job.status)}>
                                {job.status.replace('_', ' ')}
                            </Badge>
                            <Badge variant="outline" className={getPriorityColor(job.priority)}>
                                {job.priority}
                            </Badge>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                    <Link href={`/dashboard/jobs/${jobId}/mobile`}>
                        <Button className="bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600">
                            <Smartphone className="w-4 h-4 mr-2" />
                            Start Job Execution
                        </Button>
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Job Details Card */}
                <Card className="bg-slate-800 border-slate-700">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 text-blue-400" />
                            Job Details
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {job.description && (
                            <div>
                                <p className="text-sm text-slate-400 mb-1">Description</p>
                                <p className="text-white">{job.description}</p>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-slate-400 mb-1 flex items-center gap-1">
                                    <Calendar className="w-4 h-4" /> Date
                                </p>
                                <p className="text-white">
                                    {format(new Date(job.scheduled_date), 'EEEE, MMMM d, yyyy')}
                                </p>
                            </div>
                            {job.scheduled_time && (
                                <div>
                                    <p className="text-sm text-slate-400 mb-1 flex items-center gap-1">
                                        <Clock className="w-4 h-4" /> Time
                                    </p>
                                    <p className="text-white">{job.scheduled_time.slice(0, 5)}</p>
                                </div>
                            )}
                        </div>

                        {job.estimated_duration_minutes && (
                            <div>
                                <p className="text-sm text-slate-400 mb-1">Estimated Duration</p>
                                <p className="text-white">{job.estimated_duration_minutes} minutes</p>
                            </div>
                        )}

                        {job.technician && (
                            <div>
                                <p className="text-sm text-slate-400 mb-1 flex items-center gap-1">
                                    <User className="w-4 h-4" /> Assigned Technician
                                </p>
                                <p className="text-white">
                                    {job.technician.display_name || 'Unknown'}
                                </p>
                            </div>
                        )}

                        {job.check_in_at && (
                            <div>
                                <p className="text-sm text-slate-400 mb-1">Checked In</p>
                                <p className="text-green-400">
                                    {format(new Date(job.check_in_at), 'MMM d, yyyy h:mm a')}
                                </p>
                            </div>
                        )}

                        {job.completed_at && (
                            <div>
                                <p className="text-sm text-slate-400 mb-1">Completed</p>
                                <p className="text-green-400">
                                    {format(new Date(job.completed_at), 'MMM d, yyyy h:mm a')}
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Customer Card */}
                <Card className="bg-slate-800 border-slate-700">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                            <User className="w-5 h-5 text-cyan-400" />
                            Customer Information
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <p className="text-sm text-slate-400 mb-1">Name</p>
                            <p className="text-white text-lg font-medium">{job.customer.name}</p>
                        </div>

                        <div>
                            <p className="text-sm text-slate-400 mb-1 flex items-center gap-1">
                                <MapPin className="w-4 h-4" /> Address
                            </p>
                            <p className="text-white">
                                {job.customer.address}
                                {job.customer.city && `, ${job.customer.city}`}
                                {job.customer.state && `, ${job.customer.state}`}
                                {job.customer.zip_code && ` ${job.customer.zip_code}`}
                            </p>
                        </div>

                        {job.customer.phone && (
                            <div>
                                <p className="text-sm text-slate-400 mb-1 flex items-center gap-1">
                                    <Phone className="w-4 h-4" /> Phone
                                </p>
                                <a
                                    href={`tel:${job.customer.phone}`}
                                    className="text-blue-400 hover:text-blue-300 transition-colors"
                                >
                                    {job.customer.phone}
                                </a>
                            </div>
                        )}

                        {job.customer.email && (
                            <div>
                                <p className="text-sm text-slate-400 mb-1">Email</p>
                                <a
                                    href={`mailto:${job.customer.email}`}
                                    className="text-blue-400 hover:text-blue-300 transition-colors"
                                >
                                    {job.customer.email}
                                </a>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="pt-4 flex flex-col sm:flex-row gap-2">
                            {job.customer.phone && (
                                <a href={`tel:${job.customer.phone}`} className="flex-1">
                                    <Button variant="outline" className="w-full border-slate-600 text-slate-300 hover:bg-slate-700">
                                        <Phone className="w-4 h-4 mr-2" />
                                        Call Customer
                                    </Button>
                                </a>
                            )}
                            <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
                                <Button className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600">
                                    <Navigation className="w-4 h-4 mr-2" />
                                    Navigate
                                </Button>
                            </a>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
