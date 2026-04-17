-- 16-Apr-2026 — Emanuele Motta
-- Telegram bot user linking

CREATE TABLE IF NOT EXISTS public.telegram_bot_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_group_id UUID NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  telegram_id TEXT NOT NULL UNIQUE,
  telegram_username TEXT,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telegram_bot_links_family_group
  ON public.telegram_bot_links (family_group_id);

CREATE INDEX IF NOT EXISTS idx_telegram_bot_links_user
  ON public.telegram_bot_links (user_id);

ALTER TABLE public.telegram_bot_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their Telegram link" ON public.telegram_bot_links;
DROP POLICY IF EXISTS "Users can manage their Telegram link" ON public.telegram_bot_links;
DROP POLICY IF EXISTS "Users can delete their Telegram link" ON public.telegram_bot_links;

CREATE POLICY "Users can view their Telegram link"
  ON public.telegram_bot_links FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage their Telegram link"
  ON public.telegram_bot_links FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their Telegram link"
  ON public.telegram_bot_links FOR DELETE
  USING (user_id = auth.uid());
