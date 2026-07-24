-- ============================================================
-- 10_vehicle_and_public_profile
-- Two small additions:
--   • rides.car_model / car_color — so passengers can spot the car
--     at a crowded gate. Stored per ride (a student may borrow a
--     different car), prefilled client-side from the last ride.
--   • public_profiles gains created_at, for "Member since" on the
--     tappable profile card. Still no email / phone / gender.
-- ============================================================

alter table public.rides
  add column if not exists car_model text,
  add column if not exists car_color text;

-- ---- public_profiles: add created_at ------------------------
-- create or replace keeps existing columns in order and appends
-- the new one at the end.
create or replace view public.public_profiles as
  select id, name, branch, year, rating_avg, rating_count, created_at
  from public.users;

-- re-assert: view runs with owner rights (bypassing users RLS),
-- which is safe because the column list is already filtered.
alter view public.public_profiles set (security_invoker = off);

revoke all on public.public_profiles from public, anon;
grant select on public.public_profiles to authenticated;
