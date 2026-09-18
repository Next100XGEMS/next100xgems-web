begin;

-- pgcrypto is a standard Supabase-local extension already available in the
-- project; ensure scratch/clean replays expose its database-authoritative
-- SHA-256 function without adding an application dependency.
create extension if not exists pgcrypto with schema extensions;

-- Gate 19C-F1 is an additive integrity correction.  The original Radar
-- foundation migration remains unchanged; these contracts close the proven
-- worker-fencing, pause, input, replay and concurrency gaps.

alter table public.radar_events
  add column canonical_fingerprint text
    check (canonical_fingerprint is null or canonical_fingerprint ~ '^[0-9a-f]{64}$');

alter table public.radar_work_items
  add column request_actor_id uuid references public.profiles(id) on delete restrict,
  add column request_operation text
    check (request_operation is null or request_operation ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  add column request_fingerprint text
    check (request_fingerprint is null or request_fingerprint ~ '^[0-9a-f]{64}$'),
  add column failure_retryable boolean;

create index radar_work_items_request_actor_idx
  on public.radar_work_items(request_actor_id, request_operation);

create or replace function private.radar_provenance_is_allowed(p_provenance jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select p_provenance is not null
    and jsonb_typeof(p_provenance) = 'object'
    and (select count(*) from jsonb_object_keys(p_provenance)) <= 8
    and not exists (
      select 1
      from jsonb_object_keys(p_provenance) as key_name
      where key_name not in (
        'authority', 'provider', 'reference_id', 'source_url',
        'normalization_version', 'reason', 'chain', 'last_verified',
        'trace_reference'
      )
    )
    and not exists (
      select 1
      from jsonb_each(p_provenance) as item(key_name, value)
      where jsonb_typeof(item.value) not in ('string', 'number', 'boolean', 'null')
    );
$$;
revoke all on function private.radar_provenance_is_allowed(jsonb)
  from public, anon, authenticated, service_role;

alter table public.radar_observations
  add constraint radar_observations_non_available_value_check check (
    data_state = 'AVAILABLE'
    or (normalized_value is null and raw_integer_value is null)
  ),
  add constraint radar_observations_provenance_allowlist_check check (
    private.radar_provenance_is_allowed(provenance)
  );

create or replace function private.radar_pause_guard(p_require_operational boolean)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  control public.feature_flags%rowtype;
  generation_text text;
  current_generation bigint;
begin
  select * into control
  from public.feature_flags
  where key = 'radar_emergency_paused'
  for share;

  if not found
     or control.enabled is null
     or control.configuration is null
     or jsonb_typeof(control.configuration) <> 'object' then
    raise exception 'Radar emergency control is missing or malformed' using errcode = '55000';
  end if;

  generation_text := control.configuration->>'generation';
  if generation_text is null
     or generation_text !~ '^[0-9]+$'
     or length(generation_text) > 18 then
    raise exception 'Radar emergency control generation is missing or malformed' using errcode = '55000';
  end if;

  begin
    current_generation := generation_text::bigint;
  exception when numeric_value_out_of_range then
    raise exception 'Radar emergency control generation is out of range' using errcode = '55000';
  end;

  if p_require_operational and control.enabled then
    raise exception 'Radar emergency pause blocks this operation' using errcode = '55000';
  end if;
  return current_generation;
end;
$$;
revoke all on function private.radar_pause_guard(boolean)
  from public, anon, authenticated, service_role;

create or replace function private.radar_pause_generation()
returns bigint language sql stable security definer set search_path = '' as $$
  select private.radar_pause_guard(false);
$$;
revoke all on function private.radar_pause_generation()
  from public, anon, authenticated, service_role;

create or replace function private.radar_flag_enabled(p_key text, p_default boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  flag_value boolean;
begin
  if p_key = 'radar_emergency_paused' then
    -- This also locks and validates the complete emergency control record.
    perform private.radar_pause_guard(false);
  end if;
  select enabled into flag_value from public.feature_flags where key = p_key;
  return coalesce(flag_value, p_default);
end;
$$;
revoke all on function private.radar_flag_enabled(text, boolean)
  from public, anon, authenticated, service_role;

create or replace function private.radar_input_fingerprint(p_work_item_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select encode(
    extensions.digest(
      convert_to(
        coalesce(
          (
            select string_agg(wi.observation_id::text || ':' || o.content_hash, ',' order by wi.observation_id)
            from public.radar_work_inputs wi
            join public.radar_observations o on o.id = wi.observation_id
            where wi.work_item_id = p_work_item_id
          ),
          ''
        ),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
$$;
revoke all on function private.radar_input_fingerprint(uuid)
  from public, anon, authenticated, service_role;

create or replace function private.radar_request_fingerprint(
  p_actor_id uuid,
  p_operation text,
  p_token_id uuid,
  p_analysis_id uuid,
  p_payload jsonb
)
returns text language sql immutable security definer set search_path = '' as $$
  select encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'actor_id', p_actor_id,
          'operation', p_operation,
          'token_id', p_token_id,
          'analysis_id', p_analysis_id,
          'payload', coalesce(p_payload, '{}'::jsonb)
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
$$;
revoke all on function private.radar_request_fingerprint(uuid, text, uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;

create or replace function public.radar_system_insert_event(
  p_event_key text,
  p_event_type text,
  p_token_id uuid,
  p_source_provider text,
  p_source_event_id text,
  p_payload_hash text,
  p_context jsonb,
  p_observed_at timestamptz
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  event_id uuid;
  existing_fingerprint text;
  canonical_fingerprint text;
  canonical_context jsonb := coalesce(p_context, '{}'::jsonb);
begin
  perform private.radar_pause_guard(true);
  canonical_fingerprint := encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'event_key_version', 'v1', 'event_key', p_event_key,
          'event_type', p_event_type, 'token_id', p_token_id,
          'source_provider', p_source_provider, 'source_event_id', p_source_event_id,
          'context', canonical_context
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  insert into public.radar_events(
    event_key, event_type, token_id, source_provider, source_event_id,
    payload_hash, canonical_fingerprint, context, observed_at
  ) values (
    p_event_key, p_event_type, p_token_id, p_source_provider, p_source_event_id,
    canonical_fingerprint, canonical_fingerprint, canonical_context, p_observed_at
  ) on conflict (event_key_version, event_key) do nothing
  returning id into event_id;

  if event_id is null then
    select e.id, coalesce(e.canonical_fingerprint, encode(
      extensions.digest(
        convert_to(jsonb_build_object(
          'event_key_version', e.event_key_version, 'event_key', e.event_key,
          'event_type', e.event_type, 'token_id', e.token_id,
          'source_provider', e.source_provider, 'source_event_id', e.source_event_id,
          'context', e.context
        )::text, 'UTF8'), 'sha256'
      ), 'hex'
    ))
    into event_id, existing_fingerprint
    from public.radar_events e
    where e.event_key_version = 'v1' and e.event_key = p_event_key;
    if existing_fingerprint is distinct from canonical_fingerprint then
      raise exception 'event key conflicts with an existing canonical request' using errcode = '23505';
    end if;
  end if;
  return event_id;
end;
$$;
revoke all on function public.radar_system_insert_event(text, text, uuid, text, text, text, jsonb, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.radar_system_insert_event(text, text, uuid, text, text, text, jsonb, timestamptz)
  to service_role;

create or replace function public.radar_system_record_observation(
  p_event_id uuid,
  p_token_id uuid,
  p_provider text,
  p_adapter_version text,
  p_capability text,
  p_metric_key text,
  p_data_state text,
  p_normalized_value numeric,
  p_raw_integer_value numeric,
  p_decimal_places integer,
  p_unit text,
  p_context jsonb,
  p_provenance jsonb,
  p_trace_reference text,
  p_content_hash text,
  p_observed_at timestamptz
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  observation_id uuid;
begin
  perform private.radar_pause_guard(true);
  insert into public.radar_observations(
    event_id, token_id, provider, adapter_version, capability, metric_key,
    data_state, normalized_value, raw_integer_value, decimal_places, unit,
    context, provenance, trace_reference, content_hash, observed_at
  ) values (
    p_event_id, p_token_id, p_provider, p_adapter_version, p_capability, p_metric_key,
    p_data_state, p_normalized_value, p_raw_integer_value, p_decimal_places, p_unit,
    coalesce(p_context, '{}'::jsonb), p_provenance, p_trace_reference, p_content_hash, p_observed_at
  ) on conflict (event_id, provider, capability, metric_key, content_hash) do nothing
  returning id into observation_id;
  if observation_id is null then
    select id into observation_id from public.radar_observations
    where event_id = p_event_id and provider = p_provider and capability = p_capability
      and metric_key = p_metric_key and content_hash = p_content_hash;
  end if;
  return observation_id;
end;
$$;
revoke all on function public.radar_system_record_observation(uuid, uuid, text, text, text, text, text, numeric, numeric, integer, text, jsonb, jsonb, text, text, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.radar_system_record_observation(uuid, uuid, text, text, text, text, text, numeric, numeric, integer, text, jsonb, jsonb, text, text, timestamptz)
  to service_role;

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
       and (
         existing_work.work_kind is distinct from p_work_kind
         or existing_work.token_id is distinct from p_token_id
         or existing_work.event_id is distinct from p_event_id
         or existing_work.parent_analysis_id is distinct from p_parent_analysis_id
         or existing_work.method_version is distinct from p_method_version
         or existing_work.input_version is distinct from p_input_version
       ) then
      raise exception 'work request key conflicts with an existing canonical request' using errcode = '23505';
    elsif existing_work.request_fingerprint is null then
      -- Legacy rows are compared by their bounded identity columns.
      null;
    elsif existing_work.request_fingerprint is distinct from request_fingerprint then
      raise exception 'work request key conflicts with an existing canonical request' using errcode = '23505';
    end if;
    return existing_work.id;
  end if;

  if p_work_kind in ('SCREENING', 'DEEP_ANALYSIS', 'REANALYSIS', 'RECALCULATION') then
    if p_token_id is null then
      raise exception 'token is required for analysis work' using errcode = '23514';
    end if;
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

create or replace function public.radar_system_attach_observation(
  p_work_item_id uuid,
  p_observation_id uuid
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.radar_pause_guard(true);
  insert into public.radar_work_inputs(work_item_id, observation_id)
  values (p_work_item_id, p_observation_id)
  on conflict do nothing;
end;
$$;
revoke all on function public.radar_system_attach_observation(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.radar_system_attach_observation(uuid, uuid) to service_role;

create or replace function public.radar_system_claim_work(
  p_worker text,
  p_lease_seconds integer default 300
)
returns table (
  work_item_id uuid,
  work_kind text,
  token_id uuid,
  lease_token uuid,
  lease_generation bigint,
  pause_generation bigint
)
language plpgsql security definer set search_path = '' as $$
declare
  candidate public.radar_work_items%rowtype;
  current_generation bigint;
begin
  if length(btrim(coalesce(p_worker, ''))) = 0 then
    raise exception 'worker identity is required' using errcode = '22023';
  end if;
  if p_lease_seconds not between 30 and 3600 then
    raise exception 'lease duration out of bounds' using errcode = '22023';
  end if;
  current_generation := private.radar_pause_guard(true);

  select * into candidate
  from public.radar_work_items w
  where (w.state in ('QUEUED', 'RETRY_WAIT')
      or (w.state = 'RUNNING' and w.lease_expires_at <= statement_timestamp()))
    and w.available_at <= statement_timestamp()
    and (w.lease_expires_at is null or w.lease_expires_at <= statement_timestamp())
    and w.pause_generation = current_generation
  order by w.available_at, w.created_at
  for update skip locked limit 1;
  if not found then return; end if;

  -- Claiming is the immutable input boundary.  A recalculation prepared with
  -- a copied historical hash keeps that hash; all other work gets the hash of
  -- its exact observation membership before evaluation begins.
  update public.radar_work_items as w
  set state = 'RUNNING', attempt_count = w.attempt_count + 1,
      sealed_at = coalesce(w.sealed_at, statement_timestamp()),
      input_hash = coalesce(w.input_hash, private.radar_input_fingerprint(w.id)),
      lease_owner = p_worker, lease_token = gen_random_uuid(),
      lease_expires_at = statement_timestamp() + make_interval(secs => p_lease_seconds),
      lease_generation = w.lease_generation + 1
  where w.id = candidate.id
  returning w.id, w.work_kind, w.token_id, w.lease_token, w.lease_generation, w.pause_generation
  into work_item_id, work_kind, token_id, lease_token, lease_generation, pause_generation;
  return next;
end;
$$;
revoke all on function public.radar_system_claim_work(text, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.radar_system_claim_work(text, integer) to service_role;

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

  if work_row.state = 'SUCCEEDED' then
    if work_row.lease_generation is distinct from p_lease_generation then
      raise exception 'work lease is stale or invalid' using errcode = '40001';
    end if;
    if work_row.input_hash = p_input_hash
       and work_row.screening_result = p_result
       and work_row.screening_reasons = normalized_reasons then
      return work_row.id;
    end if;
    raise exception 'screening completion conflicts with the accepted result' using errcode = '22023';
  end if;

  if work_row.state <> 'RUNNING' or work_row.lease_owner is distinct from p_worker
     or work_row.lease_token is distinct from p_lease_token
     or work_row.lease_generation <> p_lease_generation
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

create or replace function public.radar_system_renew_work(
  p_work_item_id uuid,
  p_worker text,
  p_lease_token uuid,
  p_lease_generation bigint,
  p_lease_seconds integer default 300
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  current_generation bigint;
begin
  if p_lease_token is null or p_lease_generation is null then
    raise exception 'lease renewal requires a fence' using errcode = '22023';
  end if;
  if p_lease_seconds not between 30 and 3600 then
    raise exception 'lease duration out of bounds' using errcode = '22023';
  end if;
  current_generation := private.radar_pause_guard(true);
  update public.radar_work_items
  set lease_expires_at = statement_timestamp() + make_interval(secs => p_lease_seconds)
  where id = p_work_item_id and state = 'RUNNING' and lease_owner = p_worker
    and lease_token = p_lease_token and lease_generation = p_lease_generation
    and lease_expires_at > statement_timestamp()
    and pause_generation = current_generation;
  return found;
end;
$$;
revoke all on function public.radar_system_renew_work(uuid, text, uuid, bigint, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.radar_system_renew_work(uuid, text, uuid, bigint, integer) to service_role;

create or replace function public.radar_system_fail_work(
  p_work_item_id uuid,
  p_worker text,
  p_lease_token uuid,
  p_lease_generation bigint,
  p_retryable boolean,
  p_error_summary text,
  p_retry_at timestamptz
)
returns text language plpgsql security definer set search_path = '' as $$
declare
  next_state text := case when p_retryable then 'RETRY_WAIT' else 'FAILED' end;
  resulting_state text;
  prior_retryable boolean;
  prior_error text;
  current_generation bigint;
begin
  if p_lease_token is null or p_lease_generation is null then
    raise exception 'work failure requires a fence' using errcode = '22023';
  end if;
  if length(coalesce(p_error_summary, '')) > 1000 then
    raise exception 'error summary too long' using errcode = '22023';
  end if;
  current_generation := private.radar_pause_guard(true);
  update public.radar_work_items
  set state = next_state, available_at = coalesce(p_retry_at, statement_timestamp()),
      last_error_summary = nullif(btrim(coalesce(p_error_summary, '')), ''),
      failure_retryable = p_retryable,
      lease_owner = null, lease_token = null, lease_expires_at = null
  where id = p_work_item_id and state = 'RUNNING' and lease_owner = p_worker
    and lease_token = p_lease_token and lease_generation = p_lease_generation
    and lease_expires_at > statement_timestamp()
    and pause_generation = current_generation;
  if found then
    perform private.radar_system_audit('radar.work_failed', p_work_item_id,
      null, jsonb_build_object('state', next_state),
      jsonb_build_object('schema_version', 2, 'retryable', p_retryable));
    return next_state;
  end if;

  select state, failure_retryable, last_error_summary
  into resulting_state, prior_retryable, prior_error
  from public.radar_work_items where id = p_work_item_id;
  if resulting_state in ('FAILED', 'RETRY_WAIT')
     and prior_retryable is not distinct from p_retryable
     and prior_error is not distinct from nullif(btrim(coalesce(p_error_summary, '')), '') then
    return resulting_state;
  end if;
  raise exception 'work lease is stale or invalid' using errcode = '40001';
end;
$$;
revoke all on function public.radar_system_fail_work(uuid, text, uuid, bigint, boolean, text, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.radar_system_fail_work(uuid, text, uuid, bigint, boolean, text, timestamptz)
  to service_role;

drop function public.radar_system_create_analysis(uuid, text, numeric, jsonb, jsonb, text, text, text, text, jsonb, jsonb, jsonb, text, timestamptz, timestamptz);
create function public.radar_system_create_analysis(
  p_work_item_id uuid,
  p_status text,
  p_score numeric,
  p_deterministic_data jsonb,
  p_ai_inference jsonb,
  p_risk_summary text,
  p_scoring_method_version text,
  p_methodology_hash text,
  p_input_hash text,
  p_component_breakdown jsonb,
  p_coverage jsonb,
  p_deep_lane_provenance jsonb,
  p_freshness_policy_version text,
  p_expires_at timestamptz,
  p_data_as_of timestamptz,
  p_lease_generation bigint
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  work_row public.radar_work_items%rowtype;
  existing_analysis public.radar_analyses%rowtype;
  analysis_id uuid;
  analysis_version integer;
  analysis_run_type text;
  current_generation bigint;
begin
  if p_lease_generation is null or p_input_hash is null then
    raise exception 'analysis completion requires a fence and input hash' using errcode = '22023';
  end if;
  current_generation := private.radar_pause_guard(true);
  select * into work_row from public.radar_work_items where id = p_work_item_id for update;
  if not found then raise exception 'work item not found' using errcode = '23503'; end if;
  if work_row.lease_generation <> p_lease_generation
     or work_row.pause_generation <> current_generation then
    raise exception 'analysis result fence is stale or invalid' using errcode = '40001';
  end if;

  if work_row.result_analysis_id is not null then
    select * into existing_analysis from public.radar_analyses where id = work_row.result_analysis_id;
    if existing_analysis.status is distinct from p_status
       or existing_analysis.score is distinct from p_score
       or existing_analysis.scoring_method_version is distinct from p_scoring_method_version
       or existing_analysis.methodology_hash is distinct from p_methodology_hash
       or existing_analysis.input_hash is distinct from p_input_hash
       or existing_analysis.data_as_of is distinct from p_data_as_of then
      raise exception 'analysis completion conflicts with the accepted result' using errcode = '22023';
    end if;
    return work_row.result_analysis_id;
  end if;
  if work_row.state <> 'SUCCEEDED' or work_row.sealed_at is null
     or work_row.input_hash is distinct from p_input_hash then
    raise exception 'analysis requires the exact completed sealed input set' using errcode = '55000';
  end if;
  if p_scoring_method_version <> 'contract-v1'
     or (work_row.method_version is not null and work_row.method_version is distinct from p_scoring_method_version) then
    raise exception 'methodology is not bound to the producing work item' using errcode = '22023';
  end if;
  if work_row.reserved_analysis_version is null then
    raise exception 'work item has no reserved analysis version' using errcode = '55000';
  end if;
  analysis_version := work_row.reserved_analysis_version;
  analysis_run_type := case work_row.work_kind
    when 'REANALYSIS' then 'REANALYSIS'
    when 'RECALCULATION' then 'RECALCULATION'
    when 'DEEP_ANALYSIS' then 'DEEP_ANALYSIS'
    else 'SCREENING'
  end;
  insert into public.radar_analyses(
    token_id, version, status, score, deterministic_data, ai_inference,
    risk_summary, analyzed_at, data_as_of, run_type, work_item_id,
    requested_at, started_at, completed_at, scoring_method_version,
    methodology_hash, input_hash, component_breakdown, coverage,
    deep_lane_provenance, public_eligibility, freshness_policy_version, expires_at,
    supersedes_analysis_id
  ) values (
    work_row.token_id, analysis_version, p_status, p_score,
    coalesce(p_deterministic_data, '{}'::jsonb), coalesce(p_ai_inference, '{}'::jsonb),
    p_risk_summary, statement_timestamp(), p_data_as_of, analysis_run_type, p_work_item_id,
    work_row.created_at, work_row.created_at, statement_timestamp(), p_scoring_method_version,
    p_methodology_hash, p_input_hash, p_component_breakdown, p_coverage,
    p_deep_lane_provenance, p_status in ('EARLY', 'TRENDING', 'HIGH_RISK'), p_freshness_policy_version, p_expires_at,
    work_row.parent_analysis_id
  ) returning id into analysis_id;
  update public.radar_work_items set result_analysis_id = analysis_id where id = p_work_item_id;
  perform private.radar_system_audit('radar.analysis_completed', analysis_id,
    null, jsonb_build_object('analysis_id', analysis_id, 'version', analysis_version),
    jsonb_build_object('schema_version', 2, 'methodology_hash', p_methodology_hash,
      'input_hash', p_input_hash, 'lease_generation', p_lease_generation));
  return analysis_id;
end;
$$;
revoke all on function public.radar_system_create_analysis(uuid, text, numeric, jsonb, jsonb, text, text, text, text, jsonb, jsonb, jsonb, text, timestamptz, timestamptz, bigint)
  from public, anon, authenticated, service_role;
grant execute on function public.radar_system_create_analysis(uuid, text, numeric, jsonb, jsonb, text, text, text, text, jsonb, jsonb, jsonb, text, timestamptz, timestamptz, bigint)
  to service_role;

drop function public.radar_system_append_evidence(uuid, uuid, text, text, text, text, text, text, numeric, text, integer, jsonb, text, text, text, uuid, text, timestamptz, timestamptz, timestamptz, text, boolean, integer);
create function public.radar_system_append_evidence(
  p_analysis_id uuid,
  p_token_id uuid,
  p_evidence_key text,
  p_classification text,
  p_origin text,
  p_category text,
  p_label text,
  p_statement text,
  p_numeric_value numeric,
  p_numeric_unit text,
  p_decimal_places integer,
  p_structured_value jsonb,
  p_unknown_reason text,
  p_provider text,
  p_adapter_version text,
  p_observation_id uuid,
  p_source_reference text,
  p_observed_at timestamptz,
  p_received_at timestamptz,
  p_evaluated_at timestamptz,
  p_methodology_version text,
  p_is_public boolean,
  p_public_rank integer,
  p_lease_generation bigint
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  evidence_id uuid;
  existing_evidence public.radar_evidence%rowtype;
  analysis_row public.radar_analyses%rowtype;
  work_row public.radar_work_items%rowtype;
  current_generation bigint;
begin
  if p_lease_generation is null then
    raise exception 'evidence append requires a result fence' using errcode = '22023';
  end if;
  current_generation := private.radar_pause_guard(true);
  select * into analysis_row from public.radar_analyses where id = p_analysis_id for share;
  if not found then raise exception 'analysis not found' using errcode = '23503'; end if;
  select * into work_row from public.radar_work_items where id = analysis_row.work_item_id for share;
  if not found or work_row.result_analysis_id is distinct from p_analysis_id
     or work_row.state <> 'SUCCEEDED' or work_row.sealed_at is null
     or work_row.lease_generation <> p_lease_generation
     or work_row.pause_generation <> current_generation then
    raise exception 'evidence result fence is stale or invalid' using errcode = '40001';
  end if;
  if p_observation_id is not null and not exists (
    select 1 from public.radar_work_inputs
    where work_item_id = work_row.id and observation_id = p_observation_id
  ) then
    raise exception 'evidence observation is outside the sealed input set' using errcode = '23514';
  end if;

  insert into public.radar_evidence(
    analysis_id, token_id, evidence_key, classification, origin, category, label,
    statement, numeric_value, numeric_unit, decimal_places, structured_value,
    unknown_reason, provider, adapter_version, observation_id, source_reference,
    observed_at, received_at, evaluated_at, methodology_version, is_public, public_rank
  ) values (
    p_analysis_id, p_token_id, p_evidence_key, p_classification, p_origin, p_category, p_label,
    p_statement, p_numeric_value, p_numeric_unit, p_decimal_places, p_structured_value,
    p_unknown_reason, p_provider, p_adapter_version, p_observation_id, p_source_reference,
    p_observed_at, p_received_at, p_evaluated_at, p_methodology_version, coalesce(p_is_public, false), p_public_rank
  ) on conflict (analysis_id, evidence_key) do nothing
  returning id into evidence_id;
  if evidence_id is null then
    select * into existing_evidence from public.radar_evidence
    where analysis_id = p_analysis_id and evidence_key = p_evidence_key;
    if existing_evidence.token_id is distinct from p_token_id
       or existing_evidence.classification is distinct from p_classification
       or existing_evidence.origin is distinct from p_origin
       or existing_evidence.category is distinct from p_category
       or existing_evidence.label is distinct from p_label
       or existing_evidence.statement is distinct from p_statement
       or existing_evidence.numeric_value is distinct from p_numeric_value
       or existing_evidence.structured_value is distinct from p_structured_value
       or existing_evidence.observation_id is distinct from p_observation_id
       or existing_evidence.source_reference is distinct from p_source_reference
       or existing_evidence.methodology_version is distinct from p_methodology_version
       or existing_evidence.is_public is distinct from coalesce(p_is_public, false)
       or existing_evidence.public_rank is distinct from p_public_rank then
      raise exception 'evidence key conflicts with an existing result' using errcode = '22023';
    end if;
    evidence_id := existing_evidence.id;
  end if;
  return evidence_id;
end;
$$;
revoke all on function public.radar_system_append_evidence(uuid, uuid, text, text, text, text, text, text, numeric, text, integer, jsonb, text, text, text, uuid, text, timestamptz, timestamptz, timestamptz, text, boolean, integer, bigint)
  from public, anon, authenticated, service_role;
grant execute on function public.radar_system_append_evidence(uuid, uuid, text, text, text, text, text, text, numeric, text, integer, jsonb, text, text, text, uuid, text, timestamptz, timestamptz, timestamptz, text, boolean, integer, bigint)
  to service_role;

create function public.radar_system_mark_analysis_ready_for_review(
  p_analysis_id uuid,
  p_analysis_version integer,
  p_lease_generation bigint,
  p_input_hash text,
  p_methodology_hash text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  analysis_row public.radar_analyses%rowtype;
  work_row public.radar_work_items%rowtype;
  review_id uuid;
  current_generation bigint;
begin
  if p_analysis_version is null or p_lease_generation is null
     or p_input_hash is null or p_methodology_hash is null then
    raise exception 'ready-for-review transition requires bound result identity' using errcode = '22023';
  end if;
  current_generation := private.radar_pause_guard(true);
  select * into analysis_row from public.radar_analyses where id = p_analysis_id for share;
  if not found then raise exception 'analysis not found' using errcode = '23503'; end if;
  select * into work_row from public.radar_work_items where id = analysis_row.work_item_id for share;
  if not found or work_row.result_analysis_id is distinct from p_analysis_id
     or work_row.state <> 'SUCCEEDED' or work_row.sealed_at is null
     or work_row.lease_generation <> p_lease_generation
     or work_row.pause_generation <> current_generation
     or work_row.input_hash is distinct from p_input_hash
     or analysis_row.version <> p_analysis_version
     or analysis_row.input_hash is distinct from p_input_hash
     or analysis_row.methodology_hash is distinct from p_methodology_hash
     or not analysis_row.public_eligibility then
    raise exception 'analysis is not bound to an eligible current result' using errcode = '55000';
  end if;
  if not exists (select 1 from public.radar_evidence where analysis_id = p_analysis_id) then
    raise exception 'analysis requires evidence before review' using errcode = '55000';
  end if;

  insert into public.radar_reviews(analysis_id, token_id, state)
  values (p_analysis_id, analysis_row.token_id, 'PENDING')
  on conflict (analysis_id) do nothing
  returning id into review_id;
  if review_id is null then
    select id into review_id from public.radar_reviews where analysis_id = p_analysis_id;
  end if;
  perform private.radar_system_audit('radar.analysis_ready_for_review', review_id,
    null, jsonb_build_object('state', 'PENDING', 'analysis_id', p_analysis_id,
      'analysis_version', p_analysis_version),
    jsonb_build_object('schema_version', 1, 'input_hash', p_input_hash,
      'methodology_hash', p_methodology_hash, 'lease_generation', p_lease_generation));
  return review_id;
end;
$$;
revoke all on function public.radar_system_mark_analysis_ready_for_review(uuid, integer, bigint, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.radar_system_mark_analysis_ready_for_review(uuid, integer, bigint, text, text)
  to service_role;

-- Human requests receive an actor/action/target/payload-bound receipt and use
-- the same token-locked version allocator as system enqueueing.
drop function public.radar_request_reanalysis(uuid, text, text);
create function public.radar_request_reanalysis(
  p_analysis_id uuid,
  p_reason text,
  p_request_key text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := private.radar_require_roles(array['owner', 'admin', 'radar_reviewer', 'analyst']);
  analysis_row public.radar_analyses%rowtype;
  existing_work public.radar_work_items%rowtype;
  work_id uuid;
  reserved_version integer;
  pause_generation bigint;
  request_fingerprint text;
begin
  if length(btrim(coalesce(p_reason, ''))) = 0 or length(p_reason) > 1000
     or length(btrim(coalesce(p_request_key, ''))) = 0 then
    raise exception 'bounded reanalysis reason and request key required' using errcode = '22023';
  end if;
  pause_generation := private.radar_pause_guard(true);
  select * into analysis_row from public.radar_analyses where id = p_analysis_id for share;
  if not found then raise exception 'analysis not found' using errcode = 'P0002'; end if;
  request_fingerprint := private.radar_request_fingerprint(actor_id, 'REANALYSIS', analysis_row.token_id,
    p_analysis_id, jsonb_build_object('reason', p_reason));
  select * into existing_work from public.radar_work_items where request_key = p_request_key;
  if existing_work.id is not null then
    if existing_work.request_actor_id is distinct from actor_id
       or existing_work.request_operation is distinct from 'REANALYSIS'
       or existing_work.request_fingerprint is distinct from request_fingerprint then
      raise exception 'human request key conflicts with an existing request' using errcode = '23505';
    end if;
    return existing_work.id;
  end if;
  perform 1 from public.tokens where id = analysis_row.token_id for update;
  select greatest(
    coalesce((select max(version) from public.radar_analyses where token_id = analysis_row.token_id), 0),
    coalesce((select max(reserved_analysis_version) from public.radar_work_items where token_id = analysis_row.token_id), 0)
  ) + 1 into reserved_version;
  insert into public.radar_work_items(
    work_kind, token_id, parent_analysis_id, request_key, request_actor_id,
    request_operation, request_fingerprint, method_version, input_version,
    reserved_analysis_version, pause_generation
  ) values (
    'REANALYSIS', analysis_row.token_id, p_analysis_id, p_request_key, actor_id,
    'REANALYSIS', request_fingerprint, analysis_row.scoring_method_version,
    'reanalysis-input-v1', reserved_version, pause_generation
  ) on conflict (request_key) do nothing
  returning id into work_id;
  if work_id is null then
    select * into existing_work from public.radar_work_items where request_key = p_request_key;
    if existing_work.request_actor_id is distinct from actor_id
       or existing_work.request_operation is distinct from 'REANALYSIS'
       or existing_work.request_fingerprint is distinct from request_fingerprint then
      raise exception 'human request key conflicts with an existing request' using errcode = '23505';
    end if;
    return existing_work.id;
  end if;
  perform private.radar_audit(actor_id, 'radar.reanalysis_requested', p_analysis_id,
    null, jsonb_build_object('work_item_id', work_id, 'analysis_id', p_analysis_id,
      'reserved_analysis_version', reserved_version),
    jsonb_build_object('schema_version', 2, 'reason', p_reason, 'request_key', p_request_key));
  return work_id;
end;
$$;
revoke all on function public.radar_request_reanalysis(uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.radar_request_reanalysis(uuid, text, text) to authenticated;

drop function public.radar_request_score_recalculation(uuid, text, text);
create function public.radar_request_score_recalculation(
  p_analysis_id uuid,
  p_reason text,
  p_request_key text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := private.radar_require_roles(array['owner', 'admin', 'radar_reviewer', 'analyst']);
  analysis_row public.radar_analyses%rowtype;
  source_work public.radar_work_items%rowtype;
  existing_work public.radar_work_items%rowtype;
  work_id uuid;
  reserved_version integer;
  pause_generation bigint;
  request_fingerprint text;
begin
  if length(btrim(coalesce(p_reason, ''))) = 0 or length(p_reason) > 1000
     or length(btrim(coalesce(p_request_key, ''))) = 0 then
    raise exception 'bounded recalculation reason and request key required' using errcode = '22023';
  end if;
  pause_generation := private.radar_pause_guard(true);
  select * into analysis_row from public.radar_analyses where id = p_analysis_id for share;
  if not found then raise exception 'analysis not found' using errcode = 'P0002'; end if;
  select * into source_work from public.radar_work_items where id = analysis_row.work_item_id for share;
  if not found or source_work.sealed_at is null or source_work.input_hash is null
     or source_work.input_hash is distinct from private.radar_input_fingerprint(source_work.id) then
    raise exception 'recalculation requires an intact historical frozen input set' using errcode = '55000';
  end if;
  request_fingerprint := private.radar_request_fingerprint(actor_id, 'RECALCULATION', analysis_row.token_id,
    p_analysis_id, jsonb_build_object('reason', p_reason));
  select * into existing_work from public.radar_work_items where request_key = p_request_key;
  if existing_work.id is not null then
    if existing_work.request_actor_id is distinct from actor_id
       or existing_work.request_operation is distinct from 'RECALCULATION'
       or existing_work.request_fingerprint is distinct from request_fingerprint then
      raise exception 'human request key conflicts with an existing request' using errcode = '23505';
    end if;
    return existing_work.id;
  end if;
  perform 1 from public.tokens where id = analysis_row.token_id for update;
  select greatest(
    coalesce((select max(version) from public.radar_analyses where token_id = analysis_row.token_id), 0),
    coalesce((select max(reserved_analysis_version) from public.radar_work_items where token_id = analysis_row.token_id), 0)
  ) + 1 into reserved_version;
  insert into public.radar_work_items(
    work_kind, token_id, parent_analysis_id, request_key, request_actor_id,
    request_operation, request_fingerprint, method_version, input_version,
    reserved_analysis_version, pause_generation
  ) values (
    'RECALCULATION', analysis_row.token_id, p_analysis_id, p_request_key, actor_id,
    'RECALCULATION', request_fingerprint, source_work.method_version,
    source_work.input_version, reserved_version, pause_generation
  ) returning id into work_id;
  insert into public.radar_work_inputs(work_item_id, observation_id)
  select work_id, observation_id from public.radar_work_inputs where work_item_id = source_work.id;
  update public.radar_work_items
  set sealed_at = statement_timestamp(), input_hash = source_work.input_hash
  where id = work_id;
  perform private.radar_audit(actor_id, 'radar.score_recalculation_requested', p_analysis_id,
    null, jsonb_build_object('work_item_id', work_id, 'analysis_id', p_analysis_id,
      'reserved_analysis_version', reserved_version),
    jsonb_build_object('schema_version', 2, 'reason', p_reason, 'request_key', p_request_key));
  return work_id;
exception when unique_violation then
  select * into existing_work from public.radar_work_items where request_key = p_request_key;
  if existing_work.request_actor_id is distinct from actor_id
     or existing_work.request_operation is distinct from 'RECALCULATION'
     or existing_work.request_fingerprint is distinct from request_fingerprint then
    raise exception 'human request key conflicts with an existing request' using errcode = '23505';
  end if;
  return existing_work.id;
end;
$$;
revoke all on function public.radar_request_score_recalculation(uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.radar_request_score_recalculation(uuid, text, text) to authenticated;

drop function public.radar_set_emergency_pause(boolean, bigint, text);
create function public.radar_set_emergency_pause(
  p_paused boolean,
  p_expected_generation bigint,
  p_action_key text
)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := private.radar_require_roles(array['owner', 'admin']);
  current_generation bigint;
  next_generation bigint;
  current_enabled boolean;
  flag_id uuid;
begin
  if p_expected_generation is null then
    raise exception 'expected emergency generation is required' using errcode = '22023';
  end if;
  select id, enabled, case
    when configuration is not null and jsonb_typeof(configuration) = 'object'
      and configuration->>'generation' ~ '^[0-9]+$'
    then (configuration->>'generation')::bigint
    else null
  end
  into flag_id, current_enabled, current_generation
  from public.feature_flags
  where key = 'radar_emergency_paused'
  for update;
  if not found or current_generation is null then
    raise exception 'Radar emergency control is missing or malformed' using errcode = '55000';
  end if;
  if current_generation <> p_expected_generation then
    raise exception 'stale emergency control generation' using errcode = '40001';
  end if;
  next_generation := current_generation + 1;
  update public.feature_flags set enabled = p_paused,
    configuration = jsonb_build_object('generation', next_generation), updated_by = actor_id
  where id = flag_id;
  perform private.radar_audit(actor_id, 'feature_flag.updated', flag_id,
    jsonb_build_object('key', 'radar_emergency_paused', 'enabled', current_enabled,
      'generation', current_generation),
    jsonb_build_object('key', 'radar_emergency_paused', 'enabled', p_paused,
      'generation', next_generation),
    jsonb_build_object('schema_version', 2, 'action_key', p_action_key));
  return next_generation;
end;
$$;
revoke all on function public.radar_set_emergency_pause(boolean, bigint, text)
  from public, anon, authenticated, service_role;
grant execute on function public.radar_set_emergency_pause(boolean, bigint, text) to authenticated;

-- Explicit NULL checks close the optimistic-concurrency NULL bypasses on all
-- existing Radar review mutations.  Their publication policy is unchanged.
create or replace function public.radar_approve_review(
  p_review_id uuid, p_expected_revision integer, p_public_note text,
  p_public_disclosure text, p_public_presentation jsonb, p_action_key text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := private.radar_require_roles(array['owner', 'admin', 'radar_reviewer']);
  review_row public.radar_reviews%rowtype;
  analysis_row public.radar_analyses%rowtype;
begin
  if p_expected_revision is null then raise exception 'expected review revision is required' using errcode = '22023'; end if;
  select * into review_row from public.radar_reviews where id = p_review_id for update;
  if not found then raise exception 'review not found' using errcode = 'P0002'; end if;
  if review_row.state = 'APPROVED' and review_row.last_action_key = p_action_key then return p_review_id; end if;
  if review_row.revision <> p_expected_revision then raise exception 'stale review revision' using errcode = '40001'; end if;
  if review_row.state <> 'PENDING' then raise exception 'review is not pending' using errcode = '55000'; end if;
  select * into analysis_row from public.radar_analyses where id = review_row.analysis_id for share;
  if not found or not analysis_row.public_eligibility or analysis_row.scoring_method_version is null
     or analysis_row.methodology_hash is null or analysis_row.input_hash is null
     or analysis_row.freshness_policy_version is null or analysis_row.expires_at is null
     or not exists (select 1 from public.radar_evidence e where e.analysis_id = analysis_row.id)
     or p_public_presentation is null or jsonb_typeof(p_public_presentation) <> 'object'
     or length(btrim(coalesce(p_public_disclosure, ''))) = 0 then
    raise exception 'analysis is not eligible for review approval' using errcode = '55000';
  end if;
  perform private.radar_require_roles(array['owner', 'admin', 'radar_reviewer']);
  update public.radar_reviews
  set state = 'APPROVED', reviewed_by = actor_id, reviewed_at = statement_timestamp(),
      public_note = coalesce(p_public_note, ''), public_disclosure = p_public_disclosure,
      public_presentation = p_public_presentation, approval_analysis_version = analysis_row.version,
      approval_input_hash = analysis_row.input_hash, approval_methodology_hash = analysis_row.methodology_hash,
      approved_at = statement_timestamp(), revision = revision + 1, last_action_key = p_action_key
  where id = p_review_id;
  perform private.radar_audit(actor_id, 'radar.reviewed', p_review_id,
    jsonb_build_object('state', review_row.state, 'revision', review_row.revision),
    jsonb_build_object('state', 'APPROVED', 'revision', review_row.revision + 1,
      'analysis_version', analysis_row.version),
    jsonb_build_object('schema_version', 1, 'action_key', p_action_key));
  return p_review_id;
end;
$$;
revoke all on function public.radar_approve_review(uuid, integer, text, text, jsonb, text)
  from public, anon, authenticated, service_role;
grant execute on function public.radar_approve_review(uuid, integer, text, text, jsonb, text) to authenticated;

create or replace function public.radar_publish_review(
  p_review_id uuid, p_expected_revision integer, p_action_key text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := private.radar_require_roles(array['owner', 'admin', 'radar_reviewer']);
  review_row public.radar_reviews%rowtype;
  analysis_row public.radar_analyses%rowtype;
  old_review public.radar_reviews%rowtype;
  highest_version integer;
begin
  if p_expected_revision is null then raise exception 'expected review revision is required' using errcode = '22023'; end if;
  perform 1 from public.feature_flags where key in ('radar_enabled', 'maintenance_mode', 'radar_emergency_paused') for update;
  select r.* into review_row from public.radar_reviews r where r.id = p_review_id for update;
  if not found then raise exception 'review not found' using errcode = 'P0002'; end if;
  if review_row.state = 'PUBLISHED' and review_row.last_action_key = p_action_key then return p_review_id; end if;
  if review_row.revision <> p_expected_revision then raise exception 'stale review revision' using errcode = '40001'; end if;
  if review_row.state <> 'APPROVED' then raise exception 'review must be approved before publication' using errcode = '55000'; end if;
  select * into analysis_row from public.radar_analyses where id = review_row.analysis_id for share;
  if not (select private.radar_flag_enabled('radar_enabled', false))
     or (select private.radar_flag_enabled('maintenance_mode', true))
     or (select private.radar_flag_enabled('radar_emergency_paused', true)) then
    raise exception 'Radar publication controls are not enabled' using errcode = '55000';
  end if;
  if not analysis_row.public_eligibility or analysis_row.status not in ('EARLY', 'TRENDING', 'HIGH_RISK')
     or analysis_row.score is null or analysis_row.expires_at <= statement_timestamp()
     or review_row.approval_analysis_version <> analysis_row.version
     or review_row.approval_input_hash is distinct from analysis_row.input_hash
     or review_row.approval_methodology_hash is distinct from analysis_row.methodology_hash
     or length(btrim(review_row.public_disclosure)) = 0
     or not exists (select 1 from public.radar_evidence e where e.analysis_id = analysis_row.id and e.is_public) then
    raise exception 'publication prerequisites are not satisfied' using errcode = '55000';
  end if;
  select max(a.version) into highest_version
  from public.radar_reviews r join public.radar_analyses a on a.id = r.analysis_id
  where r.token_id = review_row.token_id and r.published_at is not null and r.state in ('PUBLISHED', 'HIDDEN');
  if highest_version is not null and analysis_row.version < highest_version then
    raise exception 'older analysis cannot replace a newer publication' using errcode = '55000';
  end if;
  select * into old_review from public.radar_reviews r
  where r.token_id = review_row.token_id and r.state = 'PUBLISHED' and r.id <> p_review_id for update;
  if found then
    update public.radar_reviews set state = 'HIDDEN', revision = revision + 1 where id = old_review.id;
    perform private.radar_audit(actor_id, 'radar.hidden', old_review.id,
      jsonb_build_object('state', 'PUBLISHED', 'revision', old_review.revision),
      jsonb_build_object('state', 'HIDDEN', 'revision', old_review.revision + 1),
      jsonb_build_object('schema_version', 1, 'superseded_by', p_review_id));
  end if;
  update public.radar_reviews set state = 'PUBLISHED', published_at = statement_timestamp(),
    revision = revision + 1, last_action_key = p_action_key where id = p_review_id;
  perform private.radar_audit(actor_id, 'radar.published', p_review_id,
    jsonb_build_object('state', review_row.state, 'revision', review_row.revision),
    jsonb_build_object('state', 'PUBLISHED', 'revision', review_row.revision + 1,
      'analysis_version', analysis_row.version, 'public_disclosure', review_row.public_disclosure),
    jsonb_build_object('schema_version', 1, 'action_key', p_action_key));
  return p_review_id;
end;
$$;
revoke all on function public.radar_publish_review(uuid, integer, text)
  from public, anon, authenticated, service_role;
grant execute on function public.radar_publish_review(uuid, integer, text) to authenticated;

create or replace function public.radar_reject_review(
  p_review_id uuid, p_expected_revision integer, p_reason text, p_action_key text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := private.radar_require_roles(array['owner', 'admin', 'radar_reviewer']);
  review_row public.radar_reviews%rowtype;
begin
  if p_expected_revision is null then raise exception 'expected review revision is required' using errcode = '22023'; end if;
  select * into review_row from public.radar_reviews where id = p_review_id for update;
  if not found then raise exception 'review not found' using errcode = 'P0002'; end if;
  if review_row.state = 'REJECTED' and review_row.last_action_key = p_action_key then return p_review_id; end if;
  if review_row.revision <> p_expected_revision or review_row.state not in ('PENDING', 'APPROVED') then
    raise exception 'invalid or stale review transition' using errcode = '55000';
  end if;
  if length(btrim(coalesce(p_reason, ''))) = 0 or length(p_reason) > 1000 then raise exception 'bounded rejection reason required' using errcode = '22023'; end if;
  update public.radar_reviews set state='REJECTED', reviewed_by=actor_id, reviewed_at=statement_timestamp(), revision=revision+1, last_action_key=p_action_key where id=p_review_id;
  perform private.radar_audit(actor_id,'radar.rejected',p_review_id,jsonb_build_object('state',review_row.state,'revision',review_row.revision),jsonb_build_object('state','REJECTED','revision',review_row.revision+1),jsonb_build_object('schema_version',1,'reason',p_reason,'action_key',p_action_key));
  return p_review_id;
end;
$$;
revoke all on function public.radar_reject_review(uuid, integer, text, text) from public, anon, authenticated, service_role;
grant execute on function public.radar_reject_review(uuid, integer, text, text) to authenticated;

create or replace function public.radar_hide_review(
  p_review_id uuid, p_expected_revision integer, p_reason text, p_action_key text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := private.radar_require_roles(array['owner', 'admin', 'radar_reviewer']);
  review_row public.radar_reviews%rowtype;
begin
  if p_expected_revision is null then raise exception 'expected review revision is required' using errcode = '22023'; end if;
  select * into review_row from public.radar_reviews where id = p_review_id for update;
  if not found then raise exception 'review not found' using errcode = 'P0002'; end if;
  if review_row.state = 'HIDDEN' and review_row.last_action_key = p_action_key then return p_review_id; end if;
  if review_row.revision <> p_expected_revision or review_row.state <> 'PUBLISHED' then raise exception 'only published reviews can be hidden' using errcode = '55000'; end if;
  if length(btrim(coalesce(p_reason, ''))) = 0 or length(p_reason) > 1000 then raise exception 'bounded hide reason required' using errcode = '22023'; end if;
  update public.radar_reviews set state='HIDDEN', revision=revision+1, last_action_key=p_action_key where id=p_review_id;
  perform private.radar_audit(actor_id,'radar.hidden',p_review_id,jsonb_build_object('state','PUBLISHED','revision',review_row.revision),jsonb_build_object('state','HIDDEN','revision',review_row.revision+1),jsonb_build_object('schema_version',1,'reason',p_reason,'action_key',p_action_key));
  return p_review_id;
end;
$$;
revoke all on function public.radar_hide_review(uuid, integer, text, text) from public, anon, authenticated, service_role;
grant execute on function public.radar_hide_review(uuid, integer, text, text) to authenticated;

create or replace function public.radar_update_editorial_note(
  p_review_id uuid, p_expected_revision integer, p_editorial_note text, p_action_key text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := private.radar_require_roles(array['owner', 'admin', 'radar_reviewer']);
  review_row public.radar_reviews%rowtype;
begin
  if p_expected_revision is null then raise exception 'expected review revision is required' using errcode = '22023'; end if;
  select * into review_row from public.radar_reviews where id = p_review_id for update;
  if not found then raise exception 'review not found' using errcode = 'P0002'; end if;
  if review_row.revision <> p_expected_revision or review_row.state = 'PUBLISHED' then raise exception 'editorial note cannot rewrite published history' using errcode = '55000'; end if;
  if length(coalesce(p_editorial_note, '')) > 4000 then raise exception 'editorial note too long' using errcode = '22023'; end if;
  update public.radar_reviews set editorial_note=coalesce(p_editorial_note,''), revision=revision+1, last_action_key=p_action_key where id=p_review_id;
  perform private.radar_audit(actor_id,'radar.editorial_note_updated',p_review_id,jsonb_build_object('state',review_row.state,'revision',review_row.revision),jsonb_build_object('state',review_row.state,'revision',review_row.revision+1),jsonb_build_object('schema_version',1,'action_key',p_action_key));
  return p_review_id;
end;
$$;
revoke all on function public.radar_update_editorial_note(uuid, integer, text, text) from public, anon, authenticated, service_role;
grant execute on function public.radar_update_editorial_note(uuid, integer, text, text) to authenticated;

commit;
