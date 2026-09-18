begin;

-- Gate 19C is a persistence and security contract only.  Provider adapters,
-- evaluators, workers and public application callers remain deferred.

create table public.radar_events (
  id uuid primary key default gen_random_uuid(),
  token_id uuid references public.tokens(id) on delete restrict,
  event_type text not null check (event_type ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  event_key_version text not null default 'v1' check (event_key_version ~ '^v[0-9]+$'),
  event_key text not null check (length(btrim(event_key)) between 1 and 512),
  source_provider text check (source_provider is null or length(btrim(source_provider)) between 1 and 128),
  source_event_id text check (source_event_id is null or length(btrim(source_event_id)) between 1 and 256),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  context jsonb not null default '{}'::jsonb check (jsonb_typeof(context) = 'object'),
  observed_at timestamptz not null,
  received_at timestamptz not null default statement_timestamp(),
  processing_state text not null default 'RECEIVED'
    check (processing_state in ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED', 'QUARANTINED')),
  created_at timestamptz not null default statement_timestamp(),
  constraint radar_events_time_order_check check (observed_at <= received_at)
);
create unique index radar_events_identity_key
  on public.radar_events(event_key_version, event_key);
create index radar_events_token_observed_idx
  on public.radar_events(token_id, observed_at desc);
create trigger radar_events_no_mutation before update or delete on public.radar_events
  for each row execute function public.reject_immutable_change();
create trigger radar_events_no_truncate before truncate on public.radar_events
  for each statement execute function public.reject_immutable_change();

create table public.radar_observations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.radar_events(id) on delete restrict,
  token_id uuid not null references public.tokens(id) on delete restrict,
  provider text not null check (provider ~ '^[a-z][a-z0-9_.-]{1,63}$'),
  adapter_version text not null check (adapter_version ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'),
  capability text not null check (capability ~ '^[a-z][a-z0-9_.:-]{1,63}$'),
  metric_key text not null check (metric_key ~ '^[a-z][a-z0-9_.:-]{1,63}$'),
  data_state text not null check (data_state in ('AVAILABLE', 'UNKNOWN', 'UNAVAILABLE', 'UNSUPPORTED', 'STALE')),
  normalized_value numeric,
  raw_integer_value numeric,
  decimal_places integer check (decimal_places is null or decimal_places between 0 and 255),
  unit text check (unit is null or length(btrim(unit)) between 1 and 64),
  context jsonb not null default '{}'::jsonb check (jsonb_typeof(context) = 'object'),
  provenance jsonb not null check (jsonb_typeof(provenance) = 'object'),
  trace_reference text check (trace_reference is null or length(trace_reference) <= 512),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  observed_at timestamptz not null,
  received_at timestamptz not null default statement_timestamp(),
  created_at timestamptz not null default statement_timestamp(),
  constraint radar_observations_time_order_check check (observed_at <= received_at),
  constraint radar_observations_state_value_check check (
    (data_state = 'AVAILABLE' and normalized_value is not null) or data_state <> 'AVAILABLE'
  ),
  constraint radar_observations_finite_numeric_check check (
    (normalized_value is null or normalized_value not in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric))
    and (raw_integer_value is null or raw_integer_value not in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric))
  ),
  constraint radar_observations_integer_scale_check check (
    raw_integer_value is null or raw_integer_value = trunc(raw_integer_value)
  )
);

create function private.radar_observation_identity_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  event_token uuid;
begin
  select token_id into event_token from public.radar_events where id = new.event_id;
  if not found then raise exception 'observation event does not exist' using errcode = '23503'; end if;
  if event_token is not null and event_token is distinct from new.token_id then
    raise exception 'observation token does not match event token' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.radar_observation_identity_guard() from public, anon, authenticated, service_role;
create trigger radar_observations_identity_guard before insert on public.radar_observations
  for each row execute function private.radar_observation_identity_guard();

create unique index radar_observations_identity_key
  on public.radar_observations(event_id, provider, capability, metric_key, content_hash);
create index radar_observations_token_observed_idx
  on public.radar_observations(token_id, observed_at desc);
create trigger radar_observations_no_mutation before update or delete on public.radar_observations
  for each row execute function public.reject_immutable_change();
create trigger radar_observations_no_truncate before truncate on public.radar_observations
  for each statement execute function public.reject_immutable_change();

create table public.radar_work_items (
  id uuid primary key default gen_random_uuid(),
  work_kind text not null check (work_kind in (
    'DISCOVERY', 'OBSERVATION', 'SCREENING', 'DEEP_ANALYSIS',
    'REFRESH', 'REANALYSIS', 'RECALCULATION'
  )),
  token_id uuid references public.tokens(id) on delete restrict,
  event_id uuid references public.radar_events(id) on delete restrict,
  parent_analysis_id uuid references public.radar_analyses(id) on delete restrict,
  request_key text not null check (length(btrim(request_key)) between 1 and 256),
  state text not null default 'QUEUED'
    check (state in ('QUEUED', 'RUNNING', 'RETRY_WAIT', 'SUCCEEDED', 'FAILED', 'CANCELLED')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  available_at timestamptz not null default statement_timestamp(),
  lease_owner text check (lease_owner is null or length(btrim(lease_owner)) between 1 and 128),
  lease_token uuid,
  lease_expires_at timestamptz,
  lease_generation bigint not null default 0 check (lease_generation >= 0),
  pause_generation bigint not null default 1 check (pause_generation >= 0),
  method_version text check (method_version is null or method_version ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'),
  input_version text check (input_version is null or input_version ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'),
  reserved_analysis_version integer check (reserved_analysis_version is null or reserved_analysis_version > 0),
  sealed_at timestamptz,
  input_hash text check (input_hash is null or input_hash ~ '^[0-9a-f]{64}$'),
  screening_result text check (screening_result is null or screening_result in ('PASS', 'REJECT', 'INCOMPLETE')),
  screening_reasons jsonb check (screening_reasons is null or jsonb_typeof(screening_reasons) = 'array'),
  screening_evaluated_at timestamptz,
  result_analysis_id uuid,
  last_error_summary text check (last_error_summary is null or length(last_error_summary) <= 1000),
  checkpoint jsonb check (checkpoint is null or jsonb_typeof(checkpoint) = 'object'),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint radar_work_items_token_scope_check check (
    work_kind = 'DISCOVERY' or token_id is not null
  ),
  constraint radar_work_items_lease_pair_check check (
    (lease_owner is null and lease_token is null and lease_expires_at is null)
    or (lease_owner is not null and lease_token is not null and lease_expires_at is not null)
  ),
  constraint radar_work_items_screening_pair_check check (
    (screening_result is null and screening_evaluated_at is null)
    or (screening_result is not null and screening_evaluated_at is not null)
  )
);
create unique index radar_work_items_request_key on public.radar_work_items(request_key);
create unique index radar_work_items_reserved_version_key
  on public.radar_work_items(token_id, reserved_analysis_version)
  where reserved_analysis_version is not null;
create index radar_work_items_due_idx on public.radar_work_items(state, available_at, created_at);
create index radar_work_items_token_idx on public.radar_work_items(token_id, created_at desc);
create trigger radar_work_items_set_updated_at before update on public.radar_work_items
  for each row execute function public.set_updated_at();

create table public.radar_work_inputs (
  work_item_id uuid not null references public.radar_work_items(id) on delete restrict,
  observation_id uuid not null references public.radar_observations(id) on delete restrict,
  added_at timestamptz not null default statement_timestamp(),
  primary key (work_item_id, observation_id)
);
create index radar_work_inputs_observation_idx on public.radar_work_inputs(observation_id);

create function private.radar_work_input_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  work_state text;
  sealed timestamptz;
  work_token uuid;
  observation_token uuid;
begin
  if tg_op <> 'INSERT' then
    raise exception 'radar_work_inputs is append-only' using errcode = '55000';
  end if;
  select state, sealed_at, token_id into work_state, sealed, work_token
  from public.radar_work_items where id = new.work_item_id for share;
  if not found or sealed is not null or work_state not in ('QUEUED', 'RUNNING', 'RETRY_WAIT') then
    raise exception 'work inputs can only be added before a work item is sealed' using errcode = '55000';
  end if;
  select token_id into observation_token from public.radar_observations where id = new.observation_id;
  if not found or (work_token is not null and work_token is distinct from observation_token) then
    raise exception 'work input token does not match work item scope' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.radar_work_input_guard() from public, anon, authenticated, service_role;
create trigger radar_work_inputs_guard before insert or update or delete on public.radar_work_inputs
  for each row execute function private.radar_work_input_guard();

alter table public.radar_analyses
  add column run_type text not null default 'LEGACY'
    check (run_type in ('LEGACY', 'SCREENING', 'DEEP_ANALYSIS', 'REANALYSIS', 'RECALCULATION')),
  add column work_item_id uuid,
  add column requested_at timestamptz,
  add column started_at timestamptz,
  add column completed_at timestamptz,
  add column failure_code text check (failure_code is null or failure_code ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  add column failure_context jsonb check (failure_context is null or jsonb_typeof(failure_context) = 'object'),
  add column scoring_method_version text check (scoring_method_version is null or scoring_method_version ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'),
  add column methodology_hash text check (methodology_hash is null or methodology_hash ~ '^[0-9a-f]{64}$'),
  add column input_hash text check (input_hash is null or input_hash ~ '^[0-9a-f]{64}$'),
  add column component_breakdown jsonb check (component_breakdown is null or jsonb_typeof(component_breakdown) = 'object'),
  add column coverage jsonb check (coverage is null or jsonb_typeof(coverage) = 'object'),
  add column deep_lane_provenance jsonb check (deep_lane_provenance is null or jsonb_typeof(deep_lane_provenance) = 'object'),
  add column supersedes_analysis_id uuid references public.radar_analyses(id) on delete restrict,
  add column public_eligibility boolean not null default false,
  add column freshness_policy_version text check (freshness_policy_version is null or freshness_policy_version ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'),
  add column expires_at timestamptz,
  add constraint radar_analyses_score_finite_check check (
    score is null or score not in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
  ),
  add constraint radar_analyses_run_time_order_check check (
    (requested_at is null or started_at is null or requested_at <= started_at)
    and (started_at is null or completed_at is null or started_at <= completed_at)
    and (completed_at is null or completed_at <= analyzed_at)
  ),
  add constraint radar_analyses_expiry_check check (expires_at is null or expires_at > data_as_of),
  add constraint radar_analyses_public_contract_check check (
    not public_eligibility
    or (scoring_method_version is not null and methodology_hash is not null and input_hash is not null
        and freshness_policy_version is not null and expires_at is not null)
  ),
  add constraint radar_analyses_id_token_key unique (id, token_id);
create unique index radar_analyses_work_item_key
  on public.radar_analyses(work_item_id) where work_item_id is not null;
create index radar_analyses_public_idx
  on public.radar_analyses(token_id, analyzed_at desc)
  where public_eligibility;

alter table public.radar_work_items
  add constraint radar_work_items_result_analysis_fk
  foreign key (result_analysis_id) references public.radar_analyses(id) on delete restrict;
alter table public.radar_analyses
  add constraint radar_analyses_work_item_fk
  foreign key (work_item_id) references public.radar_work_items(id) on delete restrict;

create table public.radar_evidence (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null,
  token_id uuid not null,
  evidence_key text not null check (evidence_key ~ '^[a-z][a-z0-9_.:-]{1,95}$'),
  classification text not null check (classification in ('VERIFIED_DATA', 'STRONG_SIGNAL', 'AI_INFERENCE', 'UNKNOWN')),
  origin text not null check (origin in ('DETERMINISTIC', 'INFERENCE')),
  category text not null check (category ~ '^[a-z][a-z0-9_.:-]{1,63}$'),
  label text not null check (length(btrim(label)) between 1 and 160),
  statement text check (statement is null or length(statement) <= 2000),
  numeric_value numeric,
  numeric_unit text check (numeric_unit is null or length(btrim(numeric_unit)) between 1 and 64),
  decimal_places integer check (decimal_places is null or decimal_places between 0 and 255),
  structured_value jsonb check (structured_value is null or jsonb_typeof(structured_value) in ('object', 'array')),
  unknown_reason text check (unknown_reason is null or length(btrim(unknown_reason)) between 1 and 500),
  provider text check (provider is null or provider ~ '^[a-z][a-z0-9_.-]{1,63}$'),
  adapter_version text check (adapter_version is null or adapter_version ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'),
  observation_id uuid references public.radar_observations(id) on delete restrict,
  source_reference text check (source_reference is null or source_reference ~* '^https?://(([a-z0-9]([-a-z0-9]{0,61}[a-z0-9])?\.)+[a-z]{2,63}|([0-9]{1,3}\.){3}[0-9]{1,3})(:[0-9]{1,5})?(/[^[:space:]]*)?$'),
  observed_at timestamptz,
  received_at timestamptz,
  evaluated_at timestamptz,
  methodology_version text check (methodology_version is null or methodology_version ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'),
  is_public boolean not null default false,
  public_rank integer check (public_rank is null or public_rank between 0 and 99),
  created_at timestamptz not null default statement_timestamp(),
  constraint radar_evidence_analysis_token_fk foreign key (analysis_id, token_id)
    references public.radar_analyses(id, token_id) on delete restrict,
  constraint radar_evidence_numeric_finite_check check (
    numeric_value is null or numeric_value not in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
  ),
  constraint radar_evidence_classification_origin_check check (
    (classification = 'AI_INFERENCE' and origin = 'INFERENCE')
    or (classification <> 'AI_INFERENCE')
  ),
  constraint radar_evidence_unknown_contract_check check (
    (classification = 'UNKNOWN' and numeric_value is null and unknown_reason is not null)
    or (classification <> 'UNKNOWN')
  ),
  constraint radar_evidence_timestamp_order_check check (
    (observed_at is null or received_at is null or observed_at <= received_at)
    and (evaluated_at is null or received_at is null or evaluated_at >= received_at)
  )
);
create unique index radar_evidence_analysis_key on public.radar_evidence(analysis_id, evidence_key);
create index radar_evidence_public_idx on public.radar_evidence(analysis_id, public_rank) where is_public;
create trigger radar_evidence_no_mutation before update or delete on public.radar_evidence
  for each row execute function public.reject_immutable_change();
create trigger radar_evidence_no_truncate before truncate on public.radar_evidence
  for each statement execute function public.reject_immutable_change();

alter table public.radar_reviews
  add column token_id uuid,
  add column revision integer not null default 1 check (revision > 0),
  add column public_note text not null default '',
  add column public_disclosure text not null default '',
  add column public_presentation jsonb not null default '{}'::jsonb
    check (jsonb_typeof(public_presentation) = 'object'),
  add column approval_analysis_version integer,
  add column approval_input_hash text,
  add column approval_methodology_hash text,
  add column approved_at timestamptz,
  add column last_action_key text check (last_action_key is null or length(btrim(last_action_key)) between 1 and 256);
update public.radar_reviews r
set token_id = a.token_id
from public.radar_analyses a
where a.id = r.analysis_id and r.token_id is null;
alter table public.radar_reviews
  add constraint radar_reviews_analysis_token_fk foreign key (analysis_id, token_id)
    references public.radar_analyses(id, token_id) on delete restrict,
  add constraint radar_reviews_approval_binding_check check (
    (state <> 'APPROVED' or (approved_at is not null and approval_analysis_version is not null
      and approval_input_hash is not null and approval_methodology_hash is not null))
  ),
  add constraint radar_reviews_public_text_check check (length(btrim(public_note)) <= 2000);

create or replace function private.radar_review_token_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.token_id is null then
    select token_id into new.token_id from public.radar_analyses where id = new.analysis_id;
  end if;
  if new.token_id is null then
    raise exception 'review target analysis must have a token' using errcode = '23503';
  end if;
  return new;
end;
$$;
revoke all on function private.radar_review_token_guard() from public, anon, authenticated, service_role;
create trigger radar_reviews_default_token before insert on public.radar_reviews
  for each row execute function private.radar_review_token_guard();
create unique index radar_reviews_one_published_token
  on public.radar_reviews(token_id) where state = 'PUBLISHED';
create index radar_reviews_token_revision_idx on public.radar_reviews(token_id, revision desc);

-- Missing or malformed emergency state is fail-closed.  This seed is a
-- control row, not an automatic publication or processing mechanism.
insert into public.feature_flags(key, enabled, configuration)
values ('radar_emergency_paused', true, '{"generation": 1}'::jsonb)
on conflict (key) do nothing;

create or replace function private.radar_flag_enabled(p_key text, p_default boolean)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select f.enabled from public.feature_flags f where f.key = p_key), p_default);
$$;
revoke all on function private.radar_flag_enabled(text, boolean) from public, anon, authenticated, service_role;

create or replace function private.radar_pause_generation()
returns bigint language sql stable security definer set search_path = '' as $$
  select case
    when f.configuration is not null
      and jsonb_typeof(f.configuration) = 'object'
      and f.configuration->>'generation' ~ '^[0-9]+$'
    then (f.configuration->>'generation')::bigint
    else 0
  end
  from public.feature_flags f
  where f.key = 'radar_emergency_paused';
$$;
revoke all on function private.radar_pause_generation() from public, anon, authenticated, service_role;

create or replace function private.radar_require_roles(p_allowed text[])
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare
  actor_id uuid := (select auth.uid());
  role_keys text[] := coalesce((select private.current_app_roles()), array[]::text[]);
begin
  if actor_id is null or not (role_keys && p_allowed) then
    raise exception 'Radar permission denied' using errcode = '42501';
  end if;
  return actor_id;
end;
$$;
revoke all on function private.radar_require_roles(text[]) from public, anon, authenticated, service_role;

create or replace function private.radar_audit(
  p_actor_id uuid,
  p_action text,
  p_resource_id uuid,
  p_previous jsonb,
  p_resulting jsonb,
  p_metadata jsonb
)
returns uuid language sql security definer set search_path = '' as $$
  select public.write_audit_event(
    'USER', p_actor_id, p_action, 'radar', p_resource_id,
    p_previous, p_resulting, coalesce(p_metadata, '{}'::jsonb)
  );
$$;
revoke all on function private.radar_audit(uuid, text, uuid, jsonb, jsonb, jsonb)
  from public, anon, authenticated, service_role;

create or replace function private.radar_system_audit(
  p_action text,
  p_resource_id uuid,
  p_previous jsonb,
  p_resulting jsonb,
  p_metadata jsonb
)
returns uuid language sql security definer set search_path = '' as $$
  select public.write_audit_event(
    'SYSTEM', null, p_action, 'radar', p_resource_id,
    p_previous, p_resulting, coalesce(p_metadata, '{}'::jsonb)
  );
$$;
revoke all on function private.radar_system_audit(text, uuid, jsonb, jsonb, jsonb)
  from public, anon, authenticated, service_role;

-- System operations are deliberately narrow definer functions.  Their only
-- API execution grant is service_role; ordinary browser roles retain no raw
-- DML or system-operation path.
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
  existing_hash text;
begin
  insert into public.radar_events(
    event_key, event_type, token_id, source_provider, source_event_id,
    payload_hash, context, observed_at
  ) values (
    p_event_key, p_event_type, p_token_id, p_source_provider, p_source_event_id,
    p_payload_hash, coalesce(p_context, '{}'::jsonb), p_observed_at
  ) on conflict (event_key_version, event_key) do nothing
  returning id into event_id;
  if event_id is null then
    select id, payload_hash into event_id, existing_hash from public.radar_events
    where event_key_version = 'v1' and event_key = p_event_key;
    if existing_hash is distinct from p_payload_hash then
      raise exception 'event key conflicts with an existing payload' using errcode = '23505';
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
  pause_generation bigint := coalesce((select private.radar_pause_generation()), 0);
begin
  select * into existing_work from public.radar_work_items where request_key = p_request_key;
  if existing_work.id is not null then
    if existing_work.work_kind is distinct from p_work_kind
       or existing_work.token_id is distinct from p_token_id
       or existing_work.event_id is distinct from p_event_id
       or existing_work.parent_analysis_id is distinct from p_parent_analysis_id
       or existing_work.method_version is distinct from p_method_version
       or existing_work.input_version is distinct from p_input_version then
      raise exception 'work request key conflicts with an existing request' using errcode = '23505';
    end if;
    return existing_work.id;
  end if;
  if (select private.radar_flag_enabled('radar_emergency_paused', true)) then
    raise exception 'Radar emergency pause blocks new work' using errcode = '55000';
  end if;

  if p_work_kind in ('SCREENING', 'DEEP_ANALYSIS', 'REANALYSIS', 'RECALCULATION') then
    if p_token_id is null then
      raise exception 'token is required for analysis work' using errcode = '23514';
    end if;
    perform 1 from public.tokens where id = p_token_id for update;
    if not found then raise exception 'token not found' using errcode = '23503'; end if;
    select coalesce(max(reserved_analysis_version), 0) + 1 into reserved_version
    from public.radar_work_items where token_id = p_token_id;
  end if;

  insert into public.radar_work_items(
    work_kind, token_id, event_id, parent_analysis_id, request_key,
    available_at, method_version, input_version, reserved_analysis_version,
    pause_generation
  ) values (
    p_work_kind, p_token_id, p_event_id, p_parent_analysis_id, p_request_key,
    coalesce(p_available_at, statement_timestamp()), p_method_version, p_input_version,
    reserved_version, pause_generation
  ) on conflict (request_key) do nothing
  returning id into work_id;
  if work_id is null then
    select id into work_id from public.radar_work_items where request_key = p_request_key;
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
  current_generation bigint := coalesce((select private.radar_pause_generation()), 0);
begin
  if p_lease_seconds not between 30 and 3600 then
    raise exception 'lease duration out of bounds' using errcode = '22023';
  end if;
  if (select private.radar_flag_enabled('radar_emergency_paused', true)) then
    return;
  end if;
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

  update public.radar_work_items as w
  set state = 'RUNNING', attempt_count = w.attempt_count + 1,
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
  already_complete boolean := false;
begin
  if p_result not in ('PASS', 'REJECT', 'INCOMPLETE') then
    raise exception 'invalid screening result' using errcode = '22023';
  end if;
  update public.radar_work_items
  set state = 'SUCCEEDED', sealed_at = statement_timestamp(), input_hash = p_input_hash,
      screening_result = p_result, screening_reasons = coalesce(p_reasons, '[]'::jsonb),
      screening_evaluated_at = coalesce(p_evaluated_at, statement_timestamp()),
      lease_owner = null, lease_token = null, lease_expires_at = null
  where id = p_work_item_id and state = 'RUNNING' and lease_owner = p_worker
    and lease_token = p_lease_token and lease_generation = p_lease_generation
    and lease_expires_at > statement_timestamp()
    and pause_generation = coalesce((select private.radar_pause_generation()), 0)
    and not (select private.radar_flag_enabled('radar_emergency_paused', true))
  returning id into completed_id;
  if completed_id is null then
    select id into completed_id from public.radar_work_items
    where id = p_work_item_id and state = 'SUCCEEDED' and screening_result = p_result;
    already_complete := completed_id is not null;
  end if;
  if completed_id is null then
    raise exception 'work lease is stale or invalid' using errcode = '40001';
  end if;
  if not already_complete then
    perform private.radar_system_audit('radar.screening_completed', completed_id,
      null, jsonb_build_object('state', 'SUCCEEDED', 'screening_result', p_result),
      jsonb_build_object('schema_version', 1, 'input_hash', p_input_hash));
  end if;
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
begin
  if p_lease_seconds not between 30 and 3600 then
    raise exception 'lease duration out of bounds' using errcode = '22023';
  end if;
  update public.radar_work_items
  set lease_expires_at = statement_timestamp() + make_interval(secs => p_lease_seconds)
  where id = p_work_item_id and state = 'RUNNING' and lease_owner = p_worker
    and lease_token = p_lease_token and lease_generation = p_lease_generation
    and lease_expires_at > statement_timestamp()
    and not (select private.radar_flag_enabled('radar_emergency_paused', true));
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
begin
  if length(coalesce(p_error_summary, '')) > 1000 then
    raise exception 'error summary too long' using errcode = '22023';
  end if;
  update public.radar_work_items
  set state = next_state, available_at = coalesce(p_retry_at, statement_timestamp()),
      last_error_summary = nullif(btrim(coalesce(p_error_summary, '')), ''),
      lease_owner = null, lease_token = null, lease_expires_at = null
  where id = p_work_item_id and state = 'RUNNING' and lease_owner = p_worker
    and lease_token = p_lease_token and lease_generation = p_lease_generation;
  if not found then
    select state into resulting_state from public.radar_work_items where id = p_work_item_id;
    if resulting_state in ('FAILED', 'RETRY_WAIT') then return resulting_state; end if;
    raise exception 'work lease is stale or invalid' using errcode = '40001';
  end if;
  perform private.radar_system_audit('radar.work_failed', p_work_item_id,
    null, jsonb_build_object('state', next_state),
    jsonb_build_object('schema_version', 1, 'retryable', p_retryable));
  return next_state;
end;
$$;
revoke all on function public.radar_system_fail_work(uuid, text, uuid, bigint, boolean, text, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.radar_system_fail_work(uuid, text, uuid, bigint, boolean, text, timestamptz)
  to service_role;

create or replace function public.radar_system_create_analysis(
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
  p_data_as_of timestamptz
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  work_row public.radar_work_items%rowtype;
  analysis_id uuid;
  analysis_version integer;
  analysis_run_type text;
begin
  select * into work_row from public.radar_work_items where id = p_work_item_id for update;
  if not found then raise exception 'work item not found' using errcode = '23503'; end if;
  if work_row.result_analysis_id is not null then
    if p_scoring_method_version is distinct from (
      select scoring_method_version from public.radar_analyses where id = work_row.result_analysis_id
    ) then
      raise exception 'analysis completion conflicts with the accepted methodology' using errcode = '22023';
    end if;
    return work_row.result_analysis_id;
  end if;
  if work_row.state <> 'SUCCEEDED' or work_row.sealed_at is null then
    raise exception 'analysis requires a completed sealed work item' using errcode = '55000';
  end if;
  if (select private.radar_flag_enabled('radar_emergency_paused', true))
     or work_row.pause_generation <> coalesce((select private.radar_pause_generation()), 0) then
    raise exception 'Radar emergency pause blocks result acceptance' using errcode = '55000';
  end if;
  if p_scoring_method_version <> 'contract-v1' then
    raise exception 'methodology is not approved by the Gate 19C contract' using errcode = '22023';
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
    jsonb_build_object('schema_version', 1, 'methodology_hash', p_methodology_hash,
      'input_hash', p_input_hash));
  return analysis_id;
end;
$$;
revoke all on function public.radar_system_create_analysis(uuid, text, numeric, jsonb, jsonb, text, text, text, text, jsonb, jsonb, jsonb, text, timestamptz, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.radar_system_create_analysis(uuid, text, numeric, jsonb, jsonb, text, text, text, text, jsonb, jsonb, jsonb, text, timestamptz, timestamptz)
  to service_role;

create or replace function public.radar_system_append_evidence(
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
  p_public_rank integer
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  evidence_id uuid;
begin
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
    select id into evidence_id from public.radar_evidence
    where analysis_id = p_analysis_id and evidence_key = p_evidence_key;
  end if;
  return evidence_id;
end;
$$;
revoke all on function public.radar_system_append_evidence(uuid, uuid, text, text, text, text, text, text, numeric, text, integer, jsonb, text, text, text, uuid, text, timestamptz, timestamptz, timestamptz, text, boolean, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.radar_system_append_evidence(uuid, uuid, text, text, text, text, text, text, numeric, text, integer, jsonb, text, text, text, uuid, text, timestamptz, timestamptz, timestamptz, text, boolean, integer)
  to service_role;

-- Human operations derive the authenticated subject and current effective
-- roles, lock the target, validate the transition, mutate, and audit in one
-- transaction.  No browser role receives direct DML on Radar tables.
create or replace function public.radar_approve_review(
  p_review_id uuid,
  p_expected_revision integer,
  p_public_note text,
  p_public_disclosure text,
  p_public_presentation jsonb,
  p_action_key text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := private.radar_require_roles(array['owner', 'admin', 'radar_reviewer']);
  review_row public.radar_reviews%rowtype;
  analysis_row public.radar_analyses%rowtype;
begin
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
  p_review_id uuid,
  p_expected_revision integer,
  p_action_key text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := private.radar_require_roles(array['owner', 'admin', 'radar_reviewer']);
  review_row public.radar_reviews%rowtype;
  analysis_row public.radar_analyses%rowtype;
  old_review public.radar_reviews%rowtype;
  highest_version integer;
begin
  -- Lock controls before the token/review so pause and publication have one
  -- clear linearization point.
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
     or analysis_row.score is null
     or analysis_row.expires_at <= statement_timestamp()
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
  where r.token_id = review_row.token_id and r.state = 'PUBLISHED' and r.id <> p_review_id
  for update;
  if found then
    update public.radar_reviews set state = 'HIDDEN', revision = revision + 1 where id = old_review.id;
    perform private.radar_audit(actor_id, 'radar.hidden', old_review.id,
      jsonb_build_object('state', 'PUBLISHED', 'revision', old_review.revision),
      jsonb_build_object('state', 'HIDDEN', 'revision', old_review.revision + 1),
      jsonb_build_object('schema_version', 1, 'superseded_by', p_review_id));
  end if;
  update public.radar_reviews
  set state = 'PUBLISHED', published_at = statement_timestamp(), revision = revision + 1,
      last_action_key = p_action_key
  where id = p_review_id;
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
  p_review_id uuid,
  p_expected_revision integer,
  p_reason text,
  p_action_key text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := private.radar_require_roles(array['owner', 'admin', 'radar_reviewer']);
  review_row public.radar_reviews%rowtype;
begin
  select * into review_row from public.radar_reviews where id = p_review_id for update;
  if not found then raise exception 'review not found' using errcode = 'P0002'; end if;
  if review_row.state = 'REJECTED' and review_row.last_action_key = p_action_key then return p_review_id; end if;
  if review_row.revision <> p_expected_revision or review_row.state not in ('PENDING', 'APPROVED') then
    raise exception 'invalid or stale review transition' using errcode = '55000';
  end if;
  if length(btrim(coalesce(p_reason, ''))) = 0 or length(p_reason) > 1000 then
    raise exception 'bounded rejection reason required' using errcode = '22023';
  end if;
  update public.radar_reviews set state = 'REJECTED', reviewed_by = actor_id,
    reviewed_at = statement_timestamp(), revision = revision + 1, last_action_key = p_action_key
  where id = p_review_id;
  perform private.radar_audit(actor_id, 'radar.rejected', p_review_id,
    jsonb_build_object('state', review_row.state, 'revision', review_row.revision),
    jsonb_build_object('state', 'REJECTED', 'revision', review_row.revision + 1),
    jsonb_build_object('schema_version', 1, 'reason', p_reason, 'action_key', p_action_key));
  return p_review_id;
end;
$$;
revoke all on function public.radar_reject_review(uuid, integer, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.radar_reject_review(uuid, integer, text, text) to authenticated;

create or replace function public.radar_hide_review(
  p_review_id uuid,
  p_expected_revision integer,
  p_reason text,
  p_action_key text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := private.radar_require_roles(array['owner', 'admin', 'radar_reviewer']);
  review_row public.radar_reviews%rowtype;
begin
  select * into review_row from public.radar_reviews where id = p_review_id for update;
  if not found then raise exception 'review not found' using errcode = 'P0002'; end if;
  if review_row.state = 'HIDDEN' and review_row.last_action_key = p_action_key then return p_review_id; end if;
  if review_row.revision <> p_expected_revision or review_row.state <> 'PUBLISHED' then
    raise exception 'only published reviews can be hidden' using errcode = '55000';
  end if;
  if length(btrim(coalesce(p_reason, ''))) = 0 or length(p_reason) > 1000 then
    raise exception 'bounded hide reason required' using errcode = '22023';
  end if;
  update public.radar_reviews set state = 'HIDDEN', revision = revision + 1, last_action_key = p_action_key
  where id = p_review_id;
  perform private.radar_audit(actor_id, 'radar.hidden', p_review_id,
    jsonb_build_object('state', 'PUBLISHED', 'revision', review_row.revision),
    jsonb_build_object('state', 'HIDDEN', 'revision', review_row.revision + 1),
    jsonb_build_object('schema_version', 1, 'reason', p_reason, 'action_key', p_action_key));
  return p_review_id;
end;
$$;
revoke all on function public.radar_hide_review(uuid, integer, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.radar_hide_review(uuid, integer, text, text) to authenticated;

create or replace function public.radar_update_editorial_note(
  p_review_id uuid,
  p_expected_revision integer,
  p_editorial_note text,
  p_action_key text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := private.radar_require_roles(array['owner', 'admin', 'radar_reviewer']);
  review_row public.radar_reviews%rowtype;
begin
  select * into review_row from public.radar_reviews where id = p_review_id for update;
  if not found then raise exception 'review not found' using errcode = 'P0002'; end if;
  if review_row.revision <> p_expected_revision or review_row.state = 'PUBLISHED' then
    raise exception 'editorial note cannot rewrite published history' using errcode = '55000';
  end if;
  if length(coalesce(p_editorial_note, '')) > 4000 then raise exception 'editorial note too long' using errcode = '22023'; end if;
  update public.radar_reviews set editorial_note = coalesce(p_editorial_note, ''),
    revision = revision + 1, last_action_key = p_action_key where id = p_review_id;
  perform private.radar_audit(actor_id, 'radar.editorial_note_updated', p_review_id,
    jsonb_build_object('state', review_row.state, 'revision', review_row.revision),
    jsonb_build_object('state', review_row.state, 'revision', review_row.revision + 1),
    jsonb_build_object('schema_version', 1, 'action_key', p_action_key));
  return p_review_id;
end;
$$;
revoke all on function public.radar_update_editorial_note(uuid, integer, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.radar_update_editorial_note(uuid, integer, text, text) to authenticated;

create or replace function public.radar_request_reanalysis(
  p_analysis_id uuid,
  p_reason text,
  p_request_key text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := private.radar_require_roles(array['owner', 'admin', 'radar_reviewer', 'analyst']);
  analysis_row public.radar_analyses%rowtype;
  work_id uuid;
  already_exists boolean := false;
begin
  if length(btrim(coalesce(p_reason, ''))) = 0 or length(p_reason) > 1000 then
    raise exception 'bounded reanalysis reason required' using errcode = '22023';
  end if;
  select * into analysis_row from public.radar_analyses where id = p_analysis_id for share;
  if not found then raise exception 'analysis not found' using errcode = 'P0002'; end if;
  if (select private.radar_flag_enabled('radar_emergency_paused', true)) then
    raise exception 'Radar emergency pause blocks reanalysis requests' using errcode = '55000';
  end if;
  insert into public.radar_work_items(work_kind, token_id, parent_analysis_id, request_key, pause_generation)
  values ('REANALYSIS', analysis_row.token_id, p_analysis_id, p_request_key,
    coalesce((select private.radar_pause_generation()), 0))
  on conflict (request_key) do nothing returning id into work_id;
  if work_id is null then
    select id into work_id from public.radar_work_items where request_key = p_request_key;
    already_exists := true;
  end if;
  if not already_exists then
    perform private.radar_audit(actor_id, 'radar.reanalysis_requested', p_analysis_id,
      null, jsonb_build_object('work_item_id', work_id, 'analysis_id', p_analysis_id),
      jsonb_build_object('schema_version', 1, 'reason', p_reason, 'request_key', p_request_key));
  end if;
  return work_id;
end;
$$;
revoke all on function public.radar_request_reanalysis(uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.radar_request_reanalysis(uuid, text, text) to authenticated;

create or replace function public.radar_request_score_recalculation(
  p_analysis_id uuid,
  p_reason text,
  p_request_key text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := private.radar_require_roles(array['owner', 'admin', 'radar_reviewer', 'analyst']);
  analysis_row public.radar_analyses%rowtype;
  work_id uuid;
  already_exists boolean := false;
begin
  if length(btrim(coalesce(p_reason, ''))) = 0 or length(p_reason) > 1000 then
    raise exception 'bounded recalculation reason required' using errcode = '22023';
  end if;
  select * into analysis_row from public.radar_analyses where id = p_analysis_id for share;
  if not found then raise exception 'analysis not found' using errcode = 'P0002'; end if;
  if (select private.radar_flag_enabled('radar_emergency_paused', true)) then
    raise exception 'Radar emergency pause blocks recalculation requests' using errcode = '55000';
  end if;
  insert into public.radar_work_items(work_kind, token_id, parent_analysis_id, request_key,
    method_version, input_version, pause_generation)
  values ('RECALCULATION', analysis_row.token_id, p_analysis_id, p_request_key,
    analysis_row.scoring_method_version, 'sealed-input-v1',
    coalesce((select private.radar_pause_generation()), 0))
  on conflict (request_key) do nothing returning id into work_id;
  if work_id is null then
    select id into work_id from public.radar_work_items where request_key = p_request_key;
    already_exists := true;
  end if;
  if not already_exists then
    perform private.radar_audit(actor_id, 'radar.score_recalculation_requested', p_analysis_id,
      null, jsonb_build_object('work_item_id', work_id, 'analysis_id', p_analysis_id),
      jsonb_build_object('schema_version', 1, 'reason', p_reason, 'request_key', p_request_key));
  end if;
  return work_id;
end;
$$;
revoke all on function public.radar_request_score_recalculation(uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.radar_request_score_recalculation(uuid, text, text) to authenticated;

create or replace function public.radar_set_emergency_pause(
  p_paused boolean,
  p_expected_generation bigint,
  p_action_key text
)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := private.radar_require_roles(array['owner', 'admin']);
  current_generation bigint;
  next_generation bigint;
begin
  select case
    when configuration->>'generation' ~ '^[0-9]+$' then (configuration->>'generation')::bigint
    else 0 end into current_generation
  from public.feature_flags where key = 'radar_emergency_paused' for update;
  if not found then raise exception 'emergency pause control is missing' using errcode = '55000'; end if;
  if current_generation <> p_expected_generation then raise exception 'stale emergency control generation' using errcode = '40001'; end if;
  next_generation := current_generation + 1;
  update public.feature_flags set enabled = p_paused,
    configuration = jsonb_build_object('generation', next_generation), updated_by = actor_id
  where key = 'radar_emergency_paused';
  perform private.radar_audit(actor_id, 'feature_flag.updated', (select id from public.feature_flags where key='radar_emergency_paused'),
    jsonb_build_object('key', 'radar_emergency_paused', 'enabled', not p_paused, 'generation', current_generation),
    jsonb_build_object('key', 'radar_emergency_paused', 'enabled', p_paused, 'generation', next_generation),
    jsonb_build_object('schema_version', 1, 'action_key', p_action_key));
  return next_generation;
end;
$$;
revoke all on function public.radar_set_emergency_pause(boolean, bigint, text)
  from public, anon, authenticated, service_role;
grant execute on function public.radar_set_emergency_pause(boolean, bigint, text) to authenticated;

-- Narrow public projections.  Raw Radar tables stay closed to anon; these
-- functions expose only frozen, explicitly public fields from PUBLISHED rows.
create or replace function public.get_public_radar_list(p_limit integer default 20, p_before timestamptz default null)
returns table (
  token_id uuid,
  chain text,
  contract_address text,
  symbol text,
  name text,
  analytical_status text,
  score text,
  methodology_version text,
  analysis_version integer,
  calculated_at timestamptz,
  as_of timestamptz,
  freshness_state text,
  why_on_radar text,
  risk_summary text,
  metrics jsonb,
  evidence jsonb,
  public_note text,
  disclosure text,
  published_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select t.id, t.chain, t.contract_address, t.symbol, t.name, a.status,
    a.score::text, a.scoring_method_version, a.version, a.analyzed_at, a.data_as_of,
    case when a.expires_at > statement_timestamp() then 'FRESH' else 'STALE' end,
    r.public_presentation->>'why_on_radar', r.public_presentation->>'risk_summary',
    coalesce(r.public_presentation->'metrics', '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object(
      'classification', e.classification, 'category', e.category, 'label', e.label,
      'statement', e.statement, 'value', case when e.numeric_value is null then null else e.numeric_value::text end,
      'unit', e.numeric_unit, 'source', e.source_reference, 'observed_at', e.observed_at)
      order by e.public_rank nulls last, e.created_at)
      from public.radar_evidence e where e.analysis_id = a.id and e.is_public), '[]'::jsonb),
    r.public_note, r.public_disclosure, r.published_at
  from public.radar_reviews r
  join public.radar_analyses a on a.id = r.analysis_id
  join public.tokens t on t.id = r.token_id
  where r.state = 'PUBLISHED' and a.public_eligibility
    and a.expires_at > statement_timestamp()
    and (select private.radar_flag_enabled('radar_enabled', false))
    and not (select private.radar_flag_enabled('maintenance_mode', true))
    and not (select private.radar_flag_enabled('radar_emergency_paused', true))
    and (p_before is null or r.published_at < p_before)
  order by r.published_at desc, r.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;
revoke all on function public.get_public_radar_list(integer, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.get_public_radar_list(integer, timestamptz) to anon, authenticated;

create or replace function public.get_public_radar_detail(p_token_id uuid)
returns table (
  token_id uuid,
  chain text,
  contract_address text,
  symbol text,
  name text,
  analytical_status text,
  score text,
  methodology_version text,
  analysis_version integer,
  calculated_at timestamptz,
  as_of timestamptz,
  freshness_state text,
  why_on_radar text,
  risk_summary text,
  metrics jsonb,
  evidence jsonb,
  public_note text,
  disclosure text,
  published_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select * from public.get_public_radar_list(1, null)
  where false;
$$;
-- Replace the body separately so the detail function has no list/filter
-- ambiguity and remains a single canonical-token lookup.
create or replace function public.get_public_radar_detail(p_token_id uuid)
returns table (
  token_id uuid, chain text, contract_address text, symbol text, name text,
  analytical_status text, score text, methodology_version text, analysis_version integer,
  calculated_at timestamptz, as_of timestamptz, freshness_state text, why_on_radar text,
  risk_summary text, metrics jsonb, evidence jsonb, public_note text, disclosure text,
  published_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select t.id, t.chain, t.contract_address, t.symbol, t.name, a.status,
    a.score::text, a.scoring_method_version, a.version, a.analyzed_at, a.data_as_of,
    case when a.expires_at > statement_timestamp() then 'FRESH' else 'STALE' end,
    r.public_presentation->>'why_on_radar', r.public_presentation->>'risk_summary',
    coalesce(r.public_presentation->'metrics', '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object(
      'classification', e.classification, 'category', e.category, 'label', e.label,
      'statement', e.statement, 'value', case when e.numeric_value is null then null else e.numeric_value::text end,
      'unit', e.numeric_unit, 'source', e.source_reference, 'observed_at', e.observed_at)
      order by e.public_rank nulls last, e.created_at)
      from public.radar_evidence e where e.analysis_id = a.id and e.is_public), '[]'::jsonb),
    r.public_note, r.public_disclosure, r.published_at
  from public.radar_reviews r
  join public.radar_analyses a on a.id = r.analysis_id
  join public.tokens t on t.id = r.token_id
  where r.token_id = p_token_id and r.state = 'PUBLISHED' and a.public_eligibility
    and a.expires_at > statement_timestamp()
    and (select private.radar_flag_enabled('radar_enabled', false))
    and not (select private.radar_flag_enabled('maintenance_mode', true))
    and not (select private.radar_flag_enabled('radar_emergency_paused', true));
$$;
revoke all on function public.get_public_radar_detail(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_public_radar_detail(uuid) to anon, authenticated;

-- Default deny for all new Radar tables.  Existing analysis/review policies
-- remain intact; only the added private columns and domains are exposed to
-- authenticated Radar readers through role-filtered policies.
do $$
declare
  table_name text;
begin
  foreach table_name in array array['radar_events', 'radar_observations', 'radar_work_items', 'radar_work_inputs', 'radar_evidence'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated, service_role', table_name);
  end loop;
end;
$$;

grant select (id, token_id, event_type, event_key_version, event_key, source_provider,
  source_event_id, payload_hash, context, observed_at, received_at, processing_state, created_at)
  on table public.radar_events to authenticated;
grant select (id, event_id, token_id, provider, adapter_version, capability, metric_key,
  data_state, normalized_value, raw_integer_value, decimal_places, unit, context,
  provenance, trace_reference, content_hash, observed_at, received_at, created_at)
  on table public.radar_observations to authenticated;
grant select (id, work_kind, token_id, event_id, parent_analysis_id, request_key, state,
  attempt_count, available_at, lease_owner, lease_token, lease_expires_at, lease_generation,
  pause_generation, method_version, input_version, reserved_analysis_version, sealed_at,
  input_hash, screening_result, screening_reasons, screening_evaluated_at, result_analysis_id,
  last_error_summary, checkpoint, created_at, updated_at)
  on table public.radar_work_items to authenticated;
grant select (work_item_id, observation_id, added_at) on table public.radar_work_inputs to authenticated;
grant select (id, analysis_id, token_id, evidence_key, classification, origin, category, label,
  statement, numeric_value, numeric_unit, decimal_places, structured_value, unknown_reason,
  provider, adapter_version, observation_id, source_reference, observed_at, received_at,
  evaluated_at, methodology_version, is_public, public_rank, created_at)
  on table public.radar_evidence to authenticated;
grant select (run_type, work_item_id, requested_at, started_at, completed_at, failure_code,
  failure_context, scoring_method_version, methodology_hash, input_hash, component_breakdown,
  coverage, deep_lane_provenance, supersedes_analysis_id, public_eligibility,
  freshness_policy_version, expires_at)
  on table public.radar_analyses to authenticated;
grant select (token_id, revision, public_note, public_disclosure, public_presentation,
  approval_analysis_version, approval_input_hash, approval_methodology_hash, approved_at,
  last_action_key)
  on table public.radar_reviews to authenticated;

create policy radar_events_staff_select on public.radar_events for select to authenticated using (
  (select private.current_app_roles()) && array['owner', 'admin', 'radar_reviewer', 'analyst']::text[]
);
create policy radar_observations_staff_select on public.radar_observations for select to authenticated using (
  (select private.current_app_roles()) && array['owner', 'admin', 'radar_reviewer', 'analyst']::text[]
);
create policy radar_work_items_staff_select on public.radar_work_items for select to authenticated using (
  (select private.current_app_roles()) && array['owner', 'admin', 'radar_reviewer', 'analyst']::text[]
);
create policy radar_work_inputs_staff_select on public.radar_work_inputs for select to authenticated using (
  (select private.current_app_roles()) && array['owner', 'admin', 'radar_reviewer', 'analyst']::text[]
);
create policy radar_evidence_staff_select on public.radar_evidence for select to authenticated using (
  (select private.current_app_roles()) && array['owner', 'admin', 'radar_reviewer', 'analyst']::text[]
);

commit;
