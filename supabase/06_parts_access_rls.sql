-- Fixes: parts not inserting (RLS), or errors after adding `company` / ordering by `created_at`.
-- Run in Supabase → SQL Editor (safe to run more than once).

-- Columns the app expects
ALTER TABLE public.parts
  ADD COLUMN IF NOT EXISTS company text NOT NULL DEFAULT '';

ALTER TABLE public.parts
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE public.parts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parts_select_anon" ON public.parts;
DROP POLICY IF EXISTS "parts_insert_anon" ON public.parts;
DROP POLICY IF EXISTS "parts_update_anon" ON public.parts;
DROP POLICY IF EXISTS "parts_delete_anon" ON public.parts;

CREATE POLICY "parts_select_anon"
  ON public.parts FOR SELECT TO anon USING (true);

CREATE POLICY "parts_insert_anon"
  ON public.parts FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "parts_update_anon"
  ON public.parts FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "parts_delete_anon"
  ON public.parts FOR DELETE TO anon USING (true);
