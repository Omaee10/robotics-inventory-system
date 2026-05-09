-- Add supplier / company name for parts (shown in the info popup on each card).
-- Run in Supabase → SQL Editor.

ALTER TABLE public.parts
  ADD COLUMN IF NOT EXISTS company text NOT NULL DEFAULT '';
