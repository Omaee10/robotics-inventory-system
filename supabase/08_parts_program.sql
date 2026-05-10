-- Scope parts by FIRST program (FRC vs FTC). Run in Supabase → SQL Editor.

ALTER TABLE public.parts
  ADD COLUMN IF NOT EXISTS program text NOT NULL DEFAULT 'frc';

ALTER TABLE public.parts
  DROP CONSTRAINT IF EXISTS parts_program_check;

ALTER TABLE public.parts
  ADD CONSTRAINT parts_program_check CHECK (program IN ('frc', 'ftc'));
