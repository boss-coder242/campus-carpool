-- ============================================================
-- 05_ratings_table_and_rls
-- Rate someone you shared a COMPLETED ride with, once.
-- rating_avg / rating_count on users are client-frozen, so they
-- are recalculated here by trigger (see 01_users protect_user_columns).
-- ============================================================

create table if not exists public.ratings (
  id         uuid primary key default gen_random_uuid(),
  ride_id    uuid not null references public.rides(id) on delete cascade,
  rater_id   uuid not null references public.users(id) on delete cascade,
  rated_id   uuid not null references public.users(id) on delete cascade,
  stars      smallint not null check (stars between 1 and 5),
  created_at timestamptz not null default now(),

  constraint ratings_no_self check (rater_id <> rated_id),
  -- one rating per (ride, rater, rated): you can rate each co-rider once
  constraint ratings_once  unique (ride_id, rater_id, rated_id)
);

create index if not exists ratings_rated_idx on public.ratings (rated_id);

-- ---- recalc the rated user's aggregate ---------------------
-- security definer: bypasses users RLS AND the protect_user_columns
-- freeze (which only guards a user editing their OWN row).
create or replace function public.recalc_user_rating()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := coalesce(new.rated_id, old.rated_id);
begin
  update public.users u
  set rating_avg   = coalesce(s.avg, 0),
      rating_count = coalesce(s.cnt, 0)
  from (
    select round(avg(stars)::numeric, 2) as avg, count(*) as cnt
    from public.ratings where rated_id = v_id
  ) s
  where u.id = v_id;
  return null;
end; $$;

drop trigger if exists recalc_user_rating on public.ratings;
create trigger recalc_user_rating
  after insert or update or delete on public.ratings
  for each row execute function public.recalc_user_rating();

-- ============================================================
-- rate_user() — the ONLY write path (mirrors join_ride/leave_ride).
-- Enforces: completed ride, both parties were on it, no self-rating,
-- once only. raise exception strings are shown to users verbatim.
-- ============================================================
create or replace function public.rate_user(p_ride_id uuid, p_rated_id uuid, p_stars smallint)
returns public.ratings
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_ride public.rides;
  v_row  public.ratings;
begin
  if v_user is null then raise exception 'Sign in to rate'; end if;
  if p_stars < 1 or p_stars > 5 then
    raise exception 'Rating must be between 1 and 5 stars'; end if;
  if p_rated_id = v_user then raise exception 'You cannot rate yourself'; end if;

  select * into v_ride from public.rides where id = p_ride_id;
  if not found then raise exception 'That ride no longer exists'; end if;
  if v_ride.status <> 'completed' then
    raise exception 'You can only rate after a ride is completed'; end if;

  -- rater must have been on the ride (driver or a passenger)
  if not (v_ride.driver_id = v_user
          or exists (select 1 from public.ride_passengers
                     where ride_id = p_ride_id and user_id = v_user)) then
    raise exception 'You were not part of this ride'; end if;

  -- rated must have been on the ride too
  if not (v_ride.driver_id = p_rated_id
          or exists (select 1 from public.ride_passengers
                     where ride_id = p_ride_id and user_id = p_rated_id)) then
    raise exception 'That person was not part of this ride'; end if;

  insert into public.ratings (ride_id, rater_id, rated_id, stars)
  values (p_ride_id, v_user, p_rated_id, p_stars)
  returning * into v_row;
  return v_row;
exception when unique_violation then
  raise exception 'You have already rated this person for this ride';
end; $$;

revoke all on function public.rate_user(uuid, uuid, smallint) from public, anon;
grant execute on function public.rate_user(uuid, uuid, smallint) to authenticated;

-- ---- Row Level Security ------------------------------------
alter table public.ratings enable row level security;

-- See ratings you gave or received. No direct writes: use rate_user().
drop policy if exists "ratings_select_involved" on public.ratings;
create policy "ratings_select_involved"
  on public.ratings for select to authenticated
  using (rater_id = auth.uid() or rated_id = auth.uid());
