-- Allow anon (app client) to delete activity log rows — required for “Clear log” in admin.
-- Run in Supabase → SQL Editor (safe to run more than once).

ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "logs_delete_anon" ON public.logs;

CREATE POLICY "logs_delete_anon"
  ON public.logs FOR DELETE TO anon
  USING (true);
