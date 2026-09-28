-- Analytics Hub · self-hosted schema for Supabase (Postgres).
-- Paste the whole file into the Supabase SQL editor and run it. Safe to run again.
--
-- profiles : one row per registered account (mirrors the Hub's "users" collection; role/status here are the truth)
-- docs     : every other Hub collection as JSON, keyed by collection + id; the activity log is collection 'audit'
-- The first account ever registered becomes the admin. Every later account starts as viewer / requested.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null default '',
  team text not null default '',
  timezone text not null default 'America/New_York',
  role text not null default 'viewer' check (role in ('viewer','editor','admin')),
  status text not null default 'requested' check (status in ('requested','active','declined','paused')),
  access jsonb not null default '{"workspaces":"all","capabilities":{}}',
  data jsonb not null default '{}',
  password_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles add column if not exists data jsonb not null default '{}';
alter table public.profiles add column if not exists access jsonb not null default '{"workspaces":"all","capabilities":{}}';

create table if not exists public.docs (
  collection text not null,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (collection, id)
);
create index if not exists docs_collection_idx on public.docs (collection);

-- ---------- helpers (security definer so policies can consult profiles without recursing into their own policy)
create or replace function public.is_active() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'active');
$$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and status = 'active');
$$;
create or replace function public.own_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;
create or replace function public.own_status() returns text
language sql stable security definer set search_path = public as $$
  select status from public.profiles where id = auth.uid();
$$;
create or replace function public.password_rotation_due(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select password_changed_at < now() - interval '180 days' from public.profiles where id = p), false);
$$;

-- ---------- first account becomes admin; keep updated_at current
create or replace function public.profiles_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where role = 'admin') then
    new.role := 'admin';
    new.status := 'active';
    new.data := coalesce(new.data, '{}'::jsonb) || jsonb_build_object('approved_at', to_char(now(), 'YYYY-MM-DD'), 'bootstrap_admin', true);
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists trg_profiles_before_insert on public.profiles;
create trigger trg_profiles_before_insert before insert on public.profiles
  for each row execute function public.profiles_before_insert();

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists trg_profiles_touch on public.profiles;
create trigger trg_profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------- Supabase Auth hooks: create the profile on sign-up, restart the 180-day clock on a password change
create or replace function public.on_auth_user_created() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data->>'name', ''))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists trg_auth_user_created on auth.users;
create trigger trg_auth_user_created after insert on auth.users
  for each row execute function public.on_auth_user_created();

create or replace function public.on_auth_user_updated() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password then
    update public.profiles set password_changed_at = now() where id = new.id;
  end if;
  if new.email is distinct from old.email then
    update public.profiles set email = coalesce(new.email, email) where id = new.id;
  end if;
  return new;
end $$;
drop trigger if exists trg_auth_user_updated on auth.users;
create trigger trg_auth_user_updated after update on auth.users
  for each row execute function public.on_auth_user_updated();

-- ---------- row-level security
alter table public.profiles enable row level security;
alter table public.docs enable row level security;
revoke all on public.profiles from anon;
revoke all on public.docs from anon;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.docs to authenticated;

-- profiles: everyone signed in sees their own row; active members see everyone; a member may edit their own
-- row but never their role, and may only move their own status to 'requested' (asking again after a decline);
-- admins do everything.
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select
  using (id = auth.uid() or public.is_active());
drop policy if exists profiles_self_insert on public.profiles;
create policy profiles_self_insert on public.profiles for insert
  with check (id = auth.uid() and role = 'viewer' and status = 'requested');
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and role = public.own_role() and status in (public.own_status(), 'requested'));
drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles for all
  using (public.is_admin()) with check (public.is_admin());

-- docs: active members read and write everything; anyone signed in may append to the activity log;
-- nobody edits or deletes activity rows; only admins delete other rows.
drop policy if exists docs_read on public.docs;
create policy docs_read on public.docs for select
  using (public.is_active());
drop policy if exists docs_insert on public.docs;
create policy docs_insert on public.docs for insert
  with check (public.is_active() or (collection = 'audit' and auth.uid() is not null));
drop policy if exists docs_update on public.docs;
create policy docs_update on public.docs for update
  using (public.is_active() and collection <> 'audit')
  with check (public.is_active() and collection <> 'audit');
drop policy if exists docs_delete on public.docs;
create policy docs_delete on public.docs for delete
  using (public.is_admin() and collection <> 'audit');
