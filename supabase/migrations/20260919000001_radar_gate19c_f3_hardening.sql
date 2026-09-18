begin;

-- Gate 19C-F3 is an additive corrective migration. The original Gate 19C,
-- F1, and F2 migrations remain historical and unchanged.

-- Public text must be sourced from a JSON string, remain bounded, and contain
-- no control characters. In particular, ->> must never coerce an object or
-- array into a public analytical label.
create or replace function private.radar_public_text_is_safe(p_value text, p_limit integer)
returns boolean language sql immutable set search_path = '' as $$
  select p_value is not null
    and length(p_value) <= p_limit
    and p_value !~ '[[:cntrl:]]';
$$;
revoke all on function private.radar_public_text_is_safe(text, integer)
  from public, anon, authenticated, service_role;

create or replace function private.radar_public_text_from_json(
  p_document jsonb, p_key text, p_limit integer
)
returns text language sql immutable set search_path = '' as $$
  select case
    when jsonb_typeof(p_document -> p_key) = 'string'
      and private.radar_public_text_is_safe(p_document ->> p_key, p_limit)
    then p_document ->> p_key
    else null
  end;
$$;
revoke all on function private.radar_public_text_from_json(jsonb, text, integer)
  from public, anon, authenticated, service_role;

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
      and private.radar_public_text_is_safe(p_presentation->>'why_on_radar', 2000)
      and private.radar_public_text_is_safe(p_presentation->>'risk_summary', 2000)
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
      and jsonb_typeof(p_snapshot->'why_on_radar') = 'string'
      and jsonb_typeof(p_snapshot->'risk_summary') = 'string'
      and jsonb_typeof(p_snapshot->'evidence_hash') = 'string'
      and private.radar_public_text_is_safe(p_snapshot->>'why_on_radar', 2000)
      and private.radar_public_text_is_safe(p_snapshot->>'risk_summary', 2000)
      and jsonb_array_length(p_snapshot->'metrics') <= 64
      and jsonb_array_length(p_snapshot->'evidence') <= 64);
$$;
revoke all on function private.radar_publication_snapshot_is_valid(jsonb)
  from public, anon, authenticated, service_role;

-- A durable row records that an analysis has crossed the irreversible review
-- boundary. Evidence membership never becomes appendable again when a review
-- later moves to REJECTED, HIDDEN, or is superseded.
create table public.radar_evidence_freezes (
  analysis_id uuid primary key references public.radar_analyses(id) on delete restrict,
  frozen_at timestamptz not null,
  constraint radar_evidence_freezes_finite_check check (isfinite(frozen_at))
);
alter table public.radar_evidence_freezes enable row level security;
revoke all on table public.radar_evidence_freezes from public, anon, authenticated, service_role;

insert into public.radar_evidence_freezes(analysis_id, frozen_at)
select analysis_id, min(approved_at)
from public.radar_reviews
where approved_at is not null
group by analysis_id
on conflict (analysis_id) do nothing;

create or replace function private.radar_user_effective_roles(p_user_id uuid)
returns text[] language sql stable security definer set search_path = '' as $$
  with assigned_roles as (
    select distinct r.key
    from public.profiles p
    join public.user_roles ur on ur.user_id = p.id
    join public.roles r on r.id = ur.role_id
    where p.id = p_user_id
      and p.status = 'ACTIVE'
      and r.key in (
        'owner', 'admin', 'editor', 'radar_reviewer',
        'ad_manager', 'analyst', 'viewer'
      )
  ), collected as (
    select coalesce(array_agg(key order by key), array[]::text[]) as role_keys
    from assigned_roles
  )
  select case
    when role_keys @> array['ad_manager']::text[]
      and role_keys && array['editor', 'radar_reviewer', 'analyst']::text[]
      then array[]::text[]
    else role_keys
  end
  from collected;
$$;
revoke all on function private.radar_user_effective_roles(uuid)
  from public, anon, authenticated, service_role;

create or replace function private.radar_user_has_effective_role(
  p_user_id uuid, p_allowed_roles text[]
)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(private.radar_user_effective_roles(p_user_id) && p_allowed_roles, false);
$$;
revoke all on function private.radar_user_has_effective_role(uuid, text[])
  from public, anon, authenticated, service_role;

-- F2's trigger is retained in purpose but now serializes with the approval
-- lock and consults the durable freeze marker rather than only current state.
create or replace function private.radar_evidence_f2_integrity_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  observation_row public.radar_observations%rowtype;
  analysis_exists boolean;
  frozen_at timestamptz;
begin
  select true into analysis_exists
  from public.radar_analyses where id = new.analysis_id for share;
  if not coalesce(analysis_exists, false) then
    raise exception 'evidence analysis does not exist' using errcode = '23503';
  end if;

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
  select f.frozen_at into frozen_at
  from public.radar_evidence_freezes f
  where f.analysis_id = new.analysis_id for share;
  if frozen_at is not null or exists (
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

-- Explicitly reject infinite values on every Radar time that can enter an
-- observation, evidence, analysis, or public publication contract.
alter table public.radar_events
  add constraint radar_events_finite_time_check check (
    isfinite(observed_at) and isfinite(received_at) and isfinite(created_at)
  );
alter table public.radar_observations
  add constraint radar_observations_finite_time_check check (
    isfinite(observed_at) and isfinite(received_at) and isfinite(created_at)
  );
alter table public.radar_evidence
  add constraint radar_evidence_finite_time_check check (
    (observed_at is null or isfinite(observed_at))
    and (received_at is null or isfinite(received_at))
    and (evaluated_at is null or isfinite(evaluated_at))
    and isfinite(created_at)
  );
alter table public.radar_analyses
  add constraint radar_analyses_finite_time_check check (
    isfinite(analyzed_at)
    and isfinite(created_at)
    and (requested_at is null or isfinite(requested_at))
    and (started_at is null or isfinite(started_at))
    and (completed_at is null or isfinite(completed_at))
    and (expires_at is null or isfinite(expires_at))
  );
alter table public.radar_reviews
  add constraint radar_reviews_finite_time_check check (
    (reviewed_at is null or isfinite(reviewed_at))
    and (approved_at is null or isfinite(approved_at))
    and (published_at is null or isfinite(published_at))
    and isfinite(created_at)
    and isfinite(updated_at)
  );

-- Approval locks the immutable analysis before freezing its evidence set. An
-- evidence insert takes a share lock on the same row, so approval and append
-- serialize deterministically regardless of which request starts first.
create or replace function public.radar_approve_review(
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
  why_on_radar text;
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
  select * into analysis_row from public.radar_analyses where id = review_row.analysis_id for update;
  select * into work_row from public.radar_work_items where id = analysis_row.work_item_id for share;
  why_on_radar := private.radar_public_text_from_json(
    analysis_row.deterministic_data, 'why_on_radar', 2000);
  if (analysis_row.deterministic_data ? 'why_on_radar' and why_on_radar is null)
     or not found or work_row.sealed_at is null or work_row.input_hash is null
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
     or analysis_row.expires_at <= clock_timestamp()
     or not private.radar_methodology_is_approved(analysis_row.scoring_method_version)
     or not private.radar_freshness_policy_is_approved(analysis_row.freshness_policy_version)
     or not exists (select 1 from public.radar_evidence e where e.analysis_id = analysis_row.id and e.is_public) then
    raise exception 'analysis is not eligible for review approval' using errcode = '55000';
  end if;
  insert into public.radar_evidence_freezes(analysis_id, frozen_at)
  values (analysis_row.id, clock_timestamp())
  on conflict (analysis_id) do nothing;
  metrics_snapshot := private.radar_public_metrics_snapshot(analysis_row.id);
  evidence_snapshot := private.radar_public_evidence_snapshot(analysis_row.id);
  presentation := jsonb_build_object(
    'why_on_radar', coalesce(why_on_radar, ''),
    'risk_summary', left(coalesce(analysis_row.risk_summary, ''), 2000),
    'metrics', metrics_snapshot,
    'evidence', evidence_snapshot
  );
  evidence_hash := pg_catalog.encode(extensions.digest(convert_to(evidence_snapshot::text, 'UTF8'), 'sha256'), 'hex');
  update public.radar_reviews
  set state = 'APPROVED', reviewed_by = actor_id, reviewed_at = clock_timestamp(),
      public_note = coalesce(p_public_note, ''), public_disclosure = p_public_disclosure,
      public_presentation = presentation, public_metrics_snapshot = metrics_snapshot,
      public_evidence_snapshot = evidence_snapshot, approval_analysis_version = analysis_row.version,
      approval_input_hash = analysis_row.input_hash, approval_methodology_hash = analysis_row.methodology_hash,
      approval_evidence_hash = evidence_hash, approval_score_snapshot = analysis_row.score::text,
      approved_at = clock_timestamp(), revision = revision + 1, last_action_key = p_action_key
  where id = p_review_id;
  perform private.radar_audit(actor_id, 'radar.reviewed', p_review_id,
    jsonb_build_object('state', review_row.state, 'revision', review_row.revision),
    jsonb_build_object('state', 'APPROVED', 'revision', review_row.revision + 1,
      'analysis_version', analysis_row.version, 'evidence_hash', evidence_hash),
    jsonb_build_object('schema_version', 3, 'action_key', p_action_key));
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
  publication_time timestamptz;
  frozen_publication_snapshot jsonb;
begin
  if p_expected_revision is null then
    raise exception 'expected review revision is required' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_action_key, ''))) = 0 then
    raise exception 'publication action key is required' using errcode = '22023';
  end if;
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
  publication_time := clock_timestamp();

  if review_row.state = 'PUBLISHED' and review_row.last_action_key = p_action_key then return p_review_id; end if;
  if review_row.revision <> p_expected_revision then
    raise exception 'stale review revision' using errcode = '40001';
  end if;
  if review_row.state <> 'APPROVED' then
    raise exception 'review must be approved before publication' using errcode = '55000';
  end if;
  if review_row.reviewed_by is null
     or not exists (select 1 from public.profiles p where p.id = review_row.reviewed_by and p.status = 'ACTIVE')
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
     or review_row.approval_evidence_hash is distinct from pg_catalog.encode(
       extensions.digest(convert_to(private.radar_public_evidence_snapshot(analysis_row.id)::text, 'UTF8'), 'sha256'),
       'hex'
     )
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
      jsonb_build_object('schema_version', 3, 'superseded_by', p_review_id));
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
    jsonb_build_object('schema_version', 3, 'action_key', p_action_key));
  return p_review_id;
end;
$$;
revoke all on function public.radar_publish_review(uuid, integer, text)
  from public, anon, authenticated, service_role;
grant execute on function public.radar_publish_review(uuid, integer, text) to authenticated;

-- Public reads re-check the current registry state. Withdrawal hides the
-- publication without deleting its immutable review, analysis, or evidence.
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
    case when (r.publication_snapshot->>'expires_at')::timestamptz > clock_timestamp()
      then 'FRESH' else 'STALE' end,
    r.publication_snapshot->>'why_on_radar', r.publication_snapshot->>'risk_summary',
    r.publication_snapshot->'metrics', r.publication_snapshot->'evidence',
    r.public_note, r.public_disclosure,
    (r.publication_snapshot->>'published_at')::timestamptz
  from public.radar_reviews r
  join public.tokens t on t.id = r.token_id
  where r.state = 'PUBLISHED' and r.publication_snapshot <> '{}'::jsonb
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
    case when (r.publication_snapshot->>'expires_at')::timestamptz > clock_timestamp()
      then 'FRESH' else 'STALE' end,
    r.publication_snapshot->>'why_on_radar', r.publication_snapshot->>'risk_summary',
    r.publication_snapshot->'metrics', r.publication_snapshot->'evidence',
    r.public_note, r.public_disclosure,
    (r.publication_snapshot->>'published_at')::timestamptz
  from public.radar_reviews r
  join public.tokens t on t.id = r.token_id
  where r.token_id = p_token_id and r.state = 'PUBLISHED'
    and r.publication_snapshot <> '{}'::jsonb
    and private.radar_methodology_is_approved(r.publication_snapshot->>'methodology_version')
    and private.radar_freshness_policy_is_approved(r.publication_snapshot->>'freshness_policy_version')
    and (select private.radar_flag_enabled('radar_enabled', false))
    and not (select private.radar_flag_enabled('maintenance_mode', true))
    and not (select private.radar_flag_enabled('radar_emergency_paused', true))
    and (r.publication_snapshot->>'expires_at')::timestamptz > clock_timestamp();
$$;
revoke all on function public.get_public_radar_detail(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_public_radar_detail(uuid) to anon, authenticated;

-- Recheck the lease against wall clock after the authoritative row lock.
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
  wall_time timestamptz;
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
      or (w.state = 'RUNNING' and w.lease_expires_at <= clock_timestamp()))
    and w.available_at <= clock_timestamp()
    and (w.lease_expires_at is null or w.lease_expires_at <= clock_timestamp())
    and w.pause_generation = current_generation
  order by w.available_at, w.created_at
  for update skip locked limit 1;
  if not found then return; end if;
  wall_time := clock_timestamp();
  if candidate.state = 'RUNNING' and candidate.lease_expires_at > wall_time then
    return;
  end if;
  update public.radar_work_items as w
  set state = 'RUNNING', attempt_count = w.attempt_count + 1,
      sealed_at = coalesce(w.sealed_at, wall_time),
      input_hash = coalesce(w.input_hash, private.radar_input_fingerprint(w.id)),
      lease_owner = p_worker, lease_token = gen_random_uuid(),
      lease_expires_at = wall_time + make_interval(secs => p_lease_seconds),
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
  wall_time timestamptz;
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
  wall_time := clock_timestamp();
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
     or work_row.lease_expires_at <= wall_time
     or work_row.pause_generation <> current_generation
     or work_row.sealed_at is null
     or work_row.input_hash is distinct from p_input_hash then
    raise exception 'work lease is stale or invalid' using errcode = '40001';
  end if;
  update public.radar_work_items
  set state = 'SUCCEEDED', screening_result = p_result,
      screening_reasons = normalized_reasons,
      screening_evaluated_at = coalesce(p_evaluated_at, wall_time),
      lease_owner = null, lease_token = null, lease_expires_at = null
  where id = p_work_item_id;
  completed_id := p_work_item_id;
  perform private.radar_system_audit('radar.screening_completed', completed_id,
    null, jsonb_build_object('state', 'SUCCEEDED', 'screening_result', p_result),
    jsonb_build_object('schema_version', 3, 'input_hash', p_input_hash,
      'lease_generation', p_lease_generation));
  return completed_id;
end;
$$;
revoke all on function public.radar_system_complete_screening(uuid, text, uuid, bigint, text, jsonb, text, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.radar_system_complete_screening(uuid, text, uuid, bigint, text, jsonb, text, timestamptz)
  to service_role;

commit;
