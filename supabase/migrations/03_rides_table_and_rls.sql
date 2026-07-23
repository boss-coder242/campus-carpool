-- ============================================================
-- 03_rides_table_and_rls
-- Carpool App — rides table, seat logic, RLS
-- ============================================================

create table if not exists public.rides (
  id           uuid primary key default gen_random_uuid(),
  driver_id    uuid not null references public.users(id) on delete cascade,
  "from"       text not null,
  "to"         text not null,
  date         date not null,
  time         time not null,
  seats_total  smallint not null check (seats_total between 1 and 6),
  seats_left   smallint not null check (seats_left >= 0),
  price        numeric(6,2) not null default 0 check (price >= 0),
  note         text,
  status       text not null default 'open'
               check (status in ('open','full','completed','cancelled')),
  created_at   timestamptz not null default now(),

  constraint seats_left_lte_total check (seats_left <= seats_total)
);

create index if not exists rides_search_idx
  on public.rides (date, status);
create index if not exists rides_driver_idx
  on public.rides (driver_id);

-- ---- seats_left defaults to seats_total on insert ----------
create or replace function public.init_seats_left()
returns trigger language plpgsql as $$
begin
  if new.seats_left is null then
    new.seats_left := new.seats_total;
  end if;
  return new;
end;
$$;

drop trigger if exists init_seats_left on public.rides;
create trigger init_seats_left
  before insert on public.rides
  for each row execute function public.init_seats_left();

-- ---- auto-flip status between open and full ----------------
create or replace function public.sync_ride_status()
returns trigger language plpgsql as $$
begin
  if new.status in ('completed','cancelled') then
    return new;                       -- terminal states win
  end if;
  new.status := case when new.seats_left = 0 then 'full' else 'open' end;
  return new;
end;
$$;

drop trigger if exists sync_ride_status on public.rides;
create trigger sync_ride_status
  before insert or update of seats_left, status on public.rides
  for each row execute function public.sync_ride_status();

-- ---- Row Level Security ------------------------------------
alter table public.rides enable row level security;

-- Any signed-in student can browse rides
drop policy if exists "rides_select_authenticated" on public.rides;
create policy "rides_select_authenticated"
  on public.rides for select
  to authenticated
  using (true);

-- You can only post a ride as yourself
drop policy if exists "rides_insert_own" on public.rides;
create policy "rides_insert_own"
  on public.rides for insert
  to authenticated
  with check (auth.uid() = driver_id);

-- Only the driver edits their ride
drop policy if exists "rides_update_own" on public.rides;
create policy "rides_update_own"
  on public.rides for update
  to authenticated
  using (auth.uid() = driver_id)
  with check (auth.uid() = driver_id);

-- Deletes are not allowed: cancel instead, so passengers keep
-- the record. No delete policy = no deletes.

-- ---- driver cannot reassign a ride or rewrite history -------
create or replace function public.protect_ride_columns()
returns trigger language plpgsql as $$
begin
  new.driver_id  := old.driver_id;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists protect_ride_columns on public.rides;
create trigger protect_ride_columns
  before update on public.rides
  for each row execute function public.protect_ride_columns();
