-- ============================================================
-- Carpool App — Auth setup
-- Run in Supabase SQL Editor (or as a migration)
-- ============================================================

-- 1. users profile table -------------------------------------
create table if not exists public.users (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null unique,
  phone         text,
  name          text,
  branch        text,
  year          smallint check (year between 1 and 5),
  rating_avg    numeric(3,2) not null default 0,
  rating_count  integer not null default 0,
  created_at    timestamptz not null default now()
);

-- 2. SERVER-SIDE domain restriction --------------------------
-- Trigger on auth.users itself. Even if someone calls the auth
-- API directly (bypassing the frontend), signup fails at the DB.
create or replace function public.enforce_chitkara_domain()
returns trigger
language plpgsql
security definer
as $$
begin
  if lower(new.email) not like '%@chitkara.edu.in' then
    raise exception 'Signups are restricted to @chitkara.edu.in email addresses';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_chitkara_domain on auth.users;
create trigger enforce_chitkara_domain
  before insert on auth.users
  for each row execute function public.enforce_chitkara_domain();

-- 3. Auto-create profile row on signup -----------------------
-- Client never INSERTs into public.users; it only UPDATEs its
-- own row later (profile setup). Keeps RLS surface minimal.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4. Row Level Security --------------------------------------
alter table public.users enable row level security;

-- Read own row only
drop policy if exists "users_select_own" on public.users;
create policy "users_select_own"
  on public.users for select
  using (auth.uid() = id);

-- Update own row only — and never the trust/identity columns
drop policy if exists "users_update_own" on public.users;
create policy "users_update_own"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Block edits to email / ratings even on own row
create or replace function public.protect_user_columns()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() = new.id then           -- only restrict self-service edits
    new.email        := old.email;
    new.rating_avg   := old.rating_avg;
    new.rating_count := old.rating_count;
    new.created_at   := old.created_at;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_user_columns on public.users;
create trigger protect_user_columns
  before update on public.users
  for each row execute function public.protect_user_columns();

-- No INSERT or DELETE policies => clients cannot insert/delete rows.
