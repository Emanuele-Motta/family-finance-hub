DROP POLICY IF EXISTS "Authenticated can join groups" ON public.family_members;

CREATE POLICY "Authenticated can join groups"
  ON public.family_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND role = 'member');