-- ================================================================
-- PORTAL TABLES MIGRATION (Idempotent - safe to run multiple times)
-- ================================================================

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow anonymous to read portal tokens" ON public.portal_tokens;
DROP POLICY IF EXISTS "Allow authenticated users to manage portal tokens" ON public.portal_tokens;
DROP POLICY IF EXISTS "Allow anonymous to read own estimates" ON public.estimates;
DROP POLICY IF EXISTS "Allow anonymous to approve own estimates" ON public.estimates;
DROP POLICY IF EXISTS "Allow authenticated users to manage estimates" ON public.estimates;
DROP POLICY IF EXISTS "Allow anonymous to read own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Allow authenticated users to manage invoices" ON public.invoices;
DROP POLICY IF EXISTS "Allow all to read business settings" ON public.business_settings;
DROP POLICY IF EXISTS "Allow authenticated users to manage business settings" ON public.business_settings;

-- Drop existing indexes if they exist
DROP INDEX IF EXISTS idx_portal_tokens_token;
DROP INDEX IF EXISTS idx_portal_tokens_customer_id;
DROP INDEX IF EXISTS idx_estimates_customer_id;
DROP INDEX IF EXISTS idx_estimates_job_id;
DROP INDEX IF EXISTS idx_estimates_status;
DROP INDEX IF EXISTS idx_invoices_customer_id;
DROP INDEX IF EXISTS idx_invoices_job_id;
DROP INDEX IF EXISTS idx_invoices_payment_status;
DROP INDEX IF EXISTS idx_invoices_invoice_number;
DROP INDEX IF EXISTS idx_invoices_stripe_checkout_session_id;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS handle_estimates_updated_at ON public.estimates;
DROP TRIGGER IF EXISTS handle_invoices_updated_at ON public.invoices;
DROP TRIGGER IF EXISTS handle_business_settings_updated_at ON public.business_settings;

-- ================================================================
-- PORTAL_TOKENS TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS public.portal_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.fs_customers(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,
    last_accessed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_portal_tokens_token ON public.portal_tokens(token);
CREATE INDEX idx_portal_tokens_customer_id ON public.portal_tokens(customer_id);
ALTER TABLE public.portal_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous to read portal tokens"
    ON public.portal_tokens FOR SELECT TO anon USING (true);

CREATE POLICY "Allow authenticated users to manage portal tokens"
    ON public.portal_tokens FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ================================================================
-- ESTIMATES TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS public.estimates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.fs_customers(id) ON DELETE CASCADE,
    job_id UUID REFERENCES public.fs_jobs(id) ON DELETE SET NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
    line_items JSONB DEFAULT '[]'::jsonb,
    approved_at TIMESTAMP WITH TIME ZONE,
    signature_data TEXT,
    signature_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_estimates_customer_id ON public.estimates(customer_id);
CREATE INDEX idx_estimates_job_id ON public.estimates(job_id);
CREATE INDEX idx_estimates_status ON public.estimates(status);
ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous to read own estimates"
    ON public.estimates FOR SELECT TO anon
    USING (customer_id IN (
        SELECT customer_id FROM public.portal_tokens 
        WHERE token = current_setting('request.headers', true)::json->>'x-portal-token'
        AND expires_at > NOW() AND revoked_at IS NULL
    ));

CREATE POLICY "Allow anonymous to approve own estimates"
    ON public.estimates FOR UPDATE TO anon
    USING (customer_id IN (
        SELECT customer_id FROM public.portal_tokens 
        WHERE token = current_setting('request.headers', true)::json->>'x-portal-token'
        AND expires_at > NOW() AND revoked_at IS NULL
    ))
    WITH CHECK (customer_id IN (
        SELECT customer_id FROM public.portal_tokens 
        WHERE token = current_setting('request.headers', true)::json->>'x-portal-token'
        AND expires_at > NOW() AND revoked_at IS NULL
    ));

CREATE POLICY "Allow authenticated users to manage estimates"
    ON public.estimates FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ================================================================
-- INVOICES TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.fs_customers(id) ON DELETE CASCADE,
    job_id UUID REFERENCES public.fs_jobs(id) ON DELETE SET NULL,
    invoice_number TEXT NOT NULL UNIQUE,
    total_amount DECIMAL(10, 2) NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'partial', 'refunded')),
    stripe_checkout_session_id TEXT,
    stripe_payment_intent_id TEXT,
    line_items JSONB DEFAULT '[]'::jsonb,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_invoices_customer_id ON public.invoices(customer_id);
CREATE INDEX idx_invoices_job_id ON public.invoices(job_id);
CREATE INDEX idx_invoices_payment_status ON public.invoices(payment_status);
CREATE INDEX idx_invoices_invoice_number ON public.invoices(invoice_number);
CREATE INDEX idx_invoices_stripe_checkout_session_id ON public.invoices(stripe_checkout_session_id);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous to read own invoices"
    ON public.invoices FOR SELECT TO anon
    USING (customer_id IN (
        SELECT customer_id FROM public.portal_tokens 
        WHERE token = current_setting('request.headers', true)::json->>'x-portal-token'
        AND expires_at > NOW() AND revoked_at IS NULL
    ));

CREATE POLICY "Allow authenticated users to manage invoices"
    ON public.invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ================================================================
-- BUSINESS_SETTINGS TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS public.business_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_name TEXT NOT NULL DEFAULT 'Field Service Co.',
    logo_url TEXT,
    primary_color TEXT DEFAULT '#3B82F6',
    secondary_color TEXT DEFAULT '#10B981',
    contact_email TEXT,
    contact_phone TEXT,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

INSERT INTO public.business_settings (business_name, contact_email, contact_phone)
VALUES ('Field Service Co.', 'info@fieldservice.com', '(555) 123-4567')
ON CONFLICT DO NOTHING;

ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all to read business settings"
    ON public.business_settings FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow authenticated users to manage business settings"
    ON public.business_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ================================================================
-- TRIGGERS
-- ================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_estimates_updated_at
    BEFORE UPDATE ON public.estimates
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_invoices_updated_at
    BEFORE UPDATE ON public.invoices
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_business_settings_updated_at
    BEFORE UPDATE ON public.business_settings
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ================================================================
-- TEST DATA (for the existing customer)
-- ================================================================
INSERT INTO public.estimates (customer_id, job_id, total_amount, description, status, line_items)
SELECT 
    '93c5c2d3-adcb-4e68-9d3b-8b5f6b357396'::uuid,
    'ac142af3-2148-4364-8074-f8fde2833241'::uuid,
    350.00,
    'HVAC System Maintenance & Filter Replacement',
    'pending',
    '[{"description": "Premium HVAC filter replacement", "amount": 85.00}, {"description": "System inspection and cleaning", "amount": 150.00}, {"description": "Thermostat calibration", "amount": 65.00}, {"description": "Labor (2 hours)", "amount": 50.00}]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.estimates WHERE customer_id = '93c5c2d3-adcb-4e68-9d3b-8b5f6b357396'::uuid);

INSERT INTO public.invoices (customer_id, job_id, invoice_number, total_amount, payment_status, line_items)
SELECT 
    '93c5c2d3-adcb-4e68-9d3b-8b5f6b357396'::uuid,
    'ac142af3-2148-4364-8074-f8fde2833241'::uuid,
    'INV-TEST-001',
    275.00,
    'unpaid',
    '[{"description": "Emergency service call", "amount": 125.00}, {"description": "Parts replacement", "amount": 100.00}, {"description": "After-hours surcharge", "amount": 50.00}]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.invoices WHERE invoice_number = 'INV-TEST-001');
