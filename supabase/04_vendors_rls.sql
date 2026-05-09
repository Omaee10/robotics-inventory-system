-- Fix: "new row violates row-level security policy for table vendors"
-- Run in Supabase → SQL Editor (safe to run more than once).

alter table public.vendors enable row level security;

drop policy if exists "vendors_select_anon" on public.vendors;
drop policy if exists "vendors_insert_anon" on public.vendors;
drop policy if exists "vendors_update_anon" on public.vendors;
drop policy if exists "vendors_delete_anon" on public.vendors;

-- App uses NEXT_PUBLIC_SUPABASE_ANON_KEY (role: anon), same pattern as access_codes / logs.
create policy "vendors_select_anon"
  on public.vendors for select
  to anon
  using (true);

create policy "vendors_insert_anon"
  on public.vendors for insert
  to anon
  with check (true);

create policy "vendors_update_anon"
  on public.vendors for update
  to anon
  using (true)
  with check (true);

create policy "vendors_delete_anon"
  on public.vendors for delete
  to anon
  using (true);
