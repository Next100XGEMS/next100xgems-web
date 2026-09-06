begin;

-- The private schema is not an exposed Data API schema. It contains only the
-- current-user role lookup used by RLS and the authenticated server client.
create schema private;
revoke all on schema private from public, anon, authenticated, service_role;
grant usage on schema private to authenticated;

create function private.current_app_roles()
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
    when role_keys && array['ad_manager', 'editor']::text[]
      or role_keys && array['ad_manager', 'radar_reviewer']::text[]
      or role_keys && array['ad_manager', 'analyst']::text[]
      then array[]::text[]
    else role_keys
  end
  from collected;
$$;

revoke all on function private.current_app_roles() from public, anon, authenticated, service_role;
grant execute on function private.current_app_roles() to authenticated;

create function public.get_my_authorization()
returns table (user_id uuid, role_keys text[])
language sql
stable
security invoker
set search_path = ''
as $$
  select (select auth.uid()), (select private.current_app_roles());
$$;

revoke all on function public.get_my_authorization() from public, anon, authenticated, service_role;
grant execute on function public.get_my_authorization() to authenticated;

-- Revoke table privileges before granting only the scoped authenticated reads
-- below. No API role receives INSERT, UPDATE or DELETE in Gate 6B.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'roles', 'user_roles', 'feature_flags', 'site_settings',
    'audit_logs', 'articles', 'partners', 'sponsors', 'ad_placements',
    'ad_campaigns', 'ad_creatives', 'ad_campaign_placements', 'leads',
    'tokens', 'radar_analyses', 'radar_reviews'
  ] loop
    execute format(
      'revoke all on table public.%I from public, anon, authenticated, service_role',
      table_name
    );
  end loop;
end;
$$;

grant select (id, display_name, status, created_at, updated_at)
  on table public.profiles to authenticated;
grant select (id, key, name, created_at, updated_at)
  on table public.roles to authenticated;
grant select (id, user_id, role_id, created_at)
  on table public.user_roles to authenticated;
grant select (id, key, enabled, configuration, updated_by, created_at, updated_at)
  on table public.feature_flags to authenticated;
grant select (id, singleton, site_name, site_description, updated_by, created_at, updated_at)
  on table public.site_settings to authenticated;

grant select (id, title, slug, author_id, status, classification, tldr, body_markdown,
  seo_title, seo_description, disclosure, scheduled_at, published_at, created_at, updated_at)
  on table public.articles to authenticated;
grant select (id, name, slug, logo_reference, description, website_url, x_url, telegram_url,
  active, disclosure, starts_at, ends_at, created_at, updated_at)
  on table public.partners to authenticated;
grant select (id, name, website_url, created_at, updated_at)
  on table public.sponsors to authenticated;
grant select (id, code, name, enabled, desktop_enabled, mobile_enabled, sponsored_label,
  created_at, updated_at)
  on table public.ad_placements to authenticated;
grant select (id, sponsor_id, name, status, starts_at, ends_at, created_at, updated_at)
  on table public.ad_campaigns to authenticated;
grant select (id, campaign_id, headline, body, media_reference, cta, destination_url,
  enabled, created_at, updated_at)
  on table public.ad_creatives to authenticated;
grant select (id, campaign_id, placement_id, creative_id, enabled, created_at, updated_at)
  on table public.ad_campaign_placements to authenticated;
grant select (id, project_name, contact_name, contact_method, contact_value, website_url,
  interested_service, budget_note, launch_date, notes, status, created_at, updated_at)
  on table public.leads to authenticated;
grant select (id, chain, contract_address, contract_address_key, symbol, name, created_at, updated_at)
  on table public.tokens to authenticated;
grant select (id, token_id, version, status, score, deterministic_data, ai_inference,
  risk_summary, analyzed_at, data_as_of, created_at)
  on table public.radar_analyses to authenticated;
grant select (id, analysis_id, state, reviewed_by, reviewed_at, editorial_note,
  published_at, created_at, updated_at)
  on table public.radar_reviews to authenticated;

create policy profiles_staff_select on public.profiles
  for select to authenticated
  using (
    (select private.current_app_roles()) && array['owner', 'admin']::text[]
    or (
      cardinality((select private.current_app_roles())) > 0
      and id = (select auth.uid())
    )
  );

create policy roles_staff_select on public.roles
  for select to authenticated
  using ((select private.current_app_roles()) && array['owner', 'admin']::text[]);

create policy user_roles_staff_select on public.user_roles
  for select to authenticated
  using ((select private.current_app_roles()) && array['owner', 'admin']::text[]);

create policy feature_flags_staff_select on public.feature_flags
  for select to authenticated
  using ((select private.current_app_roles()) && array['owner', 'admin']::text[]);

create policy site_settings_staff_select on public.site_settings
  for select to authenticated
  using ((select private.current_app_roles()) && array['owner', 'admin']::text[]);

create policy articles_staff_select on public.articles
  for select to authenticated
  using (
    (select private.current_app_roles()) && array['owner', 'admin', 'editor']::text[]
    or (
      (select private.current_app_roles()) @> array['analyst']::text[]
      and author_id = (select auth.uid())
      and status = 'DRAFT'
    )
    or (
      (select private.current_app_roles()) && array['analyst', 'viewer']::text[]
      and status = 'PUBLISHED'
      and published_at <= statement_timestamp()
      and (scheduled_at is null or scheduled_at <= statement_timestamp())
    )
  );

create policy partners_staff_select on public.partners
  for select to authenticated
  using (
    (select private.current_app_roles()) && array['owner', 'admin', 'ad_manager']::text[]
    or (
      (select private.current_app_roles()) @> array['viewer']::text[]
      and active is true
      and (starts_at is null or starts_at <= statement_timestamp())
      and (ends_at is null or ends_at > statement_timestamp())
    )
  );

create policy sponsors_staff_select on public.sponsors
  for select to authenticated
  using ((select private.current_app_roles()) && array['owner', 'admin', 'ad_manager']::text[]);

create policy ad_placements_staff_select on public.ad_placements
  for select to authenticated
  using ((select private.current_app_roles()) && array['owner', 'admin', 'ad_manager']::text[]);

create policy ad_campaigns_staff_select on public.ad_campaigns
  for select to authenticated
  using ((select private.current_app_roles()) && array['owner', 'admin', 'ad_manager']::text[]);

create policy ad_creatives_staff_select on public.ad_creatives
  for select to authenticated
  using ((select private.current_app_roles()) && array['owner', 'admin', 'ad_manager']::text[]);

create policy ad_campaign_placements_staff_select on public.ad_campaign_placements
  for select to authenticated
  using ((select private.current_app_roles()) && array['owner', 'admin', 'ad_manager']::text[]);

create policy leads_staff_select on public.leads
  for select to authenticated
  using ((select private.current_app_roles()) && array['owner', 'admin', 'ad_manager']::text[]);

create policy tokens_staff_select on public.tokens
  for select to authenticated
  using ((select private.current_app_roles()) && array['owner', 'admin', 'radar_reviewer', 'analyst']::text[]);

create policy radar_analyses_staff_select on public.radar_analyses
  for select to authenticated
  using ((select private.current_app_roles()) && array['owner', 'admin', 'radar_reviewer', 'analyst']::text[]);

create policy radar_reviews_staff_select on public.radar_reviews
  for select to authenticated
  using ((select private.current_app_roles()) && array['owner', 'admin', 'radar_reviewer']::text[]);

-- audit_logs intentionally has no policy or API grant. All application-table
-- INSERT, UPDATE, DELETE and TRUNCATE operations remain denied by ACLs/RLS.

commit;
