-- Add condition_logic field to support AND/OR rule evaluation

-- Check if column exists and add if not (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='transaction_rules' AND column_name='condition_logic'
  ) THEN
    ALTER TABLE public.transaction_rules 
    ADD COLUMN condition_logic TEXT NOT NULL DEFAULT 'and';
  END IF;
END $$;

-- Add check constraint for valid values (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_condition_logic'
  ) THEN
    ALTER TABLE public.transaction_rules
      ADD CONSTRAINT chk_condition_logic CHECK (condition_logic IN ('and', 'or'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_transaction_rules_condition_logic
  ON public.transaction_rules (condition_logic);
