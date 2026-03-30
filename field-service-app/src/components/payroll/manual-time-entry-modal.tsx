'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getPayrollFormOptions, createManualTimeEntry } from '@/lib/actions/payroll';
import { X, Clock, MapPin, User, FileText, Briefcase } from 'lucide-react';

interface ManualTimeEntryModalProps {
    onClose: () => void;
}

export function ManualTimeEntryModal({ onClose }: ManualTimeEntryModalProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [profiles, setProfiles] = useState<{ id: string; display_name: string; role: string }[]>([]);
    const [jobs, setJobs] = useState<{ id: string; title: string; status: string }[]>([]);

    const [userId, setUserId] = useState('');
    const [jobId, setJobId] = useState('');
    const [clockInDate, setClockInDate] = useState('');
    const [clockInTime, setClockInTime] = useState('');
    const [clockOutDate, setClockOutDate] = useState('');
    const [clockOutTime, setClockOutTime] = useState('');
    const [isTravelTime, setIsTravelTime] = useState(false);
    const [notes, setNotes] = useState('');

    useEffect(() => {
        async function fetchOptions() {
            const result = await getPayrollFormOptions();
            if (result.success && result.data) {
                setProfiles(result.data.profiles);
                setJobs(result.data.jobs);
            } else {
                toast.error('Failed to load form options');
            }
            setIsLoading(false);
        }
        fetchOptions();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!userId || !jobId || !clockInDate || !clockInTime || !clockOutDate || !clockOutTime) {
            toast.error('Please fill in all required fields');
            return;
        }

        const clockInAt = new Date(`${clockInDate}T${clockInTime}`).toISOString();
        const clockOutAt = new Date(`${clockOutDate}T${clockOutTime}`).toISOString();

        if (new Date(clockOutAt) <= new Date(clockInAt)) {
            toast.error('Clock out time must be after clock in time');
            return;
        }

        setIsSubmitting(true);
        const result = await createManualTimeEntry({
            userId,
            jobId,
            clockInAt,
            clockOutAt,
            isTravelTime,
            notes
        });

        if (result.success) {
            toast.success('Manual time entry created successfully');
            router.refresh();
            onClose();
        } else {
            toast.error(result.error);
        }
        setIsSubmitting(false);
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between z-10">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Clock className="w-5 h-5 text-blue-400" />
                        Add Manual Time Entry
                    </h2>
                    <Button variant="ghost" size="icon" onClick={onClose} className="text-slate-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {isLoading ? (
                        <div className="text-center py-8 text-slate-400">Loading form options...</div>
                    ) : (
                        <>
                            {/* User Selection */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                    <User className="w-4 h-4" />
                                    Technician / Employee *
                                </label>
                                <select 
                                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                    value={userId}
                                    onChange={(e) => setUserId(e.target.value)}
                                    required
                                >
                                    <option value="">Select an employee...</option>
                                    {profiles.map(p => (
                                        <option key={p.id} value={p.id}>{p.display_name} ({p.role})</option>
                                    ))}
                                </select>
                            </div>

                            {/* Job Selection */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                    <Briefcase className="w-4 h-4" />
                                    Assigned Job *
                                </label>
                                <select 
                                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                    value={jobId}
                                    onChange={(e) => setJobId(e.target.value)}
                                    required
                                >
                                    <option value="">Select a job...</option>
                                    {jobs.map(j => (
                                        <option key={j.id} value={j.id}>{j.title} ({j.status.replace('_', ' ')})</option>
                                    ))}
                                </select>
                            </div>

                            {/* Clock In */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300">Clock In Date *</label>
                                    <input 
                                        type="date" 
                                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2.5 outline-none [color-scheme:dark]"
                                        value={clockInDate}
                                        onChange={(e) => setClockInDate(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300">Clock In Time *</label>
                                    <input 
                                        type="time" 
                                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2.5 outline-none [color-scheme:dark]"
                                        value={clockInTime}
                                        onChange={(e) => setClockInTime(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            {/* Clock Out */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300">Clock Out Date *</label>
                                    <input 
                                        type="date" 
                                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2.5 outline-none [color-scheme:dark]"
                                        value={clockOutDate}
                                        onChange={(e) => setClockOutDate(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300">Clock Out Time *</label>
                                    <input 
                                        type="time" 
                                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2.5 outline-none [color-scheme:dark]"
                                        value={clockOutTime}
                                        onChange={(e) => setClockOutTime(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            {/* Travel Time Toggle */}
                            <div className="flex items-center gap-3 bg-slate-900 p-4 rounded-lg border border-slate-700 cursor-pointer" onClick={() => setIsTravelTime(!isTravelTime)}>
                                <input 
                                    type="checkbox" 
                                    checked={isTravelTime}
                                    onChange={(e) => setIsTravelTime(e.target.checked)}
                                    className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900"
                                    onClick={e => e.stopPropagation()}
                                />
                                <div>
                                    <p className="text-white font-medium flex items-center gap-2">
                                        <MapPin className="w-4 h-4 text-slate-400" />
                                        Travel Time Entry
                                    </p>
                                    <p className="text-xs text-slate-400">Mark if this time was spent traveling to/from a job site.</p>
                                </div>
                            </div>

                            {/* Notes */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                    <FileText className="w-4 h-4" />
                                    Admin Notes (Optional)
                                </label>
                                <textarea 
                                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                    placeholder="Reason for manual entry..."
                                    rows={3}
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                ></textarea>
                            </div>

                            <div className="pt-4 border-t border-slate-700 flex gap-3 justify-end">
                                <Button type="button" variant="outline" onClick={onClose} className="border-slate-600">
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700">
                                    {isSubmitting ? 'Saving...' : 'Create Entry'}
                                </Button>
                            </div>
                        </>
                    )}
                </form>
            </div>
        </div>
    );
}
