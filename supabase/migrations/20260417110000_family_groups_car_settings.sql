-- Author: Emanuele Motta
-- Date: 17-Apr-2026
-- Persist car expenses settings in family_groups so they sync across devices

ALTER TABLE public.family_groups
  ADD COLUMN IF NOT EXISTS car_expenses_settings JSONB DEFAULT NULL;

COMMENT ON COLUMN public.family_groups.car_expenses_settings IS 'Car expenses feature settings (enabled flag + cars list) shared across family members';
