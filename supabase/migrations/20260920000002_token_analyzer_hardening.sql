begin;

-- Private application gateway for the Analyzer. Browser roles receive no table
-- grants; all reads and writes remain behind this authenticated operation.
alter table public.analyzer_analyses
  add column if not exists schema_version text not null default 'token-analyzer-v1',
  add column if not exists score_engine_version text,
  add column if not exists analysis_mode text not null default 'DETERMINISTIC',
  add column if not exists freshness_class text not null default 'CURRENT',
  add column if not exists freshness_expires_at timestamptz,
  add column if not exists evidence_manifest_hash text,
  add column if not exists identity jsonb not null default '{}'::jsonb;

create unique index if not exists analyzer_requests_fingerprint_unique_idx
  on public.analyzer_requests(request_fingerprint);

drop trigger if exists analyzer_resolutions_no_mutation on public.analyzer_resolutions;
create trigger analyzer_resolutions_no_mutation
  before update or delete on public.analyzer_resolutions
  for each row execute function public.reject_immutable_change();

create or replace function public.analyzer_assert_operator()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not ((select private.current_app_roles()) && array['owner','admin']::text[]) then
    raise exception 'Analyzer operation is not authorized' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.analyzer_record_provider_event(p_payload jsonb)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare event_id uuid;
begin
  perform public.analyzer_assert_operator();
  if jsonb_typeof(p_payload) <> 'object' or length(coalesce(p_payload->>'provider','')) not between 1 and 128 or length(coalesce(p_payload->>'capability','')) not between 1 and 128 then raise exception 'Analyzer provider telemetry is invalid' using errcode = '22023'; end if;
  insert into public.analyzer_provider_events(request_id, analysis_id, provider, capability, status, latency_ms, source_timestamp, metadata)
  values (nullif(p_payload->>'request_id','')::uuid, nullif(p_payload->>'analysis_id','')::uuid, p_payload->>'provider', p_payload->>'capability', p_payload->>'status', nullif(p_payload->>'latency_ms','')::integer, nullif(p_payload->>'source_timestamp','')::timestamptz, coalesce(p_payload->'metadata','{}'::jsonb)) returning id into event_id;
  return event_id;
end;
$$;

create or replace function public.analyzer_record_cost_usage(p_payload jsonb)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare usage_id uuid;
begin
  perform public.analyzer_assert_operator();
  if jsonb_typeof(p_payload) <> 'object' or length(coalesce(p_payload->>'provider','')) not between 1 and 128 or length(coalesce(p_payload->>'operation','')) not between 1 and 128 then raise exception 'Analyzer cost telemetry is invalid' using errcode = '22023'; end if;
  insert into public.analyzer_cost_usage(request_id, analysis_id, provider, operation, units, unit_kind, estimated_cost)
  values (nullif(p_payload->>'request_id','')::uuid, nullif(p_payload->>'analysis_id','')::uuid, p_payload->>'provider', p_payload->>'operation', nullif(p_payload->>'units','')::numeric, nullif(p_payload->>'unit_kind',''), nullif(p_payload->>'estimated_cost','')::numeric) returning id into usage_id;
  return usage_id;
end;
$$;

create or replace function public.analyzer_record_model_call(p_payload jsonb)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare call_id uuid;
begin
  perform public.analyzer_assert_operator();
  if jsonb_typeof(p_payload) <> 'object' or length(coalesce(p_payload->>'provider','')) not between 1 and 128 or length(coalesce(p_payload->>'model','')) not between 1 and 256 then raise exception 'Analyzer model telemetry is invalid' using errcode = '22023'; end if;
  insert into public.analyzer_model_calls(analysis_id, provider, model, input_tokens, output_tokens, estimated_cost, actual_cost, latency_ms, status)
  values ((p_payload->>'analysis_id')::uuid, p_payload->>'provider', p_payload->>'model', nullif(p_payload->>'input_tokens','')::integer, nullif(p_payload->>'output_tokens','')::integer, nullif(p_payload->>'estimated_cost','')::numeric, nullif(p_payload->>'actual_cost','')::numeric, nullif(p_payload->>'latency_ms','')::integer, p_payload->>'status') returning id into call_id;
  return call_id;
end;
$$;

create or replace function public.analyzer_read_state()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  result jsonb;
begin
  perform public.analyzer_assert_operator();
  select jsonb_build_object(
    'enabled', coalesce((select enabled from public.feature_flags where key = 'token_analyzer_enabled'), false),
    'public_enabled', coalesce((select enabled from public.feature_flags where key = 'token_analyzer_public_enabled'), false),
    'ai_enabled', c.ai_enabled,
    'default_model', c.default_model,
    'social_specialist_enabled', c.social_specialist_enabled,
    'escalation_enabled', c.escalation_enabled,
    'max_model_cost_per_analysis', c.max_model_cost_per_analysis::text,
    'max_daily_model_spend', c.max_daily_model_spend::text,
    'max_monthly_model_spend', c.max_monthly_model_spend::text,
    'analysis_count', (select count(*) from public.analyzer_analyses)
  ) into result
  from public.analyzer_config c where c.singleton = true;
  if result is null then raise exception 'Analyzer configuration is unavailable' using errcode = '55000'; end if;
  return result;
end;
$$;

create or replace function public.analyzer_submit_run(p_payload jsonb)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  requester uuid := auth.uid();
  fingerprint text := p_payload->>'fingerprint';
  request_row public.analyzer_requests%rowtype;
  existing_identity jsonb;
  existing_analysis public.analyzer_analyses%rowtype;
  manifest_version integer;
  analysis_version integer;
  manifest_id uuid;
  analysis_id uuid;
  expires_at timestamptz;
  is_new boolean := false;
begin
  perform public.analyzer_assert_operator();
  if jsonb_typeof(p_payload) <> 'object' or fingerprint is null or fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'Analyzer request payload is invalid' using errcode = '22023';
  end if;
  if jsonb_typeof(p_payload->'resolution') <> 'object' or jsonb_typeof(p_payload->'manifest') <> 'object' or jsonb_typeof(p_payload->'result') <> 'object' then
    raise exception 'Analyzer persistence payload is invalid' using errcode = '22023';
  end if;
  if coalesce(length(p_payload->>'raw_input'), 0) not between 1 and 4096 then
    raise exception 'Analyzer input is invalid' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(fingerprint, 0));
  select * into request_row from public.analyzer_requests where request_fingerprint = fingerprint for update;

  if request_row.id is not null then
    select a.identity into existing_identity from public.analyzer_analyses as a where a.request_id = request_row.id order by a.analysis_version desc limit 1;
    if existing_identity is distinct from p_payload->'identity' then
      raise exception 'Analyzer request context conflicts with the durable request' using errcode = '23P01';
    end if;
    select a.* into existing_analysis from public.analyzer_analyses as a where a.request_id = request_row.id order by a.analysis_version desc limit 1;
    if existing_analysis.id is not null and existing_analysis.freshness_expires_at is not null and existing_analysis.freshness_expires_at > clock_timestamp() and existing_analysis.evidence_manifest_hash = p_payload->>'manifest_hash' then
      return jsonb_build_object('status','REPLAY','request_id',request_row.id,'analysis_id',existing_analysis.id,'analysis_version',existing_analysis.analysis_version,'result',existing_analysis.result);
    end if;
    manifest_version := coalesce((select max(m.manifest_version) from public.analyzer_evidence_manifests as m where m.request_id = request_row.id), 0) + 1;
    analysis_version := coalesce(existing_analysis.analysis_version, 0) + 1;
  else
    is_new := true;
    insert into public.analyzer_requests(requester_id, raw_input, input_type, requested_chain, request_fingerprint, status)
    values (requester, p_payload->>'raw_input', p_payload->>'input_type', nullif(p_payload->>'requested_chain',''), fingerprint, 'RECEIVED')
    returning * into request_row;
    manifest_version := 1;
    analysis_version := 1;
  end if;

  if is_new then
    insert into public.analyzer_resolutions(request_id, resolution) values (request_row.id, p_payload->'resolution');
  end if;
  select m.id into manifest_id from public.analyzer_evidence_manifests as m where m.request_id = request_row.id and m.manifest_hash = p_payload->>'manifest_hash' limit 1;
  if manifest_id is null then
    insert into public.analyzer_evidence_manifests(request_id, manifest_version, manifest_hash, manifest)
    values (request_row.id, manifest_version, p_payload->>'manifest_hash', p_payload->'manifest') returning id into manifest_id;
  end if;
  expires_at := nullif(p_payload->>'freshness_expires_at','')::timestamptz;
  insert into public.analyzer_analyses(request_id, evidence_manifest_id, analysis_version, status, result, methodology_version, schema_version, score_engine_version, analysis_mode, freshness_class, freshness_expires_at, evidence_manifest_hash, identity)
  values (request_row.id, manifest_id, analysis_version, p_payload->>'status', jsonb_set(p_payload->'result', '{requestId}', to_jsonb(request_row.id::text), true), nullif(p_payload->>'methodology_version',''), p_payload->>'schema_version', nullif(p_payload->>'score_engine_version',''), p_payload->>'analysis_mode', p_payload->>'freshness_class', expires_at, p_payload->>'manifest_hash', p_payload->'identity') returning id into analysis_id;
  update public.analyzer_requests set status = 'ANALYZED' where id = request_row.id;
  return jsonb_build_object('status','CREATED','request_id',request_row.id,'analysis_id',analysis_id,'analysis_version',analysis_version,'result',jsonb_set(p_payload->'result', '{requestId}', to_jsonb(request_row.id::text), true));
end;
$$;

revoke all on function public.analyzer_assert_operator() from public, anon, authenticated, service_role;
revoke all on function public.analyzer_read_state() from public, anon, authenticated, service_role;
revoke all on function public.analyzer_submit_run(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.analyzer_record_provider_event(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.analyzer_record_cost_usage(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.analyzer_record_model_call(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.analyzer_read_state() to authenticated;
grant execute on function public.analyzer_submit_run(jsonb) to authenticated;
grant execute on function public.analyzer_record_provider_event(jsonb) to authenticated;
grant execute on function public.analyzer_record_cost_usage(jsonb) to authenticated;
grant execute on function public.analyzer_record_model_call(jsonb) to authenticated;

commit;
