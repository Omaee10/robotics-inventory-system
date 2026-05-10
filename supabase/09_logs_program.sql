-- Scope activity logs by FIRST program (FRC vs FTC). Run in Supabase → SQL Editor.

ALTER TABLE public.logs
  ADD COLUMN IF NOT EXISTS program text NOT NULL DEFAULT 'frc';

ALTER TABLE public.logs
  DROP CONSTRAINT IF EXISTS logs_program_check;

ALTER TABLE public.logs
  ADD CONSTRAINT logs_program_check CHECK (program IN ('frc', 'ftc'));
