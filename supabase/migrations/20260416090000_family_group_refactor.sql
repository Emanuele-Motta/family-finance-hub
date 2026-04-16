-- Family-centric refactor: shared accounts, shared tags, transfer support,
-- and audit fields for transaction authorship.

-- Admin helper for family-scoped permissions
CREATE OR REPLACE FUNCTION public.is_family_admin(_family_group_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_group_id = _family_group_id
      AND fm.user_id = _user_id
      AND fm.role = 'admin'
  );
$$;

-- Shared accounts for each family group
CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_group_id UUID NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_accounts_primary_per_family
  ON public.accounts (family_group_id)
  WHERE is_primary = true;

CREATE INDEX IF NOT EXISTS idx_accounts_family_group
  ON public.accounts (family_group_id);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view group accounts" ON public.accounts;
DROP POLICY IF EXISTS "Admins can manage group accounts" ON public.accounts;
CREATE POLICY "Members can view group accounts"
  ON public.accounts FOR SELECT
  USING (family_group_id IN (SELECT public.get_user_family_ids(auth.uid())));
CREATE POLICY "Admins can manage group accounts"
  ON public.accounts FOR ALL
  USING (public.is_family_admin(family_group_id, auth.uid()))
  WITH CHECK (public.is_family_admin(family_group_id, auth.uid()));

DROP TRIGGER IF EXISTS update_accounts_updated_at ON public.accounts;
CREATE TRIGGER update_accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ensure every family has a primary account
INSERT INTO public.accounts (family_group_id, name, is_primary)
SELECT fg.id, 'Conto principale', true
FROM public.family_groups fg
WHERE NOT EXISTS (
  SELECT 1 FROM public.accounts a WHERE a.family_group_id = fg.id
);

-- Shared tag catalog per family
CREATE TABLE IF NOT EXISTS public.tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_group_id UUID NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#64748B',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (family_group_id, name)
);

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view tags" ON public.tags;
DROP POLICY IF EXISTS "Admins can manage tags" ON public.tags;
CREATE POLICY "Members can view tags"
  ON public.tags FOR SELECT
  USING (family_group_id IN (SELECT public.get_user_family_ids(auth.uid())));
CREATE POLICY "Admins can manage tags"
  ON public.tags FOR ALL
  USING (public.is_family_admin(family_group_id, auth.uid()))
  WITH CHECK (public.is_family_admin(family_group_id, auth.uid()));

-- Add transfer support to transaction type enum
ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'transfer';

-- Extend transactions with shared-account + audit fields
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS to_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS paid_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Backfill audit/account values for legacy rows
UPDATE public.transactions t
SET created_by_user_id = t.user_id
WHERE t.created_by_user_id IS NULL;

UPDATE public.transactions t
SET account_id = a.id
FROM public.accounts a
WHERE t.account_id IS NULL
  AND a.family_group_id = t.family_group_id
  AND a.is_primary = true;

ALTER TABLE public.transactions
  ALTER COLUMN created_by_user_id SET NOT NULL,
  ALTER COLUMN account_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON public.transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_by ON public.transactions(created_by_user_id);

-- Split table to track internal advances (who paid for whom)
CREATE TABLE IF NOT EXISTS public.transaction_splits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_amount NUMERIC(12,2) NOT NULL,
  is_advance BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(transaction_id, user_id)
);

ALTER TABLE public.transaction_splits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view splits" ON public.transaction_splits;
DROP POLICY IF EXISTS "Members can manage splits" ON public.transaction_splits;
CREATE POLICY "Members can view splits"
  ON public.transaction_splits FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.transactions t
      WHERE t.id = transaction_id
        AND t.family_group_id IN (SELECT public.get_user_family_ids(auth.uid()))
    )
  );
CREATE POLICY "Members can manage splits"
  ON public.transaction_splits FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.transactions t
      WHERE t.id = transaction_id
        AND t.family_group_id IN (SELECT public.get_user_family_ids(auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.transactions t
      WHERE t.id = transaction_id
        AND t.family_group_id IN (SELECT public.get_user_family_ids(auth.uid()))
    )
  );

-- Transactions: remove per-user update/delete restriction
DROP POLICY IF EXISTS "Members can update own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Members can delete own transactions" ON public.transactions;
CREATE POLICY "Members can update group transactions"
  ON public.transactions FOR UPDATE
  USING (family_group_id IN (SELECT public.get_user_family_ids(auth.uid())));
CREATE POLICY "Members can delete group transactions"
  ON public.transactions FOR DELETE
  USING (family_group_id IN (SELECT public.get_user_family_ids(auth.uid())));

-- Categories/budgets are admin-managed
DROP POLICY IF EXISTS "Members can create categories" ON public.categories;
DROP POLICY IF EXISTS "Members can update categories" ON public.categories;
DROP POLICY IF EXISTS "Members can delete categories" ON public.categories;
CREATE POLICY "Admins can create categories"
  ON public.categories FOR INSERT
  WITH CHECK (
    family_group_id IS NULL OR public.is_family_admin(family_group_id, auth.uid())
  );
CREATE POLICY "Admins can update categories"
  ON public.categories FOR UPDATE
  USING (family_group_id IS NULL OR public.is_family_admin(family_group_id, auth.uid()));
CREATE POLICY "Admins can delete categories"
  ON public.categories FOR DELETE
  USING (family_group_id IS NULL OR public.is_family_admin(family_group_id, auth.uid()));

DROP POLICY IF EXISTS "Members can create budgets" ON public.budgets;
DROP POLICY IF EXISTS "Members can update budgets" ON public.budgets;
DROP POLICY IF EXISTS "Members can delete budgets" ON public.budgets;
CREATE POLICY "Admins can create budgets"
  ON public.budgets FOR INSERT
  WITH CHECK (public.is_family_admin(family_group_id, auth.uid()));
CREATE POLICY "Admins can update budgets"
  ON public.budgets FOR UPDATE
  USING (public.is_family_admin(family_group_id, auth.uid()));
CREATE POLICY "Admins can delete budgets"
  ON public.budgets FOR DELETE
  USING (public.is_family_admin(family_group_id, auth.uid()));

-- Group creation now provisions default primary account
CREATE OR REPLACE FUNCTION public.create_family_group(_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _group_id uuid;
BEGIN
  INSERT INTO public.family_groups (name)
  VALUES (_name)
  RETURNING id INTO _group_id;

  INSERT INTO public.family_members (user_id, family_group_id, role)
  VALUES (auth.uid(), _group_id, 'admin');

  INSERT INTO public.accounts (family_group_id, name, is_primary)
  VALUES (_group_id, 'Conto principale', true);

  RETURN _group_id;
END;
$$;
