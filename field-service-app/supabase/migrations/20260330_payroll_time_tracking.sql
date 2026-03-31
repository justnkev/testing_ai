-- ================================================================
-- PAYROLL & TIME TRACKING MIGRATION
-- Adds labor costing and time entry support to the Field Service App
-- ================================================================

-- ================================================================
-- 1. ALTER PROFILES — Add Pay-Rate Columns
-- ================================================================
DO $$
BEGIN
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS base_hourly_rate DECIMAL(10,2) DEFAULT 0.00;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS overtime_multiplier DECIMAL(4,2) DEFAULT 1.50;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS travel_rate_multiplier DECIMAL(4,2) DEFAULT 1.00;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS rate_effective_date DATE DEFAULT CURRENT_DATE;
END $$;

-- ================================================================
-- 2. CREATE TIME_ENTRY_STATUS ENUM
-- ================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'time_entry_status') THEN
        CREATE TYPE public.time_entry_status AS ENUM ('pending', 'approved', 'rejected', 'manual_review');
    END IF;
END $$;

-- ================================================================
-- 3. CREATE TIME_ENTRIES TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS public.time_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    -- SET NULL on job delete: time entries survive for financial auditing
    job_id UUID REFERENCES public.fs_jobs(id) ON DELETE SET NULL,
    clock_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    clock_out_at TIMESTAMPTZ,
    is_travel_time BOOLEAN NOT NULL DEFAULT FALSE,
    status public.time_entry_status NOT NULL DEFAULT 'pending',
    -- Geolocation
    clock_in_latitude DECIMAL(10,7),
    clock_in_longitude DECIMAL(10,7),
    clock_out_latitude DECIMAL(10,7),
    clock_out_longitude DECIMAL(10,7),
    -- Computed labor cost (populated by calculate_labor_cost RPC)
    total_hours DECIMAL(8,4),
    gross_pay DECIMAL(10,2),
    applied_rate DECIMAL(10,2),
    applied_multiplier DECIMAL(4,2),
    -- Audit trail
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    flagged_reason TEXT,
    -- Snapshot of job data at clock-in time (survives job archival/deletion)
    job_snapshot JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================================
-- 4. INDEXES
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_time_entries_user_id ON public.time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_job_id ON public.time_entries(job_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_org_id ON public.time_entries(organization_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_status ON public.time_entries(status);
CREATE INDEX IF NOT EXISTS idx_time_entries_clock_in ON public.time_entries(clock_in_at);
-- Composite index for overtime calculation (weekly hours per user)
CREATE INDEX IF NOT EXISTS idx_time_entries_user_week ON public.time_entries(user_id, clock_in_at);

-- ================================================================
-- 5. ROW LEVEL SECURITY
-- ================================================================
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

-- Technicians: CRUD on own entries within their org
DROP POLICY IF EXISTS "Technicians can manage own time entries" ON public.time_entries;
CREATE POLICY "Technicians can manage own time entries"
    ON public.time_entries FOR ALL
    TO authenticated
    USING (
        organization_id = public.get_current_org_id()
        AND user_id = auth.uid()
        AND public.get_current_user_role() = 'technician'
    )
    WITH CHECK (
        organization_id = public.get_current_org_id()
        AND user_id = auth.uid()
    );

-- Admins/Managers: full access to all org entries
DROP POLICY IF EXISTS "Admins and Managers can manage org time entries" ON public.time_entries;
CREATE POLICY "Admins and Managers can manage org time entries"
    ON public.time_entries FOR ALL
    TO authenticated
    USING (
        organization_id = public.get_current_org_id()
        AND public.get_current_user_role() IN ('admin', 'manager')
    );

-- ================================================================
-- 6. TRIGGERS
-- ================================================================

-- Auto-set organization_id on insert (reuses existing function)
DROP TRIGGER IF EXISTS tr_set_org_id_time_entries ON public.time_entries;
CREATE TRIGGER tr_set_org_id_time_entries
    BEFORE INSERT ON public.time_entries
    FOR EACH ROW EXECUTE FUNCTION public.set_current_org_id();

-- Auto-update updated_at on update (reuses existing function)
DROP TRIGGER IF EXISTS handle_time_entries_updated_at ON public.time_entries;
CREATE TRIGGER handle_time_entries_updated_at
    BEFORE UPDATE ON public.time_entries
    FOR EACH ROW EXECUTE FUNCTION public.fs_update_updated_at_column();

-- ================================================================
-- 7. RPC: calculate_labor_cost
-- Computes total hours, gross pay, and flags for a single time entry.
-- Uses fixed workweek (Monday 00:00 UTC) for overtime determination.
-- ================================================================
CREATE OR REPLACE FUNCTION public.calculate_labor_cost(entry_id UUID)
RETURNS JSONB AS $$
DECLARE
    entry RECORD;
    profile RECORD;
    hours DECIMAL(8,4);
    rate DECIMAL(10,2);
    multiplier DECIMAL(4,2);
    pay DECIMAL(10,2);
    weekly_hours DECIMAL(8,4);
    week_start TIMESTAMPTZ;
    flag TEXT;
BEGIN
    SELECT * INTO entry FROM public.time_entries WHERE id = entry_id;
    IF entry IS NULL THEN
        RETURN jsonb_build_object('error', 'Entry not found');
    END IF;
    IF entry.clock_out_at IS NULL THEN
        RETURN jsonb_build_object('error', 'Entry still clocked in');
    END IF;

    SELECT * INTO profile FROM public.profiles WHERE id = entry.user_id;
    IF profile IS NULL THEN
        RETURN jsonb_build_object('error', 'User profile not found');
    END IF;

    -- Calculate hours worked
    hours := EXTRACT(EPOCH FROM (entry.clock_out_at - entry.clock_in_at)) / 3600.0;
    rate := COALESCE(profile.base_hourly_rate, 0);
    multiplier := 1.0;
    flag := NULL;

    -- Flag forgotten clock-outs (>12 hours)
    IF hours > 12 THEN
        flag := 'forgotten_clock_out';
    END IF;

    -- Apply travel rate multiplier if flagged as travel time
    IF entry.is_travel_time THEN
        multiplier := COALESCE(profile.travel_rate_multiplier, 1.0);
    END IF;

    -- Check weekly hours for overtime (fixed workweek: Monday 00:00 UTC)
    week_start := date_trunc('week', entry.clock_in_at);
    SELECT COALESCE(SUM(
        EXTRACT(EPOCH FROM (COALESCE(te.clock_out_at, NOW()) - te.clock_in_at)) / 3600.0
    ), 0) INTO weekly_hours
    FROM public.time_entries te
    WHERE te.user_id = entry.user_id
      AND te.clock_in_at >= week_start
      AND te.id != entry.id  -- exclude current entry
      AND te.clock_in_at < (week_start + INTERVAL '7 days')
      AND te.status != 'rejected';

    -- If adding this entry pushes past 40 weekly hours, apply OT multiplier
    IF weekly_hours + hours > 40 AND NOT entry.is_travel_time THEN
        multiplier := COALESCE(profile.overtime_multiplier, 1.5);
        IF flag IS NULL THEN
            flag := 'overtime_warning';
        END IF;
    END IF;

    pay := ROUND(hours * rate * multiplier, 2);

    -- Persist the calculation
    UPDATE public.time_entries SET
        total_hours = hours,
        gross_pay = pay,
        applied_rate = rate,
        applied_multiplier = multiplier,
        flagged_reason = COALESCE(flag, flagged_reason),
        status = CASE
            WHEN flag = 'forgotten_clock_out' THEN 'manual_review'::public.time_entry_status
            ELSE status
        END
    WHERE id = entry_id;

    RETURN jsonb_build_object(
        'total_hours', hours,
        'gross_pay', pay,
        'rate', rate,
        'multiplier', multiplier,
        'weekly_hours_before', weekly_hours,
        'is_overtime', (weekly_hours + hours > 40),
        'flagged_reason', flag
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================================
-- 8. RPC: get_pay_period_summary
-- Returns aggregated payroll summary per employee for a date range.
-- Used for the admin "Pay Period Summary" export.
-- ================================================================
CREATE OR REPLACE FUNCTION public.get_pay_period_summary(
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
    user_id UUID,
    full_name TEXT,
    base_rate DECIMAL,
    total_regular_hours DECIMAL,
    total_overtime_hours DECIMAL,
    total_travel_hours DECIMAL,
    total_gross_pay DECIMAL,
    entry_count BIGINT,
    pending_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        te.user_id,
        p.full_name,
        p.base_hourly_rate AS base_rate,
        COALESCE(SUM(
            CASE WHEN te.applied_multiplier <= 1.0 AND NOT te.is_travel_time
            THEN te.total_hours ELSE 0 END
        ), 0)::DECIMAL AS total_regular_hours,
        COALESCE(SUM(
            CASE WHEN te.applied_multiplier > 1.0 AND NOT te.is_travel_time
            THEN te.total_hours ELSE 0 END
        ), 0)::DECIMAL AS total_overtime_hours,
        COALESCE(SUM(
            CASE WHEN te.is_travel_time
            THEN te.total_hours ELSE 0 END
        ), 0)::DECIMAL AS total_travel_hours,
        COALESCE(SUM(te.gross_pay), 0)::DECIMAL AS total_gross_pay,
        COUNT(*)::BIGINT AS entry_count,
        COUNT(*) FILTER (WHERE te.status = 'pending')::BIGINT AS pending_count
    FROM public.time_entries te
    JOIN public.profiles p ON p.id = te.user_id
    WHERE te.organization_id = public.get_current_org_id()
      AND te.clock_in_at >= p_start_date
      AND te.clock_in_at < p_end_date
      AND te.status != 'rejected'
    GROUP BY te.user_id, p.full_name, p.base_hourly_rate
    ORDER BY p.full_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================================
-- 9. GRANT EXECUTE on RPCs
-- ================================================================
GRANT EXECUTE ON FUNCTION public.calculate_labor_cost TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pay_period_summary TO authenticated;
