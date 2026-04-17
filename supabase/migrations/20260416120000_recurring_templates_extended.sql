-- Author: Emanuele Motta
-- Date: 16-Apr-2026
-- Adds missing columns to recurring_templates so the app can manage
-- subscriptions with active/inactive state, tags, scheduling metadata, etc.

ALTER TABLE IF EXISTS public.recurring_templates
  ADD COLUMN IF NOT EXISTS tags TEXT[],
  ADD COLUMN IF NOT EXISTS starts_at DATE,
  ADD COLUMN IF NOT EXISTS ends_at DATE,
  ADD COLUMN IF NOT EXISTS max_occurrences INT,
  ADD COLUMN IF NOT EXISTS notify_days_before INT,
  ADD COLUMN IF NOT EXISTS notify_method TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
