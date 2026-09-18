begin;

-- A stale fence must remain a stale-fence error even after a newer worker has
-- already accepted an equivalent completion. Exact replay is idempotent only
-- for the same accepted fence and result identity.
create or replace function public.radar_system_complete_screening(
  p_work_item_id uuid,
  p_worker text,
  p_lease_token uuid,
  p_lease_generation bigint,
  p_result text,
  p_reasons jsonb,
  p_input_hash text,
  p_evaluated_at timestamptz
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  completed_id uuid;
  work_row public.radar_work_items%rowtype;
  current_generation bigint;
  normalized_reasons jsonb := coalesce(p_reasons, '[]'::jsonb);
begin
  if p_lease_token is null or p_lease_generation is null or p_input_hash is null then
    raise exception 'screening completion requires a lease fence and input hash' using errcode = '22023';
  end if;
  if p_result not in ('PASS', 'REJECT', 'INCOMPLETE') then
    raise exception 'invalid screening result' using errcode = '22023';
  end if;
  current_generation := private.radar_pause_guard(true);
  select * into work_row from public.radar_work_items where id = p_work_item_id for update;
  if not found then raise exception 'work item not found' using errcode = '23503'; end if;

  if work_row.lease_generation is distinct from p_lease_generation then
    raise exception 'work lease is stale or invalid' using errcode = '40001';
  end if;
  if work_row.state = 'SUCCEEDED' then
    if work_row.input_hash = p_input_hash
       and work_row.screening_result = p_result
       and work_row.screening_reasons = normalized_reasons then
      return work_row.id;
    end if;
    raise exception 'screening completion conflicts with the accepted result' using errcode = '22023';
  end if;

  if work_row.state <> 'RUNNING' or work_row.lease_owner is distinct from p_worker
     or work_row.lease_token is distinct from p_lease_token
     or work_row.lease_expires_at <= statement_timestamp()
     or work_row.pause_generation <> current_generation
     or work_row.sealed_at is null
     or work_row.input_hash is distinct from p_input_hash then
    raise exception 'work lease is stale or invalid' using errcode = '40001';
  end if;

  update public.radar_work_items
  set state = 'SUCCEEDED', screening_result = p_result,
      screening_reasons = normalized_reasons,
      screening_evaluated_at = coalesce(p_evaluated_at, statement_timestamp()),
      lease_owner = null, lease_token = null, lease_expires_at = null
  where id = p_work_item_id;
  completed_id := p_work_item_id;
  perform private.radar_system_audit('radar.screening_completed', completed_id,
    null, jsonb_build_object('state', 'SUCCEEDED', 'screening_result', p_result),
    jsonb_build_object('schema_version', 2, 'input_hash', p_input_hash,
      'lease_generation', p_lease_generation));
  return completed_id;
end;
$$;
revoke all on function public.radar_system_complete_screening(uuid, text, uuid, bigint, text, jsonb, text, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.radar_system_complete_screening(uuid, text, uuid, bigint, text, jsonb, text, timestamptz)
  to service_role;

commit;
