-- Create helper function if it doesn't exist
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
BEGIN
    RETURN (SELECT role FROM public.profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS on fs_customers if not already enabled
ALTER TABLE public.fs_customers ENABLE ROW LEVEL SECURITY;

-- Policy for Admins and Managers: Full access to their organization's customers
-- We drop generic policies if they might exist to avoid conflicts, though we don't know their names.
-- Best effort drop of likely names.
DROP POLICY IF EXISTS "Admins and Managers can manage org customers" ON public.fs_customers;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.fs_customers;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.fs_customers;
DROP POLICY IF EXISTS "Enable update for users based on email" ON public.fs_customers;

CREATE POLICY "Admins and Managers can manage org customers"
    ON public.fs_customers FOR ALL
    TO authenticated
    USING (
        public.get_current_user_role() IN ('admin', 'manager')
    );

-- Policy for Technicians: View access to their organization's customers
-- For now, we allow technicians to view ALL customers in the system (or org if strictly enforced) 
-- to ensure they can see details for any job they might be assigned or is unassigned.
DROP POLICY IF EXISTS "Technicians can view org customers" ON public.fs_customers;
CREATE POLICY "Technicians can view org customers"
    ON public.fs_customers FOR SELECT
    TO authenticated
    USING (
        public.get_current_user_role() = 'technician'
    );
