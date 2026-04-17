-- Author: Emanuele Motta
-- Date: 17-Apr-2026
-- Add dashboard_kpis column to profiles for persistent KPI preferences

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS dashboard_kpis JSONB DEFAULT NULL;

COMMENT ON COLUMN public.profiles.dashboard_kpis IS 'User-selected KPI card IDs shown on the dashboard (null = use app default)';
