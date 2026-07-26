-- ============================================================
-- 11_booking_approval_and_reviews
--
-- (1) Request-to-book. A driver picks per ride:
--       instant_book = true   -> joining confirms immediately (old behaviour)
--       instant_book = false  -> joining creates a PENDING booking the
--                                driver must accept or decline.
--     The seat is HELD while pending, and released on decline, so two
--     students can't be promised the same seat.
--
-- (2) Written reviews. ratings gains a comment, and public_reviews
--     exposes them (with the rater's name only) for profile cards.
-- ============================================================

alter table public.rides
  add column if not exists instant_book boolean not null default true;

-- existing rows are all confirmed seats, which the default covers
alter table public.ride_passengers
  add column if not exists status text not null default 'confirmed'
  check (status in ('pending', 'confirmed', 'declined'));

create index if not exists ride_passengers_pending_idx
  on public.ride_passengers (ride_id) where status = 'pending' and left_at is null;

alter table public.ratings
  add column if not exists comment text;

-- ============================================================
-- join_ride() — as before, but sets pending when the ride needs
-- approval. Seat is decremented either way (the hold).
-- ============================================================
create or replace function public.join_ride(p_ride_id uuid)
returns public.ride_passengers
language plpgsql security definer set search_path = public
as $$
declare
  v_user   uuid := auth.uid();
  v_ride   public.rides;
  v_row    public.ride_passengers;
  v_gender text;
  v_status text;
begin
  if v_user is null then raise exception 'Sign in to join a ride'; end if;

  select * into v_ride from public.rides where id = p_ride_id for update;

  if not found then raise exception 'That ride no longer exists'; end if;
  if v_ride.driver_id = v_user then raise exception 'You are driving this ride'; end if;
  if v_ride.status <> 'open' then
    raise exception 'This ride is not accepting passengers'; end if;
  if v_ride.seats_left < 1 then raise exception 'No seats left'; end if;

  if v_ride.women_only then
    select gender into v_gender from public.users where id = v_user;
    if v_gender is distinct from 'female' then
      raise exception 'This ride is reserved for women'; end if;
  end if;

  if exists (select 1 from public.ride_passengers
             where ride_id = p_ride_id and user_id = v_user and left_at is null) then
    raise exception 'You have already joined this ride';
  end if;

  v_status := case when v_ride.instant_book then 'confirmed' else 'pending' end;

  insert into public.ride_passengers (ride_id, user_id, status)
  values (p_ride_id, v_user, v_status)
  returning * into v_row;

  update public.rides set seats_left = seats_left - 1 where id = p_ride_id;

  return v_row;
end; $$;

revoke all on function public.join_ride(uuid) from public, anon;
grant execute on function public.join_ride(uuid) to authenticated;

-- ============================================================
-- respond_booking() — the driver accepts or declines a pending seat.
-- Declining frees the held seat and closes the row (left_at), so the
-- student can request again later.
-- ============================================================
create or replace function public.respond_booking(p_passenger_id uuid, p_accept boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_pax  public.ride_passengers;
  v_ride public.rides;
begin
  if v_user is null then raise exception 'Sign in to manage bookings'; end if;

  select * into v_pax from public.ride_passengers where id = p_passenger_id;
  if not found then raise exception 'That booking no longer exists'; end if;

  select * into v_ride from public.rides where id = v_pax.ride_id for update;
  if v_ride.driver_id <> v_user then
    raise exception 'Only the driver can respond to this booking'; end if;
  if v_pax.status <> 'pending' or v_pax.left_at is not null then
    raise exception 'That booking has already been handled'; end if;

  if p_accept then
    update public.ride_passengers set status = 'confirmed' where id = p_passenger_id;
  else
    update public.ride_passengers
      set status = 'declined', left_at = now()
      where id = p_passenger_id;
    -- give the held seat back
    if v_ride.status in ('open', 'full') then
      update public.rides
        set seats_left = least(seats_left + 1, seats_total)
        where id = v_ride.id;
    end if;
  end if;
end; $$;

revoke all on function public.respond_booking(uuid, boolean) from public, anon;
grant execute on function public.respond_booking(uuid, boolean) to authenticated;

-- ============================================================
-- get_ride_contacts() — only confirmed passengers get phone numbers.
-- A pending rider can still see the driver's number (they may need to
-- ask about the ride), but the driver only sees people he accepted.
-- ============================================================
create or replace function public.get_ride_contacts(p_ride_id uuid)
returns table (id uuid, name text, phone text, role text)
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
declare
  v_user      uuid := auth.uid();
  v_ride      public.rides;
  v_is_driver boolean;
  v_is_pax    boolean;
begin
  if v_user is null then raise exception 'Sign in to view ride contacts'; end if;

  select * into v_ride from public.rides where id = p_ride_id;
  if not found then raise exception 'That ride no longer exists'; end if;

  v_is_driver := (v_ride.driver_id = v_user);
  v_is_pax := exists (
    select 1 from public.ride_passengers
    where ride_id = p_ride_id and user_id = v_user and left_at is null
  );

  if not (v_is_driver or v_is_pax) then
    raise exception 'You can only see contacts for a ride you are on'; end if;

  if v_is_driver then
    return query
      select u.id, u.name, u.phone, 'passenger'::text
      from public.ride_passengers rp
      join public.users u on u.id = rp.user_id
      where rp.ride_id = p_ride_id and rp.left_at is null and rp.status = 'confirmed'
      order by rp.joined_at;
  else
    return query
      select u.id, u.name, u.phone, 'driver'::text
      from public.users u where u.id = v_ride.driver_id;
  end if;
end; $$;

revoke all on function public.get_ride_contacts(uuid) from public, anon;
grant execute on function public.get_ride_contacts(uuid) to authenticated;

-- ============================================================
-- rate_user() gains an optional comment. Old 3-arg version is dropped
-- so there is exactly one signature.
-- ============================================================
drop function if exists public.rate_user(uuid, uuid, smallint);

create or replace function public.rate_user(
  p_ride_id uuid, p_rated_id uuid, p_stars smallint, p_comment text default null)
returns public.ratings
language plpgsql security definer set search_path = public
as $$
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

  if not (v_ride.driver_id = v_user
          or exists (select 1 from public.ride_passengers
                     where ride_id = p_ride_id and user_id = v_user
                       and status = 'confirmed')) then
    raise exception 'You were not part of this ride'; end if;

  if not (v_ride.driver_id = p_rated_id
          or exists (select 1 from public.ride_passengers
                     where ride_id = p_ride_id and user_id = p_rated_id
                       and status = 'confirmed')) then
    raise exception 'That person was not part of this ride'; end if;

  insert into public.ratings (ride_id, rater_id, rated_id, stars, comment)
  values (p_ride_id, v_user, p_rated_id, p_stars, nullif(trim(p_comment), ''))
  returning * into v_row;
  return v_row;
exception when unique_violation then
  raise exception 'You have already rated this person for this ride';
end; $$;

revoke all on function public.rate_user(uuid, uuid, smallint, text) from public, anon;
grant execute on function public.rate_user(uuid, uuid, smallint, text) to authenticated;

-- ============================================================
-- public_reviews — reviews readable by any signed-in student.
-- Exposes the rater's NAME only (no email / phone / id-linkable data
-- beyond what public_profiles already shows).
-- ============================================================
create or replace view public.public_reviews as
  select r.id, r.rated_id, r.stars, r.comment, r.created_at,
         u.name as rater_name
  from public.ratings r
  join public.users u on u.id = r.rater_id;

alter view public.public_reviews set (security_invoker = off);

revoke all on public.public_reviews from public, anon;
grant select on public.public_reviews to authenticated;
