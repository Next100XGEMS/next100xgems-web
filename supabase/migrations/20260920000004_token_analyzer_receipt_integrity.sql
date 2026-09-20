begin;

-- The fourth Analyzer migration makes the trusted boundary derive the
-- identity used for replay.  It intentionally leaves the earlier migrations
-- immutable and keeps all Analyzer tables private to named RPCs.
alter table public.analyzer_analyses
  add column if not exists evidence_revision integer,
  add column if not exists delivery_identity text;

update public.analyzer_analyses
set evidence_revision = coalesce(evidence_revision, 1),
    delivery_identity = coalesce(delivery_identity, evidence_manifest_hash)
where evidence_revision is null or delivery_identity is null;

alter table public.analyzer_analyses
  alter column evidence_revision set default 1,
  alter column evidence_revision set not null,
  alter column delivery_identity set not null;

alter table public.analyzer_analyses
  drop constraint if exists analyzer_analyses_evidence_revision_check,
  drop constraint if exists analyzer_analyses_delivery_identity_check;
alter table public.analyzer_analyses
  add constraint analyzer_analyses_evidence_revision_check check (evidence_revision > 0),
  add constraint analyzer_analyses_delivery_identity_check check (delivery_identity ~ '^[0-9a-f]{64}$');

create index if not exists analyzer_analyses_delivery_identity_idx
  on public.analyzer_analyses(request_id, delivery_identity, analysis_version);

-- Transport timestamps are deliberately excluded from a delivery identity;
-- observedAt remains part of the frozen evidence.  This lets a retried
-- application request rebuild its transport envelope while preserving the
-- same sealed delivery, without weakening the exact manifest hash stored on
-- the evidence row.
create or replace function public.analyzer_delivery_json(p_value jsonb)
returns jsonb
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  item record;
  result jsonb := '{}'::jsonb;
begin
  if jsonb_typeof(p_value) = 'object' then
    for item in select key, value from jsonb_each(p_value) loop
      if item.key not in ('capturedAt', 'createdAt') then
        result := result || jsonb_build_object(item.key, public.analyzer_delivery_json(item.value));
      end if;
    end loop;
    return result;
  elsif jsonb_typeof(p_value) = 'array' then
    select coalesce(jsonb_agg(public.analyzer_delivery_json(value)), '[]'::jsonb)
      into result
      from jsonb_array_elements(p_value) as values(value);
    return result;
  end if;
  return p_value;
end;
$$;

create or replace function public.analyzer_canonical_token_id(p_resolution jsonb)
returns text
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  chain text := p_resolution->>'chain';
  token text := p_resolution->>'tokenAddress';
  expected text;
begin
  if token is null or chain is null or chain = 'unknown' then return null; end if;
  if chain = 'solana' then
    expected := 'solana:' || token;
  elsif chain in ('ethereum', 'base', 'bnb') then
    if token !~* '^0x[0-9a-f]{40}$' or token <> lower(token) then return null; end if;
    expected := chain || ':' || lower(token);
  else
    return null;
  end if;
  return expected;
end;
$$;

create or replace function public.analyzer_assert_operator()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not ((select private.current_app_roles()) && array['owner','admin']::text[]) then
    raise exception 'Analyzer operation is not authorized' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.analyzer_submit_run(p_payload jsonb)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  requester uuid := auth.uid();
  fingerprint text := p_payload->>'fingerprint';
  operation text := coalesce(nullif(p_payload->>'operation',''), 'DELIVERY_RETRY');
  request_row public.analyzer_requests%rowtype;
  stored_resolution jsonb;
  existing_analysis public.analyzer_analyses%rowtype;
  delivery_analysis public.analyzer_analyses%rowtype;
  canonical_manifest jsonb;
  stored_manifest jsonb;
  canonical_manifest_hash text;
  delivery_key text;
  supplied_manifest_hash text := nullif(p_payload->>'manifest_hash','');
  manifest_version integer;
  analysis_version integer;
  manifest_id uuid;
  analysis_id uuid;
  expires_at timestamptz;
  is_new boolean := false;
  expected_token_id text;
begin
  perform public.analyzer_assert_operator();
  perform public.analyzer_assert_enabled();
  if jsonb_typeof(p_payload) <> 'object' or fingerprint is null or fingerprint !~ '^[0-9a-f]{64}$' then raise exception 'Analyzer request payload is invalid' using errcode = '22023'; end if;
  if operation not in ('DELIVERY_RETRY', 'FRESH_ANALYSIS', 'EXPLICIT_REANALYSIS') then raise exception 'Analyzer operation is invalid' using errcode = '22023'; end if;
  if operation = 'EXPLICIT_REANALYSIS' and length(btrim(coalesce(p_payload->>'reanalysis_reason',''))) = 0 then raise exception 'Explicit reanalysis requires a reason' using errcode = '22023'; end if;
  if jsonb_typeof(p_payload->'resolution') <> 'object' or jsonb_typeof(p_payload->'manifest') <> 'object' or jsonb_typeof(p_payload->'result') <> 'object' then raise exception 'Analyzer persistence payload is invalid' using errcode = '22023'; end if;
  if coalesce(length(p_payload->>'raw_input'), 0) not between 1 and 4096 then raise exception 'Analyzer input is invalid' using errcode = '22023'; end if;
  if p_payload->>'input_type' is distinct from p_payload->'resolution'->>'inputType' or p_payload->>'requested_chain' is distinct from p_payload->'resolution'->>'chain' then raise exception 'Analyzer request context is invalid' using errcode = '23P01'; end if;
  if p_payload->>'schema_version' <> 'token-analyzer-v1' or p_payload->'manifest'->>'schemaVersion' <> 'token-analyzer-v1' or p_payload->'result'->>'schemaVersion' <> 'token-analyzer-v1' or p_payload->'manifest'->>'manifestVersion' <> '1' then raise exception 'Analyzer schema version is not supported' using errcode = '23P01'; end if;
  if p_payload->'manifest'->>'methodologyVersion' is not null or p_payload->'result'->>'methodologyVersion' is not null or p_payload->>'methodology_version' is not null or p_payload->>'score_engine_version' is not null then raise exception 'Analyzer methodology is not active' using errcode = '23P01'; end if;
  expected_token_id := public.analyzer_canonical_token_id(p_payload->'resolution');
  if p_payload->'resolution'->>'canonicalTokenId' is distinct from expected_token_id then raise exception 'Analyzer canonical token identity is invalid' using errcode = '23P01'; end if;
  if p_payload->'manifest'->'resolvedToken' is distinct from p_payload->'resolution' or p_payload->'result'->'resolvedToken' is distinct from p_payload->'resolution' or p_payload->'result'->>'chain' is distinct from p_payload->'resolution'->>'chain' then raise exception 'Analyzer result identity is invalid' using errcode = '23P01'; end if;
  if p_payload->>'status' is distinct from p_payload->'result'->>'status' then raise exception 'Analyzer result status is invalid' using errcode = '23P01'; end if;
  if jsonb_typeof(p_payload->'result'->'score') <> 'object' or p_payload->'result'->'score'->>'status' is distinct from 'METHODOLOGY_NOT_ACTIVE' or jsonb_typeof(p_payload->'result'->'score'->'value') is distinct from 'null' or jsonb_typeof(p_payload->'result'->'score'->'components') <> 'object' or exists (select 1 from jsonb_each(p_payload->'result'->'score'->'components') component where component.value <> 'null'::jsonb) then raise exception 'Analyzer score is not inactive-safe' using errcode = '23P01'; end if;
  if jsonb_typeof(p_payload->'result'->'aiInterpretation') is distinct from 'object' or p_payload->'result'->'aiInterpretation'->>'status' is distinct from 'DISABLED' or jsonb_typeof(p_payload->'result'->'aiInterpretation'->'provider') is distinct from 'null' or jsonb_typeof(p_payload->'result'->'aiInterpretation'->'model') is distinct from 'null' or jsonb_typeof(p_payload->'result'->'aiInterpretation'->'content') is distinct from 'null' then raise exception 'Analyzer AI is disabled' using errcode = '23P01'; end if;
  if jsonb_typeof(p_payload->'manifest'->'observations') is distinct from 'array' or exists (select 1 from jsonb_array_elements(p_payload->'manifest'->'observations') as observation where observation->>'evidenceClass' = 'AI_INFERENCE') then raise exception 'Analyzer AI evidence is disabled' using errcode = '23P01'; end if;
  if jsonb_typeof(p_payload->'result'->'market') <> 'object' or p_payload->'result'->'market' <> '{}'::jsonb or jsonb_typeof(p_payload->'result'->'liquidity') <> 'object' or p_payload->'result'->'liquidity' <> '{}'::jsonb or jsonb_typeof(p_payload->'result'->'holders') <> 'object' or p_payload->'result'->'holders' <> '{}'::jsonb or jsonb_typeof(p_payload->'result'->'creator') <> 'object' or p_payload->'result'->'creator' <> '{}'::jsonb or jsonb_typeof(p_payload->'result'->'activity') <> 'object' or p_payload->'result'->'activity' <> '{}'::jsonb then raise exception 'Analyzer result contains unsupported authoritative data' using errcode = '23P01'; end if;
  if p_payload->'result'->'claimVerification' is distinct from p_payload->'manifest'->'claims' or p_payload->'result'->'providerConflicts' is distinct from p_payload->'manifest'->'providerConflicts' or p_payload->'result'->'unknowns' is distinct from p_payload->'manifest'->'missing' or p_payload->'result'->'citations' is distinct from p_payload->'manifest'->'resolvedToken'->'provenance' then raise exception 'Analyzer result evidence binding is invalid' using errcode = '23P01'; end if;
  if exists (select 1 from jsonb_array_elements(p_payload->'result'->'topTrades') as trade where not exists (select 1 from jsonb_array_elements(p_payload->'manifest'->'observations') as observation where observation->>'evidenceId' = trade->>'evidenceId')) then raise exception 'Analyzer trade result is not bound to evidence' using errcode = '23P01'; end if;
  if exists (select 1 from jsonb_array_elements(p_payload->'result'->'whyMoving') as reason where reason->>'classification' <> 'UNKNOWN' and jsonb_array_length(coalesce(reason->'evidenceRefs', '[]'::jsonb)) = 0) then raise exception 'Analyzer causal result is not bound to evidence' using errcode = '23P01'; end if;
  if exists (select 1 from jsonb_array_elements(p_payload->'result'->'riskFactors') as risk where risk->>'state' = 'PRESENT' and jsonb_array_length(coalesce(risk->'evidenceRefs', '[]'::jsonb)) = 0) then raise exception 'Analyzer risk result is not bound to evidence' using errcode = '23P01'; end if;

  canonical_manifest := (p_payload->'manifest') - 'manifestHash'::text;
  canonical_manifest_hash := encode(extensions.digest(convert_to(canonical_manifest::text, 'UTF8'), 'sha256'), 'hex');
  if supplied_manifest_hash is not null and supplied_manifest_hash <> canonical_manifest_hash then raise exception 'Analyzer manifest hash does not match canonical content' using errcode = '23P01'; end if;
  stored_manifest := jsonb_set(canonical_manifest, '{manifestHash}', to_jsonb(canonical_manifest_hash), true);
  delivery_key := encode(extensions.digest(convert_to(public.analyzer_delivery_json(canonical_manifest)::text, 'UTF8'), 'sha256'), 'hex');

  perform pg_advisory_xact_lock(hashtextextended(fingerprint, 0));
  select * into request_row from public.analyzer_requests where request_fingerprint = fingerprint for update;
  if request_row.id is not null then
    select resolution into stored_resolution from public.analyzer_resolutions where request_id = request_row.id;
    if request_row.raw_input is distinct from p_payload->>'raw_input' or request_row.input_type is distinct from p_payload->>'input_type' or request_row.requested_chain is distinct from nullif(p_payload->>'requested_chain','') or public.analyzer_delivery_json(stored_resolution) is distinct from public.analyzer_delivery_json(p_payload->'resolution') then raise exception 'Analyzer request context conflicts with the durable request' using errcode = '23P01'; end if;
    if operation = 'DELIVERY_RETRY' then
      select a.* into delivery_analysis from public.analyzer_analyses as a where a.request_id = request_row.id and a.delivery_identity = delivery_key order by a.analysis_version limit 1;
      if delivery_analysis.id is null then raise exception 'Analyzer delivery receipt does not match the sealed request' using errcode = '23P01'; end if;
      return jsonb_build_object('status','REPLAY','request_id',request_row.id,'analysis_id',delivery_analysis.id,'analysis_version',delivery_analysis.analysis_version,'manifest_hash',delivery_analysis.evidence_manifest_hash,'result',delivery_analysis.result);
    end if;
    select a.* into existing_analysis from public.analyzer_analyses as a where a.request_id = request_row.id order by a.analysis_version desc limit 1;
    manifest_version := coalesce((select max(m.manifest_version) from public.analyzer_evidence_manifests as m where m.request_id = request_row.id), 0) + 1;
    analysis_version := coalesce(existing_analysis.analysis_version, 0) + 1;
  else
    is_new := true;
    insert into public.analyzer_requests(requester_id, raw_input, input_type, requested_chain, request_fingerprint, status) values (requester, p_payload->>'raw_input', p_payload->>'input_type', nullif(p_payload->>'requested_chain',''), fingerprint, 'RECEIVED') returning * into request_row;
    manifest_version := 1;
    analysis_version := 1;
  end if;
  if is_new then insert into public.analyzer_resolutions(request_id, resolution) values (request_row.id, p_payload->'resolution'); end if;
  select m.id into manifest_id from public.analyzer_evidence_manifests as m where m.request_id = request_row.id and m.manifest_hash = canonical_manifest_hash limit 1;
  if manifest_id is null then insert into public.analyzer_evidence_manifests(request_id, manifest_version, manifest_hash, manifest) values (request_row.id, manifest_version, canonical_manifest_hash, stored_manifest) returning id into manifest_id; end if;
  expires_at := nullif(p_payload->>'freshness_expires_at','')::timestamptz;
  insert into public.analyzer_analyses(request_id, evidence_manifest_id, analysis_version, status, result, methodology_version, schema_version, score_engine_version, analysis_mode, freshness_class, freshness_expires_at, evidence_manifest_hash, identity, analysis_operation, reanalysis_reason, evidence_revision, delivery_identity)
  values (request_row.id, manifest_id, analysis_version, p_payload->>'status', jsonb_set(jsonb_set(p_payload->'result', '{requestId}', to_jsonb(request_row.id::text), true), '{analysisVersion}', to_jsonb(analysis_version), true), null, 'token-analyzer-v1', null, 'DETERMINISTIC', p_payload->>'freshness_class', expires_at, canonical_manifest_hash, jsonb_build_object('chain', p_payload->'resolution'->'chain', 'canonicalTokenId', expected_token_id, 'inputType', p_payload->'resolution'->'inputType', 'pairAddress', p_payload->'resolution'->'pairAddress', 'poolAddress', p_payload->'resolution'->'poolAddress', 'schemaVersion', 'token-analyzer-v1', 'methodologyVersion', null, 'scoreEngineVersion', null, 'analysisMode', 'DETERMINISTIC'), operation, nullif(btrim(p_payload->>'reanalysis_reason'),''), manifest_version, delivery_key) returning id into analysis_id;
  update public.analyzer_requests set status = 'ANALYZED' where id = request_row.id;
  return jsonb_build_object('status','CREATED','request_id',request_row.id,'analysis_id',analysis_id,'analysis_version',analysis_version,'manifest_hash',canonical_manifest_hash,'result',jsonb_set(jsonb_set(p_payload->'result', '{requestId}', to_jsonb(request_row.id::text), true), '{analysisVersion}', to_jsonb(analysis_version), true));
end;
$$;

revoke all on function public.analyzer_delivery_json(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.analyzer_canonical_token_id(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.analyzer_submit_run(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.analyzer_submit_run(jsonb) to authenticated;

commit;
