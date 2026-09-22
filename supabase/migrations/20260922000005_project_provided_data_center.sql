begin;

-- Project Platform Phase 1 — Official Data Center (PP1-5).
-- Bounded allowlist; PROJECT_PROVIDED writes only; cannot overwrite verified.

create table public.project_field_values (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  field_key text not null check (field_key ~ '^[a-z][a-z0-9_]*$'),
  value jsonb not null,
  provenance public.project_provenance not null default 'PROJECT_PROVIDED',
  version integer not null default 1 check (version > 0),
  updated_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_field_values_project_key_unique unique (project_id, field_key)
);

create table public.project_field_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  field_key text not null,
  value jsonb not null,
  provenance public.project_provenance not null,
  version integer not null check (version > 0),
  updated_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint project_field_versions_unique unique (project_id, field_key, version)
);

create index project_field_values_project_idx on public.project_field_values(project_id);
create index project_field_versions_project_idx
  on public.project_field_versions(project_id, field_key, version desc);

create trigger project_field_values_set_updated_at
  before update on public.project_field_values
  for each row execute function public.set_updated_at();

create trigger project_field_versions_no_mutation
  before update or delete on public.project_field_versions
  for each row execute function public.reject_immutable_change();

alter table public.project_field_values enable row level security;
alter table public.project_field_versions enable row level security;
revoke all on table public.project_field_values from public, anon, authenticated, service_role;
revoke all on table public.project_field_versions from public, anon, authenticated, service_role;

grant select (
  id, project_id, field_key, value, provenance, version, updated_by, created_at, updated_at
) on table public.project_field_values to authenticated;
grant select (
  id, project_id, field_key, value, provenance, version, updated_by, created_at
) on table public.project_field_versions to authenticated;

create policy project_field_values_member_or_staff_select on public.project_field_values
  for select to authenticated
  using (
    private.is_project_staff()
    or private.is_project_member(project_id, null)
  );

create policy project_field_versions_member_or_staff_select on public.project_field_versions
  for select to authenticated
  using (
    private.is_project_staff()
    or private.is_project_member(project_id, null)
  );

create function private.project_field_key_is_allowed(p_field_key text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_field_key in (
    'website',
    'x_url',
    'telegram_url',
    'discord_url',
    'short_description',
    'logo_url',
    'contact_email',
    'contact_note'
  );
$$;

create function private.project_field_value_is_allowed(p_field_key text, p_value jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_field_key
    when 'website' then
      jsonb_typeof(p_value) = 'string' and length(btrim(p_value#>>'{}')) between 1 and 500
    when 'x_url' then
      jsonb_typeof(p_value) = 'string' and length(btrim(p_value#>>'{}')) between 1 and 500
    when 'telegram_url' then
      jsonb_typeof(p_value) = 'string' and length(btrim(p_value#>>'{}')) between 1 and 500
    when 'discord_url' then
      jsonb_typeof(p_value) = 'string' and length(btrim(p_value#>>'{}')) between 1 and 500
    when 'short_description' then
      jsonb_typeof(p_value) = 'string' and length(btrim(p_value#>>'{}')) between 1 and 500
    when 'logo_url' then
      jsonb_typeof(p_value) = 'string' and length(btrim(p_value#>>'{}')) between 1 and 500
    when 'contact_email' then
      jsonb_typeof(p_value) = 'string' and length(btrim(p_value#>>'{}')) between 3 and 254
    when 'contact_note' then
      jsonb_typeof(p_value) = 'string' and length(btrim(p_value#>>'{}')) between 1 and 500
    else false
  end;
$$;

-- Editors/owners may set PROJECT_PROVIDED values only; never overwrite verified.
create function public.set_project_field_value(
  p_project_id uuid,
  p_field_key text,
  p_value jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_existing public.project_field_values;
  v_existing_found boolean := false;
  v_next_version integer;
  v_row public.project_field_values;
  v_previous jsonb := null;
begin
  if v_uid is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if not private.is_project_member(
    p_project_id,
    array['project_owner', 'project_editor']::text[]
  ) then
    raise exception 'Project editor access is required' using errcode = '42501';
  end if;

  if not private.project_field_key_is_allowed(p_field_key) then
    raise exception 'Field is not editable in the Data Center' using errcode = '22023';
  end if;

  if not private.project_field_value_is_allowed(p_field_key, p_value) then
    raise exception 'Invalid field value' using errcode = '22023';
  end if;

  select * into v_existing
  from public.project_field_values
  where project_id = p_project_id and field_key = p_field_key
  for update;
  v_existing_found := found;

  if v_existing_found then
    if v_existing.provenance in (
      'INDEPENDENTLY_VERIFIED'::public.project_provenance,
      'PROVIDER_DERIVED'::public.project_provenance,
      'AI_INFERENCE'::public.project_provenance
    ) then
      raise exception 'Cannot overwrite independently sourced field'
        using errcode = '55000';
    end if;
    v_previous := jsonb_build_object(
      'field_key', v_existing.field_key,
      'value', v_existing.value,
      'provenance', v_existing.provenance::text,
      'version', v_existing.version
    );
    v_next_version := v_existing.version + 1;
    update public.project_field_values
    set
      value = p_value,
      provenance = 'PROJECT_PROVIDED',
      version = v_next_version,
      updated_by = v_uid
    where id = v_existing.id
    returning * into v_row;
  else
    v_next_version := 1;
    insert into public.project_field_values (
      project_id, field_key, value, provenance, version, updated_by
    ) values (
      p_project_id, p_field_key, p_value, 'PROJECT_PROVIDED', v_next_version, v_uid
    )
    returning * into v_row;
  end if;

  insert into public.project_field_versions (
    project_id, field_key, value, provenance, version, updated_by
  ) values (
    v_row.project_id, v_row.field_key, v_row.value, v_row.provenance, v_row.version, v_uid
  );

  perform public.write_audit_event(
    'USER', v_uid, 'project.field.updated', 'project_field', v_row.id,
    v_previous,
    jsonb_build_object(
      'field_key', v_row.field_key,
      'value', v_row.value,
      'provenance', v_row.provenance::text,
      'version', v_row.version,
      'project_id', v_row.project_id
    ),
    '{}'::jsonb
  );

  return jsonb_build_object(
    'project_id', v_row.project_id,
    'field_key', v_row.field_key,
    'version', v_row.version,
    'provenance', v_row.provenance::text
  );
end;
$$;

revoke all on function public.set_project_field_value(uuid, text, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.set_project_field_value(uuid, text, jsonb)
  to authenticated;

commit;
