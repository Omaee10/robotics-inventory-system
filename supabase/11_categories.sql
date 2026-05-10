-- Part categories / sections (filters + Part modal). Run in Supabase → SQL Editor.

CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories_select_anon" ON public.categories;
DROP POLICY IF EXISTS "categories_insert_anon" ON public.categories;
DROP POLICY IF EXISTS "categories_delete_anon" ON public.categories;

CREATE POLICY "categories_select_anon"
  ON public.categories FOR SELECT TO anon USING (true);

CREATE POLICY "categories_insert_anon"
  ON public.categories FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "categories_delete_anon"
  ON public.categories FOR DELETE TO anon USING (true);

INSERT INTO public.categories (label) VALUES
  ('Motors'),
  ('Electronics'),
  ('Sensors'),
  ('Pneumatics'),
  ('Drive'),
  ('Vision')
ON CONFLICT (label) DO NOTHING;
