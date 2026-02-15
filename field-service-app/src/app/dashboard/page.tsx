export const dynamic = 'force-dynamic';

import { getUpcomingJobs } from '@/lib/actions/jobs';
import { getCustomers } from '@/lib/actions/customers';
import { JobCardList } from '@/components/job-card-list';
import { JobTable } from '@/components/job-table';
import { Button } from '@/components/ui/button';
import { Plus, Calendar, Users, ClipboardList, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default async function DashboardPage() {
    const [jobsResult, customersResult] = await Promise.all([
        getUpcomingJobs(),
        getCustomers(),
    ]);

    const jobs = jobsResult.data;
    const customers = customersResult.data;

    // Calculate stats
    const todayJobs = jobs.filter(j => {
        const jobDate = new Date(j.scheduled_date).toDateString();
        const today = new Date().toDateString();
        return jobDate === today;
    });

    const inProgressJobs = jobs.filter(j => j.status === 'in_progress');
    const urgentJobs = jobs.filter(j => j.priority === 'urgent' || j.priority === 'high');

    return (
        <div className="p-4 md:p-8 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-white">Job Dashboard</h1>
                    <p className="text-slate-400 mt-1">Manage your upcoming service calls</p>
                </div>
                <div className="flex gap-2">
                    <Link href="/dashboard/customers">
                        <Button className="bg-slate-700 text-white hover:bg-slate-600">
                            <Users className="w-4 h-4 mr-2" />
                            Customers
                        </Button>
                    </Link>
                    <Link href="/dashboard/jobs/new">
                        <Button className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600">
                            <Plus className="w-4 h-4 mr-2" />
                            New Job
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                    <div className="flex items-center gap-2 text-slate-400">
                        <Calendar className="w-4 h-4" />
                        <span className="text-sm">Today</span>
                    </div>
                    <p className="text-2xl font-bold text-white mt-1">{todayJobs.length}</p>
                </div>
                <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                    <div className="flex items-center gap-2 text-slate-400">
                        <ClipboardList className="w-4 h-4" />
                        <span className="text-sm">Upcoming</span>
                    </div>
                    <p className="text-2xl font-bold text-white mt-1">{jobs.length}</p>
                </div>
                <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                    <div className="flex items-center gap-2 text-yellow-400">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-sm">In Progress</span>
                    </div>
                    <p className="text-2xl font-bold text-yellow-400 mt-1">{inProgressJobs.length}</p>
                </div>
                <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                    <div className="flex items-center gap-2 text-red-400">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-sm">Urgent/High</span>
                    </div>
                    <p className="text-2xl font-bold text-red-400 mt-1">{urgentJobs.length}</p>
                </div>
            </div>

            {/* Empty State */}
            {jobs.length === 0 && (
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-8 text-center">
                    <div className="w-16 h-16 mx-auto bg-slate-700 rounded-full flex items-center justify-center mb-4">
                        <ClipboardList className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">No upcoming jobs</h3>
                    <p className="text-slate-400 mb-4">
                        {customers.length === 0
                            ? 'Start by adding a customer, then create your first job.'
                            : 'Create a new job to get started.'}
                    </p>
                    {customers.length === 0 ? (
                        <Link href="/dashboard/customers">
                            <Button className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600">
                                <Plus className="w-4 h-4 mr-2" />
                                Add Customer
                            </Button>
                        </Link>
                    ) : (
                        <Link href="/dashboard/jobs/new">
                            <Button className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600">
                                <Plus className="w-4 h-4 mr-2" />
                                Create Job
                            </Button>
                        </Link>
                    )}
                </div>
            )}

            {/* Job List */}
            {jobs.length > 0 && (
                <>
                    {/* Mobile: Card List */}
                    <div className="block md:hidden">
                        <h2 className="text-lg font-semibold text-white mb-4">Upcoming Jobs</h2>
                        <JobCardList jobs={jobs} />
                    </div>

                    {/* Desktop: Data Table */}
                    <div className="hidden md:block">
                        <JobTable jobs={jobs} />
                    </div>
                </>
            )}
        </div>
    );
}
