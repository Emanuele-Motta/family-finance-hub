-- Enable RLS on recurring_occurrences
ALTER TABLE public.recurring_occurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own occurrences"
  ON public.recurring_occurrences FOR SELECT
  USING (family_group_id IN (SELECT public.get_user_family_ids(auth.uid())));

CREATE POLICY "Members can manage own occurrences"
  ON public.recurring_occurrences FOR ALL
  USING (family_group_id IN (SELECT public.get_user_family_ids(auth.uid())))
  WITH CHECK (family_group_id IN (SELECT public.get_user_family_ids(auth.uid())));

-- Enable RLS on rule_applications
ALTER TABLE public.rule_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own rule applications"
  ON public.rule_applications FOR SELECT
  USING (family_group_id IN (SELECT public.get_user_family_ids(auth.uid())));

CREATE POLICY "Members can manage own rule applications"
  ON public.rule_applications FOR ALL
  USING (family_group_id IN (SELECT public.get_user_family_ids(auth.uid())))
  WITH CHECK (family_group_id IN (SELECT public.get_user_family_ids(auth.uid())));

-- Add membership guard to log_audit_event
CREATE OR REPLACE FUNCTION public.log_audit_event(
  _family_group_id uuid,
  _action text,
  _entity_type text,
  _entity_id uuid DEFAULT NULL::uuid,
  _entity_name text DEFAULT NULL::text,
  _old_values jsonb DEFAULT NULL::jsonb,
  _new_values jsonb DEFAULT NULL::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _log_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.family_members
    WHERE family_group_id = _family_group_id
      AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: not a member of this family group';
  END IF;

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
$function$;

-- Add membership guard to create_record_version
CREATE OR REPLACE FUNCTION public.create_record_version(
  _family_group_id uuid,
  _record_type text,
  _record_id uuid,
  _data jsonb,
  _change_reason text DEFAULT NULL::text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _next_version INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.family_members
    WHERE family_group_id = _family_group_id
      AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: not a member of this family group';
  END IF;

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
$function$;