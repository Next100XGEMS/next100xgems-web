begin;

-- Gate 19C-F4 is additive. The original Gate 19C, F1, F2 and F3 migrations
-- remain historical and unchanged.

-- Legacy approvals and publications must be checked against the authoritative
-- analytical JSON, rather than trusting text that may already have been
-- produced by an unsafe JSON ->> coercion in the F2 era.
create or replace function private.radar_public_analysis_is_safe(p_analysis_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.radar_analyses a
    where a.id = p_analysis_id
      and jsonb_typeof(a.deterministic_data) = 'object'
      and (
        not (a.deterministic_data ? 'why_on_radar')
        or (
          jsonb_typeof(a.deterministic_data -> 'why_on_radar') = 'string'
          and private.radar_public_text_is_safe(a.deterministic_data ->> 'why_on_radar', 2000)
        )
      )
      and private.radar_public_text_is_safe(left(coalesce(a.risk_summary, ''), 2000), 2000)
  );
$$;
revoke all on function private.radar_public_analysis_is_safe(uuid)
  from public, anon, authenticated, service_role;

-- Rebuild the presentation through the typed source helper. Callers must use
-- radar_public_analysis_is_safe before this presentation becomes publishable.
create or replace function private.radar_public_presentation(p_analysis_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'why_on_radar', coalesce(
      private.radar_public_text_from_json(a.deterministic_data, 'why_on_radar', 2000), ''
    ),
    'risk_summary', left(coalesce(a.risk_summary, ''), 2000),
    'metrics', private.radar_public_metrics_snapshot(a.id),
    'evidence', private.radar_public_evidence_snapshot(a.id)
  )
  from public.radar_analyses a
  where a.id = p_analysis_id;
$$;
revoke all on function private.radar_public_presentation(uuid)
  from public, anon, authenticated, service_role;

-- Publication is serialized in this order:
-- token -> candidate review -> candidate analysis -> current publication ->
-- methodology/freshness registries -> feature/emergency controls. All
-- mutable authorization, eligibility and time checks follow these locks.
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
  publication_time timestamptz;
  frozen_publication_snapshot jsonb;
begin
  if p_expected_revision is null then
    raise exception 'expected review revision is required' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_action_key, ''))) = 0 then
    raise exception 'publication action key is required' using errcode = '22023';
  end if;

  -- Every blocking mutable publication resource is locked before the final
  -- authorization and eligibility phase. Token locking serializes competing
  -- publications for one token before either can inspect current history.
  perform 1
  from public.tokens t
  join public.radar_reviews r on r.token_id = t.id
  where r.id = p_review_id
  for update;
  select r.* into review_row
  from public.radar_reviews r
  where r.id = p_review_id
  for update;
  if not found then raise exception 'review not found' using errcode = 'P0002'; end if;
  select a.* into analysis_row
  from public.radar_analyses a
  where a.id = review_row.analysis_id
  for update;
  if not found then raise exception 'analysis not found' using errcode = 'P0002'; end if;

  -- There is at most one current publication per token. Lock it before any
  -- final check; no current-publication lock is taken later in the function.
  select r.* into old_review
  from public.radar_reviews r
  where r.token_id = review_row.token_id
    and r.state = 'PUBLISHED'
    and r.id <> p_review_id
  for update;

  perform 1
  from public.radar_methodology_versions m
  where m.methodology_version = analysis_row.scoring_method_version
  for share;
  perform 1
  from public.radar_freshness_policies f
  where f.freshness_policy_version = analysis_row.freshness_policy_version
  for share;
  perform 1
  from public.feature_flags f
  where f.key in ('radar_enabled', 'maintenance_mode', 'radar_emergency_paused')
  order by f.key
  for update;

  -- This is the final wall-clock capture, after every blocking lock above.
  publication_time := clock_timestamp();
  perform private.radar_pause_guard(false);
  actor_id := private.radar_require_roles(array['owner', 'admin', 'radar_reviewer']);

  if review_row.state = 'PUBLISHED' and review_row.last_action_key = p_action_key then
    return p_review_id;
  end if;
  if review_row.revision <> p_expected_revision then
    raise exception 'stale review revision' using errcode = '40001';
  end if;
  if review_row.state <> 'APPROVED' then
    raise exception 'review must be approved before publication' using errcode = '55000';
  end if;
  if review_row.reviewed_by is null
     or not exists (
       select 1 from public.profiles p
       where p.id = review_row.reviewed_by and p.status = 'ACTIVE'
     )
     or not private.radar_user_has_effective_role(
       review_row.reviewed_by, array['owner', 'admin', 'radar_reviewer']
     ) then
    raise exception 'approver is no longer eligible' using errcode = '55000';
  end if;
  if not (select private.radar_flag_enabled('radar_enabled', false))
     or (select private.radar_flag_enabled('maintenance_mode', true))
     or (select private.radar_flag_enabled('radar_emergency_paused', true)) then
    raise exception 'Radar publication controls are not enabled' using errcode = '55000';
  end if;
  if not private.radar_public_analysis_is_safe(analysis_row.id)
     or not analysis_row.public_eligibility
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
     or review_row.approval_evidence_hash is distinct from pg_catalog.encode(
       extensions.digest(
         convert_to(private.radar_public_evidence_snapshot(analysis_row.id)::text, 'UTF8'),
         'sha256'
       ), 'hex'
     )
     or not exists (
       select 1 from public.radar_evidence e
       where e.analysis_id = analysis_row.id and e.is_public
     )
     or not exists (
       select 1 from public.radar_work_items w
       where w.id = analysis_row.work_item_id
         and w.sealed_at is not null
         and w.input_hash is not null
         and w.input_hash = private.radar_input_fingerprint(w.id)
         and w.screening_result = 'PASS'
     ) then
    raise exception 'publication prerequisites are not satisfied' using errcode = '55000';
  end if;

  select max(a.version) into highest_version
  from public.radar_reviews r
  join public.radar_analyses a on a.id = r.analysis_id
  where r.token_id = review_row.token_id
    and r.published_at is not null
    and r.state in ('PUBLISHED', 'HIDDEN');
  if highest_version is not null and analysis_row.version < highest_version then
    raise exception 'older analysis cannot replace a newer publication' using errcode = '55000';
  end if;

  if old_review.id is not null then
    update public.radar_reviews
    set state = 'HIDDEN', revision = revision + 1
    where id = old_review.id;
    perform private.radar_audit(actor_id, 'radar.hidden', old_review.id,
      jsonb_build_object('state', 'PUBLISHED', 'revision', old_review.revision),
      jsonb_build_object('state', 'HIDDEN', 'revision', old_review.revision + 1),
      jsonb_build_object('schema_version', 4, 'superseded_by', p_review_id));
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
  update public.radar_reviews
  set state = 'PUBLISHED', published_at = publication_time,
      publication_snapshot = frozen_publication_snapshot,
      revision = revision + 1, last_action_key = p_action_key
  where id = p_review_id;
  perform private.radar_audit(actor_id, 'radar.published', p_review_id,
    jsonb_build_object('state', review_row.state, 'revision', review_row.revision),
    jsonb_build_object('state', 'PUBLISHED', 'revision', review_row.revision + 1,
      'analysis_version', analysis_row.version, 'evidence_hash', review_row.approval_evidence_hash),
    jsonb_build_object('schema_version', 4, 'action_key', p_action_key));
  return p_review_id;
end;
$$;
revoke all on function public.radar_publish_review(uuid, integer, text)
  from public, anon, authenticated, service_role;
grant execute on function public.radar_publish_review(uuid, integer, text) to authenticated;

-- A stored publication remains historical, but public eligibility is derived
-- again from its authoritative analysis and closed snapshot at read time.
create or replace function public.get_public_radar_list(
  p_limit integer default 20, p_before timestamptz default null
)
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
    case when (r.publication_snapshot->>'expires_at')::timestamptz > clock_timestamp()
      then 'FRESH' else 'STALE' end,
    r.publication_snapshot->>'why_on_radar', r.publication_snapshot->>'risk_summary',
    r.publication_snapshot->'metrics', r.publication_snapshot->'evidence',
    r.public_note, r.public_disclosure,
    (r.publication_snapshot->>'published_at')::timestamptz
  from public.radar_reviews r
  join public.radar_analyses a on a.id = r.analysis_id
  join public.tokens t on t.id = r.token_id
  where r.state = 'PUBLISHED'
    and r.publication_snapshot <> '{}'::jsonb
    and private.radar_publication_snapshot_is_valid(r.publication_snapshot)
    and private.radar_public_analysis_is_safe(a.id)
    and private.radar_methodology_is_approved(r.publication_snapshot->>'methodology_version')
    and private.radar_freshness_policy_is_approved(r.publication_snapshot->>'freshness_policy_version')
    and (select private.radar_flag_enabled('radar_enabled', false))
    and not (select private.radar_flag_enabled('maintenance_mode', true))
    and not (select private.radar_flag_enabled('radar_emergency_paused', true))
    and (r.publication_snapshot->>'expires_at')::timestamptz > clock_timestamp()
    and (p_before is null or (r.publication_snapshot->>'published_at')::timestamptz < p_before)
  order by (r.publication_snapshot->>'published_at')::timestamptz desc, r.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;
revoke all on function public.get_public_radar_list(integer, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.get_public_radar_list(integer, timestamptz)
  to anon, authenticated;

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
    case when (r.publication_snapshot->>'expires_at')::timestamptz > clock_timestamp()
      then 'FRESH' else 'STALE' end,
    r.publication_snapshot->>'why_on_radar', r.publication_snapshot->>'risk_summary',
    r.publication_snapshot->'metrics', r.publication_snapshot->'evidence',
    r.public_note, r.public_disclosure,
    (r.publication_snapshot->>'published_at')::timestamptz
  from public.radar_reviews r
  join public.radar_analyses a on a.id = r.analysis_id
  join public.tokens t on t.id = r.token_id
  where r.token_id = p_token_id
    and r.state = 'PUBLISHED'
    and r.publication_snapshot <> '{}'::jsonb
    and private.radar_publication_snapshot_is_valid(r.publication_snapshot)
    and private.radar_public_analysis_is_safe(a.id)
    and private.radar_methodology_is_approved(r.publication_snapshot->>'methodology_version')
    and private.radar_freshness_policy_is_approved(r.publication_snapshot->>'freshness_policy_version')
    and (select private.radar_flag_enabled('radar_enabled', false))
    and not (select private.radar_flag_enabled('maintenance_mode', true))
    and not (select private.radar_flag_enabled('radar_emergency_paused', true))
    and (r.publication_snapshot->>'expires_at')::timestamptz > clock_timestamp();
$$;
revoke all on function public.get_public_radar_detail(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_public_radar_detail(uuid)
  to anon, authenticated;

-- Lease authority is evaluated only after the authoritative work row is
-- locked. The pause row is then share-locked and both fences are checked
-- against a fresh wall clock while those locks remain held.
create or replace function public.radar_system_renew_work(
  p_work_item_id uuid,
  p_worker text,
  p_lease_token uuid,
  p_lease_generation bigint,
  p_lease_seconds integer default 300
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  work_row public.radar_work_items%rowtype;
  current_generation bigint;
  wall_time timestamptz;
begin
  if p_lease_token is null or p_lease_generation is null then
    raise exception 'lease renewal requires a fence' using errcode = '22023';
  end if;
  if p_lease_seconds not between 30 and 3600 then
    raise exception 'lease duration out of bounds' using errcode = '22023';
  end if;
  select * into work_row
  from public.radar_work_items
  where id = p_work_item_id
  for update;
  if not found then return false; end if;
  current_generation := private.radar_pause_guard(true);
  wall_time := clock_timestamp();
  if work_row.state <> 'RUNNING'
     or work_row.lease_owner is distinct from p_worker
     or work_row.lease_token is distinct from p_lease_token
     or work_row.lease_generation is distinct from p_lease_generation
     or work_row.lease_expires_at is null
     or work_row.lease_expires_at <= wall_time
     or work_row.pause_generation is distinct from current_generation then
    return false;
  end if;
  update public.radar_work_items
  set lease_expires_at = wall_time + make_interval(secs => p_lease_seconds)
  where id = p_work_item_id;
  return true;
end;
$$;
revoke all on function public.radar_system_renew_work(uuid, text, uuid, bigint, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.radar_system_renew_work(uuid, text, uuid, bigint, integer)
  to service_role;

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
  work_row public.radar_work_items%rowtype;
  current_generation bigint;
  wall_time timestamptz;
  next_state text := case when p_retryable then 'RETRY_WAIT' else 'FAILED' end;
begin
  if p_lease_token is null or p_lease_generation is null then
    raise exception 'work failure requires a fence' using errcode = '22023';
  end if;
  if length(coalesce(p_error_summary, '')) > 1000 then
    raise exception 'error summary too long' using errcode = '22023';
  end if;
  select * into work_row
  from public.radar_work_items
  where id = p_work_item_id
  for update;
  if not found then raise exception 'work item not found' using errcode = '23503'; end if;
  current_generation := private.radar_pause_guard(true);
  wall_time := clock_timestamp();
  if work_row.state in ('FAILED', 'RETRY_WAIT')
     and work_row.failure_retryable is not distinct from p_retryable
     and work_row.last_error_summary is not distinct from nullif(btrim(coalesce(p_error_summary, '')), '') then
    return work_row.state;
  end if;
  if work_row.state <> 'RUNNING'
     or work_row.lease_owner is distinct from p_worker
     or work_row.lease_token is distinct from p_lease_token
     or work_row.lease_generation is distinct from p_lease_generation
     or work_row.lease_expires_at is null
     or work_row.lease_expires_at <= wall_time
     or work_row.pause_generation is distinct from current_generation then
    raise exception 'work lease is stale or invalid' using errcode = '40001';
  end if;
  update public.radar_work_items
  set state = next_state,
      available_at = coalesce(p_retry_at, wall_time),
      last_error_summary = nullif(btrim(coalesce(p_error_summary, '')), ''),
      failure_retryable = p_retryable,
      lease_owner = null, lease_token = null, lease_expires_at = null
  where id = p_work_item_id;
  perform private.radar_system_audit('radar.work_failed', p_work_item_id,
    null, jsonb_build_object('state', next_state),
    jsonb_build_object('schema_version', 4, 'retryable', p_retryable));
  return next_state;
end;
$$;
revoke all on function public.radar_system_fail_work(uuid, text, uuid, bigint, boolean, text, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.radar_system_fail_work(uuid, text, uuid, bigint, boolean, text, timestamptz)
  to service_role;

commit;
