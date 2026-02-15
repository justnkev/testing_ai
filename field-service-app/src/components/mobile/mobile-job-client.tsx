'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { JobActionBar } from '@/components/mobile/job-action-bar';
import { PhotoGallery } from '@/components/mobile/photo-gallery';
import { SignaturePad } from '@/components/mobile/signature-pad';
import { TaskChecklist } from '@/components/mobile/task-checklist';
import { PartsManager } from '@/components/mobile/parts-manager';
import { Button } from '@/components/ui/button';
import { completeJob } from '@/lib/actions/job-execution';
import type { JobExecutionData } from '@/lib/actions/job-execution';
import { toast } from 'sonner';
import {
    ArrowLeft,
    MapPin,
    Calendar,
    Clock,
    Phone,
    User,
    AlertTriangle,
} from 'lucide-react';

interface MobileJobClientProps {
    initialData: JobExecutionData;
}

export function MobileJobClient({ initialData }: MobileJobClientProps) {
    const router = useRouter();
    const [jobData, setJobData] = useState<JobExecutionData>(initialData);
    const [showSignature, setShowSignature] = useState(false);
    const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
    const [isCompleting, setIsCompleting] = useState(false);

    // Check if job can be completed
    const canComplete = useMemo(() => {
        // Must have at least one "after" photo
        const hasAfterPhoto = jobData.photos.some((p) => p.photo_type === 'after');

        // All required checklist items must be complete
        const requiredComplete = jobData.checklist
            .filter((c) => c.is_required)
            .every((c) => c.is_completed);

        return hasAfterPhoto && requiredComplete;
    }, [jobData.photos, jobData.checklist]);

    // Refresh data
    const refreshData = useCallback(async () => {
        router.refresh();
    }, [router]);

    // Handle complete button click
    const handleCompleteClick = useCallback(() => {
        if (!canComplete) {
            toast.warning('Complete all requirements first');
            return;
        }
        setShowCompleteConfirm(true);
    }, [canComplete]);

    // Handle confirm complete (show signature)
    const handleConfirmComplete = useCallback(() => {
        setShowCompleteConfirm(false);
        setShowSignature(true);
    }, []);

    // Handle signature capture
    const handleSignatureCapture = useCallback(
        async (signatureData: string, signerName: string) => {
            setIsCompleting(true);

            const result = await completeJob(jobData.id, signatureData, signerName);

            if (result.success) {
                toast.success('Job completed successfully!');
                setShowSignature(false);
                router.refresh();
            } else {
                toast.error(result.error);
            }

            setIsCompleting(false);
        },
        [jobData.id, router]
    );

    // Build customer address
    const customerAddress = jobData.customer
        ? [
            jobData.customer.address,
            jobData.customer.city,
            jobData.customer.state,
            jobData.customer.zip_code,
        ]
            .filter(Boolean)
            .join(', ')
        : '';

    return (
        <div className="min-h-screen bg-slate-900 pb-8">
            {/* Header */}
            <header className="sticky top-0 z-20 bg-slate-800 border-b border-slate-700 px-4 py-3">
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.push('/dashboard/jobs')}
                        className="text-slate-300 hover:text-white h-11 w-11"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-lg font-bold text-white truncate">{jobData.title}</h1>
                        <p className="text-sm text-slate-400 truncate">
                            {jobData.customer?.name || 'No customer'}
                        </p>
                    </div>
                    <div
                        className={`px-3 py-1 rounded-full text-xs font-medium ${jobData.status === 'completed'
                            ? 'bg-green-500/20 text-green-400'
                            : jobData.status === 'in_progress'
                                ? 'bg-blue-500/20 text-blue-400'
                                : 'bg-slate-600 text-slate-300'
                            }`}
                    >
                        {jobData.status.replace('_', ' ').toUpperCase()}
                    </div>
                </div>
            </header>

            <div className="px-4 space-y-4 mt-4">
                {/* Job Info Card */}
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 space-y-3">
                    {/* Schedule */}
                    <div className="flex items-center gap-3">
                        <Calendar className="w-5 h-5 text-slate-400" />
                        <span className="text-white">
                            {new Date(jobData.scheduled_date).toLocaleDateString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                            })}
                        </span>
                        {jobData.scheduled_time && (
                            <>
                                <Clock className="w-5 h-5 text-slate-400 ml-2" />
                                <span className="text-white">{jobData.scheduled_time}</span>
                            </>
                        )}
                    </div>

                    {/* Customer */}
                    {jobData.customer && (
                        <>
                            <div className="flex items-start gap-3">
                                <User className="w-5 h-5 text-slate-400 mt-0.5" />
                                <span className="text-white">{jobData.customer.name}</span>
                            </div>
                            <div className="flex items-start gap-3">
                                <MapPin className="w-5 h-5 text-slate-400 mt-0.5" />
                                <span className="text-slate-300 text-sm">{customerAddress}</span>
                            </div>
                            {jobData.customer.phone && (
                                <a
                                    href={`tel:${jobData.customer.phone}`}
                                    className="flex items-center gap-3 text-blue-400 hover:text-blue-300"
                                >
                                    <Phone className="w-5 h-5" />
                                    {jobData.customer.phone}
                                </a>
                            )}
                        </>
                    )}

                    {/* Description */}
                    {jobData.description && (
                        <div className="pt-2 border-t border-slate-700">
                            <p className="text-slate-300 text-sm">{jobData.description}</p>
                        </div>
                    )}
                </div>

                {/* Action Bar */}
                {jobData.status !== 'completed' && (
                    <JobActionBar
                        jobId={jobData.id}
                        status={jobData.status}
                        checkInAt={jobData.check_in_at}
                        customerAddress={customerAddress}
                        onStatusChange={refreshData}
                        canComplete={canComplete}
                        onCompleteClick={handleCompleteClick}
                    />
                )}

                {/* Checklist */}
                {jobData.checklist.length > 0 && (
                    <TaskChecklist
                        items={jobData.checklist}
                        onItemChange={refreshData}
                        disabled={jobData.status === 'completed'}
                    />
                )}

                {/* Parts Manager (New) */}
                <PartsManager
                    jobId={jobData.id}
                    parts={jobData.parts || []}
                    onPartsChange={refreshData}
                    disabled={jobData.status === 'completed'}
                />

                {/* Photo Gallery */}
                <PhotoGallery
                    jobId={jobData.id}
                    photos={jobData.photos}
                    onPhotosChange={refreshData}
                />

                {/* Signature Display (if completed) */}
                {jobData.signature_data && (
                    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
                        <h3 className="text-white font-medium mb-3">Customer Signature</h3>
                        <div className="bg-white rounded-lg p-4">
                            <img
                                src={jobData.signature_data}
                                alt="Customer signature"
                                className="max-h-24 mx-auto"
                            />
                        </div>
                        <p className="text-center text-sm text-slate-400 mt-2">
                            Signed by {jobData.signature_name} at{' '}
                            {new Date(jobData.signed_at!).toLocaleString()}
                        </p>
                    </div>
                )}
            </div>

            {/* Complete Confirmation Dialog */}
            {showCompleteConfirm && (
                <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
                    <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 max-w-sm w-full space-y-4">
                        <div className="flex items-center gap-3 text-amber-400">
                            <AlertTriangle className="w-6 h-6" />
                            <h3 className="text-lg font-bold">Complete Job?</h3>
                        </div>
                        <p className="text-slate-300">
                            Are you sure you want to complete this job? This will require a customer
                            signature.
                        </p>
                        <div className="flex gap-3">
                            <Button
                                onClick={() => setShowCompleteConfirm(false)}
                                variant="outline"
                                className="flex-1 h-12 border-slate-600"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleConfirmComplete}
                                className="flex-1 h-12 bg-green-600 hover:bg-green-700"
                            >
                                Continue
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Signature Modal */}
            {showSignature && (
                <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center p-4">
                    <div className="w-full max-w-md mx-auto">
                        <SignaturePad
                            onCapture={handleSignatureCapture}
                            onCancel={() => setShowSignature(false)}
                            isLoading={isCompleting}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
