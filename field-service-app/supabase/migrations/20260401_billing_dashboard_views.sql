-- 20260401_billing_dashboard_views.sql
-- Create a view that combines completed unbilled jobs and existing invoices
-- Also create an RPC to fetch high-level Receivables and DSO.

-- 1. View: v_billing_dashboard
CREATE OR REPLACE VIEW public.v_billing_dashboard AS
-- Part A: Existing Invoices
SELECT 
    i.id as id,
    'invoice' as record_type,
    i.invoice_number as display_id,
    c.name as customer_name,
    j.title as job_title,
    i.created_at as created_at,
    i.due_date as due_date,
    i.total_amount as total_amount,
    i.balance_due as balance_due,
    i.status as status,
    i.payment_status as payment_status,
    -- Aging logic: If not paid, how many days since creation?
    CASE 
        WHEN i.payment_status != 'paid' THEN EXTRACT(DAY FROM (NOW() - i.created_at))
        ELSE NULL
    END as days_aging,
    i.job_id,
    c.id as customer_id,
    false as has_missing_costs -- invoices already have amounts formalized
FROM public.invoices i
LEFT JOIN public.fs_jobs j ON i.job_id = j.id
LEFT JOIN public.fs_customers c ON i.customer_id = c.id

UNION ALL

-- Part B: Completed Jobs without invoices
SELECT 
    j.id as id,
    'unbilled_job' as record_type,
    'Unbilled' as display_id,
    c.name as customer_name,
    j.title as job_title,
    j.updated_at as created_at,
    NULL::TIMESTAMPTZ as due_date,
    -- Estimate amount based on time_entries and fs_job_parts
    COALESCE(
        (SELECT SUM(te.total_hours * te.applied_rate) FROM public.time_entries te WHERE te.job_id = j.id AND te.status='approved'), 
        0
    ) + 
    COALESCE(
        (SELECT SUM(jp.quantity_used * jp.unit_price_at_time_of_use) FROM public.fs_job_parts jp WHERE jp.job_id = j.id), 
        0
    ) as total_amount,
    COALESCE(
        (SELECT SUM(te.total_hours * te.applied_rate) FROM public.time_entries te WHERE te.job_id = j.id AND te.status='approved'), 
        0
    ) + 
    COALESCE(
        (SELECT SUM(jp.quantity_used * jp.unit_price_at_time_of_use) FROM public.fs_job_parts jp WHERE jp.job_id = j.id), 
        0
    ) as balance_due,
    'unbilled' as status,
    'unpaid' as payment_status,
    NULL::numeric as days_aging,
    j.id as job_id,
    c.id as customer_id,
    -- Missing Costs logic: Returns true if there are ZERO approved hours AND ZERO parts.
    (
        NOT EXISTS (SELECT 1 FROM public.time_entries te WHERE te.job_id = j.id AND te.status='approved')
        AND 
        NOT EXISTS (SELECT 1 FROM public.fs_job_parts jp WHERE jp.job_id = j.id)
    ) as has_missing_costs
FROM public.fs_jobs j
LEFT JOIN public.fs_customers c ON j.customer_id = c.id
WHERE j.status = 'completed' AND NOT EXISTS (SELECT 1 FROM public.invoices i WHERE i.job_id = j.id);


-- 2. RPC: get_billing_kpis
-- Returns total receivables and DSO
CREATE OR REPLACE FUNCTION public.get_billing_kpis()
RETURNS TABLE (
    total_receivables NUMERIC,
    average_dso NUMERIC,
    total_unbilled NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    -- total_receivables: sum of all balance_due where status is NOT draft
    -- average_dso: average days between invoice created_at and paid_at
    -- total_unbilled: sum of implied amounts from completed jobs without invoices
SELECT 
    (
        SELECT COALESCE(SUM(balance_due), 0) 
        FROM public.invoices 
        WHERE status != 'draft' AND payment_status != 'paid'
    ) as total_receivables,
    
    (
        SELECT COALESCE(AVG(EXTRACT(DAY FROM (paid_at - created_at))), 0)
        FROM public.invoices
        WHERE payment_status = 'paid' AND paid_at IS NOT NULL
    ) as average_dso,

    (
        SELECT COALESCE(SUM(total_amount), 0)
        FROM public.v_billing_dashboard
        WHERE record_type = 'unbilled_job'
    ) as total_unbilled;
$$;
