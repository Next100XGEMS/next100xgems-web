begin;

-- Project Platform Phase 1 — project entity + provenance enum (PP1-1).
-- Additive; deny-by-default. Does not touch Radar/Analyzer/Research tables.

create extension if not exists citext with schema extensions;

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'project_provenance'
  ) then
    create type public.project_provenance as enum (
      'PROJECT_PROVIDED',
      'INDEPENDENTLY_VERIFIED',
      'PROVIDER_DERIVED',
      'AI_INFERENCE',
      'UNKNOWN'
    );
  end if;
end;
$$;

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  slug extensions.citext not null,
  display_name text not null check (length(btrim(display_name)) between 1 and 200),
  status text not null default 'DRAFT'
    check (status in ('DRAFT', 'ACTIVE', 'SUSPENDED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_slug_format check (
    length(btrim(slug::text)) between 1 and 80
    and slug::text ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  constraint projects_slug_unique unique (slug)
);

create index projects_status_idx on public.projects(status);
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

alter table public.projects enable row level security;
revoke all on table public.projects from public, anon, authenticated, service_role;

commit;
