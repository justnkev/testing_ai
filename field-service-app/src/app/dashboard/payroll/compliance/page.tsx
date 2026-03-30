'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import {
    Shield, Plus, Trash2, Save, Loader2, ChevronDown,
    HardHat, FileText, Calendar, Search, Download, AlertTriangle, ArrowLeft
} from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
    getPrevailingWageJobs,
    getComplianceJobsList,
    markJobAsPrevailingWage,
    setJobRateOverrides,
    getJobRateOverrides,
    generateCertifiedPayrollReport,
} from '@/lib/actions/compliance';
import type { RateOverride, CertifiedPayrollRow } from '@/lib/actions/compliance';

const CLASSIFICATIONS = ['Electrician', 'Apprentice', 'Foreman', 'Journeyman', 'Helper', 'Laborer'];

export default function CompliancePage() {
    const [activeTab, setActiveTab] = useState<'rates' | 'payroll'>('rates');

    return (
        <div className="p-4 md:p-8 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Link href="/dashboard/payroll" className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center hover:bg-slate-700 transition-colors mr-2">
                    <ArrowLeft className="w-5 h-5 text-slate-400" />
                </Link>
                <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/25">
                    <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-white">Compliance</h1>
                    <p className="text-slate-400 text-sm">Prevailing wage rates & certified payroll reports</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1 w-fit">
                <button
                    onClick={() => setActiveTab('rates')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                        activeTab === 'rates'
                            ? 'bg-amber-600/20 text-amber-400 shadow-sm'
                            : 'text-slate-400 hover:text-white'
                    }`}
                >
                    <HardHat className="w-4 h-4 inline mr-2" />
                    Rate Manager
                </button>
                <button
                    onClick={() => setActiveTab('payroll')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                        activeTab === 'payroll'
                            ? 'bg-amber-600/20 text-amber-400 shadow-sm'
                            : 'text-slate-400 hover:text-white'
                    }`}
                >
                    <FileText className="w-4 h-4 inline mr-2" />
                    Certified Payroll
                </button>
            </div>

            {activeTab === 'rates' && <RateManagerTab />}
            {activeTab === 'payroll' && <CertifiedPayrollTab />}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// RATE MANAGER TAB
// ═══════════════════════════════════════════════════════════════

function RateManagerTab() {
    const [jobs, setJobs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingJobId, setEditingJobId] = useState<string | null>(null);
    const [overrides, setOverrides] = useState<RateOverride[]>([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadJobs();
    }, []);

    const loadJobs = async () => {
        setLoading(true);
        const result = await getPrevailingWageJobs();
        if (result.success && result.data) setJobs(result.data);
        setLoading(false);
    };

    const togglePrevailingWage = async (jobId: string, isPW: boolean) => {
        const result = await markJobAsPrevailingWage(jobId, isPW);
        if (result.success) {
            toast.success(isPW ? 'Marked as prevailing wage' : 'Prevailing wage removed');
            loadJobs();
        } else {
            toast.error(result.error);
        }
    };

    const openRateEditor = async (jobId: string) => {
        setEditingJobId(jobId);
        const result = await getJobRateOverrides(jobId);
        if (result.success && result.data) {
            setOverrides(result.data.length > 0 ? result.data : [
                { labor_classification: 'Electrician', hourly_rate: 0, overtime_rate: null, fringe_rate: 0 },
            ]);
        }
    };

    const saveOverrides = async () => {
        if (!editingJobId) return;
        setSaving(true);
        const valid = overrides.filter((o) => o.labor_classification && o.hourly_rate > 0);
        const result = await setJobRateOverrides(editingJobId, valid);
        setSaving(false);
        if (result.success) {
            toast.success('Rate overrides saved');
            setEditingJobId(null);
            loadJobs();
        } else {
            toast.error(result.error);
        }
    };

    const addOverrideRow = () => {
        setOverrides([...overrides, { labor_classification: '', hourly_rate: 0, overtime_rate: null, fringe_rate: 0 }]);
    };

    const removeOverrideRow = (idx: number) => {
        setOverrides(overrides.filter((_, i) => i !== idx));
    };

    const updateOverride = (idx: number, field: keyof RateOverride, value: any) => {
        const updated = [...overrides];
        (updated[idx] as any)[field] = value;
        setOverrides(updated);
    };

    if (loading) {
        return <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 text-slate-500 animate-spin" /></div>;
    }

    return (
        <div className="space-y-4">
            {/* Jobs Table */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-700 text-slate-400 text-left">
                                <th className="px-4 py-3 font-medium">Job</th>
                                <th className="px-4 py-3 font-medium">Customer</th>
                                <th className="px-4 py-3 font-medium">Status</th>
                                <th className="px-4 py-3 font-medium text-center">Prevailing Wage</th>
                                <th className="px-4 py-3 font-medium text-center">Rate Overrides</th>
                                <th className="px-4 py-3 font-medium"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {jobs.map((job) => (
                                <tr key={job.id} className={`border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors ${job.is_prevailing_wage ? 'bg-amber-500/5' : ''}`}>
                                    <td className="px-4 py-3">
                                        <p className="text-white font-medium">{job.title}</p>
                                    </td>
                                    <td className="px-4 py-3 text-slate-300">{job.customer?.name || '—'}</td>
                                    <td className="px-4 py-3">
                                        <Badge variant="outline" className="text-xs text-slate-200">{job.status}</Badge>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <button
                                            onClick={() => togglePrevailingWage(job.id, !job.is_prevailing_wage)}
                                            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                                                job.is_prevailing_wage
                                                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                                    : 'bg-slate-700 text-slate-400 border border-slate-600 hover:border-amber-500/30'
                                            }`}
                                        >
                                            {job.is_prevailing_wage ? '✓ PW Active' : 'Enable'}
                                        </button>
                                    </td>
                                    <td className="px-4 py-3 text-center text-slate-400 text-xs">
                                        {job.rate_overrides?.length || 0} classifications
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {job.is_prevailing_wage && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 text-xs"
                                                onClick={() => openRateEditor(job.id)}
                                            >
                                                Edit Rates
                                            </Button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {jobs.length === 0 && (
                                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No jobs found.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Rate Override Editor (Drawer/Inline) */}
            {editingJobId && (
                <div className="bg-slate-800/80 rounded-xl border border-amber-500/30 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-white font-semibold flex items-center gap-2">
                            <HardHat className="w-5 h-5 text-amber-400" />
                            Rate Overrides — {jobs.find((j) => j.id === editingJobId)?.title}
                        </h3>
                        <Button size="sm" variant="ghost" onClick={() => setEditingJobId(null)} className="text-slate-400">
                            Cancel
                        </Button>
                    </div>

                    <div className="space-y-3">
                        {overrides.map((o, idx) => (
                            <div key={idx} className="grid grid-cols-5 gap-3 items-end">
                                <div>
                                    <label className="text-xs text-slate-400">Classification</label>
                                    <Select
                                        value={o.labor_classification}
                                        onValueChange={(v) => updateOverride(idx, 'labor_classification', v)}
                                    >
                                        <SelectTrigger className="bg-slate-900 border-slate-600 h-9 text-sm">
                                            <SelectValue placeholder="Select..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {CLASSIFICATIONS.map((c) => (
                                                <SelectItem key={c} value={c}>{c}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400">Hourly Rate</label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={o.hourly_rate || ''}
                                        onChange={(e) => updateOverride(idx, 'hourly_rate', parseFloat(e.target.value) || 0)}
                                        className="bg-slate-900 border-slate-600 h-9 text-sm"
                                        placeholder="$0.00"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400">OT Rate</label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={o.overtime_rate ?? ''}
                                        onChange={(e) => updateOverride(idx, 'overtime_rate', parseFloat(e.target.value) || null)}
                                        className="bg-slate-900 border-slate-600 h-9 text-sm"
                                        placeholder="Auto"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400">Fringe Rate</label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={o.fringe_rate || ''}
                                        onChange={(e) => updateOverride(idx, 'fringe_rate', parseFloat(e.target.value) || 0)}
                                        className="bg-slate-900 border-slate-600 h-9 text-sm"
                                        placeholder="$0.00"
                                    />
                                </div>
                                <Button size="icon" variant="ghost" className="h-9 w-9 text-red-400 hover:bg-red-400/10" onClick={() => removeOverrideRow(idx)}>
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        ))}
                    </div>

                    <div className="flex items-center gap-3">
                        <Button size="sm" variant="outline" onClick={addOverrideRow} className="border-slate-600 text-slate-300">
                            <Plus className="w-4 h-4 mr-1" /> Add Classification
                        </Button>
                        <Button size="sm" onClick={saveOverrides} disabled={saving} className="bg-amber-600 hover:bg-amber-700">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-1" /> Save Rates</>}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// CERTIFIED PAYROLL TAB
// ═══════════════════════════════════════════════════════════════

function CertifiedPayrollTab() {
    const [jobs, setJobs] = useState<any[]>([]);
    const [selectedJobId, setSelectedJobId] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reportData, setReportData] = useState<CertifiedPayrollRow[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [loadingJobs, setLoadingJobs] = useState(true);
    const [isWh347Mode, setIsWh347Mode] = useState(false);

    useEffect(() => {
        getComplianceJobsList().then((result) => {
            if (result.success && result.data) setJobs(result.data);
            setLoadingJobs(false);
        });

        // Default date range: last 7 days
        const end = new Date();
        const start = new Date(end);
        start.setDate(start.getDate() - 7);
        setStartDate(start.toISOString().split('T')[0]);
        setEndDate(end.toISOString().split('T')[0]);
    }, []);

    const generateReport = async () => {
        if (!selectedJobId || !startDate || !endDate) {
            toast.warning('Select a job and date range');
            return;
        }
        setLoading(true);
        const result = await generateCertifiedPayrollReport(selectedJobId, startDate, endDate);
        setLoading(false);
        if (result.success && result.data) {
            setReportData(result.data);
            if (result.data.length === 0) {
                toast.info('No approved time entries found for this period');
            }
        } else if (!result.success) {
            toast.error(result.error);
        }
    };

    const downloadPayrollPDF = async () => {
        if (!reportData || reportData.length === 0) return;

        // Dynamic import jsPDF (client-side only)
        const { default: jsPDF } = await import('jspdf');
        const autoTable = (await import('jspdf-autotable')).default;

        const doc = new jsPDF({ orientation: 'landscape' });
        const selectedJob = jobs.find((j) => j.id === selectedJobId);

        // Title
        doc.setFontSize(16);
        doc.text(isWh347Mode ? 'WH-347 Certified Payroll Report' : 'Certified Payroll Report', 14, 20);
        doc.setFontSize(10);
        doc.text(`Job: ${selectedJob?.title || 'N/A'}`, 14, 28);
        doc.text(`Period: ${startDate} to ${endDate}`, 14, 34);
        doc.text(`Customer: ${selectedJob?.customer?.name || 'N/A'}`, 14, 40);
        if (reportData[0]?.is_prevailing_wage) {
            doc.setTextColor(200, 100, 0);
            doc.text('⚠ PREVAILING WAGE JOB', 200, 28);
            doc.setTextColor(0);
        }

        const headers = isWh347Mode
            ? ['Name', 'SSN (Last 4)', 'Classification', 'Date', 'Reg Hrs', 'OT Hrs', 'Total Hrs', 'Rate', 'OT Rate', 'Fringe', 'Gross Pay']
            : ['Name', 'Classification', 'Date', 'Reg Hrs', 'OT Hrs', 'Total Hrs', 'Rate', 'Gross Pay'];

        const rows = reportData.map((r) => {
            const base = [
                r.employee_name,
                ...(isWh347Mode ? [r.last_four_ssn ? `***-**-${r.last_four_ssn}` : 'N/A'] : []),
                r.labor_classification,
                r.work_date,
                Number(r.regular_hours).toFixed(1),
                Number(r.overtime_hours).toFixed(1),
                Number(r.total_hours).toFixed(1),
                `$${Number(r.hourly_rate).toFixed(2)}`,
                ...(isWh347Mode ? [
                    `$${Number(r.overtime_rate).toFixed(2)}`,
                    `$${Number(r.fringe_rate).toFixed(2)}`,
                ] : []),
                `$${Number(r.gross_pay).toFixed(2)}`,
            ];
            return base;
        });

        // Add totals row
        const totalHrs = reportData.reduce((s, r) => s + Number(r.total_hours), 0);
        const totalPay = reportData.reduce((s, r) => s + Number(r.gross_pay), 0);
        const emptyColCount = isWh347Mode ? 4 : 3;
        const totalsRow = [
            'TOTALS', ...Array(emptyColCount).fill(''), '',
            totalHrs.toFixed(1), '',
            ...(isWh347Mode ? ['', ''] : []),
            `$${totalPay.toFixed(2)}`,
        ];
        rows.push(totalsRow);

        autoTable(doc, {
            head: [headers],
            body: rows,
            startY: 48,
            theme: 'grid',
            headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 8 },
            bodyStyles: { fontSize: 8 },
            footStyles: { fillColor: [30, 41, 59], fontStyle: 'bold' },
        });

        if (isWh347Mode) {
            const pageHeight = doc.internal.pageSize.height;
            doc.setFontSize(8);
            doc.text('I, _________________________, do hereby certify that the above payroll is correct and complete.', 14, pageHeight - 30);
            doc.text('Signature: _________________________ Date: _________', 14, pageHeight - 22);
            doc.text('Title: _________________________', 14, pageHeight - 14);
        }

        doc.save(`payroll-${selectedJob?.title || 'report'}-${startDate}.pdf`);
        toast.success('PDF downloaded');
    };

    return (
        <div className="space-y-4">
            {/* Controls */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Job selector */}
                    <div>
                        <label className="text-sm text-slate-400 mb-1 block">Job</label>
                        <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                            <SelectTrigger className="bg-slate-900 border-slate-600 text-white">
                                <SelectValue placeholder={loadingJobs ? 'Loading...' : 'Select job...'} />
                            </SelectTrigger>
                            <SelectContent>
                                {jobs.map((j) => (
                                    <SelectItem key={j.id} value={j.id}>
                                        <div className="flex items-center gap-2">
                                            {j.title}
                                            {j.is_prevailing_wage && (
                                                <Badge variant="outline" className="text-amber-400 border-amber-500/30 text-[10px]">PW</Badge>
                                            )}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Date range */}
                    <div>
                        <label className="text-sm text-slate-400 mb-1 block">Start Date</label>
                        <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-slate-900 border-slate-600 text-white [color-scheme:dark]" />
                    </div>
                    <div>
                        <label className="text-sm text-slate-400 mb-1 block">End Date</label>
                        <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-slate-900 border-slate-600 text-white [color-scheme:dark]" />
                    </div>

                    {/* Generate */}
                    <div className="flex items-end gap-2">
                        <Button onClick={generateReport} disabled={loading || !selectedJobId} className="bg-amber-600 hover:bg-amber-700 flex-1">
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><FileText className="w-4 h-4 mr-2" /> Generate</>}
                        </Button>
                    </div>
                </div>

                {/* WH-347 toggle */}
                <div className="flex items-center gap-3 pt-2 border-t border-slate-700">
                    <button
                        onClick={() => setIsWh347Mode(!isWh347Mode)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            isWh347Mode
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-slate-700 text-slate-400 border border-slate-600'
                        }`}
                    >
                        <Shield className="w-3.5 h-3.5" />
                        {isWh347Mode ? 'WH-347 Format Active' : 'Enable WH-347 Format'}
                    </button>
                    {isWh347Mode && (
                        <span className="text-xs text-amber-400/60 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Includes SSN (last 4) and compliance signature block
                        </span>
                    )}
                </div>
            </div>

            {/* Report Results */}
            {reportData && reportData.length > 0 && (
                <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
                    <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                        <div>
                            <h3 className="text-white font-semibold">
                                {isWh347Mode ? 'WH-347 Certified Payroll' : 'Certified Payroll Report'}
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                                {reportData[0]?.is_prevailing_wage && (
                                    <Badge variant="outline" className="text-amber-400 border-amber-500/30 text-[10px] mr-2">Prevailing Wage</Badge>
                                )}
                                {reportData.length} entries · {startDate} to {endDate}
                            </p>
                        </div>
                        <Button size="sm" onClick={downloadPayrollPDF} className="bg-cyan-600 hover:bg-cyan-700">
                            <Download className="w-4 h-4 mr-1" /> Download PDF
                        </Button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-700 text-slate-400 text-left">
                                    <th className="px-4 py-2 font-medium">Employee</th>
                                    {isWh347Mode && <th className="px-4 py-2 font-medium">SSN</th>}
                                    <th className="px-4 py-2 font-medium">Classification</th>
                                    <th className="px-4 py-2 font-medium">Date</th>
                                    <th className="px-4 py-2 font-medium text-right">Reg Hrs</th>
                                    <th className="px-4 py-2 font-medium text-right">OT Hrs</th>
                                    <th className="px-4 py-2 font-medium text-right">Total</th>
                                    <th className="px-4 py-2 font-medium text-right">Rate</th>
                                    {isWh347Mode && <th className="px-4 py-2 font-medium text-right">Fringe</th>}
                                    <th className="px-4 py-2 font-medium text-right">Gross Pay</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reportData.map((row, i) => (
                                    <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                                        <td className="px-4 py-2 text-white font-medium">{row.employee_name}</td>
                                        {isWh347Mode && (
                                            <td className="px-4 py-2 text-slate-400 font-mono text-xs">
                                                {row.last_four_ssn ? `***-**-${row.last_four_ssn}` : '—'}
                                            </td>
                                        )}
                                        <td className="px-4 py-2 text-slate-300">{row.labor_classification}</td>
                                        <td className="px-4 py-2 text-slate-300">{row.work_date}</td>
                                        <td className="px-4 py-2 text-right text-slate-300">{Number(row.regular_hours).toFixed(1)}</td>
                                        <td className="px-4 py-2 text-right text-orange-400">{Number(row.overtime_hours).toFixed(1)}</td>
                                        <td className="px-4 py-2 text-right text-white font-medium">{Number(row.total_hours).toFixed(1)}</td>
                                        <td className="px-4 py-2 text-right text-cyan-400">${Number(row.hourly_rate).toFixed(2)}</td>
                                        {isWh347Mode && <td className="px-4 py-2 text-right text-purple-400">${Number(row.fringe_rate).toFixed(2)}</td>}
                                        <td className="px-4 py-2 text-right text-green-400 font-medium">${Number(row.gross_pay).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-slate-800/80 font-semibold text-white">
                                    <td className="px-4 py-2" colSpan={isWh347Mode ? 4 : 3}>Totals</td>
                                    <td className="px-4 py-2 text-right">{reportData.reduce((s, r) => s + Number(r.regular_hours), 0).toFixed(1)}</td>
                                    <td className="px-4 py-2 text-right text-orange-400">{reportData.reduce((s, r) => s + Number(r.overtime_hours), 0).toFixed(1)}</td>
                                    <td className="px-4 py-2 text-right">{reportData.reduce((s, r) => s + Number(r.total_hours), 0).toFixed(1)}</td>
                                    <td className="px-4 py-2 text-right">—</td>
                                    {isWh347Mode && <td className="px-4 py-2 text-right">—</td>}
                                    <td className="px-4 py-2 text-right text-green-400">${reportData.reduce((s, r) => s + Number(r.gross_pay), 0).toFixed(2)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}

            {reportData && reportData.length === 0 && (
                <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-8 text-center text-slate-500">
                    No approved time entries found for this job and period.
                </div>
            )}
        </div>
    );
}
