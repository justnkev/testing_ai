-- Add due_date to invoices if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'due_date') THEN
        ALTER TABLE invoices ADD COLUMN due_date TIMESTAMPTZ;
    END IF;

    -- Ensure total_amount exists (it should, but good to be safe)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'total_amount') THEN
        ALTER TABLE invoices ADD COLUMN total_amount NUMERIC(10, 2) DEFAULT 0.00;
    END IF;

    -- Add notes/terms if they don't exist, useful for "blank text boxes"
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'notes') THEN
        ALTER TABLE invoices ADD COLUMN notes TEXT;
    END IF;
END $$;
