-- ============================================================
-- 06_reports_table_and_rls
-- Let a student flag another student, optionally tied to a ride.
-- Reports are write-once from the client, readable only by their
-- author. Moderation/review happens out of band (service role).
-- ============================================================

create table if not exists public.reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid not null references public.users(id) on delete cascade,
  reported_id  uuid not null references public.users(id) on delete cascade,
  reason       text not null check (char_length(trim(reason)) > 0),
  ride_id      uuid references public.rides(id) on delete set null,
  created_at   timestamptz not null default now(),

  constraint reports_no_self check (reporter_id <> reported_id)
);

create index if not exists reports_reported_idx on public.reports (reported_id);

alter table public.reports enable row level security;

-- File a report as yourself, about someone else.
drop policy if exists "reports_insert_own" on public.reports;
create policy "reports_insert_own"
  on public.reports for insert to authenticated
  with check (reporter_id = auth.uid() and reported_id <> auth.uid());

-- You can only read the reports you filed.
drop policy if exists "reports_select_own" on public.reports;
create policy "reports_select_own"
  on public.reports for select to authenticated
  using (reporter_id = auth.uid());

-- No update/delete policies: reports are immutable from the client.
