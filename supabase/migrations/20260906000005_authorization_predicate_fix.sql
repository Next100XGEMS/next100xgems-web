begin;

create or replace function private.current_app_roles()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  with assigned_roles as (
    select distinct r.key
    from public.profiles as p
    join public.user_roles as ur on ur.user_id = p.id
    join public.roles as r on r.id = ur.role_id
    where p.id = (select auth.uid())
      and p.status = 'ACTIVE'
      and r.key in (
        'owner', 'admin', 'editor', 'radar_reviewer',
        'ad_manager', 'analyst', 'viewer'
      )
      and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
  ),
  collected as (
    select coalesce(array_agg(key order by key), array[]::text[]) as role_keys
    from assigned_roles
  )
  select case
    when role_keys @> array['ad_manager']::text[]
      and role_keys && array['editor', 'radar_reviewer', 'analyst']::text[]
      then array[]::text[]
    else role_keys
  end
  from collected;
$$;

revoke all on function private.current_app_roles() from public, anon, authenticated, service_role;
grant execute on function private.current_app_roles() to authenticated;

commit;
