begin;

-- Gate 19C-F2 is additive publication hardening.  The original Gate 19C
-- migration and all F1 migrations remain historical and unchanged.

create table public.radar_methodology_versions (
  methodology_version text primary key
    check (methodology_version ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'),
  state text not null check (state in ('DRAFT', 'APPROVED', 'RETIRED')),
  is_test_only boolean not null default false,
  content_hash text check (content_hash is null or content_hash ~ '^[0-9a-f]{64}$'),
  approved_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  constraint radar_methodology_approval_context_check check (
    state <> 'APPROVED' or approved_at is not null
  )
);

create table public.radar_freshness_policies (
  freshness_policy_version text primary key
    check (freshness_policy_version ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'),
  state text not null check (state in ('DRAFT', 'APPROVED', 'RETIRED')),
  is_test_only boolean not null default false,
  content_hash text check (content_hash is null or content_hash ~ '^[0-9a-f]{64}$'),
  approved_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  constraint radar_freshness_approval_context_check check (
    state <> 'APPROVED' or approved_at is not null
  )
);

alter table public.radar_methodology_versions enable row level security;
alter table public.radar_freshness_policies enable row level security;

revoke all on table public.radar_methodology_versions, public.radar_freshness_policies
  from public, anon, authenticated, service_role;

create or replace function private.radar_methodology_is_approved(p_version text)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_version is not null and exists (
    select 1 from public.radar_methodology_versions
    where methodology_version = p_version and state = 'APPROVED'
  );
$$;
revoke all on function private.radar_methodology_is_approved(text)
  from public, anon, authenticated, service_role;

create or replace function private.radar_freshness_policy_is_approved(p_version text)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_version is not null and exists (
    select 1 from public.radar_freshness_policies
    where freshness_policy_version = p_version and state = 'APPROVED'
  );
$$;
revoke all on function private.radar_freshness_policy_is_approved(text)
  from public, anon, authenticated, service_role;

-- Public references are deliberately stricter than the historical storage
-- regex: no query strings, userinfo, fragments, whitespace or non-HTTP(S).
create or replace function private.radar_safe_source_reference(p_reference text)
returns text language sql immutable set search_path = '' as $$
  select case when p_reference is not null
    and length(p_reference) <= 512
    and p_reference ~* '^https?://[^[:space:]/?#@]+(:[0-9]{1,5})?(/[^[:space:]?#]*)?$'
    then p_reference else null end;
$$;
revoke all on function private.radar_safe_source_reference(text)
  from public, anon, authenticated, service_role;

create or replace function private.radar_provenance_is_public_safe(p_provenance jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select private.radar_provenance_is_allowed(p_provenance)
    and (p_provenance->>'source_url' is null
      or private.radar_safe_source_reference(p_provenance->>'source_url') is not null);
$$;
revoke all on function private.radar_provenance_is_public_safe(jsonb)
  from public, anon, authenticated, service_role;

alter table public.radar_observations
  add constraint radar_observations_public_provenance_check
  check (private.radar_provenance_is_public_safe(provenance));

-- Evidence is system-owned and append-only, but it must also remain bound to
-- a compatible immutable observation and to the approved origin matrix.
create or replace function private.radar_evidence_f2_integrity_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  observation_row public.radar_observations%rowtype;
begin
  if new.classification = 'AI_INFERENCE' and new.origin <> 'INFERENCE' then
    raise exception 'AI inference must retain INFERENCE origin' using errcode = '23514';
  end if;
  if new.classification <> 'AI_INFERENCE' and new.origin <> 'DETERMINISTIC' then
    raise exception 'non-inference evidence requires DETERMINISTIC origin' using errcode = '23514';
  end if;
  if new.classification = 'VERIFIED_DATA' then
    if new.observation_id is null then
      raise exception 'verified evidence requires an observation binding' using errcode = '23514';
    end if;
    select * into observation_row
    from public.radar_observations where id = new.observation_id;
    if not found or observation_row.token_id <> new.token_id
       or observation_row.data_state <> 'AVAILABLE'
       or (new.provider is not null and new.provider <> observation_row.provider)
       or (new.adapter_version is not null and new.adapter_version <> observation_row.adapter_version)
       or (new.numeric_value is not null and new.numeric_value is distinct from observation_row.normalized_value) then
      raise exception 'verified evidence observation binding is incompatible' using errcode = '23514';
    end if;
  end if;
  if private.radar_safe_source_reference(new.source_reference) is distinct from new.source_reference then
    raise exception 'evidence source reference is not public-safe' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.radar_reviews
    where analysis_id = new.analysis_id and state in ('APPROVED', 'PUBLISHED', 'HIDDEN')
  ) then
    raise exception 'approved evidence membership is frozen' using errcode = '55000';
  end if;
  return new;
end;
$$;
revoke all on function private.radar_evidence_f2_integrity_guard()
  from public, anon, authenticated, service_role;
drop trigger if exists radar_evidence_f2_integrity_guard on public.radar_evidence;
create trigger radar_evidence_f2_integrity_guard
  before insert on public.radar_evidence
  for each row execute function private.radar_evidence_f2_integrity_guard();

alter table public.radar_reviews
  add column public_metrics_snapshot jsonb not null default '[]'::jsonb,
  add column public_evidence_snapshot jsonb not null default '[]'::jsonb,
  add column approval_evidence_hash text
    check (approval_evidence_hash is null or approval_evidence_hash ~ '^[0-9a-f]{64}$'),
  add column approval_score_snapshot text
    check (approval_score_snapshot is null or length(approval_score_snapshot) <= 128),
  add column publication_snapshot jsonb not null default '{}'::jsonb;

create or replace function private.radar_public_presentation_is_valid(p_presentation jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select p_presentation = '{}'::jsonb
    or (jsonb_typeof(p_presentation) = 'object'
      and (select count(*) from jsonb_object_keys(p_presentation)) = 4
      and not exists (
        select 1 from jsonb_object_keys(p_presentation) key_name
        where key_name not in ('why_on_radar', 'risk_summary', 'metrics', 'evidence')
      )
      and jsonb_typeof(p_presentation->'why_on_radar') = 'string'
      and jsonb_typeof(p_presentation->'risk_summary') = 'string'
      and jsonb_typeof(p_presentation->'metrics') = 'array'
      and jsonb_typeof(p_presentation->'evidence') = 'array'
      and length(p_presentation->>'why_on_radar') <= 2000
      and length(p_presentation->>'risk_summary') <= 2000
      and jsonb_array_length(p_presentation->'metrics') <= 64
      and jsonb_array_length(p_presentation->'evidence') <= 64);
$$;
revoke all on function private.radar_public_presentation_is_valid(jsonb)
  from public, anon, authenticated, service_role;

create or replace function private.radar_publication_snapshot_is_valid(p_snapshot jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select p_snapshot = '{}'::jsonb
    or (jsonb_typeof(p_snapshot) = 'object'
      and (select count(*) from jsonb_object_keys(p_snapshot)) = 17
      and not exists (
        select 1 from jsonb_object_keys(p_snapshot) key_name
        where key_name not in (
          'token_id', 'analysis_id', 'analysis_version', 'analytical_status',
          'score', 'methodology_version', 'freshness_policy_version',
          'data_as_of', 'analyzed_at', 'expires_at', 'why_on_radar',
          'risk_summary', 'metrics', 'evidence', 'evidence_hash',
          'review_revision', 'published_at'
        )
      )
      and jsonb_typeof(p_snapshot->'metrics') = 'array'
      and jsonb_typeof(p_snapshot->'evidence') = 'array'
      and jsonb_typeof(p_snapshot->'score') = 'string'
      and jsonb_typeof(p_snapshot->'methodology_version') = 'string'
      and jsonb_typeof(p_snapshot->'freshness_policy_version') = 'string'
      and jsonb_typeof(p_snapshot->'evidence_hash') = 'string'
      and jsonb_array_length(p_snapshot->'metrics') <= 64
      and jsonb_array_length(p_snapshot->'evidence') <= 64);
$$;
revoke all on function private.radar_publication_snapshot_is_valid(jsonb)
  from public, anon, authenticated, service_role;

alter table public.radar_reviews
  add constraint radar_reviews_public_metrics_snapshot_check check (
    jsonb_typeof(public_metrics_snapshot) = 'array'
    and jsonb_array_length(public_metrics_snapshot) <= 64
  ),
  add constraint radar_reviews_public_evidence_snapshot_check check (
    jsonb_typeof(public_evidence_snapshot) = 'array'
    and jsonb_array_length(public_evidence_snapshot) <= 64
  ),
  add constraint radar_reviews_public_presentation_f2_check check (
    private.radar_public_presentation_is_valid(public_presentation)
  ),
  add constraint radar_reviews_publication_snapshot_check check (
    private.radar_publication_snapshot_is_valid(publication_snapshot)
  );

create or replace function private.radar_public_metrics_snapshot(p_analysis_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'metric_key', o.metric_key,
    'category', o.capability,
    'value', case when o.normalized_value is null then null else o.normalized_value::text end,
    'state', o.data_state,
    'observed_at', o.observed_at,
    'source', o.provider
  ) order by o.metric_key, o.id), '[]'::jsonb)
  from public.radar_analyses a
  join public.radar_work_inputs wi on wi.work_item_id = a.work_item_id
  join public.radar_observations o on o.id = wi.observation_id
  where a.id = p_analysis_id;
$$;
revoke all on function private.radar_public_metrics_snapshot(uuid)
  from public, anon, authenticated, service_role;

create or replace function private.radar_public_evidence_snapshot(p_analysis_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'classification', e.classification,
    'category', e.category,
    'label', e.label,
    'statement', e.statement,
    'value', case when e.numeric_value is null then null else e.numeric_value::text end,
    'unit', e.numeric_unit,
    'source', coalesce(e.provider, o.provider),
    'source_reference', private.radar_safe_source_reference(e.source_reference),
    'observed_at', e.observed_at
  ) order by e.public_rank nulls last, e.created_at, e.id), '[]'::jsonb)
  from public.radar_evidence e
  left join public.radar_observations o on o.id = e.observation_id
  where e.analysis_id = p_analysis_id and e.is_public;
$$;
revoke all on function private.radar_public_evidence_snapshot(uuid)
  from public, anon, authenticated, service_role;

create or replace function private.radar_public_presentation(p_analysis_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'why_on_radar', left(coalesce(a.deterministic_data->>'why_on_radar', ''), 2000),
    'risk_summary', left(coalesce(a.risk_summary, ''), 2000),
    'metrics', private.radar_public_metrics_snapshot(a.id),
    'evidence', private.radar_public_evidence_snapshot(a.id)
  )
  from public.radar_analyses a where a.id = p_analysis_id;
$$;
revoke all on function private.radar_public_presentation(uuid)
  from public, anon, authenticated, service_role;

-- Remove the generic human presentation argument. Human input is limited to
-- editorial note, disclosure and action identity; all analytical output is
-- derived from immutable system-owned analysis/observation/evidence rows.
drop function if exists public.radar_approve_review(uuid, integer, text, text, jsonb, text);
create function public.radar_approve_review(
  p_review_id uuid,
  p_expected_revision integer,
  p_public_note text,
  p_public_disclosure text,
  p_action_key text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid;
  review_row public.radar_reviews%rowtype;
  analysis_row public.radar_analyses%rowtype;
  work_row public.radar_work_items%rowtype;
  metrics_snapshot jsonb;
  evidence_snapshot jsonb;
  presentation jsonb;
  evidence_hash text;
begin
  if p_expected_revision is null then
    raise exception 'expected review revision is required' using errcode = '22023';
  end if;
  if length(coalesce(p_public_note, '')) > 2000
     or length(btrim(coalesce(p_public_disclosure, ''))) = 0
     or length(p_public_disclosure) > 2000
     or length(btrim(coalesce(p_action_key, ''))) = 0 then
    raise exception 'bounded editorial approval fields are required' using errcode = '22023';
  end if;
  perform private.radar_pause_guard(false);
  actor_id := private.radar_require_roles(array['owner', 'admin', 'radar_reviewer']);
  select * into review_row from public.radar_reviews where id = p_review_id for update;
  if not found then raise exception 'review not found' using errcode = 'P0002'; end if;
  if review_row.state = 'APPROVED' and review_row.last_action_key = p_action_key then return p_review_id; end if;
  if review_row.revision <> p_expected_revision then
    raise exception 'stale review revision' using errcode = '40001';
  end if;
  if review_row.state <> 'PENDING' then
    raise exception 'review is not pending' using errcode = '55000';
  end if;
  select * into analysis_row from public.radar_analyses where id = review_row.analysis_id for share;
  select * into work_row from public.radar_work_items where id = analysis_row.work_item_id for share;
  if not found or work_row.sealed_at is null or work_row.input_hash is null
     or work_row.input_hash is distinct from private.radar_input_fingerprint(work_row.id)
     or work_row.screening_result <> 'PASS'
     or (select count(*) from public.radar_work_inputs where work_item_id = work_row.id) = 0
     or not analysis_row.public_eligibility
     or analysis_row.status not in ('EARLY', 'TRENDING', 'HIGH_RISK')
     or analysis_row.score is null
     or not isfinite(analysis_row.analyzed_at)
     or not isfinite(analysis_row.data_as_of)
     or analysis_row.expires_at is null
     or not isfinite(analysis_row.expires_at)
     or analysis_row.expires_at <= statement_timestamp()
     or not private.radar_methodology_is_approved(analysis_row.scoring_method_version)
     or not private.radar_freshness_policy_is_approved(analysis_row.freshness_policy_version)
     or not exists (select 1 from public.radar_evidence e where e.analysis_id = analysis_row.id and e.is_public) then
    raise exception 'analysis is not eligible for review approval' using errcode = '55000';
  end if;
  metrics_snapshot := private.radar_public_metrics_snapshot(analysis_row.id);
  evidence_snapshot := private.radar_public_evidence_snapshot(analysis_row.id);
  presentation := jsonb_build_object(
    'why_on_radar', left(coalesce(analysis_row.deterministic_data->>'why_on_radar', ''), 2000),
    'risk_summary', left(coalesce(analysis_row.risk_summary, ''), 2000),
    'metrics', metrics_snapshot,
    'evidence', evidence_snapshot
  );
  evidence_hash := encode(extensions.digest(convert_to(evidence_snapshot::text, 'UTF8'), 'sha256'), 'hex');
  update public.radar_reviews
  set state = 'APPROVED', reviewed_by = actor_id, reviewed_at = statement_timestamp(),
      public_note = coalesce(p_public_note, ''), public_disclosure = p_public_disclosure,
      public_presentation = presentation, public_metrics_snapshot = metrics_snapshot,
      public_evidence_snapshot = evidence_snapshot, approval_analysis_version = analysis_row.version,
      approval_input_hash = analysis_row.input_hash, approval_methodology_hash = analysis_row.methodology_hash,
      approval_evidence_hash = evidence_hash, approval_score_snapshot = analysis_row.score::text,
      approved_at = statement_timestamp(), revision = revision + 1, last_action_key = p_action_key
  where id = p_review_id;
  perform private.radar_audit(actor_id, 'radar.reviewed', p_review_id,
    jsonb_build_object('state', review_row.state, 'revision', review_row.revision),
    jsonb_build_object('state', 'APPROVED', 'revision', review_row.revision + 1,
      'analysis_version', analysis_row.version, 'evidence_hash', evidence_hash),
    jsonb_build_object('schema_version', 2, 'action_key', p_action_key));
  return p_review_id;
end;
$$;
revoke all on function public.radar_approve_review(uuid, integer, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.radar_approve_review(uuid, integer, text, text, text) to authenticated;

create or replace function public.radar_publish_review(
  p_review_id uuid, p_expected_revision integer, p_action_key text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid;
  review_row public.radar_reviews%rowtype;
  analysis_row public.radar_analyses%rowtype;
  old_review public.radar_reviews%rowtype;
  highest_version integer;
  publication_time timestamptz := statement_timestamp();
  frozen_publication_snapshot jsonb;
begin
  if p_expected_revision is null then
    raise exception 'expected review revision is required' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_action_key, ''))) = 0 then
    raise exception 'publication action key is required' using errcode = '22023';
  end if;

  -- These locks establish the publication linearization point. Every mutable
  -- prerequisite, including the publishing subject and approver, is checked
  -- again after the lock waits complete.
  perform 1 from public.feature_flags
    where key in ('radar_enabled', 'maintenance_mode', 'radar_emergency_paused') for update;
  perform 1 from public.tokens t
    join public.radar_reviews r on r.token_id = t.id
    where r.id = p_review_id for update;
  select r.* into review_row from public.radar_reviews r where r.id = p_review_id for update;
  if not found then raise exception 'review not found' using errcode = 'P0002'; end if;
  select a.* into analysis_row from public.radar_analyses a where a.id = review_row.analysis_id for update;
  if not found then raise exception 'analysis not found' using errcode = 'P0002'; end if;
  perform private.radar_pause_guard(false);
  actor_id := private.radar_require_roles(array['owner', 'admin', 'radar_reviewer']);

  if review_row.state = 'PUBLISHED' and review_row.last_action_key = p_action_key then return p_review_id; end if;
  if review_row.revision <> p_expected_revision then
    raise exception 'stale review revision' using errcode = '40001';
  end if;
  if review_row.state <> 'APPROVED' then
    raise exception 'review must be approved before publication' using errcode = '55000';
  end if;
  if review_row.reviewed_by is null or not exists (
    select 1
    from public.profiles p
    join public.user_roles ur on ur.user_id = p.id
    join public.roles rr on rr.id = ur.role_id
    where p.id = review_row.reviewed_by and p.status = 'ACTIVE'
      and rr.key in ('owner', 'admin', 'radar_reviewer')
  ) then
    raise exception 'approver is no longer eligible' using errcode = '55000';
  end if;
  if not (select private.radar_flag_enabled('radar_enabled', false))
     or (select private.radar_flag_enabled('maintenance_mode', true))
     or (select private.radar_flag_enabled('radar_emergency_paused', true)) then
    raise exception 'Radar publication controls are not enabled' using errcode = '55000';
  end if;
  if not analysis_row.public_eligibility
     or analysis_row.status not in ('EARLY', 'TRENDING', 'HIGH_RISK')
     or analysis_row.score is null
     or not isfinite(analysis_row.analyzed_at)
     or not isfinite(analysis_row.data_as_of)
     or analysis_row.expires_at is null
     or not isfinite(analysis_row.expires_at)
     or analysis_row.expires_at <= publication_time
     or not private.radar_methodology_is_approved(analysis_row.scoring_method_version)
     or not private.radar_freshness_policy_is_approved(analysis_row.freshness_policy_version)
     or review_row.approval_analysis_version <> analysis_row.version
     or review_row.approval_input_hash is distinct from analysis_row.input_hash
     or review_row.approval_methodology_hash is distinct from analysis_row.methodology_hash
     or review_row.approval_score_snapshot is distinct from analysis_row.score::text
     or review_row.public_presentation <> private.radar_public_presentation(analysis_row.id)
     or review_row.approval_evidence_hash is distinct from encode(
       extensions.digest(convert_to(private.radar_public_evidence_snapshot(analysis_row.id)::text, 'UTF8'), 'sha256'), 'hex')
     or not exists (select 1 from public.radar_evidence e where e.analysis_id = analysis_row.id and e.is_public)
     or not exists (select 1 from public.radar_work_items w
       where w.id = analysis_row.work_item_id and w.sealed_at is not null
         and w.input_hash is not null and w.input_hash = private.radar_input_fingerprint(w.id)
         and w.screening_result = 'PASS') then
    raise exception 'publication prerequisites are not satisfied' using errcode = '55000';
  end if;
  select max(a.version) into highest_version
  from public.radar_reviews r
  join public.radar_analyses a on a.id = r.analysis_id
  where r.token_id = review_row.token_id
    and r.published_at is not null and r.state in ('PUBLISHED', 'HIDDEN');
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
      jsonb_build_object('schema_version', 2, 'superseded_by', p_review_id));
  end if;
  frozen_publication_snapshot := jsonb_build_object(
    'token_id', review_row.token_id,
    'analysis_id', analysis_row.id,
    'analysis_version', analysis_row.version,
    'analytical_status', analysis_row.status,
    'score', analysis_row.score::text,
    'methodology_version', analysis_row.scoring_method_version,
    'freshness_policy_version', analysis_row.freshness_policy_version,
    'data_as_of', analysis_row.data_as_of,
    'analyzed_at', analysis_row.analyzed_at,
    'expires_at', analysis_row.expires_at,
    'why_on_radar', review_row.public_presentation->>'why_on_radar',
    'risk_summary', review_row.public_presentation->>'risk_summary',
    'metrics', review_row.public_metrics_snapshot,
    'evidence', review_row.public_evidence_snapshot,
    'evidence_hash', review_row.approval_evidence_hash,
    'review_revision', review_row.revision,
    'published_at', publication_time
  );
  update public.radar_reviews set state = 'PUBLISHED', published_at = publication_time,
    publication_snapshot = frozen_publication_snapshot, revision = revision + 1, last_action_key = p_action_key
  where id = p_review_id;
  perform private.radar_audit(actor_id, 'radar.published', p_review_id,
    jsonb_build_object('state', review_row.state, 'revision', review_row.revision),
    jsonb_build_object('state', 'PUBLISHED', 'revision', review_row.revision + 1,
      'analysis_version', analysis_row.version, 'evidence_hash', review_row.approval_evidence_hash),
    jsonb_build_object('schema_version', 2, 'action_key', p_action_key));
  return p_review_id;
end;
$$;
revoke all on function public.radar_publish_review(uuid, integer, text)
  from public, anon, authenticated, service_role;
grant execute on function public.radar_publish_review(uuid, integer, text) to authenticated;

-- Public reads use the frozen publication receipt, never live evidence rows or
-- caller-controlled presentation JSON. Hidden/replaced history is private.
create or replace function public.get_public_radar_list(p_limit integer default 20, p_before timestamptz default null)
returns table (
  token_id uuid, chain text, contract_address text, symbol text, name text,
  analytical_status text, score text, methodology_version text, analysis_version integer,
  calculated_at timestamptz, as_of timestamptz, freshness_state text, why_on_radar text,
  risk_summary text, metrics jsonb, evidence jsonb, public_note text, disclosure text,
  published_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select t.id, t.chain, t.contract_address, t.symbol, t.name,
    r.publication_snapshot->>'analytical_status',
    r.publication_snapshot->>'score',
    r.publication_snapshot->>'methodology_version',
    (r.publication_snapshot->>'analysis_version')::integer,
    (r.publication_snapshot->>'analyzed_at')::timestamptz,
    (r.publication_snapshot->>'data_as_of')::timestamptz,
    case when (r.publication_snapshot->>'expires_at')::timestamptz > statement_timestamp()
      then 'FRESH' else 'STALE' end,
    r.publication_snapshot->>'why_on_radar', r.publication_snapshot->>'risk_summary',
    r.publication_snapshot->'metrics', r.publication_snapshot->'evidence',
    r.public_note, r.public_disclosure,
    (r.publication_snapshot->>'published_at')::timestamptz
  from public.radar_reviews r
  join public.tokens t on t.id = r.token_id
  where r.state = 'PUBLISHED' and r.publication_snapshot <> '{}'::jsonb
    and (select private.radar_flag_enabled('radar_enabled', false))
    and not (select private.radar_flag_enabled('maintenance_mode', true))
    and not (select private.radar_flag_enabled('radar_emergency_paused', true))
    and (r.publication_snapshot->>'expires_at')::timestamptz > statement_timestamp()
    and (p_before is null or (r.publication_snapshot->>'published_at')::timestamptz < p_before)
  order by (r.publication_snapshot->>'published_at')::timestamptz desc, r.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;
revoke all on function public.get_public_radar_list(integer, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.get_public_radar_list(integer, timestamptz) to anon, authenticated;

create or replace function public.get_public_radar_detail(p_token_id uuid)
returns table (
  token_id uuid, chain text, contract_address text, symbol text, name text,
  analytical_status text, score text, methodology_version text, analysis_version integer,
  calculated_at timestamptz, as_of timestamptz, freshness_state text, why_on_radar text,
  risk_summary text, metrics jsonb, evidence jsonb, public_note text, disclosure text,
  published_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select t.id, t.chain, t.contract_address, t.symbol, t.name,
    r.publication_snapshot->>'analytical_status',
    r.publication_snapshot->>'score',
    r.publication_snapshot->>'methodology_version',
    (r.publication_snapshot->>'analysis_version')::integer,
    (r.publication_snapshot->>'analyzed_at')::timestamptz,
    (r.publication_snapshot->>'data_as_of')::timestamptz,
    case when (r.publication_snapshot->>'expires_at')::timestamptz > statement_timestamp()
      then 'FRESH' else 'STALE' end,
    r.publication_snapshot->>'why_on_radar', r.publication_snapshot->>'risk_summary',
    r.publication_snapshot->'metrics', r.publication_snapshot->'evidence',
    r.public_note, r.public_disclosure,
    (r.publication_snapshot->>'published_at')::timestamptz
  from public.radar_reviews r
  join public.tokens t on t.id = r.token_id
  where r.token_id = p_token_id and r.state = 'PUBLISHED'
    and r.publication_snapshot <> '{}'::jsonb
    and (select private.radar_flag_enabled('radar_enabled', false))
    and not (select private.radar_flag_enabled('maintenance_mode', true))
    and not (select private.radar_flag_enabled('radar_emergency_paused', true))
    and (r.publication_snapshot->>'expires_at')::timestamptz > statement_timestamp();
$$;
revoke all on function public.get_public_radar_detail(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_public_radar_detail(uuid) to anon, authenticated;

commit;
