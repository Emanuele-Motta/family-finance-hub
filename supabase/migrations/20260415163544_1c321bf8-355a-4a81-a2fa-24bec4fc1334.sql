
DROP POLICY "Authenticated users can create groups" ON public.family_groups;
CREATE POLICY "Authenticated users can create groups" ON public.family_groups FOR INSERT TO authenticated WITH CHECK (true);
