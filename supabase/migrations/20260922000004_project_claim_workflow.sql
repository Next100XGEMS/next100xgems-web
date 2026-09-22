begin;

-- Project Platform Phase 1 — ownership claim workflow (PP1-3).
-- States: SUBMITTED → UNDER_REVIEW → APPROVED | REJECTED (no skips).

create table public.project_claims (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete restrict,
  claimant_user_id uuid not null references public.profiles(id) on delete restrict,
  proposed_slug extensions.citext not null,
  proposed_display_name text not null
    check (length(btrim(proposed_display_name)) between 1 and 200),
  payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload) = 'object'),
  state text not null default 'SUBMITTED'
    check (state in ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED')),
  reviewer_user_id uuid references public.profiles(id) on delete restrict,
  review_note text check (review_note is null or length(btrim(review_note)) between 1 and 2000),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_claims_slug_format check (
    length(btrim(proposed_slug::text)) between 1 and 80
    and proposed_slug::text ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  constraint project_claims_review_consistency check (
    (state in ('SUBMITTED') and reviewer_user_id is null and reviewed_at is null)
    or (state = 'UNDER_REVIEW' and reviewer_user_id is not null)
    or (state in ('APPROVED', 'REJECTED') and reviewer_user_id is not null and reviewed_at is not null)
  ),
  constraint project_claims_reject_note check (
    state <> 'REJECTED' or (review_note is not null and length(btrim(review_note)) > 0)
  )
);

create index project_claims_state_idx on public.project_claims(state, submitted_at desc);
create index project_claims_claimant_idx on public.project_claims(claimant_user_id, submitted_at desc);
create trigger project_claims_set_updated_at
  before update on public.project_claims
  for each row execute function public.set_updated_at();

alter table public.project_claims enable row level security;
revoke all on table public.project_claims from public, anon, authenticated, service_role;

grant select (
  id, project_id, claimant_user_id, proposed_slug, proposed_display_name, payload,
  state, reviewer_user_id, review_note, submitted_at, reviewed_at, created_at, updated_at
) on table public.project_claims to authenticated;

create policy project_claims_claimant_or_staff_select on public.project_claims
  for select to authenticated
  using (
    private.is_project_staff()
    or claimant_user_id = (select auth.uid())
  );

create function private.project_claims_enabled()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.feature_flags
    where key = 'project_claims_enabled'
      and enabled
      and (configuration is null or jsonb_typeof(configuration) = 'object')
  );
$$;

create function private.project_claim_payload_is_allowed(p_payload jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    p_payload is not null
    and jsonb_typeof(p_payload) = 'object'
    and p_payload - array[
      'website_url', 'token_mint', 'proof_url', 'contact_email', 'notes'
    ]::text[] = '{}'::jsonb
    and (
      not (p_payload ? 'website_url')
      or (
        jsonb_typeof(p_payload->'website_url') = 'string'
        and length(btrim(p_payload->>'website_url')) between 1 and 500
      )
    )
    and (
      not (p_payload ? 'token_mint')
      or (
        jsonb_typeof(p_payload->'token_mint') = 'string'
        and length(btrim(p_payload->>'token_mint')) between 1 and 128
      )
    )
    and (
      not (p_payload ? 'proof_url')
      or (
        jsonb_typeof(p_payload->'proof_url') = 'string'
        and length(btrim(p_payload->>'proof_url')) between 1 and 500
      )
    )
    and (
      not (p_payload ? 'contact_email')
      or (
        jsonb_typeof(p_payload->'contact_email') = 'string'
        and length(btrim(p_payload->>'contact_email')) between 3 and 254
      )
    )
    and (
      not (p_payload ? 'notes')
      or (
        jsonb_typeof(p_payload->'notes') = 'string'
        and length(btrim(p_payload->>'notes')) between 1 and 2000
      )
    );
$$;

-- Authenticated claimant submits a claim (flag-gated, rate-limited).
create function public.submit_project_claim(
  p_proposed_slug text,
  p_proposed_display_name text,
  p_payload jsonb default '{}'::jsonb,
  p_project_id uuid default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_claim public.project_claims;
  v_open_count integer;
  v_slug extensions.citext;
begin
  if v_uid is null or coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'true' then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if not private.project_claims_enabled() then
    raise exception 'Project claims are not available' using errcode = '55000';
  end if;

  if not exists (
    select 1 from public.profiles where id = v_uid and status = 'ACTIVE'
  ) then
    raise exception 'Active profile is required' using errcode = '42501';
  end if;

  if p_proposed_slug is null
    or length(btrim(p_proposed_slug)) not between 1 and 80
    or btrim(lower(p_proposed_slug)) !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  then
    raise exception 'Invalid proposed slug' using errcode = '22023';
  end if;

  if p_proposed_display_name is null
    or length(btrim(p_proposed_display_name)) not between 1 and 200
  then
    raise exception 'Invalid proposed display name' using errcode = '22023';
  end if;

  if not private.project_claim_payload_is_allowed(coalesce(p_payload, '{}'::jsonb)) then
    raise exception 'Invalid claim payload' using errcode = '22023';
  end if;

  if p_project_id is not null and not exists (
    select 1 from public.projects where id = p_project_id
  ) then
    raise exception 'Unknown project' using errcode = '22023';
  end if;

  select count(*)::integer into v_open_count
  from public.project_claims
  where claimant_user_id = v_uid
    and state in ('SUBMITTED', 'UNDER_REVIEW');

  if v_open_count >= 5 then
    raise exception 'Too many open claims' using errcode = '54000';
  end if;

  v_slug := btrim(lower(p_proposed_slug))::extensions.citext;

  insert into public.project_claims (
    project_id, claimant_user_id, proposed_slug, proposed_display_name, payload, state
  ) values (
    p_project_id, v_uid, v_slug, btrim(p_proposed_display_name),
    coalesce(p_payload, '{}'::jsonb), 'SUBMITTED'
  )
  returning * into v_claim;

  perform public.write_audit_event(
    'USER', v_uid, 'project.claim.submitted', 'project_claim', v_claim.id,
    null,
    jsonb_build_object(
      'state', v_claim.state,
      'proposed_slug', v_claim.proposed_slug::text,
      'project_id', v_claim.project_id
    ),
    '{}'::jsonb
  );

  return jsonb_build_object(
    'claim_id', v_claim.id,
    'state', v_claim.state,
    'audit_action', 'project.claim.submitted'
  );
end;
$$;

-- Staff moves SUBMITTED → UNDER_REVIEW.
create function public.review_project_claim_start(p_claim_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_claim public.project_claims;
  v_prev text;
begin
  if v_uid is null or not private.is_project_staff() then
    raise exception 'Staff authorization is required' using errcode = '42501';
  end if;

  select * into v_claim from public.project_claims where id = p_claim_id for update;
  if not found then
    raise exception 'Claim not found' using errcode = '22023';
  end if;

  if v_claim.state <> 'SUBMITTED' then
    raise exception 'Claim cannot enter review from current state' using errcode = '55000';
  end if;

  v_prev := v_claim.state;
  update public.project_claims
  set state = 'UNDER_REVIEW', reviewer_user_id = v_uid
  where id = p_claim_id
  returning * into v_claim;

  perform public.write_audit_event(
    'USER', v_uid, 'project.claim.reviewed', 'project_claim', v_claim.id,
    jsonb_build_object('state', v_prev),
    jsonb_build_object('state', v_claim.state, 'reviewer_user_id', v_uid),
    jsonb_build_object('transition', 'start_review')
  );

  return jsonb_build_object('claim_id', v_claim.id, 'state', v_claim.state);
end;
$$;

-- Staff APPROVE: create/link project + project_owner membership.
create function public.review_project_claim_approve(
  p_claim_id uuid,
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
  v_claim public.project_claims;
  v_prev text;
  v_project public.projects;
  v_note text := nullif(btrim(coalesce(p_review_note, '')), '');
begin
  if v_uid is null or not private.is_project_staff() then
    raise exception 'Staff authorization is required' using errcode = '42501';
  end if;

  select * into v_claim from public.project_claims where id = p_claim_id for update;
  if not found then
    raise exception 'Claim not found' using errcode = '22023';
  end if;

  if v_claim.state <> 'UNDER_REVIEW' then
    raise exception 'Claim can only be approved from UNDER_REVIEW' using errcode = '55000';
  end if;

  if v_claim.project_id is null then
    insert into public.projects (slug, display_name, status)
    values (v_claim.proposed_slug, v_claim.proposed_display_name, 'ACTIVE')
    returning * into v_project;
  else
    select * into v_project from public.projects where id = v_claim.project_id for update;
    if not found then
      raise exception 'Linked project missing' using errcode = '22023';
    end if;
    update public.projects
    set status = case when status = 'SUSPENDED' then status else 'ACTIVE' end,
        display_name = coalesce(nullif(btrim(display_name), ''), v_claim.proposed_display_name)
    where id = v_project.id
    returning * into v_project;
  end if;

  insert into public.project_members (project_id, user_id, role)
  values (v_project.id, v_claim.claimant_user_id, 'project_owner')
  on conflict (project_id, user_id) do update
    set role = case
      when public.project_members.role = 'project_owner' then public.project_members.role
      else 'project_owner'
    end,
    updated_at = statement_timestamp();

  v_prev := v_claim.state;
  update public.project_claims
  set
    state = 'APPROVED',
    project_id = v_project.id,
    reviewer_user_id = v_uid,
    review_note = v_note,
    reviewed_at = statement_timestamp()
  where id = p_claim_id
  returning * into v_claim;

  perform public.write_audit_event(
    'USER', v_uid, 'project.claim.reviewed', 'project_claim', v_claim.id,
    jsonb_build_object('state', v_prev),
    jsonb_build_object(
      'state', v_claim.state,
      'project_id', v_project.id,
      'membership_role', 'project_owner'
    ),
    jsonb_build_object('transition', 'approve')
  );

  return jsonb_build_object(
    'claim_id', v_claim.id,
    'state', v_claim.state,
    'project_id', v_project.id
  );
end;
$$;

-- Staff REJECT: terminal with required note.
create function public.review_project_claim_reject(
  p_claim_id uuid,
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
  v_claim public.project_claims;
  v_prev text;
  v_note text := nullif(btrim(coalesce(p_review_note, '')), '');
begin
  if v_uid is null or not private.is_project_staff() then
    raise exception 'Staff authorization is required' using errcode = '42501';
  end if;

  if v_note is null or length(v_note) = 0 then
    raise exception 'Rejection note is required' using errcode = '22023';
  end if;

  select * into v_claim from public.project_claims where id = p_claim_id for update;
  if not found then
    raise exception 'Claim not found' using errcode = '22023';
  end if;

  if v_claim.state <> 'UNDER_REVIEW' then
    raise exception 'Claim can only be rejected from UNDER_REVIEW' using errcode = '55000';
  end if;

  v_prev := v_claim.state;
  update public.project_claims
  set
    state = 'REJECTED',
    reviewer_user_id = v_uid,
    review_note = v_note,
    reviewed_at = statement_timestamp()
  where id = p_claim_id
  returning * into v_claim;

  perform public.write_audit_event(
    'USER', v_uid, 'project.claim.reviewed', 'project_claim', v_claim.id,
    jsonb_build_object('state', v_prev),
    jsonb_build_object('state', v_claim.state, 'review_note', v_note),
    jsonb_build_object('transition', 'reject')
  );

  return jsonb_build_object('claim_id', v_claim.id, 'state', v_claim.state);
end;
$$;

revoke all on function public.submit_project_claim(text, text, jsonb, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.review_project_claim_start(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.review_project_claim_approve(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.review_project_claim_reject(uuid, text)
  from public, anon, authenticated, service_role;

grant execute on function public.submit_project_claim(text, text, jsonb, uuid)
  to authenticated;
grant execute on function public.review_project_claim_start(uuid)
  to authenticated;
grant execute on function public.review_project_claim_approve(uuid, text)
  to authenticated;
grant execute on function public.review_project_claim_reject(uuid, text)
  to authenticated;

commit;
