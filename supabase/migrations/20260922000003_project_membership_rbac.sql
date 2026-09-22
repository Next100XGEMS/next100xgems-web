begin;

-- Project Platform Phase 1 — membership RBAC (PP1-2).
-- project_owner|project_editor|project_viewer are orthogonal to staff roles.

create table public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('project_owner', 'project_editor', 'project_viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_members_project_user_unique unique (project_id, user_id)
);

create index project_members_user_idx on public.project_members(user_id);
create index project_members_project_role_idx on public.project_members(project_id, role);
create trigger project_members_set_updated_at
  before update on public.project_members
  for each row execute function public.set_updated_at();

alter table public.project_members enable row level security;
revoke all on table public.project_members from public, anon, authenticated, service_role;

-- Returns true when the current auth user is an ACTIVE profile with a matching
-- project membership. p_roles null = any role on the project.
create function private.is_project_member(p_project_id uuid, p_roles text[] default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.project_members as m
    join public.profiles as p on p.id = m.user_id
    where m.project_id = p_project_id
      and m.user_id = (select auth.uid())
      and p.status = 'ACTIVE'
      and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
      and (
        p_roles is null
        or cardinality(p_roles) = 0
        or m.role = any (p_roles)
      )
  );
$$;

revoke all on function private.is_project_member(uuid, text[])
  from public, anon, authenticated, service_role;
grant execute on function private.is_project_member(uuid, text[]) to authenticated;

-- Staff helper: owner/admin only (never elevated by project roles).
create function private.is_project_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.current_app_roles()) && array['owner', 'admin']::text[];
$$;

revoke all on function private.is_project_staff()
  from public, anon, authenticated, service_role;
grant execute on function private.is_project_staff() to authenticated;

-- Scoped reads: members see their project; staff see all.
grant select (id, slug, display_name, status, created_at, updated_at)
  on table public.projects to authenticated;
grant select (id, project_id, user_id, role, created_at, updated_at)
  on table public.project_members to authenticated;

create policy projects_member_or_staff_select on public.projects
  for select to authenticated
  using (
    private.is_project_staff()
    or private.is_project_member(id, null)
  );

create policy project_members_self_or_staff_select on public.project_members
  for select to authenticated
  using (
    private.is_project_staff()
    or private.is_project_member(project_id, null)
  );

-- No INSERT/UPDATE/DELETE policies: mutations go through audited RPCs only.

commit;
