-- ============================================================
-- 04_ride_passengers_and_rls
-- Join / leave a ride, atomically. Plus a safe public profile view.
-- ============================================================

create table if not exists public.ride_passengers (
  id        uuid primary key default gen_random_uuid(),
  ride_id   uuid not null references public.rides(id) on delete cascade,
  user_id   uuid not null references public.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at   timestamptz
);

-- One ACTIVE seat per person per ride. Partial index lets someone
-- leave and rejoin later without tripping the constraint.
create unique index if not exists ride_passengers_active_uniq
  on public.ride_passengers (ride_id, user_id)
  where left_at is null;

create index if not exists ride_passengers_user_idx
  on public.ride_passengers (user_id) where left_at is null;

-- ============================================================
-- Atomic join. Locks the ride row so two people tapping "Join"
-- at the same moment can't both claim the last seat.
-- ============================================================
create or replace function public.join_ride(p_ride_id uuid)
returns public.ride_passengers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_ride public.rides;
  v_row  public.ride_passengers;
begin
  if v_user is null then
    raise exception 'Sign in to join a ride';
  end if;

  -- FOR UPDATE = row lock held until this transaction commits
  select * into v_ride from public.rides
    where id = p_ride_id for update;

  if not found then
    raise exception 'That ride no longer exists';
  end if;
  if v_ride.driver_id = v_user then
    raise exception 'You are driving this ride';
  end if;
  if v_ride.status <> 'open' then
    raise exception 'This ride is not accepting passengers';
  end if;
  if v_ride.seats_left < 1 then
    raise exception 'No seats left';
  end if;
  if exists (select 1 from public.ride_passengers
             where ride_id = p_ride_id and user_id = v_user and left_at is null) then
    raise exception 'You have already joined this ride';
  end if;

  insert into public.ride_passengers (ride_id, user_id)
  values (p_ride_id, v_user)
  returning * into v_row;

  update public.rides
    set seats_left = seats_left - 1
    where id = p_ride_id;

  return v_row;
end;
$$;

-- ============================================================
-- Leave a ride. Frees the seat back up.
-- ============================================================
create or replace function public.leave_ride(p_ride_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_ride public.rides;
begin
  if v_user is null then
    raise exception 'Sign in to leave a ride';
  end if;

  select * into v_ride from public.rides
    where id = p_ride_id for update;

  if not found then
    raise exception 'That ride no longer exists';
  end if;

  update public.ride_passengers
    set left_at = now()
    where ride_id = p_ride_id and user_id = v_user and left_at is null;

  if not found then
    raise exception 'You are not on this ride';
  end if;

  if v_ride.status in ('open','full') then
    update public.rides
      set seats_left = least(seats_left + 1, seats_total)
      where id = p_ride_id;
  end if;
end;
$$;

revoke all on function public.join_ride(uuid)  from public, anon;
revoke all on function public.leave_ride(uuid) from public, anon;
grant execute on function public.join_ride(uuid)  to authenticated;
grant execute on function public.leave_ride(uuid) to authenticated;

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.ride_passengers enable row level security;

-- You can see the passenger list of any ride you're part of
-- (as driver or as passenger). Not everyone else's.
drop policy if exists "ride_passengers_select_involved" on public.ride_passengers;
create policy "ride_passengers_select_involved"
  on public.ride_passengers for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.rides r
      where r.id = ride_id and r.driver_id = auth.uid()
    )
  );

-- No insert/update/delete policies. Seats change ONLY through
-- join_ride() / leave_ride(), which enforce the locking above.

-- ============================================================
-- Safe public profile view
-- users RLS locks each row to its owner, so a passenger can't
-- read the driver's name. This view exposes only non-sensitive
-- columns — no email, no phone.
-- ============================================================
create or replace view public.public_profiles as
  select id, name, branch, year, rating_avg, rating_count
  from public.users;

-- Runs with the view owner's rights, bypassing users' RLS,
-- which is exactly what we want since the columns are already
-- filtered. Phone/email are simply not selectable here.
alter view public.public_profiles set (security_invoker = off);

revoke all on public.public_profiles from public, anon;
grant select on public.public_profiles to authenticated;
