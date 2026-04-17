-- Refund tracking + quality hardening

CREATE TABLE IF NOT EXISTS public.transaction_refunds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_group_id UUID NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  original_transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  refund_transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  reason TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT transaction_refunds_unique_refund UNIQUE (refund_transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_transaction_refunds_family
  ON public.transaction_refunds (family_group_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transaction_refunds_original
  ON public.transaction_refunds (original_transaction_id);

ALTER TABLE public.transaction_refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view family refunds" ON public.transaction_refunds;
DROP POLICY IF EXISTS "Members can create family refunds" ON public.transaction_refunds;

CREATE POLICY "Members can view family refunds"
  ON public.transaction_refunds FOR SELECT
  USING (family_group_id IN (SELECT public.get_user_family_ids(auth.uid())));

CREATE POLICY "Members can create family refunds"
  ON public.transaction_refunds FOR INSERT
  WITH CHECK (family_group_id IN (SELECT public.get_user_family_ids(auth.uid())));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'transaction_audit_action_chk'
  ) THEN
    ALTER TABLE public.transaction_audit
      ADD CONSTRAINT transaction_audit_action_chk
      CHECK (action IN ('CREATE', 'UPDATE', 'DELETE'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'transaction_audit_source_chk'
  ) THEN
    ALTER TABLE public.transaction_audit
      ADD CONSTRAINT transaction_audit_source_chk
      CHECK (trigger_source IN ('manual', 'trigger', 'automation'));
  END IF;
END $$;
