begin;

-- Gate 19G-F2: durable Deep Lane request, attempt and completion contracts.
-- External model calls remain at-least-once unless a future provider honors the
-- recorded idempotency key. These tables are private implementation state;
-- all mutation happens through service-role-only, fenced functions below.

create table public.radar_deep_lane_requests (
  id uuid primary key default gen_random_uuid(),
  work_item_id uuid not null unique references public.radar_work_items(id) on delete restrict,
  token_id uuid not null references public.tokens(id) on delete restrict,
  reserved_analysis_version integer not null check (reserved_analysis_version > 0),
  task_type text not null check (task_type = 'DEEP_ANALYSIS'),
  method_version text not null check (method_version ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'),
  input_version text not null check (input_version ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'),
  schema_version text not null check (schema_version ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'),
  output_schema_version text not null check (output_schema_version ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'),
  input_hash text not null check (input_hash ~ '^[0-9a-f]{64}$'),
  input_manifest jsonb not null check (jsonb_typeof(input_manifest) = 'array'),
  evidence_manifest jsonb not null check (jsonb_typeof(evidence_manifest) = 'array'),
  provider text not null check (provider ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'),
  model text not null check (model ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  model_revision text check (model_revision is null or model_revision ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  adapter_version text not null check (adapter_version ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  logical_request_hash text not null unique check (logical_request_hash ~ '^[0-9a-f]{64}$'),
  state text not null check (state in ('IN_PROGRESS', 'SUCCEEDED', 'FAILED_RETRYABLE', 'FAILED_TERMINAL', 'UNCERTAIN')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null check (max_attempts between 1 and 20),
  completion_attempt_id uuid,
  completion_output jsonb check (completion_output is null or jsonb_typeof(completion_output) = 'object'),
  completion_output_hash text check (completion_output_hash is null or completion_output_hash ~ '^[0-9a-f]{64}$'),
  completed_at timestamptz,
  last_error_code text check (last_error_code is null or last_error_code ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  last_error_summary text check (last_error_summary is null or length(last_error_summary) <= 1000),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint radar_deep_lane_request_completion_pair check (
    (state = 'SUCCEEDED'
      and completion_attempt_id is not null
      and completion_output is not null
      and completion_output_hash is not null
      and completed_at is not null)
    or (state <> 'SUCCEEDED'
      and completion_attempt_id is null
      and completion_output is null
      and completion_output_hash is null
      and completed_at is null)
  )
);

create table public.radar_deep_lane_attempts (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.radar_deep_lane_requests(id) on delete restrict,
  attempt_number integer not null check (attempt_number > 0),
  state text not null check (state in ('INVOKING', 'SUCCEEDED', 'FAILED_RETRYABLE', 'FAILED_TERMINAL', 'UNCERTAIN')),
  worker text not null check (length(btrim(worker)) between 1 and 128),
  lease_token uuid not null,
  lease_generation bigint not null check (lease_generation >= 0),
  pause_generation bigint not null check (pause_generation >= 0),
  provider text not null check (provider ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'),
  model text not null check (model ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  model_revision text check (model_revision is null or model_revision ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  adapter_version text not null check (adapter_version ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  provider_idempotency_key text not null unique check (length(provider_idempotency_key) between 16 and 256),
  started_at timestamptz not null default statement_timestamp(),
  completed_at timestamptz,
  output jsonb check (output is null or jsonb_typeof(output) = 'object'),
  output_hash text check (output_hash is null or output_hash ~ '^[0-9a-f]{64}$'),
  error_code text check (error_code is null or error_code ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  error_summary text check (error_summary is null or length(error_summary) <= 1000),
  created_at timestamptz not null default statement_timestamp(),
  constraint radar_deep_lane_attempt_identity_key unique (request_id, attempt_number),
  constraint radar_deep_lane_attempt_completion_pair check (
    (state = 'SUCCEEDED' and completed_at is not null and output is not null and output_hash is not null)
    or (state <> 'SUCCEEDED' and completed_at is null and output is null and output_hash is null)
  )
);

alter table public.radar_deep_lane_requests
  add constraint radar_deep_lane_request_completion_fk
  foreign key (completion_attempt_id) references public.radar_deep_lane_attempts(id) on delete restrict;

create index radar_deep_lane_attempts_request_idx
  on public.radar_deep_lane_attempts(request_id, attempt_number desc);

create trigger radar_deep_lane_requests_set_updated_at before update
  on public.radar_deep_lane_requests for each row execute function public.set_updated_at();

alter table public.radar_deep_lane_requests enable row level security;
alter table public.radar_deep_lane_attempts enable row level security;
revoke all on table public.radar_deep_lane_requests, public.radar_deep_lane_attempts
  from public, anon, authenticated, service_role;

create or replace function private.radar_deep_lane_request_fingerprint(
  p_work_item_id uuid,
  p_token_id uuid,
  p_reserved_analysis_version integer,
  p_task_type text,
  p_method_version text,
  p_input_version text,
  p_schema_version text,
  p_output_schema_version text,
  p_input_hash text,
  p_input_manifest jsonb,
  p_evidence_manifest jsonb,
  p_provider text,
  p_model text,
  p_model_revision text,
  p_adapter_version text
)
returns text language sql immutable security definer set search_path = '' as $$
  select encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'identity_version', 'deep-lane-request-v2',
          'work_item_id', p_work_item_id,
          'token_id', p_token_id,
          'reserved_analysis_version', p_reserved_analysis_version,
          'task_type', p_task_type,
          'method_version', p_method_version,
          'input_version', p_input_version,
          'schema_version', p_schema_version,
          'output_schema_version', p_output_schema_version,
          'frozen_input_hash', p_input_hash,
          'input_manifest', p_input_manifest,
          'evidence', p_evidence_manifest,
          'provider', p_provider,
          'model', p_model,
          'model_revision', p_model_revision,
          'adapter_version', p_adapter_version
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
$$;
revoke all on function private.radar_deep_lane_request_fingerprint(
  uuid, uuid, integer, text, text, text, text, text, text, jsonb, jsonb,
  text, text, text, text
) from public, anon, authenticated, service_role;

create or replace function private.radar_deep_lane_output_hash(p_output jsonb)
returns text language sql immutable security definer set search_path = '' as $$
  select encode(extensions.digest(convert_to(p_output::text, 'UTF8'), 'sha256'), 'hex');
$$;
revoke all on function private.radar_deep_lane_output_hash(jsonb)
  from public, anon, authenticated, service_role;

create or replace function public.radar_system_reserve_deep_lane_attempt(
  p_work_item_id uuid,
  p_worker text,
  p_lease_token uuid,
  p_lease_generation bigint,
  p_task_type text,
  p_method_version text,
  p_input_version text,
  p_schema_version text,
  p_output_schema_version text,
  p_input_manifest jsonb,
  p_evidence_manifest jsonb,
  p_provider text,
  p_model text,
  p_model_revision text,
  p_adapter_version text,
  p_max_attempts integer,
  p_explicit_retry boolean default false
)
returns table (
  request_id uuid,
  logical_request_hash text,
  request_state text,
  attempt_id uuid,
  attempt_number integer,
  attempt_state text,
  invocation_owner boolean,
  provider_idempotency_key text,
  work_item_id uuid,
  token_id uuid,
  reserved_analysis_version integer,
  task_type text,
  method_version text,
  input_version text,
  schema_version text,
  output_schema_version text,
  input_hash text,
  input_manifest jsonb,
  evidence_manifest jsonb,
  provider text,
  model text,
  model_revision text,
  adapter_version text,
  pause_generation bigint,
  completion_output jsonb,
  completion_output_hash text
)
language plpgsql security definer set search_path = '' as $$
declare
  work_row public.radar_work_items%rowtype;
  request_row public.radar_deep_lane_requests%rowtype;
  attempt_row public.radar_deep_lane_attempts%rowtype;
  current_generation bigint;
  manifest jsonb;
  request_hash text;
  next_attempt integer;
  new_attempt_id uuid;
  new_provider_key text;
begin
  current_generation := private.radar_pause_generation();
  select w.* into work_row from public.radar_work_items as w
  where w.id = p_work_item_id for update;
  if not found then raise exception 'Deep Lane work item not found' using errcode = '23503'; end if;
  if work_row.work_kind <> 'DEEP_ANALYSIS'
     or work_row.token_id is null
     or work_row.reserved_analysis_version is null
     or work_row.input_assembly_state <> 'FINALIZED'
     or work_row.sealed_at is null
     or work_row.input_hash is null then
    raise exception 'Deep Lane work item is not finalized' using errcode = '55000';
  end if;
  manifest := private.radar_input_manifest(work_row.id);
  if work_row.input_hash is distinct from private.radar_input_fingerprint(work_row.id)
     or p_input_manifest is distinct from manifest then
    raise exception 'Deep Lane manifest conflicts with the database-authoritative input' using errcode = '23505';
  end if;
  if p_task_type <> 'DEEP_ANALYSIS'
     or work_row.method_version is distinct from p_method_version
     or work_row.input_version is distinct from p_input_version
     or jsonb_typeof(p_evidence_manifest) <> 'array'
     or jsonb_typeof(p_input_manifest) <> 'array'
     or p_max_attempts not between 1 and 20 then
    raise exception 'Deep Lane request metadata is invalid or conflicts with work' using errcode = '23505';
  end if;
  request_hash := private.radar_deep_lane_request_fingerprint(
    work_row.id, work_row.token_id, work_row.reserved_analysis_version,
    p_task_type, p_method_version, p_input_version, p_schema_version,
    p_output_schema_version, work_row.input_hash, manifest, p_evidence_manifest,
    p_provider, p_model, p_model_revision, p_adapter_version
  );

  select r.* into request_row from public.radar_deep_lane_requests as r
  where r.work_item_id = work_row.id for update;
  if found then
    if request_row.logical_request_hash <> request_hash
       or request_row.token_id is distinct from work_row.token_id
       or request_row.reserved_analysis_version <> work_row.reserved_analysis_version
       or request_row.method_version <> p_method_version
       or request_row.input_version <> p_input_version
       or request_row.schema_version <> p_schema_version
       or request_row.output_schema_version <> p_output_schema_version
       or request_row.input_hash <> work_row.input_hash
       or request_row.input_manifest is distinct from manifest
       or request_row.evidence_manifest is distinct from p_evidence_manifest
       or request_row.provider <> p_provider
       or request_row.model <> p_model
       or request_row.model_revision is distinct from p_model_revision
       or request_row.adapter_version <> p_adapter_version
       or request_row.max_attempts <> p_max_attempts then
      raise exception 'Deep Lane logical request conflicts with the durable request' using errcode = '23505';
    end if;
    select a.* into attempt_row from public.radar_deep_lane_attempts as a
    where a.request_id = request_row.id order by a.attempt_number desc limit 1 for update;
    if request_row.state = 'SUCCEEDED' then
      return query select request_row.id, request_row.logical_request_hash,
        request_row.state, attempt_row.id, attempt_row.attempt_number,
        attempt_row.state, false, attempt_row.provider_idempotency_key,
        work_row.id, work_row.token_id, work_row.reserved_analysis_version,
        request_row.task_type, request_row.method_version, request_row.input_version,
        request_row.schema_version, request_row.output_schema_version,
        request_row.input_hash, request_row.input_manifest, request_row.evidence_manifest,
        request_row.provider, request_row.model, request_row.model_revision,
        request_row.adapter_version, work_row.pause_generation,
        request_row.completion_output, request_row.completion_output_hash;
      return;
    end if;
    if request_row.state = 'UNCERTAIN'
       or request_row.state = 'FAILED_TERMINAL'
       or (attempt_row.state = 'INVOKING' and not p_explicit_retry)
       or (attempt_row.state = 'FAILED_RETRYABLE' and not p_explicit_retry) then
      return query select request_row.id, request_row.logical_request_hash,
        request_row.state, attempt_row.id, attempt_row.attempt_number,
        attempt_row.state, false, attempt_row.provider_idempotency_key,
        work_row.id, work_row.token_id, work_row.reserved_analysis_version,
        request_row.task_type, request_row.method_version, request_row.input_version,
        request_row.schema_version, request_row.output_schema_version,
        request_row.input_hash, request_row.input_manifest, request_row.evidence_manifest,
        request_row.provider, request_row.model, request_row.model_revision,
        request_row.adapter_version, work_row.pause_generation,
        request_row.completion_output, request_row.completion_output_hash;
      return;
    end if;
    if attempt_row.state <> 'FAILED_RETRYABLE' or not p_explicit_retry then
      raise exception 'Deep Lane request has no explicit retryable attempt' using errcode = '55000';
    end if;
    if request_row.attempt_count >= request_row.max_attempts then
      update public.radar_deep_lane_requests
      set state = 'FAILED_TERMINAL', last_error_code = 'MAX_ATTEMPTS',
          last_error_summary = 'Deep Lane attempt limit reached'
      where id = request_row.id;
      raise exception 'Deep Lane attempt limit reached' using errcode = '55000';
    end if;
  else
    insert into public.radar_deep_lane_requests(
      work_item_id, token_id, reserved_analysis_version, task_type,
      method_version, input_version, schema_version, output_schema_version,
      input_hash, input_manifest, evidence_manifest, provider, model,
      model_revision, adapter_version, logical_request_hash, state,
      attempt_count, max_attempts
    ) values (
      work_row.id, work_row.token_id, work_row.reserved_analysis_version,
      p_task_type, p_method_version, p_input_version, p_schema_version,
      p_output_schema_version, work_row.input_hash, manifest, p_evidence_manifest,
      p_provider, p_model, p_model_revision, p_adapter_version, request_hash,
      'IN_PROGRESS', 0, p_max_attempts
    ) returning * into request_row;
    attempt_row.id := null;
    attempt_row.attempt_number := 0;
  end if;

  current_generation := private.radar_pause_guard(true);
  if work_row.state <> 'RUNNING'
     or work_row.lease_owner is distinct from p_worker
     or work_row.lease_token is distinct from p_lease_token
     or work_row.lease_generation is distinct from p_lease_generation
     or work_row.lease_expires_at <= statement_timestamp()
     or work_row.pause_generation <> current_generation then
    raise exception 'Deep Lane work lease is stale or invalid' using errcode = '40001';
  end if;

  next_attempt := coalesce(request_row.attempt_count, 0) + 1;
  new_attempt_id := gen_random_uuid();
  new_provider_key := 'deep-lane-v1:' || encode(
    extensions.digest(convert_to(request_hash || ':' || new_attempt_id::text, 'UTF8'), 'sha256'),
    'hex'
  );
  insert into public.radar_deep_lane_attempts(
    id, request_id, attempt_number, state, worker, lease_token,
    lease_generation, pause_generation, provider, model, model_revision,
    adapter_version, provider_idempotency_key
  ) values (
    new_attempt_id, request_row.id, next_attempt, 'INVOKING', p_worker, p_lease_token,
    p_lease_generation, current_generation, p_provider, p_model, p_model_revision,
    p_adapter_version, new_provider_key
  ) returning * into attempt_row;
  update public.radar_deep_lane_requests
  set state = 'IN_PROGRESS', attempt_count = next_attempt,
      last_error_code = null, last_error_summary = null
  where id = request_row.id;

  return query select request_row.id, request_row.logical_request_hash,
    'IN_PROGRESS'::text, attempt_row.id, attempt_row.attempt_number,
    attempt_row.state, true, attempt_row.provider_idempotency_key,
    work_row.id, work_row.token_id, work_row.reserved_analysis_version,
    request_row.task_type, request_row.method_version, request_row.input_version,
    request_row.schema_version, request_row.output_schema_version,
    request_row.input_hash, request_row.input_manifest, request_row.evidence_manifest,
    request_row.provider, request_row.model, request_row.model_revision,
    request_row.adapter_version, current_generation, null::jsonb, null::text;
end;
$$;
revoke all on function public.radar_system_reserve_deep_lane_attempt(
  uuid, text, uuid, bigint, text, text, text, text, text, jsonb, jsonb,
  text, text, text, text, integer, boolean
) from public, anon, authenticated, service_role;
grant execute on function public.radar_system_reserve_deep_lane_attempt(
  uuid, text, uuid, bigint, text, text, text, text, text, jsonb, jsonb,
  text, text, text, text, integer, boolean
) to service_role;

create or replace function public.radar_system_complete_deep_lane_attempt(
  p_request_id uuid,
  p_attempt_id uuid,
  p_work_item_id uuid,
  p_worker text,
  p_lease_token uuid,
  p_lease_generation bigint,
  p_pause_generation bigint,
  p_request_hash text,
  p_attempt_number integer,
  p_output jsonb,
  p_output_hash text
)
returns table (request_id uuid, attempt_id uuid, state text, output jsonb, output_hash text)
language plpgsql security definer set search_path = '' as $$
declare
  work_row public.radar_work_items%rowtype;
  request_row public.radar_deep_lane_requests%rowtype;
  attempt_row public.radar_deep_lane_attempts%rowtype;
  current_generation bigint;
  computed_hash text;
begin
  select w.* into work_row from public.radar_work_items as w where w.id = p_work_item_id for update;
  if not found then raise exception 'Deep Lane work item not found' using errcode = '23503'; end if;
  select r.* into request_row from public.radar_deep_lane_requests as r
  where r.id = p_request_id and r.work_item_id = p_work_item_id for update;
  if not found then raise exception 'Deep Lane request not found' using errcode = '23503'; end if;
  if request_row.logical_request_hash <> p_request_hash then
    raise exception 'Deep Lane completion request identity conflicts' using errcode = '23505';
  end if;
  if request_row.state = 'SUCCEEDED' then
    if request_row.completion_output_hash <> p_output_hash
       or request_row.completion_output is distinct from p_output then
      raise exception 'Deep Lane completion conflicts with the durable receipt' using errcode = '23505';
    end if;
    return query select request_row.id, request_row.completion_attempt_id,
      request_row.state, request_row.completion_output, request_row.completion_output_hash;
    return;
  end if;
  select a.* into attempt_row from public.radar_deep_lane_attempts as a
  where a.id = p_attempt_id and a.request_id = request_row.id for update;
  if not found or attempt_row.attempt_number <> p_attempt_number
     or attempt_row.state <> 'INVOKING'
     or attempt_row.worker <> p_worker
     or attempt_row.lease_token <> p_lease_token
     or attempt_row.lease_generation <> p_lease_generation
     or attempt_row.pause_generation <> p_pause_generation then
    raise exception 'Deep Lane attempt identity or state is invalid' using errcode = '40001';
  end if;
  current_generation := private.radar_pause_guard(true);
  if work_row.state <> 'RUNNING'
     or work_row.lease_owner is distinct from p_worker
     or work_row.lease_token is distinct from p_lease_token
     or work_row.lease_generation is distinct from p_lease_generation
     or work_row.lease_expires_at <= statement_timestamp()
     or work_row.pause_generation <> current_generation
     or work_row.pause_generation <> p_pause_generation
     or work_row.input_hash <> request_row.input_hash
     or work_row.method_version <> request_row.method_version
     or work_row.input_version <> request_row.input_version then
    raise exception 'Deep Lane completion fence is stale or invalid' using errcode = '40001';
  end if;
  if p_output is null or jsonb_typeof(p_output) <> 'object' then
    raise exception 'Deep Lane output must be a structured object' using errcode = '22023';
  end if;
  computed_hash := private.radar_deep_lane_output_hash(p_output);
  if p_output_hash is distinct from computed_hash then
    raise exception 'Deep Lane output hash does not match the structured output' using errcode = '23505';
  end if;
  update public.radar_deep_lane_attempts
  set state = 'SUCCEEDED', completed_at = statement_timestamp(), output = p_output,
      output_hash = computed_hash
  where id = attempt_row.id;
  update public.radar_deep_lane_requests
  set state = 'SUCCEEDED', completion_attempt_id = attempt_row.id,
      completion_output = p_output, completion_output_hash = computed_hash,
      completed_at = statement_timestamp()
  where id = request_row.id;
  update public.radar_work_items
  set state = 'SUCCEEDED', lease_owner = null, lease_token = null, lease_expires_at = null
  where id = work_row.id;
  perform private.radar_system_audit('radar.deep_lane_completed', work_row.id,
    null, jsonb_build_object('state', 'SUCCEEDED', 'attempt_number', p_attempt_number),
    jsonb_build_object('schema_version', request_row.schema_version,
      'request_hash', request_row.logical_request_hash, 'input_hash', request_row.input_hash,
      'provider', request_row.provider, 'model', request_row.model));
  return query select request_row.id, attempt_row.id, 'SUCCEEDED'::text,
    p_output, computed_hash;
end;
$$;
revoke all on function public.radar_system_complete_deep_lane_attempt(
  uuid, uuid, uuid, text, uuid, bigint, bigint, text, integer, jsonb, text
) from public, anon, authenticated, service_role;
grant execute on function public.radar_system_complete_deep_lane_attempt(
  uuid, uuid, uuid, text, uuid, bigint, bigint, text, integer, jsonb, text
) to service_role;

create or replace function public.radar_system_fail_deep_lane_attempt(
  p_request_id uuid,
  p_attempt_id uuid,
  p_work_item_id uuid,
  p_worker text,
  p_lease_token uuid,
  p_lease_generation bigint,
  p_pause_generation bigint,
  p_retryable boolean,
  p_error_code text,
  p_error_summary text,
  p_invocation_state text
)
returns text language plpgsql security definer set search_path = '' as $$
declare
  work_row public.radar_work_items%rowtype;
  request_row public.radar_deep_lane_requests%rowtype;
  attempt_row public.radar_deep_lane_attempts%rowtype;
  next_state text := case when p_retryable then 'FAILED_RETRYABLE' else 'FAILED_TERMINAL' end;
  current_generation bigint;
begin
  if p_error_code is null or p_error_code !~ '^[A-Z][A-Z0-9_]{1,63}$'
     or length(coalesce(p_error_summary, '')) > 1000
     or p_invocation_state not in ('NOT_INVOKED', 'COMPLETED_INVALID')
     or (p_retryable and p_invocation_state <> 'NOT_INVOKED') then
    raise exception 'Deep Lane failure metadata is invalid' using errcode = '22023';
  end if;
  select w.* into work_row from public.radar_work_items as w where w.id = p_work_item_id for update;
  select r.* into request_row from public.radar_deep_lane_requests as r
  where r.id = p_request_id and r.work_item_id = p_work_item_id for update;
  select a.* into attempt_row from public.radar_deep_lane_attempts as a
  where a.id = p_attempt_id and a.request_id = p_request_id for update;
  if not found or attempt_row.state <> 'INVOKING'
     or attempt_row.worker <> p_worker or attempt_row.lease_token <> p_lease_token
     or attempt_row.lease_generation <> p_lease_generation
     or attempt_row.pause_generation <> p_pause_generation then
    raise exception 'Deep Lane failure fence is stale or invalid' using errcode = '40001';
  end if;
  current_generation := private.radar_pause_guard(true);
  if work_row.state <> 'RUNNING' or work_row.lease_owner is distinct from p_worker
     or work_row.lease_token is distinct from p_lease_token
     or work_row.lease_generation is distinct from p_lease_generation
     or work_row.lease_expires_at <= statement_timestamp()
     or work_row.pause_generation <> current_generation
     or work_row.pause_generation <> p_pause_generation then
    raise exception 'Deep Lane failure fence is stale or invalid' using errcode = '40001';
  end if;
  update public.radar_deep_lane_attempts
  set state = next_state, error_code = p_error_code, error_summary = nullif(btrim(p_error_summary), '')
  where id = attempt_row.id;
  update public.radar_deep_lane_requests
  set state = next_state, last_error_code = p_error_code,
      last_error_summary = nullif(btrim(p_error_summary), '')
  where id = request_row.id;
  update public.radar_work_items
  set state = case when p_retryable then 'RETRY_WAIT' else 'FAILED' end,
      failure_retryable = p_retryable, last_error_summary = nullif(btrim(p_error_summary), ''),
      lease_owner = null, lease_token = null, lease_expires_at = null
  where id = work_row.id;
  perform private.radar_system_audit('radar.deep_lane_failed', work_row.id,
    jsonb_build_object('state', 'IN_PROGRESS'),
    jsonb_build_object('state', next_state),
    jsonb_build_object('schema_version', 1, 'error_code', p_error_code,
      'retryable', p_retryable, 'invocation_state', p_invocation_state));
  return next_state;
end;
$$;
revoke all on function public.radar_system_fail_deep_lane_attempt(
  uuid, uuid, uuid, text, uuid, bigint, bigint, boolean, text, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.radar_system_fail_deep_lane_attempt(
  uuid, uuid, uuid, text, uuid, bigint, bigint, boolean, text, text, text
) to service_role;

create or replace function public.radar_system_mark_deep_lane_uncertain(
  p_request_id uuid,
  p_attempt_id uuid,
  p_work_item_id uuid,
  p_worker text,
  p_lease_token uuid,
  p_lease_generation bigint,
  p_pause_generation bigint,
  p_error_code text,
  p_error_summary text
)
returns text language plpgsql security definer set search_path = '' as $$
declare
  work_row public.radar_work_items%rowtype;
  request_row public.radar_deep_lane_requests%rowtype;
  attempt_row public.radar_deep_lane_attempts%rowtype;
  current_generation bigint;
begin
  if p_error_code is null or p_error_code !~ '^[A-Z][A-Z0-9_]{1,63}$'
     or length(coalesce(p_error_summary, '')) > 1000 then
    raise exception 'Deep Lane uncertain metadata is invalid' using errcode = '22023';
  end if;
  select w.* into work_row from public.radar_work_items as w where w.id = p_work_item_id for update;
  select r.* into request_row from public.radar_deep_lane_requests as r
  where r.id = p_request_id and r.work_item_id = p_work_item_id for update;
  select a.* into attempt_row from public.radar_deep_lane_attempts as a
  where a.id = p_attempt_id and a.request_id = p_request_id for update;
  if not found or attempt_row.state <> 'INVOKING'
     or attempt_row.worker <> p_worker or attempt_row.lease_token <> p_lease_token
     or attempt_row.lease_generation <> p_lease_generation
     or attempt_row.pause_generation <> p_pause_generation then
    raise exception 'Deep Lane uncertain transition fence is stale or invalid' using errcode = '40001';
  end if;
  current_generation := private.radar_pause_guard(true);
  if work_row.state <> 'RUNNING' or work_row.lease_owner is distinct from p_worker
     or work_row.lease_token is distinct from p_lease_token
     or work_row.lease_generation is distinct from p_lease_generation
     or work_row.lease_expires_at <= statement_timestamp()
     or work_row.pause_generation <> current_generation
     or work_row.pause_generation <> p_pause_generation then
    raise exception 'Deep Lane uncertain transition fence is stale or invalid' using errcode = '40001';
  end if;
  update public.radar_deep_lane_attempts
  set state = 'UNCERTAIN', error_code = p_error_code, error_summary = nullif(btrim(p_error_summary), '')
  where id = attempt_row.id;
  update public.radar_deep_lane_requests
  set state = 'UNCERTAIN', last_error_code = p_error_code,
      last_error_summary = nullif(btrim(p_error_summary), '')
  where id = request_row.id;
  update public.radar_work_items
  set state = 'FAILED', failure_retryable = false,
      last_error_summary = nullif(btrim(p_error_summary), ''),
      lease_owner = null, lease_token = null, lease_expires_at = null
  where id = work_row.id;
  perform private.radar_system_audit('radar.deep_lane_uncertain', work_row.id,
    jsonb_build_object('state', 'IN_PROGRESS'),
    jsonb_build_object('state', 'UNCERTAIN'),
    jsonb_build_object('schema_version', 1, 'error_code', p_error_code));
  return 'UNCERTAIN';
end;
$$;
revoke all on function public.radar_system_mark_deep_lane_uncertain(
  uuid, uuid, uuid, text, uuid, bigint, bigint, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.radar_system_mark_deep_lane_uncertain(
  uuid, uuid, uuid, text, uuid, bigint, bigint, text, text
) to service_role;

create or replace function public.radar_system_recover_deep_lane_attempt(
  p_request_id uuid,
  p_attempt_id uuid,
  p_work_item_id uuid,
  p_execution_state text,
  p_error_code text,
  p_error_summary text
)
returns text language plpgsql security definer set search_path = '' as $$
declare
  work_row public.radar_work_items%rowtype;
  request_row public.radar_deep_lane_requests%rowtype;
  attempt_row public.radar_deep_lane_attempts%rowtype;
  next_state text;
begin
  if p_execution_state not in ('NOT_INVOKED', 'UNKNOWN')
     or p_error_code is null or p_error_code !~ '^[A-Z][A-Z0-9_]{1,63}$'
     or length(coalesce(p_error_summary, '')) > 1000 then
    raise exception 'Deep Lane recovery metadata is invalid' using errcode = '22023';
  end if;
  select * into work_row from public.radar_work_items where id = p_work_item_id for update;
  select * into request_row from public.radar_deep_lane_requests
  where id = p_request_id and work_item_id = p_work_item_id for update;
  select * into attempt_row from public.radar_deep_lane_attempts
  where id = p_attempt_id and request_id = p_request_id for update;
  if not found or attempt_row.state <> 'INVOKING' then
    raise exception 'Deep Lane recovery attempt is not active' using errcode = '55000';
  end if;
  if work_row.lease_expires_at is not null and work_row.lease_expires_at > statement_timestamp() then
    raise exception 'Deep Lane recovery requires an expired lease' using errcode = '55000';
  end if;
  next_state := case when p_execution_state = 'NOT_INVOKED' then 'FAILED_RETRYABLE' else 'UNCERTAIN' end;
  update public.radar_deep_lane_attempts
  set state = next_state, error_code = p_error_code, error_summary = nullif(btrim(p_error_summary), '')
  where id = attempt_row.id;
  update public.radar_deep_lane_requests
  set state = next_state, last_error_code = p_error_code,
      last_error_summary = nullif(btrim(p_error_summary), '')
  where id = request_row.id;
  update public.radar_work_items
  set state = case when p_execution_state = 'NOT_INVOKED' then 'RETRY_WAIT' else 'FAILED' end,
      failure_retryable = p_execution_state = 'NOT_INVOKED',
      last_error_summary = nullif(btrim(p_error_summary), ''),
      lease_owner = null, lease_token = null, lease_expires_at = null
  where id = work_row.id;
  perform private.radar_system_audit('radar.deep_lane_recovered', work_row.id,
    jsonb_build_object('state', 'INVOKING'), jsonb_build_object('state', next_state),
    jsonb_build_object('schema_version', 1, 'execution_state', p_execution_state,
      'error_code', p_error_code));
  return next_state;
end;
$$;
revoke all on function public.radar_system_recover_deep_lane_attempt(
  uuid, uuid, uuid, text, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.radar_system_recover_deep_lane_attempt(
  uuid, uuid, uuid, text, text, text
) to service_role;

commit;
