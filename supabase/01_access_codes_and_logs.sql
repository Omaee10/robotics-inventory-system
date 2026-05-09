-- Run this in Supabase: SQL Editor → New query → Paste → Run.
-- Fixes: "Could not find the table 'public.access_codes' in the schema cache"

-- ── access_codes (mentor login + admin code generator) ─────────────────────
create table if not exists public.access_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null default '',
  created_at timestamptz not null default now()
);

alter table public.access_codes enable row level security;

drop policy if exists "access_codes_select_anon" on public.access_codes;
drop policy if exists "access_codes_insert_anon" on public.access_codes;
drop policy if exists "access_codes_delete_anon" on public.access_codes;

create policy "access_codes_select_anon"
  on public.access_codes for select
  to anon
  using (true);

create policy "access_codes_insert_anon"
  on public.access_codes for insert
  to anon
  with check (true);

create policy "access_codes_delete_anon"
  on public.access_codes for delete
  to anon
  using (true);

-- Optional: seed a row so DB-backed codes work the same as the app master 111111
insert into public.access_codes (code, label)
values ('111111', 'Master (also built into app)')
on conflict (code) do nothing;

-- ── logs (activity log in /admin) ─────────────────────────────────────────
create table if not exists public.logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_name text not null,
  action text not null,
  part_name text not null,
  part_id text,
  details text
);

alter table public.logs enable row level security;

drop policy if exists "logs_select_anon" on public.logs;
drop policy if exists "logs_insert_anon" on public.logs;

create policy "logs_select_anon"
  on public.logs for select
  to anon
  using (true);

create policy "logs_insert_anon"
  on public.logs for insert
  to anon
  with check (true);
