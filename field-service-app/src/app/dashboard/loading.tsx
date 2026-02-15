import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLoading() {
    return (
        <div className="p-4 md:p-8 space-y-6">
            {/* Header Skeleton */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <Skeleton className="h-8 w-48 bg-slate-700" />
                    <Skeleton className="h-4 w-64 mt-2 bg-slate-700" />
                </div>
                <Skeleton className="h-10 w-32 bg-slate-700" />
            </div>

            {/* Stats Skeleton */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                        <Skeleton className="h-4 w-20 bg-slate-700" />
                        <Skeleton className="h-8 w-12 mt-2 bg-slate-700" />
                    </div>
                ))}
            </div>

            {/* Job Cards Skeleton (Mobile) */}
            <div className="block md:hidden space-y-4">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                        <Skeleton className="h-5 w-3/4 bg-slate-700" />
                        <Skeleton className="h-4 w-1/2 mt-2 bg-slate-700" />
                        <div className="flex gap-2 mt-4">
                            <Skeleton className="h-6 w-16 bg-slate-700 rounded-full" />
                            <Skeleton className="h-6 w-20 bg-slate-700 rounded-full" />
                        </div>
                        <Skeleton className="h-10 w-full mt-4 bg-slate-700" />
                    </div>
                ))}
            </div>

            {/* Table Skeleton (Desktop) */}
            <div className="hidden md:block bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <div className="p-4 border-b border-slate-700">
                    <Skeleton className="h-6 w-32 bg-slate-700" />
                </div>
                <div className="divide-y divide-slate-700">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex items-center gap-4 p-4">
                            <Skeleton className="h-5 flex-1 bg-slate-700" />
                            <Skeleton className="h-5 w-24 bg-slate-700" />
                            <Skeleton className="h-5 w-20 bg-slate-700" />
                            <Skeleton className="h-8 w-24 bg-slate-700" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
