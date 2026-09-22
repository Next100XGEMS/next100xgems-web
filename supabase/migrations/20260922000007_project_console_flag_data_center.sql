begin;

-- Project Platform Phase 1 QA fix — gate Data Center RPC on project_console_enabled
-- (mirror claims/corrections fail-closed pattern; CF-33).

create or replace function private.project_console_enabled()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.feature_flags
    where key = 'project_console_enabled'
      and enabled
      and (configuration is null or jsonb_typeof(configuration) = 'object')
  );
$$;

create or replace function public.set_project_field_value(
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

  if not private.project_console_enabled() then
    raise exception 'Project console is not available' using errcode = '55000';
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
