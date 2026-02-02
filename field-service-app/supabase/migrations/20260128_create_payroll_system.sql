-- Add payroll fields to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS hourly_rate numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS pay_frequency text DEFAULT 'weekly',
ADD COLUMN IF NOT EXISTS stripe_connect_id text;

-- Create payroll_runs table
CREATE TABLE IF NOT EXISTS public.payroll_runs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    period_start timestamptz NOT NULL,
    period_end timestamptz NOT NULL,
    status text NOT NULL CHECK (status IN ('pending', 'processing', 'paid', 'failed')),
    total_amount numeric DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

-- Create timesheets table
CREATE TABLE IF NOT EXISTS public.timesheets (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) NOT NULL,
    payroll_run_id uuid REFERENCES public.payroll_runs(id),
    period_start timestamptz NOT NULL,
    period_end timestamptz NOT NULL,
    total_hours numeric DEFAULT 0,
    regular_hours numeric DEFAULT 0,
    overtime_hours numeric DEFAULT 0,
    gross_pay numeric DEFAULT 0,
    status text NOT NULL CHECK (status IN ('draft', 'approved', 'paid')) DEFAULT 'draft',
    created_at timestamptz DEFAULT now()
);

-- Create payroll_adjustments table
CREATE TABLE IF NOT EXISTS public.payroll_adjustments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    timesheet_id uuid REFERENCES public.timesheets(id) ON DELETE CASCADE NOT NULL,
    amount numeric NOT NULL,
    description text NOT NULL,
    type text NOT NULL CHECK (type IN ('bonus', 'deduction')),
    created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_adjustments ENABLE ROW LEVEL SECURITY;

-- Policies
-- Admins can do everything
CREATE POLICY "Admins can manage payroll_runs" ON public.payroll_runs
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can manage timesheets" ON public.timesheets
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can manage payroll_adjustments" ON public.payroll_adjustments
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Technicians can view their own timesheets
CREATE POLICY "Technicians can view own timesheets" ON public.timesheets
    FOR SELECT USING (
        user_id = auth.uid()
    );

-- Technicians can view adjustments on their timesheets
CREATE POLICY "Technicians can view own adjustments" ON public.payroll_adjustments
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.timesheets WHERE id = payroll_adjustments.timesheet_id AND user_id = auth.uid())
    );
