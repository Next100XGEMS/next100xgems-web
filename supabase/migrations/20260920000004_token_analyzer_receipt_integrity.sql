begin;

alter table public.analyzer_analyses
  add column if not exists evidence_revision integer,
  add column if not exists delivery_identity text;

create table if not exists public.analyzer_deliveries (
  delivery_key text primary key check (length(btrim(delivery_key)) between 1 and 128),
  request_id uuid not null references public.analyzer_requests(id) on delete restrict,
  analysis_id uuid not null unique references public.analyzer_analyses(id) on delete restrict,
  evidence_manifest_id uuid not null references public.analyzer_evidence_manifests(id) on delete restrict,
  analysis_version integer not null check (analysis_version > 0),
  operation text not null check (operation in ('DELIVERY_RETRY', 'FRESH_ANALYSIS', 'EXPLICIT_REANALYSIS')),
  manifest_hash text not null check (manifest_hash ~ '^[0-9a-f]{64}$'),
  reanalysis_reason text,
  created_at timestamptz not null default now(),
  sealed_at timestamptz not null default now()
);

alter table public.analyzer_analyses disable trigger analyzer_analyses_no_mutation;
update public.analyzer_analyses as a
set evidence_revision = coalesce(a.evidence_revision, m.manifest_version, 1),
    delivery_identity = coalesce(nullif(a.delivery_identity, ''), encode(extensions.digest(convert_to(a.id::text || ':' || encode(extensions.digest(convert_to(a.id::text, 'UTF8'), 'sha256'), 'hex'), 'UTF8'), 'sha256'), 'hex'))
from public.analyzer_evidence_manifests as m
where m.id = a.evidence_manifest_id
  and (a.evidence_revision is null or a.delivery_identity is null or a.delivery_identity = '');
update public.analyzer_analyses as a
set evidence_revision = coalesce(a.evidence_revision, 1),
    delivery_identity = coalesce(nullif(a.delivery_identity, ''), encode(extensions.digest(convert_to(a.id::text || ':' || encode(extensions.digest(convert_to(a.id::text, 'UTF8'), 'sha256'), 'hex'), 'UTF8'), 'sha256'), 'hex'))
where a.evidence_revision is null or a.delivery_identity is null or a.delivery_identity = '';
insert into public.analyzer_deliveries(delivery_key, request_id, analysis_id, evidence_manifest_id, analysis_version, operation, manifest_hash, reanalysis_reason, created_at, sealed_at)
select encode(extensions.digest(convert_to(a.id::text || ':' || coalesce(a.delivery_identity, ''), 'UTF8'), 'sha256'), 'hex'), a.request_id, a.id, a.evidence_manifest_id, a.analysis_version, a.analysis_operation, a.evidence_manifest_hash, a.reanalysis_reason, a.created_at, a.created_at
from public.analyzer_analyses as a
on conflict (analysis_id) do nothing;
alter table public.analyzer_analyses enable trigger analyzer_analyses_no_mutation;

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
create index if not exists analyzer_analyses_delivery_identity_idx on public.analyzer_analyses(request_id, delivery_identity, analysis_version);
create index if not exists analyzer_deliveries_request_version_idx on public.analyzer_deliveries(request_id, analysis_version);
alter table public.analyzer_deliveries enable row level security;
revoke all on table public.analyzer_deliveries from public, anon, authenticated, service_role;

create or replace function public.reject_analyzer_delivery_mutation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'Analyzer delivery receipts are append-only' using errcode = '55000';
end;
$$;
drop trigger if exists analyzer_deliveries_no_mutation on public.analyzer_deliveries;
create trigger analyzer_deliveries_no_mutation before update or delete on public.analyzer_deliveries for each row execute function public.reject_analyzer_delivery_mutation();

create or replace function public.analyzer_delivery_json(p_value jsonb)
returns jsonb language plpgsql immutable security definer set search_path = '' as $$
declare item record; result jsonb := '{}'::jsonb;
begin
  if jsonb_typeof(p_value) = 'object' then
    for item in select key, value from jsonb_each(p_value) loop
      if item.key not in ('capturedAt', 'createdAt') then result := result || jsonb_build_object(item.key, public.analyzer_delivery_json(item.value)); end if;
    end loop;
    return result;
  elsif jsonb_typeof(p_value) = 'array' then
    select coalesce(jsonb_agg(public.analyzer_delivery_json(value)), '[]'::jsonb) into result from jsonb_array_elements(p_value) as values(value);
    return result;
  end if;
  return p_value;
end;
$$;

create or replace function public.analyzer_is_solana_address(p_value text)
returns boolean language plpgsql immutable security definer set search_path = '' as $$
declare alphabet constant text := '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'; number_value numeric := 0; byte_count integer := 0; leading_count integer := 0; position integer; index integer;
begin
  if p_value is null or p_value !~ '^[1-9A-HJ-NP-Za-km-z]+$' or length(p_value) not between 32 and 44 then return false; end if;
  for index in 1..length(p_value) loop
    position := strpos(alphabet, substr(p_value, index, 1)) - 1;
    if position < 0 then return false; end if;
    number_value := number_value * 58 + position;
  end loop;
  while number_value >= 1 loop number_value := trunc(number_value / 256); byte_count := byte_count + 1; end loop;
  while leading_count < length(p_value) and substr(p_value, leading_count + 1, 1) = '1' loop leading_count := leading_count + 1; end loop;
  return byte_count + leading_count = 32;
end;
$$;

create or replace function public.analyzer_canonical_token_id(p_resolution jsonb)
returns text language plpgsql immutable security definer set search_path = '' as $$
declare chain text := p_resolution->>'chain'; token text := p_resolution->>'tokenAddress';
begin
  if token is null or chain is null then return null; end if;
  if chain = 'solana' then
    if not public.analyzer_is_solana_address(token) then return null; end if;
  elsif chain in ('ethereum', 'base', 'bnb') then
    if token !~ '^0x[0-9a-f]{40}$' or token <> lower(token) then return null; end if;
  else return null;
  end if;
  return chain || ':' || token;
end;
$$;

create or replace function public.analyzer_assert_operator()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not ((select private.current_app_roles()) && array['owner','admin']::text[]) then raise exception 'Analyzer operation is not authorized' using errcode = '42501'; end if;
end;
$$;

create or replace function public.analyzer_assert_evidence_refs(p_result jsonb, p_manifest jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare conclusion jsonb; reference text; observation jsonb;
begin
  if jsonb_typeof(p_result->'claimVerification') is distinct from 'array' then raise exception 'Analyzer claims are invalid' using errcode = '23P01'; end if;
  for conclusion in select value from jsonb_array_elements(p_result->'claimVerification') as values(value) loop
    if conclusion->>'verification' in ('SUPPORTED', 'PARTIALLY_SUPPORTED') and (jsonb_array_length(coalesce(conclusion->'evidenceRefs', '[]'::jsonb)) = 0 or nullif(btrim(conclusion->>'identity'), '') is null) then raise exception 'Analyzer claim lacks eligible evidence identity' using errcode = '23P01'; end if;
    for reference in select value from jsonb_array_elements_text(coalesce(conclusion->'evidenceRefs', '[]'::jsonb)) as refs(value) loop
      select value into observation from jsonb_array_elements(coalesce(p_manifest->'observations', '[]'::jsonb)) as values(value) where value->>'evidenceId' = reference;
      if observation is null or observation->>'state' <> 'AVAILABLE' or observation->>'key' is distinct from conclusion->>'field' or observation->>'source' is distinct from conclusion->>'source' or observation->>'evidenceClass' is distinct from conclusion->>'evidenceType' or observation->>'identity' is null or conclusion->>'identity' is distinct from observation->>'identity' or observation->'value' is distinct from conclusion->'value' or not exists (select 1 from jsonb_array_elements(coalesce(observation->'provenance', '[]'::jsonb)) as provenance(value) where value->>'source' = conclusion->>'source' and nullif(btrim(value->>'reference'), '') is not null and value->>'reference' in (observation->>'identity', observation->>'evidenceId') and (conclusion->>'evidenceType' <> 'VERIFIED_DATA' or value->>'kind' in ('DIRECT_CHAIN', 'OBJECTIVE_PROVIDER'))) then raise exception 'Analyzer claim evidence is not bound to an eligible observation' using errcode = '23P01'; end if;
    end loop;
  end loop;
  for conclusion in select value from jsonb_array_elements(coalesce(p_result->'whyMoving', '[]'::jsonb)) as values(value) loop
    if conclusion->>'classification' <> 'UNKNOWN' then
      if jsonb_array_length(coalesce(conclusion->'evidenceRefs', '[]'::jsonb)) = 0 then raise exception 'Analyzer explanation lacks evidence' using errcode = '23P01'; end if;
      for reference in select value from jsonb_array_elements_text(conclusion->'evidenceRefs') as refs(value) loop
        select value into observation from jsonb_array_elements(coalesce(p_manifest->'observations', '[]'::jsonb)) as values(value) where value->>'evidenceId' = reference;
        if observation is null or observation->>'state' <> 'AVAILABLE' or (conclusion->>'classification' <> 'UNKNOWN' and observation->>'evidenceClass' is distinct from conclusion->>'classification') then raise exception 'Analyzer explanation references incompatible evidence' using errcode = '23P01'; end if;
      end loop;
    end if;
  end loop;
  for conclusion in select value from jsonb_array_elements(coalesce(p_result->'riskFactors', '[]'::jsonb)) as values(value) loop
    if conclusion->>'state' = 'PRESENT' then
      if jsonb_array_length(coalesce(conclusion->'evidenceRefs', '[]'::jsonb)) = 0 then raise exception 'Analyzer risk factor lacks evidence' using errcode = '23P01'; end if;
      for reference in select value from jsonb_array_elements_text(conclusion->'evidenceRefs') as refs(value) loop
        select value into observation from jsonb_array_elements(coalesce(p_manifest->'observations', '[]'::jsonb)) as values(value) where value->>'evidenceId' = reference;
        if observation is null or observation->>'state' <> 'AVAILABLE' then raise exception 'Analyzer risk factor references unavailable evidence' using errcode = '23P01'; end if;
      end loop;
    end if;
  end loop;
  for conclusion in select value from jsonb_array_elements(coalesce(p_result->'topTrades', '[]'::jsonb)) as values(value) loop
    select value into observation from jsonb_array_elements(coalesce(p_manifest->'observations', '[]'::jsonb)) as values(value) where value->>'evidenceId' = conclusion->>'evidenceId';
    if observation is null or observation->>'state' <> 'AVAILABLE' or observation->>'key' not like 'trade%' or observation is distinct from conclusion then raise exception 'Analyzer trade is not exactly bound to eligible evidence' using errcode = '23P01'; end if;
  end loop;
end;
$$;

create or replace function public.analyzer_assert_operator_payload(p_payload jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare resolution jsonb := p_payload->'resolution'; manifest jsonb := p_payload->'manifest'; result jsonb := p_payload->'result'; expected_token_id text; raw_input text := btrim(p_payload->>'raw_input'); section text;
begin
  if jsonb_typeof(p_payload) <> 'object' or jsonb_typeof(resolution) <> 'object' or jsonb_typeof(manifest) <> 'object' or jsonb_typeof(result) <> 'object' or coalesce(length(raw_input), 0) not between 1 and 4096 then raise exception 'Analyzer persistence payload is invalid' using errcode = '22023'; end if;
  if nullif(btrim(p_payload->>'input_type'), '') is null or nullif(btrim(resolution->>'inputType'), '') is null or nullif(btrim(resolution->>'chain'), '') is null or p_payload->>'input_type' is distinct from resolution->>'inputType' or p_payload->>'requested_chain' is distinct from resolution->>'chain' then raise exception 'Analyzer request context is invalid' using errcode = '23P01'; end if;
  if p_payload->>'schema_version' is distinct from 'token-analyzer-v1' or manifest->>'schemaVersion' is distinct from 'token-analyzer-v1' or manifest->>'manifestFormatVersion' is distinct from '1' or manifest->>'evidenceRevision' !~ '^[1-9][0-9]*$' or manifest->>'evidenceRevision' is distinct from '1' or result->>'schemaVersion' is distinct from 'token-analyzer-v1' then raise exception 'Analyzer schema version is not supported' using errcode = '23P01'; end if;
  if manifest->>'methodologyVersion' is distinct from null or result->>'methodologyVersion' is distinct from null or p_payload->>'methodology_version' is distinct from null or p_payload->>'score_engine_version' is distinct from null or result->'score'->>'methodologyVersion' is distinct from null then raise exception 'Analyzer methodology is not active' using errcode = '23P01'; end if;
  expected_token_id := public.analyzer_canonical_token_id(resolution);
  if resolution->>'canonicalTokenId' is distinct from expected_token_id then raise exception 'Analyzer canonical token identity is invalid' using errcode = '23P01'; end if;
  if p_payload->>'input_type' in ('CONTRACT_ADDRESS', 'TOKEN_MINT') then
    if expected_token_id is null or resolution->>'tokenAddress' is null then raise exception 'Analyzer direct input identity is unresolved' using errcode = '23P01'; end if;
    if resolution->>'chain' = 'solana' and raw_input is distinct from resolution->>'tokenAddress' then raise exception 'Analyzer Solana input identity is invalid' using errcode = '23P01'; end if;
    if resolution->>'chain' in ('ethereum', 'base', 'bnb') and lower(raw_input) is distinct from resolution->>'tokenAddress' then raise exception 'Analyzer EVM input identity is invalid' using errcode = '23P01'; end if;
  end if;
  if not (resolution ? 'pairAddress') or not (resolution ? 'poolAddress') or manifest->'resolvedToken' is distinct from resolution or result->'resolvedToken' is distinct from resolution or result->>'chain' is distinct from resolution->>'chain' or jsonb_typeof(result->'pair') is distinct from 'object' or not (result->'pair' ? 'address') or not (result->'pair' ? 'pool') or result->'pair'->>'address' is distinct from resolution->>'pairAddress' or result->'pair'->>'pool' is distinct from resolution->>'poolAddress' then raise exception 'Analyzer result identity is invalid' using errcode = '23P01'; end if;
  if jsonb_typeof(p_payload->'identity') is distinct from 'object' or p_payload->'identity'->>'chain' is distinct from resolution->>'chain' or p_payload->'identity'->>'canonicalTokenId' is distinct from expected_token_id or p_payload->'identity'->>'inputType' is distinct from resolution->>'inputType' or p_payload->'identity'->>'pairAddress' is distinct from resolution->>'pairAddress' or p_payload->'identity'->>'poolAddress' is distinct from resolution->>'poolAddress' or p_payload->'identity'->>'schemaVersion' is distinct from 'token-analyzer-v1' or p_payload->'identity'->>'methodologyVersion' is distinct from null or p_payload->'identity'->>'scoreEngineVersion' is distinct from null or p_payload->'identity'->>'analysisMode' is distinct from 'DETERMINISTIC' then raise exception 'Analyzer authoritative identity is invalid' using errcode = '23P01'; end if;
  if p_payload->>'status' is distinct from result->>'status' then raise exception 'Analyzer result status is invalid' using errcode = '23P01'; end if;
  if jsonb_typeof(result->'score') is distinct from 'object' or result->'score'->>'status' is distinct from 'METHODOLOGY_NOT_ACTIVE' or jsonb_typeof(result->'score'->'value') is distinct from 'null' or jsonb_typeof(result->'score'->'components') is distinct from 'object' or exists (select 1 from jsonb_each(result->'score'->'components') as components(component_key, component_value) where components.component_value <> 'null'::jsonb) then raise exception 'Analyzer score is not inactive-safe' using errcode = '23P01'; end if;
  if jsonb_typeof(result->'aiInterpretation') is distinct from 'object' or result->'aiInterpretation'->>'status' is distinct from 'DISABLED' or jsonb_typeof(result->'aiInterpretation'->'provider') is distinct from 'null' or jsonb_typeof(result->'aiInterpretation'->'model') is distinct from 'null' or jsonb_typeof(result->'aiInterpretation'->'content') is distinct from 'null' then raise exception 'Analyzer AI is disabled' using errcode = '23P01'; end if;
  if jsonb_typeof(manifest->'observations') is distinct from 'array' or exists (select 1 from jsonb_array_elements(manifest->'observations') as observations(value) where observations.value->>'evidenceClass' = 'AI_INFERENCE') then raise exception 'Analyzer AI evidence is disabled' using errcode = '23P01'; end if;
  foreach section in array array['market','liquidity','holders','creator','activity'] loop
    if jsonb_extract_path(result, section) <> '{}'::jsonb and not (jsonb_typeof(jsonb_extract_path(result, section)) = 'object' and (select count(*) from jsonb_object_keys(jsonb_extract_path(result, section))) = 1 and coalesce(jsonb_extract_path_text(result, section, 'state') in ('UNKNOWN','UNAVAILABLE'), false)) then raise exception 'Analyzer result contains unsupported authoritative data' using errcode = '23P01'; end if;
  end loop;
  if result->'claimVerification' is distinct from manifest->'claims' or result->'providerConflicts' is distinct from manifest->'providerConflicts' or result->'unknowns' is distinct from manifest->'missing' or result->'citations' is distinct from manifest->'resolvedToken'->'provenance' then raise exception 'Analyzer result evidence binding is invalid' using errcode = '23P01'; end if;
  perform public.analyzer_assert_evidence_refs(result, manifest);
  if result->>'evidenceManifestHash' is not null and result->>'evidenceManifestHash' <> encode(extensions.digest(convert_to((manifest - 'manifestHash'::text)::text, 'UTF8'), 'sha256'), 'hex') then raise exception 'Analyzer result manifest hash is invalid' using errcode = '23P01'; end if;
  if result->>'evidenceRevision' is not null and (result->>'evidenceRevision' !~ '^[1-9][0-9]*$' or result->>'evidenceRevision' <> '1') then raise exception 'Analyzer result evidence revision is invalid' using errcode = '23P01'; end if;
end;
$$;

create or replace function public.analyzer_submit_run(p_payload jsonb)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare requester uuid := auth.uid(); fingerprint text := p_payload->>'fingerprint'; operation text := coalesce(nullif(p_payload->>'operation',''), 'DELIVERY_RETRY'); supplied_delivery_key text := nullif(btrim(p_payload->>'delivery_id'), ''); computed_delivery_key text; request_row public.analyzer_requests%rowtype; stored_resolution jsonb; existing_analysis public.analyzer_analyses%rowtype; delivery_row public.analyzer_deliveries%rowtype; canonical_manifest jsonb; input_manifest jsonb; stored_manifest jsonb; input_manifest_hash text; canonical_manifest_hash text; manifest_version integer; analysis_version integer; manifest_id uuid; analysis_id uuid; expires_at timestamptz; is_new boolean := false; expected_token_id text; stored_result jsonb;
begin
  perform public.analyzer_assert_operator(); perform public.analyzer_assert_enabled();
  if jsonb_typeof(p_payload) <> 'object' or fingerprint is null or fingerprint !~ '^[0-9a-f]{64}$' then raise exception 'Analyzer request payload is invalid' using errcode = '22023'; end if;
  if operation not in ('DELIVERY_RETRY', 'FRESH_ANALYSIS', 'EXPLICIT_REANALYSIS') then raise exception 'Analyzer operation is invalid' using errcode = '22023'; end if;
  if supplied_delivery_key is not null and supplied_delivery_key !~ '^[0-9a-f]{64}$' then raise exception 'Analyzer delivery key is invalid' using errcode = '22023'; end if;
  if operation = 'EXPLICIT_REANALYSIS' and length(btrim(coalesce(p_payload->>'reanalysis_reason',''))) = 0 then raise exception 'Explicit reanalysis requires a reason' using errcode = '22023'; end if;
  perform public.analyzer_assert_operator_payload(p_payload);
  input_manifest := (p_payload->'manifest') - 'manifestHash'::text;
  input_manifest_hash := encode(extensions.digest(convert_to(input_manifest::text, 'UTF8'), 'sha256'), 'hex');
  if nullif(p_payload->>'manifest_hash','') is not null and p_payload->>'manifest_hash' <> input_manifest_hash then raise exception 'Analyzer manifest hash does not match canonical content' using errcode = '23P01'; end if;
  expected_token_id := public.analyzer_canonical_token_id(p_payload->'resolution');
  computed_delivery_key := coalesce(supplied_delivery_key, encode(extensions.digest(convert_to(fingerprint || ':' || operation, 'UTF8'), 'sha256'), 'hex'));
  perform pg_advisory_xact_lock(hashtextextended(fingerprint, 0));
  select * into request_row from public.analyzer_requests where request_fingerprint = fingerprint for update;
  if request_row.id is not null then
    select resolution into stored_resolution from public.analyzer_resolutions where request_id = request_row.id;
    if request_row.raw_input is distinct from p_payload->>'raw_input' or request_row.input_type is distinct from p_payload->>'input_type' or request_row.requested_chain is distinct from nullif(p_payload->>'requested_chain','') or public.analyzer_delivery_json(stored_resolution) is distinct from public.analyzer_delivery_json(p_payload->'resolution') then raise exception 'Analyzer request context conflicts with the durable request' using errcode = '23P01'; end if;
    select * into delivery_row from public.analyzer_deliveries as d where d.delivery_key = computed_delivery_key and d.request_id = request_row.id;
    if delivery_row.delivery_key is not null then
      if supplied_delivery_key is null and operation <> 'DELIVERY_RETRY' then raise exception 'Analyzer delivery identity is reserved for its original operation' using errcode = '23P01'; end if;
      if delivery_row.manifest_hash <> input_manifest_hash then
        select manifest into stored_manifest from public.analyzer_evidence_manifests where id = delivery_row.evidence_manifest_id;
        if supplied_delivery_key is null or public.analyzer_delivery_json(stored_manifest - 'manifestHash'::text - 'evidenceRevision'::text) is distinct from public.analyzer_delivery_json(input_manifest - 'evidenceRevision'::text) then raise exception 'Analyzer delivery context conflicts with its sealed receipt' using errcode = '23P01'; end if;
      end if;
      select result into stored_result from public.analyzer_analyses where id = delivery_row.analysis_id;
      return jsonb_build_object('status','REPLAY','request_id',request_row.id,'analysis_id',delivery_row.analysis_id,'analysis_version',delivery_row.analysis_version,'manifest_hash',delivery_row.manifest_hash,'delivery_key',delivery_row.delivery_key,'result',stored_result);
    end if;
    if operation = 'DELIVERY_RETRY' then raise exception 'Analyzer delivery receipt does not match the sealed request' using errcode = '23P01'; end if;
    select a.* into existing_analysis from public.analyzer_analyses as a where a.request_id = request_row.id order by a.analysis_version desc limit 1;
    analysis_version := coalesce(existing_analysis.analysis_version, 0) + 1;
  else
    is_new := true; analysis_version := 1;
    insert into public.analyzer_requests(requester_id, raw_input, input_type, requested_chain, request_fingerprint, status) values (requester, p_payload->>'raw_input', p_payload->>'input_type', nullif(p_payload->>'requested_chain',''), fingerprint, 'RECEIVED') returning * into request_row;
  end if;
  select m.id, m.manifest_version, m.manifest_hash, m.manifest into manifest_id, manifest_version, canonical_manifest_hash, stored_manifest
  from public.analyzer_evidence_manifests as m
  where m.request_id = request_row.id
    and (m.manifest - 'manifestHash'::text - 'evidenceRevision'::text) = (input_manifest - 'evidenceRevision'::text)
  order by m.manifest_version desc limit 1;
  if manifest_id is null then
    manifest_version := coalesce((select max(m.manifest_version) from public.analyzer_evidence_manifests as m where m.request_id = request_row.id), 0) + 1;
    canonical_manifest := jsonb_set(input_manifest, '{evidenceRevision}', to_jsonb(manifest_version), true);
    canonical_manifest_hash := encode(extensions.digest(convert_to(canonical_manifest::text, 'UTF8'), 'sha256'), 'hex');
    stored_manifest := jsonb_set(canonical_manifest, '{manifestHash}', to_jsonb(canonical_manifest_hash), true);
  else
    canonical_manifest := stored_manifest - 'manifestHash'::text;
  end if;
  if is_new then insert into public.analyzer_resolutions(request_id, resolution) values (request_row.id, p_payload->'resolution'); end if;
  if manifest_id is null then insert into public.analyzer_evidence_manifests(request_id, manifest_version, manifest_hash, manifest) values (request_row.id, manifest_version, canonical_manifest_hash, stored_manifest) returning id into manifest_id; end if;
  if p_payload->'result'->>'analysisVersion' is not null and (p_payload->'result'->>'analysisVersion')::integer <> analysis_version then raise exception 'Analyzer result analysis version is inconsistent' using errcode = '23P01'; end if;
  expires_at := nullif(p_payload->>'freshness_expires_at','')::timestamptz;
  insert into public.analyzer_analyses(request_id, evidence_manifest_id, analysis_version, status, result, methodology_version, schema_version, score_engine_version, analysis_mode, freshness_class, freshness_expires_at, evidence_manifest_hash, identity, analysis_operation, reanalysis_reason, evidence_revision, delivery_identity) values (request_row.id, manifest_id, analysis_version, p_payload->>'status', jsonb_set(jsonb_set(jsonb_set(jsonb_set(p_payload->'result', '{requestId}', to_jsonb(request_row.id::text), true), '{analysisVersion}', to_jsonb(analysis_version), true), '{evidenceManifestHash}', to_jsonb(canonical_manifest_hash), true), '{evidenceRevision}', to_jsonb(manifest_version), true), null, 'token-analyzer-v1', null, 'DETERMINISTIC', p_payload->>'freshness_class', expires_at, canonical_manifest_hash, jsonb_build_object('chain', p_payload->'resolution'->'chain', 'canonicalTokenId', expected_token_id, 'inputType', p_payload->'resolution'->'inputType', 'pairAddress', p_payload->'resolution'->'pairAddress', 'poolAddress', p_payload->'resolution'->'poolAddress', 'schemaVersion', 'token-analyzer-v1', 'methodologyVersion', null, 'scoreEngineVersion', null, 'analysisMode', 'DETERMINISTIC'), operation, nullif(btrim(p_payload->>'reanalysis_reason'), ''), manifest_version, computed_delivery_key) returning id into analysis_id;
  insert into public.analyzer_deliveries(delivery_key, request_id, analysis_id, evidence_manifest_id, analysis_version, operation, manifest_hash, reanalysis_reason) values (computed_delivery_key, request_row.id, analysis_id, manifest_id, analysis_version, operation, canonical_manifest_hash, nullif(btrim(p_payload->>'reanalysis_reason'), ''));
  update public.analyzer_requests set status = 'ANALYZED' where id = request_row.id;
  return jsonb_build_object('status','CREATED','request_id',request_row.id,'analysis_id',analysis_id,'analysis_version',analysis_version,'manifest_hash',canonical_manifest_hash,'delivery_key',computed_delivery_key,'result',jsonb_set(jsonb_set(jsonb_set(jsonb_set(p_payload->'result', '{requestId}', to_jsonb(request_row.id::text), true), '{analysisVersion}', to_jsonb(analysis_version), true), '{evidenceManifestHash}', to_jsonb(canonical_manifest_hash), true), '{evidenceRevision}', to_jsonb(manifest_version), true));
end;
$$;

create or replace function public.analyzer_get_delivery_receipt(p_delivery_key text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare delivery public.analyzer_deliveries%rowtype; result jsonb;
begin perform public.analyzer_assert_operator(); select * into delivery from public.analyzer_deliveries where delivery_key = p_delivery_key; if delivery.delivery_key is null then raise exception 'Analyzer delivery receipt was not found' using errcode = '23P01'; end if; select a.result into result from public.analyzer_analyses a where a.id = delivery.analysis_id; return jsonb_build_object('delivery_key',delivery.delivery_key,'request_id',delivery.request_id,'analysis_id',delivery.analysis_id,'analysis_version',delivery.analysis_version,'manifest_hash',delivery.manifest_hash,'result',result); end;
$$;

create or replace function public.analyzer_get_analysis_by_version(p_request_id uuid, p_analysis_version integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare analysis public.analyzer_analyses%rowtype;
begin perform public.analyzer_assert_operator(); select * into analysis from public.analyzer_analyses where request_id = p_request_id and analysis_version = p_analysis_version; if analysis.id is null then raise exception 'Analyzer analysis version was not found' using errcode = '23P01'; end if; return jsonb_build_object('analysis_id',analysis.id,'request_id',analysis.request_id,'analysis_version',analysis.analysis_version,'manifest_hash',analysis.evidence_manifest_hash,'evidence_revision',analysis.evidence_revision,'delivery_key',analysis.delivery_identity,'result',analysis.result); end;
$$;

create or replace function public.analyzer_get_latest_analysis(p_request_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare analysis public.analyzer_analyses%rowtype;
begin perform public.analyzer_assert_operator(); select * into analysis from public.analyzer_analyses where request_id = p_request_id order by analysis_version desc limit 1; if analysis.id is null then raise exception 'Analyzer analysis was not found' using errcode = '23P01'; end if; return jsonb_build_object('analysis_id',analysis.id,'request_id',analysis.request_id,'analysis_version',analysis.analysis_version,'manifest_hash',analysis.evidence_manifest_hash,'evidence_revision',analysis.evidence_revision,'delivery_key',analysis.delivery_identity,'result',analysis.result); end;
$$;

revoke all on function public.reject_analyzer_delivery_mutation() from public, anon, authenticated, service_role;
revoke all on function public.analyzer_delivery_json(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.analyzer_is_solana_address(text) from public, anon, authenticated, service_role;
revoke all on function public.analyzer_canonical_token_id(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.analyzer_assert_evidence_refs(jsonb, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.analyzer_assert_operator_payload(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.analyzer_submit_run(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.analyzer_get_delivery_receipt(text) from public, anon, authenticated, service_role;
revoke all on function public.analyzer_get_analysis_by_version(uuid, integer) from public, anon, authenticated, service_role;
revoke all on function public.analyzer_get_latest_analysis(uuid) from public, anon, authenticated, service_role;
grant execute on function public.analyzer_submit_run(jsonb) to authenticated;
grant execute on function public.analyzer_get_delivery_receipt(text) to authenticated;
grant execute on function public.analyzer_get_analysis_by_version(uuid, integer) to authenticated;
grant execute on function public.analyzer_get_latest_analysis(uuid) to authenticated;

commit;
