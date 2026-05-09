-- Run this in your Supabase SQL editor to add the vendors table.
CREATE TABLE IF NOT EXISTS public.vendors (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  base_url    text NOT NULL,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vendors_select_anon" ON public.vendors;
DROP POLICY IF EXISTS "vendors_insert_anon" ON public.vendors;
DROP POLICY IF EXISTS "vendors_update_anon" ON public.vendors;
DROP POLICY IF EXISTS "vendors_delete_anon" ON public.vendors;

CREATE POLICY "vendors_select_anon"
  ON public.vendors FOR SELECT TO anon USING (true);

CREATE POLICY "vendors_insert_anon"
  ON public.vendors FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "vendors_update_anon"
  ON public.vendors FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "vendors_delete_anon"
  ON public.vendors FOR DELETE TO anon USING (true);

-- Seed a handful of common robotics suppliers so mentors start with something useful.
INSERT INTO public.vendors (name, base_url) VALUES
  ('REV Robotics',             'https://www.revrobotics.com'),
  ('VEX Robotics',             'https://www.vexrobotics.com'),
  ('AndyMark',                 'https://www.andymark.com'),
  ('CTR Electronics',          'https://store.ctr-electronics.com'),
  ('goBILDA',                  'https://www.gobilda.com'),
  ('ServoCity',                'https://www.servocity.com'),
  ('The Thrifty Bot',          'https://www.thethriftybot.com'),
  ('Swerve Drive Specialties', 'https://www.swervedrivespecialties.com')
ON CONFLICT DO NOTHING;
