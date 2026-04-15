
-- Timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  preferred_currency TEXT NOT NULL DEFAULT 'EUR',
  language TEXT NOT NULL DEFAULT 'it',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Family groups
CREATE TABLE public.family_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE DEFAULT substr(md5(random()::text), 1, 8),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.family_groups ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_family_groups_updated_at BEFORE UPDATE ON public.family_groups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Family members (join table)
CREATE TYPE public.family_role AS ENUM ('admin', 'member');
CREATE TABLE public.family_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  family_group_id UUID NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  role public.family_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, family_group_id)
);
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

-- Helper: get user's family group ids
CREATE OR REPLACE FUNCTION public.get_user_family_ids(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT family_group_id FROM public.family_members WHERE user_id = _user_id;
$$;

-- Family group policies
CREATE POLICY "Members can view their groups" ON public.family_groups FOR SELECT USING (id IN (SELECT public.get_user_family_ids(auth.uid())));
CREATE POLICY "Authenticated users can create groups" ON public.family_groups FOR INSERT WITH CHECK (true);
CREATE POLICY "Members can update their groups" ON public.family_groups FOR UPDATE USING (id IN (SELECT public.get_user_family_ids(auth.uid())));

-- Family members policies
CREATE POLICY "Members can view group members" ON public.family_members FOR SELECT USING (family_group_id IN (SELECT public.get_user_family_ids(auth.uid())));
CREATE POLICY "Authenticated can join groups" ON public.family_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Members can leave groups" ON public.family_members FOR DELETE USING (auth.uid() = user_id);

-- Categories
CREATE TYPE public.transaction_type AS ENUM ('income', 'expense');
CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_group_id UUID REFERENCES public.family_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'tag',
  type public.transaction_type NOT NULL,
  color TEXT NOT NULL DEFAULT '#10B981',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own group categories and defaults" ON public.categories FOR SELECT USING (is_default = true OR family_group_id IN (SELECT public.get_user_family_ids(auth.uid())));
CREATE POLICY "Members can create categories" ON public.categories FOR INSERT WITH CHECK (family_group_id IN (SELECT public.get_user_family_ids(auth.uid())));
CREATE POLICY "Members can update categories" ON public.categories FOR UPDATE USING (family_group_id IN (SELECT public.get_user_family_ids(auth.uid())));
CREATE POLICY "Members can delete categories" ON public.categories FOR DELETE USING (family_group_id IN (SELECT public.get_user_family_ids(auth.uid())));

-- Default categories seed
INSERT INTO public.categories (name, icon, type, color, is_default) VALUES
  ('Stipendio', 'briefcase', 'income', '#10B981', true),
  ('Freelance', 'laptop', 'income', '#3B82F6', true),
  ('Investimenti', 'trending-up', 'income', '#8B5CF6', true),
  ('Altro reddito', 'plus-circle', 'income', '#6366F1', true),
  ('Alimentari', 'shopping-cart', 'expense', '#EF4444', true),
  ('Trasporti', 'car', 'expense', '#F59E0B', true),
  ('Casa', 'home', 'expense', '#EC4899', true),
  ('Utenze', 'zap', 'expense', '#F97316', true),
  ('Salute', 'heart', 'expense', '#14B8A6', true),
  ('Intrattenimento', 'film', 'expense', '#A855F7', true),
  ('Abbigliamento', 'shirt', 'expense', '#06B6D4', true),
  ('Istruzione', 'book-open', 'expense', '#0EA5E9', true),
  ('Ristoranti', 'utensils', 'expense', '#D946EF', true),
  ('Viaggi', 'plane', 'expense', '#F43F5E', true);

-- Transactions
CREATE TYPE public.recurrence_type AS ENUM ('monthly', 'yearly');
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_group_id UUID NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL,
  type public.transaction_type NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  recurring BOOLEAN NOT NULL DEFAULT false,
  recurrence_type public.recurrence_type,
  tags TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view group transactions" ON public.transactions FOR SELECT USING (family_group_id IN (SELECT public.get_user_family_ids(auth.uid())));
CREATE POLICY "Members can create transactions" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id AND family_group_id IN (SELECT public.get_user_family_ids(auth.uid())));
CREATE POLICY "Members can update own transactions" ON public.transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Members can delete own transactions" ON public.transactions FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_transactions_family_date ON public.transactions (family_group_id, date DESC);
CREATE INDEX idx_transactions_category ON public.transactions (category_id);

-- Budgets
CREATE TYPE public.budget_period AS ENUM ('monthly', 'yearly');
CREATE TABLE public.budgets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_group_id UUID NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  period public.budget_period NOT NULL DEFAULT 'monthly',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view group budgets" ON public.budgets FOR SELECT USING (family_group_id IN (SELECT public.get_user_family_ids(auth.uid())));
CREATE POLICY "Members can create budgets" ON public.budgets FOR INSERT WITH CHECK (family_group_id IN (SELECT public.get_user_family_ids(auth.uid())));
CREATE POLICY "Members can update budgets" ON public.budgets FOR UPDATE USING (family_group_id IN (SELECT public.get_user_family_ids(auth.uid())));
CREATE POLICY "Members can delete budgets" ON public.budgets FOR DELETE USING (family_group_id IN (SELECT public.get_user_family_ids(auth.uid())));
CREATE TRIGGER update_budgets_updated_at BEFORE UPDATE ON public.budgets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Goals
CREATE TABLE public.goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_group_id UUID NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount NUMERIC(12,2) NOT NULL,
  current_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  deadline DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view group goals" ON public.goals FOR SELECT USING (family_group_id IN (SELECT public.get_user_family_ids(auth.uid())));
CREATE POLICY "Members can create goals" ON public.goals FOR INSERT WITH CHECK (family_group_id IN (SELECT public.get_user_family_ids(auth.uid())));
CREATE POLICY "Members can update goals" ON public.goals FOR UPDATE USING (family_group_id IN (SELECT public.get_user_family_ids(auth.uid())));
CREATE POLICY "Members can delete goals" ON public.goals FOR DELETE USING (family_group_id IN (SELECT public.get_user_family_ids(auth.uid())));
CREATE TRIGGER update_goals_updated_at BEFORE UPDATE ON public.goals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Debts
CREATE TABLE public.debts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_group_id UUID NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL,
  remaining_amount NUMERIC(12,2) NOT NULL,
  due_date DATE,
  interest_rate NUMERIC(5,2),
  monthly_payment NUMERIC(12,2),
  notes TEXT,
  is_paid BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view group debts" ON public.debts FOR SELECT USING (family_group_id IN (SELECT public.get_user_family_ids(auth.uid())));
CREATE POLICY "Members can create debts" ON public.debts FOR INSERT WITH CHECK (family_group_id IN (SELECT public.get_user_family_ids(auth.uid())));
CREATE POLICY "Members can update debts" ON public.debts FOR UPDATE USING (family_group_id IN (SELECT public.get_user_family_ids(auth.uid())));
CREATE POLICY "Members can delete debts" ON public.debts FOR DELETE USING (family_group_id IN (SELECT public.get_user_family_ids(auth.uid())));
CREATE TRIGGER update_debts_updated_at BEFORE UPDATE ON public.debts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
