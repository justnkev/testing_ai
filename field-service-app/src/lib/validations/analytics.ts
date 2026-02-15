import { z } from 'zod';

// Date range for filtering analytics
export const dateRangeSchema = z.object({
    from: z.string().optional(),
    to: z.string().optional(),
});

export type DateRange = z.infer<typeof dateRangeSchema>;

// KPI Metrics
export interface KPIMetrics {
    totalRevenue: number;
    pendingRevenue: number;
    jobSuccessRate: number;
    newLeadsThisMonth: number;
}

// Revenue by Month (Area Chart)
export interface MonthlyRevenue {
    month: string;
    monthLabel: string;
    totalRevenue: number;
    invoiceCount: number;
}

// Revenue by Service Type (Bar Chart)
export interface ServiceTypeRevenue {
    serviceType: string;
    serviceTypeLabel: string;
    totalRevenue: number;
    jobCount: number;
}

// Lead Sources (Donut Chart)
export interface LeadSource {
    leadSource: string;
    leadSourceLabel: string;
    customerCount: number;
}

// Technician Performance (Leaderboard)
export interface TechnicianPerformance {
    technicianId: string;
    technicianName: string;
    jobsCompleted: number;
    jobsCancelled: number;
    totalRevenue: number;
}

// Conversion Funnel
export interface ConversionFunnel {
    totalEstimates: number;
    approvedCount: number;
    declinedCount: number;
    convertedToJobs: number;
    conversionRate: number;
}

// Chart color palette
export const CHART_COLORS = {
    primary: '#3B82F6',
    secondary: '#10B981',
    accent: '#8B5CF6',
    warning: '#F59E0B',
    danger: '#EF4444',
    info: '#06B6D4',
} as const;

export const SERVICE_TYPE_COLORS: Record<string, string> = {
    plumbing: '#3B82F6',
    electrical: '#F59E0B',
    hvac: '#10B981',
    general: '#8B5CF6',
    landscaping: '#06B6D4',
    cleaning: '#EC4899',
};

export const LEAD_SOURCE_COLORS: Record<string, string> = {
    google: '#4285F4',
    referral: '#10B981',
    facebook: '#1877F2',
    website: '#8B5CF6',
    yelp: '#D32323',
    other: '#6B7280',
};
