begin;

-- Gate 19G-F1: input assembly is explicitly finalized before a worker can
-- claim an input-bearing work item.  Historical migrations remain unchanged.
alter table public.radar_work_items
  add column input_assembly_state text not null default 'OPEN'
    check (input_assembly_state in ('OPEN', 'FINALIZED'));

update public.radar_work_items
set input_assembly_state = 'FINALIZED'
where sealed_at is not null and input_hash is not null;

-- Attachments and finalization serialize on the work row.  This closes the
-- enqueue -> attach -> claim race without granting table access.
create or replace function public.radar_system_attach_observation(
  p_work_item_id uuid,
  p_observation_id uuid
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  work_row public.radar_work_items%rowtype;
  observation_token uuid;
begin
  perform private.radar_pause_guard(true);
  select * into work_row from public.radar_work_items
  where id = p_work_item_id for update;
  if not found then raise exception 'work item not found' using errcode = '23503'; end if;
  if work_row.input_assembly_state <> 'OPEN'
     or work_row.sealed_at is not null
     or work_row.state not in ('QUEUED', 'RETRY_WAIT') then
    raise exception 'work inputs can only be added before finalization' using errcode = '55000';
  end if;
  select token_id into observation_token from public.radar_observations
  where id = p_observation_id;
  if not found or (work_row.token_id is not null and observation_token is distinct from work_row.token_id) then
    raise exception 'work input token does not match work item scope' using errcode = '23514';
  end if;
  insert into public.radar_work_inputs(work_item_id, observation_id)
  values (p_work_item_id, p_observation_id)
  on conflict do nothing;
end;
$$;
revoke all on function public.radar_system_attach_observation(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.radar_system_attach_observation(uuid, uuid) to service_role;

create or replace function private.radar_input_manifest(p_work_item_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(
    jsonb_build_object('observation_id', wi.observation_id, 'content_hash', o.content_hash)
    order by wi.observation_id
  ), '[]'::jsonb)
  from public.radar_work_inputs wi
  join public.radar_observations o on o.id = wi.observation_id
  where wi.work_item_id = p_work_item_id;
$$;
revoke all on function private.radar_input_manifest(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.radar_system_finalize_work_inputs(
  p_work_item_id uuid,
  p_method_version text,
  p_input_version text
)
returns table (
  work_item_id uuid,
  token_id uuid,
  reserved_analysis_version integer,
  method_version text,
  input_version text,
  sealed_input_hash text,
  sealed_at timestamptz,
  pause_generation bigint,
  input_manifest jsonb
)
language plpgsql security definer set search_path = '' as $$
declare
  work_row public.radar_work_items%rowtype;
  current_generation bigint;
  fingerprint text;
  manifest jsonb;
  input_count integer;
  requires_inputs boolean;
begin
  current_generation := private.radar_pause_guard(true);
  select * into work_row from public.radar_work_items
  where id = p_work_item_id for update;
  if not found then raise exception 'work item not found' using errcode = '23503'; end if;
  requires_inputs := work_row.work_kind in ('SCREENING', 'DEEP_ANALYSIS', 'REANALYSIS', 'RECALCULATION');
  if not requires_inputs then
    raise exception 'work kind does not use frozen inputs' using errcode = '22023';
  end if;
  if work_row.method_version is distinct from p_method_version
     or work_row.input_version is distinct from p_input_version then
    raise exception 'finalization method or input version conflicts' using errcode = '23505';
  end if;
  if work_row.input_assembly_state = 'FINALIZED' then
    fingerprint := private.radar_input_fingerprint(work_row.id);
    if work_row.input_hash is distinct from fingerprint then
      raise exception 'finalization conflicts with sealed input membership' using errcode = '23505';
    end if;
    manifest := private.radar_input_manifest(work_row.id);
    return query select work_row.id, work_row.token_id, work_row.reserved_analysis_version,
      work_row.method_version, work_row.input_version, work_row.input_hash,
      work_row.sealed_at, work_row.pause_generation, manifest;
    return;
  end if;
  if work_row.state not in ('QUEUED', 'RETRY_WAIT') or work_row.sealed_at is not null then
    raise exception 'work item is not open for input finalization' using errcode = '55000';
  end if;
  select count(*) into input_count from public.radar_work_inputs wi
  where wi.work_item_id = work_row.id;
  if input_count = 0 then
    raise exception 'input-bearing work requires at least one observation' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.radar_work_inputs wi
    join public.radar_observations o on o.id = wi.observation_id
    where wi.work_item_id = work_row.id
      and (work_row.token_id is null or o.token_id is distinct from work_row.token_id)
  ) then
    raise exception 'work input token does not match work item scope' using errcode = '23514';
  end if;
  fingerprint := private.radar_input_fingerprint(work_row.id);
  manifest := private.radar_input_manifest(work_row.id);
  update public.radar_work_items
  set input_assembly_state = 'FINALIZED', sealed_at = clock_timestamp(), input_hash = fingerprint
  where id = work_row.id;
  return query select work_row.id, work_row.token_id, work_row.reserved_analysis_version,
    work_row.method_version, work_row.input_version, fingerprint,
    (select w.sealed_at from public.radar_work_items w where w.id = work_row.id),
    current_generation, manifest;
end;
$$;
revoke all on function public.radar_system_finalize_work_inputs(uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.radar_system_finalize_work_inputs(uuid, text, text)
  to service_role;

-- The manifest is available only to the current fenced SYSTEM worker.
create or replace function public.radar_system_get_work_manifest(
  p_work_item_id uuid,
  p_worker text,
  p_lease_token uuid,
  p_lease_generation bigint
)
returns table (
  work_item_id uuid,
  token_id uuid,
  reserved_analysis_version integer,
  method_version text,
  input_version text,
  sealed_input_hash text,
  sealed_at timestamptz,
  pause_generation bigint,
  input_manifest jsonb
)
language plpgsql security definer set search_path = '' as $$
declare
  work_row public.radar_work_items%rowtype;
  current_generation bigint;
begin
  current_generation := private.radar_pause_guard(true);
  select * into work_row from public.radar_work_items where id = p_work_item_id for share;
  if not found then raise exception 'work item not found' using errcode = '23503'; end if;
  if work_row.state <> 'RUNNING'
     or work_row.lease_owner is distinct from p_worker
     or work_row.lease_token is distinct from p_lease_token
     or work_row.lease_generation is distinct from p_lease_generation
     or work_row.pause_generation is distinct from current_generation
     or work_row.input_assembly_state <> 'FINALIZED'
     or work_row.input_hash is null then
    raise exception 'work manifest fence is stale or invalid' using errcode = '40001';
  end if;
  return query select work_row.id, work_row.token_id, work_row.reserved_analysis_version,
    work_row.method_version, work_row.input_version, work_row.input_hash,
    work_row.sealed_at, work_row.pause_generation, private.radar_input_manifest(work_row.id);
end;
$$;
revoke all on function public.radar_system_get_work_manifest(uuid, text, uuid, bigint)
  from public, anon, authenticated, service_role;
grant execute on function public.radar_system_get_work_manifest(uuid, text, uuid, bigint)
  to service_role;

drop function public.radar_system_claim_work(text, integer);
create function public.radar_system_claim_work(
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
  select * into candidate from public.radar_work_items w
  where (w.state in ('QUEUED', 'RETRY_WAIT')
      or (w.state = 'RUNNING' and w.lease_expires_at <= clock_timestamp()))
    and w.available_at <= clock_timestamp()
    and (w.lease_expires_at is null or w.lease_expires_at <= clock_timestamp())
    and w.pause_generation = current_generation
    and (w.work_kind not in ('SCREENING', 'DEEP_ANALYSIS', 'REANALYSIS', 'RECALCULATION')
      or (w.input_assembly_state = 'FINALIZED' and w.sealed_at is not null and w.input_hash is not null))
  order by w.available_at, w.created_at
  for update skip locked limit 1;
  if not found then return; end if;
  wall_time := clock_timestamp();
  if candidate.state = 'RUNNING' and candidate.lease_expires_at > wall_time then return; end if;
  update public.radar_work_items as w
  set state = 'RUNNING', attempt_count = w.attempt_count + 1,
      sealed_at = case when candidate.work_kind in ('SCREENING', 'DEEP_ANALYSIS', 'REANALYSIS', 'RECALCULATION')
        then w.sealed_at else coalesce(w.sealed_at, wall_time) end,
      input_hash = case when candidate.work_kind in ('SCREENING', 'DEEP_ANALYSIS', 'REANALYSIS', 'RECALCULATION')
        then w.input_hash else coalesce(w.input_hash, private.radar_input_fingerprint(w.id)) end,
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

commit;
