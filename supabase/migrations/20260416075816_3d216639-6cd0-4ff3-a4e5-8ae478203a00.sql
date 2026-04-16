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

  RETURN _group_id;
END;
$$;