-- ================================================================
-- PROFITABILITY MODULE MIGRATION
-- Adds material categorization, custom entries, and profitability RPCs
-- ================================================================

-- ================================================================
-- 1. ADD CATEGORY TO INVENTORY ITEMS
-- ================================================================
ALTER TABLE public.fs_inventory_items ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'General';

-- ================================================================
-- 2. ADD CUSTOM ENTRY SUPPORT TO JOB PARTS
-- ================================================================
ALTER TABLE public.fs_job_parts ADD COLUMN IF NOT EXISTS is_custom_entry BOOLEAN DEFAULT FALSE;
ALTER TABLE public.fs_job_parts ADD COLUMN IF NOT EXISTS custom_item_name TEXT;
ALTER TABLE public.fs_job_parts ADD COLUMN IF NOT EXISTS custom_item_price DECIMAL(10,2);
ALTER TABLE public.fs_job_parts ADD COLUMN IF NOT EXISTS admin_reviewed BOOLEAN DEFAULT FALSE;

-- Make item_id nullable (custom entries have no inventory item)
ALTER TABLE public.fs_job_parts ALTER COLUMN item_id DROP NOT NULL;

-- ================================================================
-- 3. RPC: get_job_profitability
-- Returns full cost breakdown for a single job.
-- Revenue = accepted estimate total_amount.
-- Labor = sum of time_entries gross_pay.
-- Materials = sum of fs_job_parts (cost_price basis for inventory, custom_item_price for custom).
-- ================================================================
CREATE OR REPLACE FUNCTION public.get_job_profitability(p_job_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_revenue DECIMAL(10,2);
    v_labor_cost DECIMAL(10,2);
    v_material_cost DECIMAL(10,2);
    v_gross_margin DECIMAL(10,2);
    v_margin_pct DECIMAL(6,2);
BEGIN
    -- Revenue from accepted estimate
    SELECT COALESCE(e.total_amount, 0) INTO v_revenue
    FROM public.estimates e
    WHERE e.job_id = p_job_id
      AND e.status = 'accepted'
    ORDER BY e.created_at DESC
    LIMIT 1;

    -- If no accepted estimate, try any estimate
    IF v_revenue = 0 THEN
        SELECT COALESCE(e.total_amount, 0) INTO v_revenue
        FROM public.estimates e
        WHERE e.job_id = p_job_id
        ORDER BY e.created_at DESC
        LIMIT 1;
    END IF;

    -- Labor cost from time_entries (Phase 1)
    SELECT COALESCE(SUM(te.gross_pay), 0) INTO v_labor_cost
    FROM public.time_entries te
    WHERE te.job_id = p_job_id
      AND te.status != 'rejected';

    -- Material cost using cost_price basis
    SELECT COALESCE(SUM(
        CASE
            WHEN jp.is_custom_entry THEN jp.quantity_used * COALESCE(jp.custom_item_price, 0)
            ELSE jp.quantity_used * COALESCE(inv.cost_price, jp.unit_price_at_time_of_use)
        END
    ), 0) INTO v_material_cost
    FROM public.fs_job_parts jp
    LEFT JOIN public.fs_inventory_items inv ON inv.id = jp.item_id
    WHERE jp.job_id = p_job_id;

    -- Calculate margin
    v_gross_margin := v_revenue - v_labor_cost - v_material_cost;
    v_margin_pct := CASE
        WHEN v_revenue > 0 THEN ROUND((v_gross_margin / v_revenue) * 100, 2)
        ELSE 0
    END;

    RETURN jsonb_build_object(
        'job_id', p_job_id,
        'total_revenue', v_revenue,
        'total_labor_cost', v_labor_cost,
        'total_material_cost', v_material_cost,
        'gross_margin', v_gross_margin,
        'gross_margin_pct', v_margin_pct,
        'is_over_budget', (v_labor_cost + v_material_cost > v_revenue AND v_revenue > 0)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================================
-- 4. RPC: get_profitability_overview
-- Returns top N jobs with margin analysis for admin dashboard.
-- ================================================================
CREATE OR REPLACE FUNCTION public.get_profitability_overview(p_limit INT DEFAULT 10)
RETURNS TABLE (
    job_id UUID,
    job_title TEXT,
    customer_name TEXT,
    job_status TEXT,
    total_revenue DECIMAL,
    total_labor_cost DECIMAL,
    total_material_cost DECIMAL,
    total_cost DECIMAL,
    gross_margin DECIMAL,
    gross_margin_pct DECIMAL,
    is_over_budget BOOLEAN,
    technician_count BIGINT,
    parts_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        j.id AS job_id,
        j.title AS job_title,
        COALESCE(c.name, 'No Customer')::TEXT AS customer_name,
        j.status AS job_status,
        COALESCE(est.total_amount, 0)::DECIMAL AS total_revenue,
        COALESCE(labor.cost, 0)::DECIMAL AS total_labor_cost,
        COALESCE(mats.cost, 0)::DECIMAL AS total_material_cost,
        (COALESCE(labor.cost, 0) + COALESCE(mats.cost, 0))::DECIMAL AS total_cost,
        (COALESCE(est.total_amount, 0) - COALESCE(labor.cost, 0) - COALESCE(mats.cost, 0))::DECIMAL AS gross_margin,
        CASE
            WHEN COALESCE(est.total_amount, 0) > 0
            THEN ROUND(((COALESCE(est.total_amount, 0) - COALESCE(labor.cost, 0) - COALESCE(mats.cost, 0))
                / est.total_amount) * 100, 2)
            ELSE 0
        END::DECIMAL AS gross_margin_pct,
        (COALESCE(labor.cost, 0) + COALESCE(mats.cost, 0) > COALESCE(est.total_amount, 0)
            AND COALESCE(est.total_amount, 0) > 0) AS is_over_budget,
        COALESCE(labor.tech_count, 0)::BIGINT AS technician_count,
        COALESCE(mats.parts_count, 0)::BIGINT AS parts_count
    FROM public.fs_jobs j
    LEFT JOIN public.fs_customers c ON c.id = j.customer_id
    -- Latest estimate per job
    LEFT JOIN LATERAL (
        SELECT e.total_amount
        FROM public.estimates e
        WHERE e.job_id = j.id
        ORDER BY
            CASE WHEN e.status = 'accepted' THEN 0 ELSE 1 END,
            e.created_at DESC
        LIMIT 1
    ) est ON TRUE
    -- Labor cost aggregation
    LEFT JOIN LATERAL (
        SELECT
            SUM(te.gross_pay) AS cost,
            COUNT(DISTINCT te.user_id) AS tech_count
        FROM public.time_entries te
        WHERE te.job_id = j.id AND te.status != 'rejected'
    ) labor ON TRUE
    -- Material cost aggregation (cost_price basis)
    LEFT JOIN LATERAL (
        SELECT
            SUM(
                CASE
                    WHEN jp.is_custom_entry THEN jp.quantity_used * COALESCE(jp.custom_item_price, 0)
                    ELSE jp.quantity_used * COALESCE(inv.cost_price, jp.unit_price_at_time_of_use)
                END
            ) AS cost,
            COUNT(*) AS parts_count
        FROM public.fs_job_parts jp
        LEFT JOIN public.fs_inventory_items inv ON inv.id = jp.item_id
        WHERE jp.job_id = j.id
    ) mats ON TRUE
    WHERE j.organization_id = public.get_current_org_id()
      AND j.deleted_at IS NULL
      AND (COALESCE(labor.cost, 0) > 0 OR COALESCE(mats.cost, 0) > 0 OR est.total_amount IS NOT NULL)
    ORDER BY
        CASE WHEN (COALESCE(labor.cost, 0) + COALESCE(mats.cost, 0) > COALESCE(est.total_amount, 0)
            AND COALESCE(est.total_amount, 0) > 0) THEN 0 ELSE 1 END,
        COALESCE(est.total_amount, 0) DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================================
-- 5. GRANT EXECUTE
-- ================================================================
GRANT EXECUTE ON FUNCTION public.get_job_profitability TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_profitability_overview TO authenticated;
