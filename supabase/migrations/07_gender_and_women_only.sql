-- ============================================================
-- 07_gender_and_women_only
-- Opt-in women-only rides.
--   • users.gender      — private (own-row RLS), NOT in public_profiles
--   • rides.women_only  — driver opts a ride in at post time
-- Enforcement is server-side: only women can post OR join a women-only
-- ride. The frontend toggles are convenience; these triggers are the
-- boundary. raise exception strings are shown to users verbatim.
-- ============================================================

-- 1. gender on users. Nullable so existing rows survive; the app sends
--    everyone through profile setup to fill it in. 'na' = prefer not to say.
alter table public.users
  add column if not exists gender text
  check (gender in ('female', 'male', 'na'));

-- 2. women_only flag on rides
alter table public.rides
  add column if not exists women_only boolean not null default false;

-- ============================================================
-- Only a woman can POST (or flip on) a women-only ride.
-- security definer so it can read the driver's private gender.
-- ============================================================
create or replace function public.enforce_women_only_post()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_gender text;
begin
  if new.women_only then
    select gender into v_gender from public.users where id = new.driver_id;
    if v_gender is distinct from 'female' then
      raise exception 'Only women can post a women-only ride';
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists enforce_women_only_post on public.rides;
create trigger enforce_women_only_post
  before insert or update of women_only on public.rides
  for each row execute function public.enforce_women_only_post();

-- ============================================================
-- join_ride() — same as 04, plus a women-only gate.
-- Replacing the function preserves its existing grants.
-- ============================================================
create or replace function public.join_ride(p_ride_id uuid)
returns public.ride_passengers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user   uuid := auth.uid();
  v_ride   public.rides;
  v_row    public.ride_passengers;
  v_gender text;
begin
  if v_user is null then
    raise exception 'Sign in to join a ride';
  end if;

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

  -- women-only gate
  if v_ride.women_only then
    select gender into v_gender from public.users where id = v_user;
    if v_gender is distinct from 'female' then
      raise exception 'This ride is reserved for women';
    end if;
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

-- Grants are preserved across create-or-replace, but re-assert to be safe.
revoke all on function public.join_ride(uuid) from public, anon;
grant execute on function public.join_ride(uuid) to authenticated;
