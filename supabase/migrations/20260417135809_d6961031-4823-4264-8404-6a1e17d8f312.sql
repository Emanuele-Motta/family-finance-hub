-- ===== INDICI MANCANTI (additivi, IF NOT EXISTS) =====

-- Budgets
CREATE INDEX IF NOT EXISTS idx_budgets_family_group ON public.budgets(family_group_id);
CREATE INDEX IF NOT EXISTS idx_budgets_category ON public.budgets(category_id);

-- Categories
CREATE INDEX IF NOT EXISTS idx_categories_family_group ON public.categories(family_group_id);
CREATE INDEX IF NOT EXISTS idx_categories_default ON public.categories(is_default) WHERE is_default = true;

-- Goals & debts
CREATE INDEX IF NOT EXISTS idx_goals_family_group ON public.goals(family_group_id);
CREATE INDEX IF NOT EXISTS idx_debts_family_group ON public.debts(family_group_id);
CREATE INDEX IF NOT EXISTS idx_debts_due_date ON public.debts(due_date) WHERE is_paid = false;

-- Transactions (transfer + dashboard KPI)
CREATE INDEX IF NOT EXISTS idx_transactions_to_account ON public.transactions(to_account_id) WHERE to_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_family_type_date ON public.transactions(family_group_id, type, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON public.transactions(user_id);

-- Transaction splits
CREATE INDEX IF NOT EXISTS idx_splits_transaction ON public.transaction_splits(transaction_id);
CREATE INDEX IF NOT EXISTS idx_splits_user ON public.transaction_splits(user_id);

-- Notifications - unread filter
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, read_at) WHERE read_at IS NULL;

-- Family members lookup by user
CREATE INDEX IF NOT EXISTS idx_family_members_user ON public.family_members(user_id);

-- ===== VINCOLI INTEGRITÀ (NOT VALID prima, poi VALIDATE) =====

-- Conti unici per nome dentro una famiglia (evita doppioni "Conto principale")
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'accounts_family_name_unique'
  ) THEN
    -- Crea solo se non ci sono duplicati esistenti
    IF NOT EXISTS (
      SELECT 1 FROM public.accounts
      GROUP BY family_group_id, name HAVING count(*) > 1
    ) THEN
      ALTER TABLE public.accounts
        ADD CONSTRAINT accounts_family_name_unique UNIQUE (family_group_id, name);
    END IF;
  END IF;
END $$;

-- Importo transazioni > 0 (NOT VALID per non bloccare dati storici eventualmente errati)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_amount_positive'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_amount_positive CHECK (amount > 0) NOT VALID;
  END IF;
END $$;

-- Trasferimenti devono avere to_account_id e diverso da account_id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_transfer_requires_to'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_transfer_requires_to
      CHECK (
        type <> 'transfer'
        OR (to_account_id IS NOT NULL AND to_account_id <> account_id)
      ) NOT VALID;
  END IF;
END $$;

-- Validazione asincrona: solo se tutti i record passano
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.transactions WHERE amount <= 0) THEN
    ALTER TABLE public.transactions VALIDATE CONSTRAINT transactions_amount_positive;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.transactions
    WHERE type = 'transfer' AND (to_account_id IS NULL OR to_account_id = account_id)
  ) THEN
    ALTER TABLE public.transactions VALIDATE CONSTRAINT transactions_transfer_requires_to;
  END IF;
END $$;

-- ===== ANALYZE per aggiornare lo statistics planner dopo i nuovi indici =====
ANALYZE public.transactions;
ANALYZE public.budgets;
ANALYZE public.categories;
ANALYZE public.notifications;
ANALYZE public.transaction_splits;