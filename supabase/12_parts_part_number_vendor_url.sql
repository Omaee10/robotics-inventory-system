-- Part number (SKU) and vendor product URL for BOM matching and ordering.
-- Run in Supabase → SQL Editor after prior migrations.

ALTER TABLE public.parts
  ADD COLUMN IF NOT EXISTS part_number text NOT NULL DEFAULT '';

ALTER TABLE public.parts
  ADD COLUMN IF NOT EXISTS vendor_url text NOT NULL DEFAULT '';

-- One non-empty SKU per program (case-insensitive).
CREATE UNIQUE INDEX IF NOT EXISTS parts_program_part_number_unique
  ON public.parts (program, lower(trim(part_number)))
  WHERE trim(part_number) <> '';

-- Make the REST API pick up new columns without waiting (fixes "schema cache" errors).
NOTIFY pgrst, 'reload schema';

