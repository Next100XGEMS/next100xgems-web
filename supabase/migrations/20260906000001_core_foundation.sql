begin;

-- These defaults apply to objects created by the migration owner (postgres).
-- Each migration also explicitly revokes grants on its own objects.
alter default privileges for role postgres in schema public
  revoke all on tables from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all on sequences from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated, service_role;

create function public.set_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

create function public.reject_immutable_change()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  raise exception '% is append-only; % is not permitted', tg_table_name, tg_op
    using errcode = '55000';
end;
$$;
revoke all on function public.set_updated_at(), public.reject_immutable_change()
  from public, anon, authenticated, service_role;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  display_name text check (display_name is null or length(btrim(display_name)) > 0),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'SUSPENDED', 'ARCHIVED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_]*$'),
  name text not null unique check (length(btrim(name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint user_roles_user_role_key unique (user_id, role_id)
);
create index user_roles_role_id_idx on public.user_roles(role_id);

create table public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_]*$'),
  enabled boolean not null default false,
  configuration jsonb check (configuration is null or jsonb_typeof(configuration) = 'object'),
  updated_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index feature_flags_updated_by_idx on public.feature_flags(updated_by);

-- A typed singleton instead of arbitrary JSON configuration. No row is seeded.
create table public.site_settings (
  id uuid primary key default gen_random_uuid(),
  singleton boolean not null default true unique check (singleton),
  site_name text not null check (length(btrim(site_name)) > 0),
  site_description text not null default '',
  updated_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index site_settings_updated_by_idx on public.site_settings(updated_by);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete restrict,
  action text not null check (length(btrim(action)) > 0),
  resource_type text not null check (length(btrim(resource_type)) > 0),
  -- Deliberately not an FK: deleting a resource must not delete its history.
  resource_id uuid not null,
  previous_state jsonb check (previous_state is null or jsonb_typeof(previous_state) = 'object'),
  resulting_state jsonb check (resulting_state is null or jsonb_typeof(resulting_state) = 'object'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);
create index audit_logs_actor_created_idx on public.audit_logs(actor_id, created_at desc);
create index audit_logs_resource_created_idx on public.audit_logs(resource_type, resource_id, created_at desc);
create trigger audit_logs_no_mutation before update or delete on public.audit_logs
  for each row execute function public.reject_immutable_change();
create trigger audit_logs_no_truncate before truncate on public.audit_logs
  for each statement execute function public.reject_immutable_change();

-- Reference definitions only: no users, assignments or environment-specific data.
insert into public.roles (key, name) values
  ('owner', 'Owner'), ('admin', 'Admin'), ('editor', 'Editor'),
  ('radar_reviewer', 'Radar Reviewer'), ('ad_manager', 'Ad Manager'),
  ('analyst', 'Analyst'), ('viewer', 'Viewer');

-- Availability is OFF; maintenance is ON. No code consumes these flags yet.
insert into public.feature_flags (key, enabled) values
  ('radar_enabled', false), ('research_enabled', false),
  ('advertising_enabled', false), ('featured_partners_enabled', false),
  ('booking_enabled', false), ('newsletter_enabled', false),
  ('maintenance_mode', true), ('radar_auto_publish', false);

do $$
declare table_name text;
begin
  foreach table_name in array array['profiles', 'roles', 'user_roles', 'feature_flags', 'site_settings', 'audit_logs'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated, service_role', table_name);
  end loop;
  foreach table_name in array array['profiles', 'roles', 'feature_flags', 'site_settings'] loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name);
  end loop;
end;
$$;

commit;
