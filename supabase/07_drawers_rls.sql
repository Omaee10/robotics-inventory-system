-- Allow app (anon key) to read/write drawers. Without this, drawer list can be empty
-- and part inserts fail (e.g. invalid drawer_id).
-- Run in Supabase → SQL Editor.

ALTER TABLE public.drawers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "drawers_select_anon" ON public.drawers;
DROP POLICY IF EXISTS "drawers_insert_anon" ON public.drawers;
DROP POLICY IF EXISTS "drawers_delete_anon" ON public.drawers;

CREATE POLICY "drawers_select_anon"
  ON public.drawers FOR SELECT TO anon USING (true);

CREATE POLICY "drawers_insert_anon"
  ON public.drawers FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "drawers_delete_anon"
  ON public.drawers FOR DELETE TO anon USING (true);
