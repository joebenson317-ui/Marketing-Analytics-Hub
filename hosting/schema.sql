-- Analytics Hub · self-hosted schema (Supabase / Postgres)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  team text,
  timezone text default 'America/New_York',
  role text not null default 'viewer' check (role in ('viewer','editor','admin')),
  status text not null default 'requested' check (status in ('requested','active','declined','paused')),
  access jsonb not null default '{"workspaces":[],"capabilities":{}}',
  request_note text,
  requested_at timestamptz default now(),
  approved_at timestamptz,
  approved_by uuid,
  password_changed_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table if not exists docs (
  collection text not null,
  id text not null,
  data jsonb not null,
  updated_at timestamptz default now(),
  primary key (collection, id)
);
create table if not exists audit (
  id text primary key,
  ts timestamptz not null default now(),
  user_id uuid,
  user_name text,
  action text not null,
  kind text,
  entity text,
  entity_id text,
  page text,
  ws text,
  detail text,
  before jsonb,
  after jsonb
);
-- password rotation: 180 days
create or replace function password_rotation_due(p uuid) returns boolean language sql stable as $$
  select coalesce((select password_changed_at < now() - interval '180 days' from profiles where id = p), false);
$$;
-- keep password_changed_at current when Supabase Auth updates the password
create or replace function on_auth_user_updated() returns trigger language plpgsql security definer as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password then
    update profiles set password_changed_at = now() where id = new.id;
  end if;
  return new;
end $$;
drop trigger if exists trg_auth_user_updated on auth.users;
create trigger trg_auth_user_updated after update on auth.users for each row execute function on_auth_user_updated();
-- create the profile row on sign-up
create or replace function on_auth_user_created() returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, email, name) values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', ''))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists trg_auth_user_created on auth.users;
create trigger trg_auth_user_created after insert on auth.users for each row execute function on_auth_user_created();
-- row-level security
alter table profiles enable row level security;
alter table docs enable row level security;
alter table audit enable row level security;
create or replace function is_admin() returns boolean language sql stable as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin' and status = 'active');
$$;
create or replace function is_active() returns boolean language sql stable as $$
  select exists (select 1 from profiles where id = auth.uid() and status = 'active');
$$;
create policy profiles_self_read on profiles for select using (id = auth.uid() or is_active());
create policy profiles_self_update on profiles for update using (id = auth.uid()) with check (id = auth.uid() and role = (select role from profiles where id = auth.uid()) and status = (select status from profiles where id = auth.uid()));
create policy profiles_admin_all on profiles for all using (is_admin()) with check (is_admin());
create policy docs_read on docs for select using (is_active());
create policy docs_write on docs for insert with check (is_active());
create policy docs_update on docs for update using (is_active()) with check (is_active());
create policy docs_delete on docs for delete using (is_admin());
create policy audit_read on audit for select using (is_active());
create policy audit_insert on audit for insert with check (auth.uid() is not null);
-- no update/delete policy on audit: append-only
