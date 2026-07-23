-- ============================================================
-- 08_ride_contacts_rpc
-- Phone is deliberately NOT in public_profiles. This RPC is the
-- single, scoped way to reveal a co-rider's number: you only see
-- contacts for a ride you are actually on.
--   • driver    -> sees all active passengers' name + phone
--   • passenger -> sees the driver's name + phone
-- security definer so it can read the phone column past users RLS;
-- the WHERE / role checks below are what keep it safe.
-- ============================================================
create or replace function public.get_ride_contacts(p_ride_id uuid)
returns table (id uuid, name text, phone text, role text)
language plpgsql
security definer
set search_path = public
as $$
-- output columns (id/name/phone) share names with users columns; always
-- resolve bare references to the column, never the OUT variable.
#variable_conflict use_column
declare
  v_user      uuid := auth.uid();
  v_ride      public.rides;
  v_is_driver boolean;
  v_is_pax    boolean;
begin
  if v_user is null then
    raise exception 'Sign in to view ride contacts';
  end if;

  select * into v_ride from public.rides where id = p_ride_id;
  if not found then
    raise exception 'That ride no longer exists';
  end if;

  v_is_driver := (v_ride.driver_id = v_user);
  v_is_pax := exists (
    select 1 from public.ride_passengers
    where ride_id = p_ride_id and user_id = v_user and left_at is null
  );

  if not (v_is_driver or v_is_pax) then
    raise exception 'You can only see contacts for a ride you are on';
  end if;

  if v_is_driver then
    -- everyone who currently holds a seat
    return query
      select u.id, u.name, u.phone, 'passenger'::text
      from public.ride_passengers rp
      join public.users u on u.id = rp.user_id
      where rp.ride_id = p_ride_id and rp.left_at is null
      order by rp.joined_at;
  else
    -- the driver
    return query
      select u.id, u.name, u.phone, 'driver'::text
      from public.users u
      where u.id = v_ride.driver_id;
  end if;
end;
$$;

revoke all on function public.get_ride_contacts(uuid) from public, anon;
grant execute on function public.get_ride_contacts(uuid) to authenticated;
