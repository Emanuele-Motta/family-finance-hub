-- Advanced Features Schema
-- Author: Emanuele Motta
-- Date: 16-Apr-2026
-- 
-- Adds infrastructure for:
-- - Bank reconciliation & duplicate detection
-- - Automatic rules (Gmail-style)
-- - Advanced recurring transactions
-- - Cashflow forecasting
-- - Import review with inline editing
-- - Audit logging & versioning
-- - Transaction comments & collaboration
-- - Notifications system
-- - Anomaly detection

-- ============================================================================
-- AUDIT LOG & VERSIONING
-- ============================================================================

-- Complete audit log for all operations
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_group_id UUID NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  entity_name TEXT,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_family ON public.audit_logs(family_group_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view family audit logs"
  ON public.audit_logs FOR SELECT
  USING (family_group_id IN (SELECT public.get_user_family_ids(auth.uid())));
CREATE POLICY "Only system can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (false);

-- Versioning for sensitive records
CREATE TABLE IF NOT EXISTS public.record_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_group_id UUID NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  record_type TEXT NOT NULL,
  record_id UUID NOT NULL,
  version_number INT NOT NULL,
  data JSONB NOT NULL,
  changed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  change_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(record_type, record_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_record_versions_family ON public.record_versions(family_group_id);
CREATE INDEX IF NOT EXISTS idx_record_versions_record ON public.record_versions(record_type, record_id);
CREATE INDEX IF NOT EXISTS idx_record_versions_changed_by ON public.record_versions(changed_by);

ALTER TABLE public.record_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view record versions"
  ON public.record_versions FOR SELECT
  USING (family_group_id IN (SELECT public.get_user_family_ids(auth.uid())));

-- ============================================================================
-- IMPORT & RECONCILIATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.import_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_group_id UUID NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  imported_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  import_source TEXT NOT NULL,
  total_rows INT NOT NULL DEFAULT 0,
  processed_rows INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_batches_family ON public.import_batches(family_group_id);
CREATE INDEX IF NOT EXISTS idx_import_batches_account ON public.import_batches(account_id);
CREATE INDEX IF NOT EXISTS idx_import_batches_status ON public.import_batches(status);

ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view import batches"
  ON public.import_batches FOR SELECT
  USING (family_group_id IN (SELECT public.get_user_family_ids(auth.uid())));
CREATE POLICY "Members can manage import batches"
  ON public.import_batches FOR ALL
  USING (family_group_id IN (SELECT public.get_user_family_ids(auth.uid())))
  WITH CHECK (family_group_id IN (SELECT public.get_user_family_ids(auth.uid())));

-- Pending import rows with inline editing
CREATE TABLE IF NOT EXISTS public.import_pending_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  import_batch_id UUID NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,
  family_group_id UUID NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  row_index INT NOT NULL,
  raw_data JSONB NOT NULL,
  date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  description TEXT NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  tags TEXT[],
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  matched_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  duplicate_score NUMERIC(3,2),
  is_reviewed BOOLEAN NOT NULL DEFAULT false,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_pending_batch ON public.import_pending_transactions(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_import_pending_family ON public.import_pending_transactions(family_group_id);
CREATE INDEX IF NOT EXISTS idx_import_pending_status ON public.import_pending_transactions(status);

ALTER TABLE public.import_pending_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view pending imports"
  ON public.import_pending_transactions FOR SELECT
  USING (family_group_id IN (SELECT public.get_user_family_ids(auth.uid())));
CREATE POLICY "Members can edit pending imports"
  ON public.import_pending_transactions FOR ALL
  USING (family_group_id IN (SELECT public.get_user_family_ids(auth.uid())))
  WITH CHECK (family_group_id IN (SELECT public.get_user_family_ids(auth.uid())));

-- Reconciliation matches
CREATE TABLE IF NOT EXISTS public.reconciliations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_group_id UUID NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  import_transaction_id UUID NOT NULL REFERENCES public.import_pending_transactions(id) ON DELETE CASCADE,
  matched_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  match_confidence NUMERIC(3,2) NOT NULL DEFAULT 0,
  match_method TEXT NOT NULL,
  match_score_details JSONB,
  confirmed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_duplicate BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reconciliations_family ON public.reconciliations(family_group_id);
CREATE INDEX IF NOT EXISTS idx_reconciliations_import ON public.reconciliations(import_transaction_id);
CREATE INDEX IF NOT EXISTS idx_reconciliations_matched ON public.reconciliations(matched_transaction_id);

ALTER TABLE public.reconciliations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view reconciliations"
  ON public.reconciliations FOR SELECT
  USING (family_group_id IN (SELECT public.get_user_family_ids(auth.uid())));

-- ============================================================================
-- AUTOMATIC RULES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.transaction_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_group_id UUID NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INT NOT NULL DEFAULT 100,
  condition_type TEXT NOT NULL,
  conditions JSONB NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  tags TEXT[],
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  auto_apply BOOLEAN NOT NULL DEFAULT true,
  require_review BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(family_group_id, name)
);

CREATE INDEX IF NOT EXISTS idx_transaction_rules_family ON public.transaction_rules(family_group_id);
CREATE INDEX IF NOT EXISTS idx_transaction_rules_active ON public.transaction_rules(family_group_id, is_active);

ALTER TABLE public.transaction_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view rules"
  ON public.transaction_rules FOR SELECT
  USING (family_group_id IN (SELECT public.get_user_family_ids(auth.uid())));
CREATE POLICY "Admins can manage rules"
  ON public.transaction_rules FOR ALL
  USING (public.is_family_admin(family_group_id, auth.uid()))
  WITH CHECK (public.is_family_admin(family_group_id, auth.uid()));

CREATE TABLE IF NOT EXISTS public.rule_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_group_id UUID NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  rule_id UUID NOT NULL REFERENCES public.transaction_rules(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rule_applications_rule ON public.rule_applications(rule_id);
CREATE INDEX IF NOT EXISTS idx_rule_applications_transaction ON public.rule_applications(transaction_id);

-- ============================================================================
-- RECURRING TRANSACTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.recurring_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_group_id UUID NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  frequency TEXT NOT NULL,
  interval INT NOT NULL DEFAULT 1,
  day_of_month INT,
  day_of_week TEXT,
  months TEXT[],
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  to_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL,
  type TEXT NOT NULL DEFAULT 'expense',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.recurring_transaction_detail (
  id INT PRIMARY KEY DEFAULT 1,
  description TEXT NOT NULL
);

INSERT INTO public.recurring_transaction_detail (id, description) VALUES (1, 'Tags and notes') ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_recurring_family ON public.recurring_templates(family_group_id);
CREATE INDEX IF NOT EXISTS idx_recurring_active ON public.recurring_templates(family_group_id);

ALTER TABLE public.recurring_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view recurring"
  ON public.recurring_templates FOR SELECT
  USING (family_group_id IN (SELECT public.get_user_family_ids(auth.uid())));
CREATE POLICY "Members can manage recurring"
  ON public.recurring_templates FOR ALL
  USING (family_group_id IN (SELECT public.get_user_family_ids(auth.uid())))
  WITH CHECK (family_group_id IN (SELECT public.get_user_family_ids(auth.uid())));

-- Generated occurrences
CREATE TABLE IF NOT EXISTS public.recurring_occurrences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.recurring_templates(id) ON DELETE CASCADE,
  family_group_id UUID NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  occurrence_date DATE NOT NULL,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  skip_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(template_id, occurrence_date)
);

CREATE INDEX IF NOT EXISTS idx_recurring_occ_template ON public.recurring_occurrences(template_id);
CREATE INDEX IF NOT EXISTS idx_recurring_occ_family ON public.recurring_occurrences(family_group_id);
CREATE INDEX IF NOT EXISTS idx_recurring_occ_date ON public.recurring_occurrences(occurrence_date);
CREATE INDEX IF NOT EXISTS idx_recurring_occ_status ON public.recurring_occurrences(status);

-- ============================================================================
-- CASHFLOW FORECAST
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cashflow_forecasts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_group_id UUID NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  forecast_date DATE NOT NULL,
  forecast_days INT NOT NULL,
  current_balance NUMERIC(12,2) NOT NULL,
  forecast_balance NUMERIC(12,2) NOT NULL,
  projected_income NUMERIC(12,2) NOT NULL DEFAULT 0,
  projected_expenses NUMERIC(12,2) NOT NULL DEFAULT 0,
  confidence_level TEXT NOT NULL DEFAULT 'medium',
  calculation_method TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(family_group_id, account_id, forecast_date, forecast_days)
);

CREATE INDEX IF NOT EXISTS idx_cashflow_family ON public.cashflow_forecasts(family_group_id);
CREATE INDEX IF NOT EXISTS idx_cashflow_account ON public.cashflow_forecasts(account_id);
CREATE INDEX IF NOT EXISTS idx_cashflow_date ON public.cashflow_forecasts(forecast_date);

ALTER TABLE public.cashflow_forecasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view forecasts"
  ON public.cashflow_forecasts FOR SELECT
  USING (family_group_id IN (SELECT public.get_user_family_ids(auth.uid())));

-- ============================================================================
-- COLLABORATION & COMMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.transaction_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  family_group_id UUID NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  is_system_comment BOOLEAN NOT NULL DEFAULT false,
  is_settlement_comment BOOLEAN NOT NULL DEFAULT false,
  settled_between_user_a UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  settled_between_user_b UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  settlement_amount NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_transaction ON public.transaction_comments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_comments_user ON public.transaction_comments(user_id);

ALTER TABLE public.transaction_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view comments"
  ON public.transaction_comments FOR SELECT
  USING (family_group_id IN (SELECT public.get_user_family_ids(auth.uid())));
CREATE POLICY "Members can create comments"
  ON public.transaction_comments FOR INSERT
  WITH CHECK (family_group_id IN (SELECT public.get_user_family_ids(auth.uid())));

-- Approval requests
CREATE TABLE IF NOT EXISTS public.transaction_approvals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  family_group_id UUID NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  approval_threshold NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approval_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_approvals_transaction ON public.transaction_approvals(transaction_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON public.transaction_approvals(family_group_id, status);

ALTER TABLE public.transaction_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view approvals"
  ON public.transaction_approvals FOR SELECT
  USING (family_group_id IN (SELECT public.get_user_family_ids(auth.uid())));

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_group_id UUID NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_entity_type TEXT,
  related_entity_id UUID,
  status TEXT NOT NULL DEFAULT 'created',
  delivery_channels TEXT[] NOT NULL DEFAULT '{}',
  sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_family ON public.notifications(family_group_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON public.notifications(status);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "Users can mark own notifications read"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- ANOMALY DETECTION
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.anomalies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_group_id UUID NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE,
  anomaly_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  description TEXT NOT NULL,
  confidence NUMERIC(3,2) NOT NULL DEFAULT 0,
  analysis JSONB,
  is_acknowledged BOOLEAN NOT NULL DEFAULT false,
  acknowledged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anomalies_family ON public.anomalies(family_group_id);
CREATE INDEX IF NOT EXISTS idx_anomalies_transaction ON public.anomalies(transaction_id);
CREATE INDEX IF NOT EXISTS idx_anomalies_severity ON public.anomalies(family_group_id, severity);

ALTER TABLE public.anomalies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view anomalies"
  ON public.anomalies FOR SELECT
  USING (family_group_id IN (SELECT public.get_user_family_ids(auth.uid())));

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_audit_event(
  _family_group_id UUID,
  _action TEXT,
  _entity_type TEXT,
  _entity_id UUID DEFAULT NULL,
  _entity_name TEXT DEFAULT NULL,
  _old_values JSONB DEFAULT NULL,
  _new_values JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _log_id UUID;
BEGIN
  INSERT INTO public.audit_logs (
    family_group_id, user_id, action, entity_type, entity_id, entity_name, old_values, new_values
  )
  VALUES (
    _family_group_id,
    auth.uid(),
    _action,
    _entity_type,
    _entity_id,
    _entity_name,
    _old_values,
    _new_values
  )
  RETURNING id INTO _log_id;
  
  RETURN _log_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_record_version(
  _family_group_id UUID,
  _record_type TEXT,
  _record_id UUID,
  _data JSONB,
  _change_reason TEXT DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _next_version INT;
BEGIN
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO _next_version
  FROM public.record_versions
  WHERE record_type = _record_type AND record_id = _record_id;
  
  INSERT INTO public.record_versions (
    family_group_id, record_type, record_id, version_number, data, changed_by, change_reason
  )
  VALUES (
    _family_group_id,
    _record_type,
    _record_id,
    _next_version,
    _data,
    auth.uid(),
    _change_reason
  );
  
  RETURN _next_version;
END;
$$;

-- Triggers for timestamps
DROP TRIGGER IF EXISTS update_import_batches_updated_at ON public.import_batches;
CREATE TRIGGER update_import_batches_updated_at
  BEFORE UPDATE ON public.import_batches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_import_pending_updated_at ON public.import_pending_transactions;
CREATE TRIGGER update_import_pending_updated_at
  BEFORE UPDATE ON public.import_pending_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_transaction_rules_updated_at ON public.transaction_rules;
CREATE TRIGGER update_transaction_rules_updated_at
  BEFORE UPDATE ON public.transaction_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_recurring_templates_updated_at ON public.recurring_templates;
CREATE TRIGGER update_recurring_templates_updated_at
  BEFORE UPDATE ON public.recurring_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_comments_updated_at ON public.transaction_comments;
CREATE TRIGGER update_comments_updated_at
  BEFORE UPDATE ON public.transaction_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_notifications_updated_at ON public.notifications;
CREATE TRIGGER update_notifications_updated_at
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
