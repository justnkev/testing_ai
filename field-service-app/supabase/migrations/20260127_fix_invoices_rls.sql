-- Drop existing policies to avoid conflicts/confusion
DROP POLICY IF EXISTS "Access own invoices" ON invoices;
DROP POLICY IF EXISTS "Admins and Managers can manage org invoices" ON invoices;
DROP POLICY IF EXISTS "Staff full access to invoices" ON invoices;

-- Enable RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Create standard Multi-Tenancy Policy
CREATE POLICY "Users can view invoices in their org"
ON invoices FOR SELECT
TO authenticated
USING (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()) OR
    organization_id IS NULL -- For legacy/dev data
);

CREATE POLICY "Users can insert invoices in their org"
ON invoices FOR INSERT
TO authenticated
WITH CHECK (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "Users can update invoices in their org"
ON invoices FOR UPDATE
TO authenticated
USING (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
)
WITH CHECK (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
);
