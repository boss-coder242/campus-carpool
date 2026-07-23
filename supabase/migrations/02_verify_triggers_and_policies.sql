-- ============================================================
-- 02_verify_triggers_and_policies
-- Read-only checks. Changes nothing. Run after 01 (and re-run
-- after 03/04) to confirm the schema landed.
-- ============================================================

-- Triggers guarding auth + profile columns.
-- Expect: enforce_chitkara_domain, on_auth_user_created, protect_user_columns
select tgname as trigger_name
from pg_trigger
where tgname in (
  'enforce_chitkara_domain',
  'on_auth_user_created',
  'protect_user_columns',
  'init_seats_left',
  'sync_ride_status',
  'protect_ride_columns'
)
order by tgname;

-- RLS policies per table.
select tablename, policyname, cmd
from pg_policies
where tablename in ('users', 'rides', 'ride_passengers')
order by tablename, policyname;

-- RLS actually enabled? Expect rls_enabled = true on all three.
select relname as table_name, relrowsecurity as rls_enabled
from pg_class
where relname in ('users', 'rides', 'ride_passengers');

-- The join/leave RPCs exist and are security definer.
select proname as function_name, prosecdef as security_definer
from pg_proc
where proname in ('join_ride', 'leave_ride');

-- public_profiles view exists (drivers are read through this, not users).
select table_name from information_schema.views
where table_schema = 'public' and table_name = 'public_profiles';
