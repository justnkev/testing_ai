import { getAllJobs } from '@/lib/actions/jobs';
import { JobCardList } from '@/components/job-card-list';
import { JobTable } from '@/components/job-table';
import { Button } from '@/components/ui/button';
import { Plus, ArrowLeft, ClipboardList } from 'lucide-react';
import Link from 'next/link';

export default async function JobsPage() {
    const result = await getAllJobs();
    const jobs = result.data;

    return (
        <div className="p-4 md:p-8 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard">
                        <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-slate-700">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-white">All Jobs</h1>
                        <p className="text-slate-400 mt-1">View and manage all service jobs</p>
                    </div>
                </div>
                <Link href="/dashboard/jobs/new">
                    <Button className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600">
                        <Plus className="w-4 h-4 mr-2" />
                        New Job
                    </Button>
                </Link>
            </div>

            {/* Job Count */}
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 inline-block">
                <p className="text-sm text-slate-400">Total Jobs</p>
                <p className="text-2xl font-bold text-white">{jobs.length}</p>
            </div>

            {/* Empty State */}
            {jobs.length === 0 && (
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-8 text-center">
                    <div className="w-16 h-16 mx-auto bg-slate-700 rounded-full flex items-center justify-center mb-4">
                        <ClipboardList className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">No jobs yet</h3>
                    <p className="text-slate-400 mb-4">Create your first job to get started.</p>
                    <Link href="/dashboard/jobs/new">
                        <Button className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600">
                            <Plus className="w-4 h-4 mr-2" />
                            Create Job
                        </Button>
                    </Link>
                </div>
            )}

            {/* Job List */}
            {jobs.length > 0 && (
                <>
                    {/* Mobile: Card List */}
                    <div className="block md:hidden">
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
