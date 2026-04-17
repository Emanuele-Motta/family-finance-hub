-- Backend persistent rules and audit history for family groups

-- Transaction rules (backend-powered automation)
CREATE TABLE IF NOT EXISTS public.transaction_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_group_id UUID NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  -- Conditions (JSON object with properties to match)
  conditions JSONB NOT NULL,
  -- Actions (JSON object with transformations to apply)
  actions JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transaction_rules_family_group
  ON public.transaction_rules (family_group_id);

CREATE INDEX IF NOT EXISTS idx_transaction_rules_priority
  ON public.transaction_rules (family_group_id, priority DESC);

ALTER TABLE public.transaction_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view family rules" ON public.transaction_rules;
DROP POLICY IF EXISTS "Admins can manage family rules" ON public.transaction_rules;

CREATE POLICY "Members can view family rules"
  ON public.transaction_rules FOR SELECT
  USING (family_group_id IN (SELECT public.get_user_family_ids(auth.uid())));

CREATE POLICY "Admins can manage family rules"
  ON public.transaction_rules FOR ALL
  USING (public.is_family_admin(family_group_id, auth.uid()))
  WITH CHECK (public.is_family_admin(family_group_id, auth.uid()));

DROP TRIGGER IF EXISTS update_transaction_rules_updated_at ON public.transaction_rules;
CREATE TRIGGER update_transaction_rules_updated_at
  BEFORE UPDATE ON public.transaction_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Audit history for all transaction changes
CREATE TABLE IF NOT EXISTS public.transaction_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_group_id UUID NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  trigger_source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transaction_audit_family_group
  ON public.transaction_audit (family_group_id);

CREATE INDEX IF NOT EXISTS idx_transaction_audit_transaction_id
  ON public.transaction_audit (transaction_id);

CREATE INDEX IF NOT EXISTS idx_transaction_audit_created_at
  ON public.transaction_audit (created_at DESC);

ALTER TABLE public.transaction_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view family audit" ON public.transaction_audit;

CREATE POLICY "Members can view family audit"
  ON public.transaction_audit FOR SELECT
  USING (family_group_id IN (SELECT public.get_user_family_ids(auth.uid())));

-- Function to log transaction changes
CREATE OR REPLACE FUNCTION public.log_transaction_audit(_family_group_id uuid, _transaction_id uuid, _action text, _old_values jsonb, _new_values jsonb, _trigger_source text DEFAULT 'manual')
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.transaction_audit (family_group_id, transaction_id, action, old_values, new_values, user_id, trigger_source)
  VALUES (_family_group_id, _transaction_id, _action, _old_values, _new_values, auth.uid(), _trigger_source);
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_transaction_trigger()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_transaction_audit(NEW.family_group_id, NEW.id, 'CREATE', NULL, row_to_json(NEW), 'trigger');
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.log_transaction_audit(NEW.family_group_id, NEW.id, 'UPDATE', row_to_json(OLD), row_to_json(NEW), 'trigger');
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_transaction_audit(OLD.family_group_id, OLD.id, 'DELETE', row_to_json(OLD), NULL, 'trigger');
  END IF;
  RETURN NULL;
END;
$$;

-- Trigger to auto-log transaction changes
DROP TRIGGER IF EXISTS audit_transaction_changes ON public.transactions;
CREATE TRIGGER audit_transaction_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_transaction_trigger();
