begin;

-- Project Platform Phase 1 — factual corrections (PP1-6).
-- Same state machine as claims; allowlist apply; forbidden intelligence keys.

create table public.project_corrections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  submitter_user_id uuid not null references public.profiles(id) on delete restrict,
  field_key text not null check (field_key ~ '^[a-z][a-z0-9_]*$'),
  proposed_value jsonb not null,
  rationale text not null check (length(btrim(rationale)) between 1 and 2000),
  state text not null default 'SUBMITTED'
    check (state in ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED')),
  reviewer_user_id uuid references public.profiles(id) on delete restrict,
  review_note text check (review_note is null or length(btrim(review_note)) between 1 and 2000),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_corrections_review_consistency check (
    (state = 'SUBMITTED' and reviewer_user_id is null and reviewed_at is null)
    or (state = 'UNDER_REVIEW' and reviewer_user_id is not null)
    or (state in ('APPROVED', 'REJECTED') and reviewer_user_id is not null and reviewed_at is not null)
  ),
  constraint project_corrections_reject_note check (
    state <> 'REJECTED' or (review_note is not null and length(btrim(review_note)) > 0)
  )
);

create index project_corrections_state_idx
  on public.project_corrections(state, submitted_at desc);
create index project_corrections_project_idx
  on public.project_corrections(project_id, submitted_at desc);

create trigger project_corrections_set_updated_at
  before update on public.project_corrections
  for each row execute function public.set_updated_at();

alter table public.project_corrections enable row level security;
revoke all on table public.project_corrections from public, anon, authenticated, service_role;

grant select (
  id, project_id, submitter_user_id, field_key, proposed_value, rationale, state,
  reviewer_user_id, review_note, submitted_at, reviewed_at, created_at, updated_at
) on table public.project_corrections to authenticated;

create policy project_corrections_member_or_staff_select on public.project_corrections
  for select to authenticated
  using (
    private.is_project_staff()
    or private.is_project_member(project_id, null)
  );

create function private.project_corrections_enabled()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.feature_flags
    where key = 'project_corrections_enabled'
      and enabled
      and (configuration is null or jsonb_typeof(configuration) = 'object')
  );
$$;

-- Intelligence / score / organic / evidence keys are never correctable.
create function private.project_correction_field_is_forbidden(p_field_key text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    p_field_key is null
    or p_field_key in (
      'score', 'radar_score', 'risk', 'risk_summary', 'organic_rank', 'organic',
      'evidence', 'evidence_manifest', 'conclusion', 'conclusions',
      'analyzer_result', 'research_conclusion', 'ai_inference'
    )
    or p_field_key like 'radar_%'
    or p_field_key like 'analyzer_%'
    or p_field_key like 'research_%'
    or p_field_key like 'organic_%'
    or p_field_key like 'evidence_%';
$$;

create function public.submit_project_correction(
  p_project_id uuid,
  p_field_key text,
  p_proposed_value jsonb,
  p_rationale text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.project_corrections;
  v_open integer;
  v_rationale text := nullif(btrim(coalesce(p_rationale, '')), '');
begin
  if v_uid is null or coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if not private.project_corrections_enabled() then
    raise exception 'Project corrections are not available' using errcode = '55000';
  end if;

  if not private.is_project_member(
    p_project_id,
    array['project_owner', 'project_editor']::text[]
  ) then
    raise exception 'Project editor access is required' using errcode = '42501';
  end if;

  if private.project_correction_field_is_forbidden(p_field_key) then
    raise exception 'Correction target is forbidden' using errcode = '22023';
  end if;

  if not private.project_field_key_is_allowed(p_field_key) then
    raise exception 'Correction field is not allowlisted' using errcode = '22023';
  end if;

  if not private.project_field_value_is_allowed(p_field_key, p_proposed_value) then
    raise exception 'Invalid proposed value' using errcode = '22023';
  end if;

  if v_rationale is null then
    raise exception 'Rationale is required' using errcode = '22023';
  end if;

  select count(*)::integer into v_open
  from public.project_corrections
  where submitter_user_id = v_uid
    and project_id = p_project_id
    and state in ('SUBMITTED', 'UNDER_REVIEW');

  if v_open >= 10 then
    raise exception 'Too many open corrections' using errcode = '54000';
  end if;

  insert into public.project_corrections (
    project_id, submitter_user_id, field_key, proposed_value, rationale, state
  ) values (
    p_project_id, v_uid, p_field_key, p_proposed_value, v_rationale, 'SUBMITTED'
  )
  returning * into v_row;

  perform public.write_audit_event(
    'USER', v_uid, 'project.correction.submitted', 'project_correction', v_row.id,
    null,
    jsonb_build_object(
      'state', v_row.state,
      'field_key', v_row.field_key,
      'project_id', v_row.project_id
    ),
    '{}'::jsonb
  );

  return jsonb_build_object('correction_id', v_row.id, 'state', v_row.state);
end;
$$;

create function public.review_project_correction_start(p_correction_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.project_corrections;
  v_prev text;
begin
  if v_uid is null or not private.is_project_staff() then
    raise exception 'Staff authorization is required' using errcode = '42501';
  end if;

  select * into v_row from public.project_corrections where id = p_correction_id for update;
  if not found then
    raise exception 'Correction not found' using errcode = '22023';
  end if;
  if v_row.state <> 'SUBMITTED' then
    raise exception 'Correction cannot enter review from current state' using errcode = '55000';
  end if;

  v_prev := v_row.state;
  update public.project_corrections
  set state = 'UNDER_REVIEW', reviewer_user_id = v_uid
  where id = p_correction_id
  returning * into v_row;

  perform public.write_audit_event(
    'USER', v_uid, 'project.correction.reviewed', 'project_correction', v_row.id,
    jsonb_build_object('state', v_prev),
    jsonb_build_object('state', v_row.state),
    jsonb_build_object('transition', 'start_review')
  );

  return jsonb_build_object('correction_id', v_row.id, 'state', v_row.state);
end;
$$;

create function public.review_project_correction_approve(
  p_correction_id uuid,
  p_review_note text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.project_corrections;
  v_prev text;
  v_apply jsonb;
  v_note text := nullif(btrim(coalesce(p_review_note, '')), '');
  v_existing public.project_field_values;
  v_next integer;
  v_field public.project_field_values;
  v_existing_found boolean := false;
begin
  if v_uid is null or not private.is_project_staff() then
    raise exception 'Staff authorization is required' using errcode = '42501';
  end if;

  select * into v_row from public.project_corrections where id = p_correction_id for update;
  if not found then
    raise exception 'Correction not found' using errcode = '22023';
  end if;
  if v_row.state <> 'UNDER_REVIEW' then
    raise exception 'Correction can only be approved from UNDER_REVIEW' using errcode = '55000';
  end if;

  -- Re-check allowlist + forbidden at approve time (adversarial hard stop).
  if private.project_correction_field_is_forbidden(v_row.field_key)
     or not private.project_field_key_is_allowed(v_row.field_key)
  then
    raise exception 'Correction target is forbidden' using errcode = '22023';
  end if;

  select * into v_existing
  from public.project_field_values
  where project_id = v_row.project_id and field_key = v_row.field_key
  for update;
  v_existing_found := found;

  if v_existing_found and v_existing.provenance in (
    'INDEPENDENTLY_VERIFIED'::public.project_provenance,
    'PROVIDER_DERIVED'::public.project_provenance,
    'AI_INFERENCE'::public.project_provenance
  ) then
    raise exception 'Cannot overwrite independently sourced field'
      using errcode = '55000';
  end if;

  if v_existing_found then
    v_next := v_existing.version + 1;
    update public.project_field_values
    set value = v_row.proposed_value,
        provenance = 'PROJECT_PROVIDED',
        version = v_next,
        updated_by = v_uid
    where id = v_existing.id
    returning * into v_field;
  else
    v_next := 1;
    insert into public.project_field_values (
      project_id, field_key, value, provenance, version, updated_by
    ) values (
      v_row.project_id, v_row.field_key, v_row.proposed_value,
      'PROJECT_PROVIDED', v_next, v_uid
    )
    returning * into v_field;
  end if;

  insert into public.project_field_versions (
    project_id, field_key, value, provenance, version, updated_by
  ) values (
    v_field.project_id, v_field.field_key, v_field.value,
    v_field.provenance, v_field.version, v_uid
  );

  v_apply := jsonb_build_object(
    'field_key', v_field.field_key,
    'version', v_field.version,
    'provenance', v_field.provenance::text
  );

  v_prev := v_row.state;
  update public.project_corrections
  set
    state = 'APPROVED',
    reviewer_user_id = v_uid,
    review_note = v_note,
    reviewed_at = statement_timestamp()
  where id = p_correction_id
  returning * into v_row;

  perform public.write_audit_event(
    'USER', v_uid, 'project.correction.reviewed', 'project_correction', v_row.id,
    jsonb_build_object('state', v_prev),
    jsonb_build_object('state', v_row.state, 'applied', v_apply),
    jsonb_build_object('transition', 'approve')
  );

  return jsonb_build_object(
    'correction_id', v_row.id,
    'state', v_row.state,
    'applied', v_apply
  );
end;
$$;

create function public.review_project_correction_reject(
  p_correction_id uuid,
  p_review_note text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.project_corrections;
  v_prev text;
  v_note text := nullif(btrim(coalesce(p_review_note, '')), '');
begin
  if v_uid is null or not private.is_project_staff() then
    raise exception 'Staff authorization is required' using errcode = '42501';
  end if;

  if v_note is null then
    raise exception 'Rejection note is required' using errcode = '22023';
  end if;

  select * into v_row from public.project_corrections where id = p_correction_id for update;
  if not found then
    raise exception 'Correction not found' using errcode = '22023';
  end if;
  if v_row.state <> 'UNDER_REVIEW' then
    raise exception 'Correction can only be rejected from UNDER_REVIEW' using errcode = '55000';
  end if;

  v_prev := v_row.state;
  update public.project_corrections
  set
    state = 'REJECTED',
    reviewer_user_id = v_uid,
    review_note = v_note,
    reviewed_at = statement_timestamp()
  where id = p_correction_id
  returning * into v_row;

  perform public.write_audit_event(
    'USER', v_uid, 'project.correction.reviewed', 'project_correction', v_row.id,
    jsonb_build_object('state', v_prev),
    jsonb_build_object('state', v_row.state),
    jsonb_build_object('transition', 'reject')
  );

  return jsonb_build_object('correction_id', v_row.id, 'state', v_row.state);
end;
$$;

revoke all on function public.submit_project_correction(uuid, text, jsonb, text)
  from public, anon, authenticated, service_role;
revoke all on function public.review_project_correction_start(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.review_project_correction_approve(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.review_project_correction_reject(uuid, text)
  from public, anon, authenticated, service_role;

grant execute on function public.submit_project_correction(uuid, text, jsonb, text)
  to authenticated;
grant execute on function public.review_project_correction_start(uuid)
  to authenticated;
grant execute on function public.review_project_correction_approve(uuid, text)
  to authenticated;
grant execute on function public.review_project_correction_reject(uuid, text)
  to authenticated;

commit;
