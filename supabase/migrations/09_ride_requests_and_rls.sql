-- ============================================================
-- 09_ride_requests_and_rls
-- The reverse board: a rider posts where/when they want to go,
-- drivers browse and reach out (by posting a matching ride).
-- Mirrors rides' conventions: never deleted, only cancelled;
-- rider_id / created_at frozen after insert.
-- ============================================================

create table if not exists public.ride_requests (
  id           uuid primary key default gen_random_uuid(),
  rider_id     uuid not null references public.users(id) on delete cascade,
  "from"       text not null,
  "to"         text not null,
  date         date not null,
  time         time,                 -- null = flexible on time
  seats_needed smallint not null default 1 check (seats_needed between 1 and 6),
  note         text,
  status       text not null default 'open'
               check (status in ('open','fulfilled','cancelled')),
  created_at   timestamptz not null default now()
);

create index if not exists ride_requests_search_idx
  on public.ride_requests (date, status);

-- rider cannot rewrite ownership/history
create or replace function public.protect_ride_request_columns()
returns trigger language plpgsql as $$
begin
  new.rider_id   := old.rider_id;
  new.created_at := old.created_at;
  return new;
end; $$;

drop trigger if exists protect_ride_request_columns on public.ride_requests;
create trigger protect_ride_request_columns
  before update on public.ride_requests
  for each row execute function public.protect_ride_request_columns();

alter table public.ride_requests enable row level security;

-- any signed-in student can browse requests
drop policy if exists "ride_requests_select_authenticated" on public.ride_requests;
create policy "ride_requests_select_authenticated"
  on public.ride_requests for select to authenticated using (true);

-- post a request only as yourself
drop policy if exists "ride_requests_insert_own" on public.ride_requests;
create policy "ride_requests_insert_own"
  on public.ride_requests for insert to authenticated
  with check (auth.uid() = rider_id);

-- only the rider edits their request (cancel / mark fulfilled)
drop policy if exists "ride_requests_update_own" on public.ride_requests;
create policy "ride_requests_update_own"
  on public.ride_requests for update to authenticated
  using (auth.uid() = rider_id)
  with check (auth.uid() = rider_id);

-- no delete policy: cancel instead.
