-- Create estimates table
CREATE TABLE IF NOT EXISTS estimates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES fs_jobs(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL, -- For Multi-tenancy RLS
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED')),
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create estimate_items table
CREATE TABLE IF NOT EXISTS estimate_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    estimate_id UUID REFERENCES estimates(id) ON DELETE CASCADE,
    inventory_item_id UUID REFERENCES fs_inventory_items(id) ON DELETE SET NULL, -- Optional link to inventory
    description TEXT NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL DEFAULT 1,
    unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_estimates_job_id ON estimates(job_id);
CREATE INDEX IF NOT EXISTS idx_estimate_items_estimate_id ON estimate_items(estimate_id);

-- RLS Policies
ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_items ENABLE ROW LEVEL SECURITY;

-- Estimates Policies
CREATE POLICY "Users can view estimates in their org" ON estimates
    FOR SELECT USING (
        organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    );

CREATE POLICY "Users can insert estimates in their org" ON estimates
    FOR INSERT WITH CHECK (
        organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    );

CREATE POLICY "Users can update estimates in their org" ON estimates
    FOR UPDATE USING (
        organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    );

CREATE POLICY "Users can delete estimates in their org" ON estimates
    FOR DELETE USING (
        organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    );

-- Estimate Items Policies (inherit from estimate via RLS or direct join check)
-- Simpler to just use join check since we don't store org_id on items typically, 
-- but consistent multi-tenancy usually implies strictly checking org.
-- Alternatively, if we trust the cascade deletion and creation via parent, we can just check if user has access to parent estimate.

CREATE POLICY "Users can view items of accessible estimates" ON estimate_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM estimates e
            WHERE e.id = estimate_items.estimate_id
            AND e.organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
        )
    );

CREATE POLICY "Users can insert items to accessible estimates" ON estimate_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM estimates e
            WHERE e.id = estimate_items.estimate_id
            AND e.organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
        )
    );

CREATE POLICY "Users can manage items of accessible estimates" ON estimate_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM estimates e
            WHERE e.id = estimate_items.estimate_id
            AND e.organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
        )
    );
