begin;

-- Qualify the concurrent enqueue lookup so the canonical request variable is
-- never confused with the persisted request_fingerprint column.
create or replace function public.radar_system_enqueue_work(
  p_request_key text,
  p_work_kind text,
  p_token_id uuid,
  p_event_id uuid,
  p_parent_analysis_id uuid,
  p_method_version text,
  p_input_version text,
  p_available_at timestamptz
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  work_id uuid;
  existing_work public.radar_work_items%rowtype;
  reserved_version integer;
  pause_generation bigint;
  request_fingerprint text;
begin
  pause_generation := private.radar_pause_guard(true);
  request_fingerprint := encode(
    extensions.digest(convert_to(jsonb_build_object(
      'operation', p_work_kind, 'token_id', p_token_id, 'event_id', p_event_id,
      'parent_analysis_id', p_parent_analysis_id, 'method_version', p_method_version,
      'input_version', p_input_version
    )::text, 'UTF8'), 'sha256'), 'hex');
  select * into existing_work from public.radar_work_items where request_key = p_request_key;
  if existing_work.id is not null then
    if existing_work.request_fingerprint is distinct from request_fingerprint
       and (existing_work.work_kind is distinct from p_work_kind
         or existing_work.token_id is distinct from p_token_id
         or existing_work.event_id is distinct from p_event_id
         or existing_work.parent_analysis_id is distinct from p_parent_analysis_id
         or existing_work.method_version is distinct from p_method_version
         or existing_work.input_version is distinct from p_input_version) then
      raise exception 'work request key conflicts with an existing canonical request' using errcode = '23505';
    elsif existing_work.request_fingerprint is not null
      and existing_work.request_fingerprint is distinct from request_fingerprint then
      raise exception 'work request key conflicts with an existing canonical request' using errcode = '23505';
    end if;
    return existing_work.id;
  end if;
  if p_work_kind in ('SCREENING', 'DEEP_ANALYSIS', 'REANALYSIS', 'RECALCULATION') then
    if p_token_id is null then raise exception 'token is required for analysis work' using errcode = '23514'; end if;
    perform 1 from public.tokens where id = p_token_id for update;
    if not found then raise exception 'token not found' using errcode = '23503'; end if;
    select greatest(
      coalesce((select max(version) from public.radar_analyses where token_id = p_token_id), 0),
      coalesce((select max(reserved_analysis_version) from public.radar_work_items where token_id = p_token_id), 0)
    ) + 1 into reserved_version;
  end if;
  insert into public.radar_work_items(
    work_kind, token_id, event_id, parent_analysis_id, request_key,
    request_operation, request_fingerprint, available_at, method_version, input_version,
    reserved_analysis_version, pause_generation
  ) values (
    p_work_kind, p_token_id, p_event_id, p_parent_analysis_id, p_request_key,
    p_work_kind, request_fingerprint, coalesce(p_available_at, statement_timestamp()),
    p_method_version, p_input_version, reserved_version, pause_generation
  ) on conflict (request_key) do nothing
  returning id into work_id;
  if work_id is null then
    select w.id, w.request_fingerprint into work_id, existing_work.request_fingerprint
    from public.radar_work_items w where w.request_key = p_request_key;
    if existing_work.request_fingerprint is distinct from request_fingerprint then
      raise exception 'work request key conflicts with an existing canonical request' using errcode = '23505';
    end if;
  end if;
  return work_id;
end;
$$;
revoke all on function public.radar_system_enqueue_work(text, text, uuid, uuid, uuid, text, text, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.radar_system_enqueue_work(text, text, uuid, uuid, uuid, text, text, timestamptz)
  to service_role;

commit;
