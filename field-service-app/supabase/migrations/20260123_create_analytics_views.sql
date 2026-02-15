-- ================================================================
-- ANALYTICS VIEWS MIGRATION (Create views for dashboard analytics)
-- ================================================================

-- ================================================================
-- SCHEMA ADDITIONS
-- ================================================================

-- Add amount_paid column to invoices for partial payment tracking
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10, 2) DEFAULT 0;

-- Update existing paid invoices to set amount_paid = total_amount
UPDATE public.invoices 
SET amount_paid = total_amount 
WHERE payment_status = 'paid' AND (amount_paid IS NULL OR amount_paid = 0);

-- Add service_type column to fs_jobs for revenue breakdown
ALTER TABLE public.fs_jobs 
ADD COLUMN IF NOT EXISTS service_type TEXT DEFAULT 'general' 
CHECK (service_type IN ('plumbing', 'electrical', 'hvac', 'general', 'landscaping', 'cleaning'));

-- Add lead_source column to fs_customers for source tracking
ALTER TABLE public.fs_customers 
ADD COLUMN IF NOT EXISTS lead_source TEXT DEFAULT 'other' 
CHECK (lead_source IN ('google', 'referral', 'facebook', 'website', 'yelp', 'other'));

-- ================================================================
-- REVENUE BY MONTH VIEW
-- ================================================================
DROP VIEW IF EXISTS public.revenue_by_month;
CREATE VIEW public.revenue_by_month AS
SELECT 
    DATE_TRUNC('month', paid_at AT TIME ZONE 'America/New_York')::date AS month,
    COALESCE(SUM(amount_paid), 0) AS total_revenue,
    COUNT(*) AS invoice_count
FROM public.invoices
WHERE payment_status IN ('paid', 'partial')
  AND paid_at IS NOT NULL
GROUP BY DATE_TRUNC('month', paid_at AT TIME ZONE 'America/New_York')
ORDER BY month DESC;

-- ================================================================
-- TECHNICIAN PERFORMANCE VIEW
-- ================================================================
DROP VIEW IF EXISTS public.technician_performance;
CREATE VIEW public.technician_performance AS
SELECT 
    j.technician_id,
    COALESCE(p.full_name, p.email, 'Unknown') AS technician_name,
    COUNT(DISTINCT j.id) FILTER (WHERE j.status = 'completed') AS jobs_completed,
    COUNT(DISTINCT j.id) FILTER (WHERE j.status = 'cancelled') AS jobs_cancelled,
    COALESCE(SUM(i.amount_paid) FILTER (WHERE i.payment_status IN ('paid', 'partial')), 0) AS total_revenue
FROM public.fs_jobs j
LEFT JOIN auth.users u ON j.technician_id = u.id
LEFT JOIN public.profiles p ON j.technician_id = p.id
LEFT JOIN public.invoices i ON j.id = i.job_id
WHERE j.technician_id IS NOT NULL
GROUP BY j.technician_id, p.full_name, p.email
ORDER BY total_revenue DESC;

-- ================================================================
-- CONVERSION FUNNEL VIEW
-- ================================================================
DROP VIEW IF EXISTS public.conversion_funnel;
CREATE VIEW public.conversion_funnel AS
SELECT 
    COUNT(*) AS total_estimates,
    COUNT(*) FILTER (WHERE status = 'approved') AS approved_count,
    COUNT(*) FILTER (WHERE status = 'declined') AS declined_count,
    COUNT(*) FILTER (WHERE job_id IS NOT NULL) AS converted_to_jobs,
    CASE 
        WHEN COUNT(*) > 0 THEN 
            ROUND((COUNT(*) FILTER (WHERE job_id IS NOT NULL)::numeric / COUNT(*)::numeric) * 100, 2)
        ELSE 0 
    END AS conversion_rate
FROM public.estimates;

-- ================================================================
-- REVENUE BY SERVICE TYPE VIEW
-- ================================================================
DROP VIEW IF EXISTS public.revenue_by_service_type;
CREATE VIEW public.revenue_by_service_type AS
SELECT 
    COALESCE(j.service_type, 'general') AS service_type,
    INITCAP(COALESCE(j.service_type, 'general')) AS service_type_label,
    COALESCE(SUM(i.amount_paid) FILTER (WHERE i.payment_status IN ('paid', 'partial')), 0) AS total_revenue,
    COUNT(DISTINCT j.id) AS job_count
FROM public.fs_jobs j
LEFT JOIN public.invoices i ON j.id = i.job_id
GROUP BY j.service_type
ORDER BY total_revenue DESC;

-- ================================================================
-- LEAD SOURCES VIEW
-- ================================================================
DROP VIEW IF EXISTS public.lead_sources;
CREATE VIEW public.lead_sources AS
SELECT 
    COALESCE(lead_source, 'other') AS lead_source,
    INITCAP(COALESCE(lead_source, 'other')) AS lead_source_label,
    COUNT(*) AS customer_count
FROM public.fs_customers
GROUP BY lead_source
ORDER BY customer_count DESC;

-- ================================================================
-- GRANT ACCESS TO AUTHENTICATED USERS
-- ================================================================
GRANT SELECT ON public.revenue_by_month TO authenticated;
GRANT SELECT ON public.technician_performance TO authenticated;
GRANT SELECT ON public.conversion_funnel TO authenticated;
GRANT SELECT ON public.revenue_by_service_type TO authenticated;
GRANT SELECT ON public.lead_sources TO authenticated;
