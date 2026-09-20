begin;

-- Provider resolution is a server attestation, not caller-supplied JSON.
alter function public.analyzer_contract_registry() rename to analyzer_contract_registry_pre_attestation;
create function public.analyzer_contract_registry()
returns jsonb language sql immutable security definer set search_path='' as $$
  select jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(public.analyzer_contract_registry_pre_attestation(), '{schemas,resolution,properties,resolutionReceiptId}', '{"type":"string","pattern":"^[0-9a-fA-F-]{36}$"}'::jsonb),
          '{schemas,resolution,properties,resolvedBaseToken}', '{"type":"string","minLength":1}'::jsonb),
        '{schemas,resolution,properties,resolvedQuoteToken}', '{"type":"string","minLength":1}'::jsonb),
      '{schemas,resolution,properties,trustedPoolIds}', '{"type":"array","items":{"type":"string","minLength":1},"maxItems":100}'::jsonb),
    '{schemas,resolution,optional}', '["pairProof","resolutionReceiptId","resolvedBaseToken","resolvedQuoteToken","trustedPoolIds"]'::jsonb)
$$;

create table public.analyzer_resolution_receipts (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.analyzer_requests(id) on delete restrict,
  input_fingerprint text not null check (input_fingerprint ~ '^[0-9a-f]{64}$'),
  normalized_input jsonb not null,
  provider text not null check (length(btrim(provider)) between 1 and 128),
  capability text not null check (length(btrim(capability)) between 1 and 128),
  chain text not null check (chain in ('solana','ethereum','base','bnb')),
  pair_address text,
  pool_address text,
  base_token text not null,
  quote_token text,
  canonical_token text not null,
  provider_response_fingerprint text not null check (provider_response_fingerprint ~ '^[0-9a-f]{64}$'),
  collector_version text not null check (collector_version = 'token-analyzer-live-collector-v2'),
  schema_version text not null check (schema_version = 'token-analyzer-resolution-v1'),
  resolution jsonb not null,
  provenance_kind text not null check (provenance_kind in ('DIRECT_CHAIN','OBJECTIVE_PROVIDER')),
  observed_at timestamptz not null,
  collected_at timestamptz not null default now(),
  unique(request_id, input_fingerprint)
);
alter table public.analyzer_resolution_receipts enable row level security;
revoke all on table public.analyzer_resolution_receipts from public, anon, authenticated, service_role;
create trigger analyzer_resolution_receipts_no_mutation before update or delete on public.analyzer_resolution_receipts for each row execute function public.reject_immutable_change();

create or replace function public.analyzer_validate_resolution_receipt(p_receipt_id uuid,p_request_id uuid,p_resolution jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare receipt public.analyzer_resolution_receipts%rowtype;
begin
 select * into receipt from public.analyzer_resolution_receipts where id=p_receipt_id and request_id=p_request_id;
 perform public.analyzer_require(receipt.id is not null,'Resolution receipt is not valid for this request');
 perform public.analyzer_require(p_resolution->>'resolutionReceiptId'=receipt.id::text,'Resolution receipt identity mismatch');
 perform public.analyzer_require((p_resolution-'resolutionReceiptId')=(receipt.resolution-'resolutionReceiptId'),'Resolution differs from trusted receipt');
end;
$$;

create or replace function public.analyzer_attest_resolution(p_delivery_key text,p_input jsonb,p_resolution jsonb,p_provider_response_fingerprint text,p_collector_version text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare delivery_row public.analyzer_delivery_intents%rowtype; request_row public.analyzer_requests%rowtype; existing public.analyzer_resolution_receipts%rowtype; url_identity jsonb; fingerprint text; provider_name text; capability_name text; provenance_kind text; stored jsonb; receipt_id uuid; quote_token text; attested_request_id uuid;
begin
 perform public.analyzer_require(current_setting('role', true)='service_role','Trusted resolution requires server authority');
 perform public.analyzer_assert_enabled();
 select * into delivery_row from public.analyzer_delivery_intents where delivery_key=p_delivery_key for update;
 perform public.analyzer_require(delivery_row.delivery_key is not null,'Analyzer delivery not found');
 attested_request_id:=delivery_row.request_id;
 select * into request_row from public.analyzer_requests where id=attested_request_id for update;
 perform public.analyzer_require(request_row.id is not null,'Analyzer request not found');
 perform public.analyzer_require(request_row.raw_input=btrim(p_input->>'raw') and delivery_row.input=p_input,'Resolution input mismatch');
 perform public.analyzer_require(p_input->>'hintChain' is null or p_input->>'hintChain'=request_row.requested_chain,'Resolution chain hint mismatch');
 perform public.analyzer_require(p_provider_response_fingerprint ~ '^[0-9a-f]{64}$','Invalid provider response fingerprint');
 perform public.analyzer_require(p_collector_version='token-analyzer-live-collector-v2','Unsupported collector version');
 perform public.analyzer_require(not (p_resolution ? 'resolutionReceiptId') and not (p_resolution ? 'pairProof'),'Resolution attestation must be fresh');
 perform public.analyzer_require(p_resolution->>'canonicalTokenId' is not null and p_resolution->>'canonicalTokenId'=public.analyzer_canonical_token_id(p_resolution),'Canonical resolution identity invalid');
 if p_resolution->>'inputType' in ('DEX_URL','CHART_URL') then
  url_identity:=public.analyzer_url_identity(request_row.raw_input);
  perform public.analyzer_require(p_resolution->>'source'=url_identity->>'host' and p_resolution->>'chain'=url_identity->>'chain','Provider URL identity mismatch');
  if url_identity->>'kind'='PAIR' then
   perform public.analyzer_require(p_resolution->>'pairAddress'=url_identity->>'address' and p_resolution->>'poolAddress' is null,'Provider pair mismatch');
   perform public.analyzer_require(p_resolution->>'tokenAddress' is not null and p_resolution->>'confidence'='PARTIAL','Provider token resolution incomplete');
   quote_token:=p_resolution->>'resolvedQuoteToken';
   perform public.analyzer_require(p_resolution->>'resolvedBaseToken'=p_resolution->>'tokenAddress' and public.analyzer_valid_address(p_resolution->>'chain',quote_token),'Provider base/quote identity invalid');
  else
   perform public.analyzer_require(p_resolution->>'tokenAddress'=url_identity->>'address' and p_resolution->>'pairAddress' is null and p_resolution->>'poolAddress' is null,'Provider token URL mismatch');
  end if;
 else
  perform public.analyzer_require(p_resolution->>'inputType' in ('TOKEN_MINT','CONTRACT_ADDRESS'),'Unsupported attested input');
  perform public.analyzer_require(p_resolution->>'source'='direct-input' and p_resolution->>'pairAddress' is null and p_resolution->>'poolAddress' is null,'Direct resolution source/identity mismatch');
  if p_resolution->>'inputType'='CONTRACT_ADDRESS' then
   perform public.analyzer_require(p_resolution->>'chain'=p_input->>'hintChain' and p_resolution->>'chain' in ('ethereum','base','bnb') and p_resolution->>'tokenAddress'=lower(p_input->>'raw') and public.analyzer_valid_address(p_resolution->>'chain',p_resolution->>'tokenAddress'),'Direct contract identity mismatch');
  else
   perform public.analyzer_require(p_resolution->>'chain'='solana' and (p_input->>'hintChain' is null or p_input->>'hintChain' in ('solana','unknown')) and p_resolution->>'tokenAddress'=p_input->>'raw' and public.analyzer_valid_address('solana',p_resolution->>'tokenAddress'),'Direct mint identity mismatch');
  end if;
 end if;
 perform public.analyzer_require(p_resolution->>'chain' in ('solana','ethereum','base','bnb'),'Unsupported attested chain');
 perform public.analyzer_require(p_resolution->>'tokenAddress' is not null,'Attested resolution requires a canonical token');
 fingerprint:=public.analyzer_compute_delivery_key(public.analyzer_canonical_json(p_input));
 select * into existing from public.analyzer_resolution_receipts as rr where rr.request_id=attested_request_id and rr.input_fingerprint=fingerprint;
 if existing.id is not null then
  perform public.analyzer_require(existing.resolution-'resolutionReceiptId'=p_resolution-'resolutionReceiptId','Existing resolution receipt differs');
  return jsonb_build_object('id',existing.id,'resolution',existing.resolution);
 end if;
 provider_name:=case when p_resolution->>'source'='dexscreener.com' then 'dex-screener' when p_resolution->>'source'='birdeye.so' then 'birdeye' else 'direct-chain' end;
 capability_name:=case when p_resolution->>'inputType'='DEX_URL' then 'PAIR_RESOLUTION' else 'TOKEN_IDENTITY' end;
 provenance_kind:=case when provider_name='direct-chain' then 'DIRECT_CHAIN' else 'OBJECTIVE_PROVIDER' end;
 receipt_id:=gen_random_uuid();
 stored:=p_resolution||jsonb_build_object('resolutionReceiptId',receipt_id::text);
 insert into public.analyzer_resolution_receipts(id,request_id,input_fingerprint,normalized_input,provider,capability,chain,pair_address,pool_address,base_token,quote_token,canonical_token,provider_response_fingerprint,collector_version,schema_version,resolution,provenance_kind,observed_at)
 values(receipt_id,attested_request_id,fingerprint,p_input,provider_name,capability_name,p_resolution->>'chain',p_resolution->>'pairAddress',p_resolution->>'poolAddress',p_resolution->>'tokenAddress',quote_token,p_resolution->>'canonicalTokenId',p_provider_response_fingerprint,p_collector_version,'token-analyzer-resolution-v1',stored,provenance_kind,clock_timestamp());
 return jsonb_build_object('id',receipt_id,'resolution',stored);
end;
$$;

-- All browser callers, including authenticated Admins, are denied attestation.
revoke all on function public.analyzer_attest_resolution(text,jsonb,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.analyzer_attest_resolution(text,jsonb,jsonb,text,text) to service_role;

-- Reject the old caller-authored proof and allow only syntax-only pair reservations
-- or resolutions carrying the immutable receipt ID.
create or replace function public.analyzer_validate_request(p_input jsonb,p_resolution jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare u jsonb; token text:=p_resolution->>'tokenAddress'; field text;
begin
 perform public.analyzer_validate_shape(p_input,public.analyzer_contract_registry()->'schemas'->'input');
 perform public.analyzer_validate_shape(p_resolution,public.analyzer_contract_registry()->'schemas'->'resolution');
 perform public.analyzer_require(not (p_resolution ? 'pairProof'),'Caller-authored pair proofs are not accepted');
 if p_resolution->>'inputType' in ('DEX_URL','CHART_URL') then
  u:=public.analyzer_url_identity(p_input->>'raw');
  perform public.analyzer_require(p_resolution->>'source'=u->>'host' and p_resolution->>'chain'=u->>'chain' and (p_input->>'hintChain' is null or p_input->>'hintChain'='unknown' or p_input->>'hintChain'=u->>'chain'),'IDENTITY_CONFLICT: provider URL');
  perform public.analyzer_require(p_resolution->>'inputType'=case when u->>'kind'='TOKEN' then 'CHART_URL' else 'DEX_URL' end,'Input type mismatch');
  if u->>'kind'='TOKEN' then
   perform public.analyzer_require(token=u->>'address' and p_resolution->>'pairAddress' is null and p_resolution->>'poolAddress' is null,'IDENTITY_CONFLICT: URL token');
  else
   perform public.analyzer_require(coalesce(p_resolution->>'pairAddress',p_resolution->>'poolAddress')=u->>'address','IDENTITY_CONFLICT: URL pool');
   perform public.analyzer_require(case when u->>'kind'='PAIR' then p_resolution->>'poolAddress' is null else p_resolution->>'pairAddress' is null end,'Unexpected pool identity');
   perform public.analyzer_require(token is null or p_resolution->>'resolutionReceiptId' is not null,'Provider resolution requires attestation');
  end if;
  perform public.analyzer_require(p_resolution->>'canonicalTokenId' is not distinct from public.analyzer_canonical_token_id(p_resolution),'Canonical token mismatch');
  perform public.analyzer_require(p_resolution->>'confidence'='PARTIAL','URL identity remains provider-derived');
  foreach field in array array['symbol','name','decimals','supply','launchpad','creator','creationTimestamp','programOrContract'] loop perform public.analyzer_require(p_resolution->field='null'::jsonb,'Unverified metadata'); end loop;
 else
  perform public.analyzer_validate_request_pre_provider_integrity(p_input,p_resolution);
 end if;
end;$$;

create or replace function public.analyzer_validate_manifest_for_request(p_manifest jsonb,p_input jsonb,p_resolution jsonb,p_request_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare resolved jsonb:=p_manifest->'resolvedToken';
begin
 perform public.analyzer_validate_request(p_input,p_resolution);
 perform public.analyzer_require(resolved->>'resolutionReceiptId' is not null,'Manifest requires trusted resolution receipt');
 perform public.analyzer_validate_resolution_receipt((resolved->>'resolutionReceiptId')::uuid,p_request_id,resolved);
 perform public.analyzer_validate_manifest_pre_provider_integrity(p_manifest,p_input,resolved);
end;$$;

create or replace function public.analyzer_validate_manifest(p_manifest jsonb,p_input jsonb,p_resolution jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare request_id uuid;
begin
 select id into request_id from public.analyzer_requests where raw_input=btrim(p_input->>'raw') and requester_id=auth.uid() order by created_at desc limit 1;
 perform public.analyzer_validate_manifest_for_request(p_manifest,p_input,p_resolution,request_id);
end;$$;

alter function public.analyzer_validate_observation(jsonb,jsonb) rename to analyzer_validate_observation_pre_attestation;
create or replace function public.analyzer_validate_observation(p_observation jsonb,p_resolution jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare c jsonb:=p_observation->'context'; expected text:=coalesce(p_resolution->>'pairAddress',p_resolution->>'poolAddress');
begin
 perform public.analyzer_validate_observation_pre_attestation(p_observation,p_resolution);
 if c->>'scope' in ('PAIR','POOL') then
  perform public.analyzer_require(expected is not null or exists(select 1 from jsonb_array_elements_text(coalesce(p_resolution->'trustedPoolIds','[]'::jsonb)) pool(value) where value=c->>'poolId'),'Scoped observation is not bound to trusted pair/pool');
  perform public.analyzer_require(c->>'poolId'=expected or exists(select 1 from jsonb_array_elements_text(coalesce(p_resolution->'trustedPoolIds','[]'::jsonb)) pool(value) where value=c->>'poolId'),'Scoped observation is not bound to trusted pair/pool');
  perform public.analyzer_require(c->>'chain'=p_resolution->>'chain' and c->>'token'=coalesce(p_resolution->>'resolvedBaseToken',p_resolution->>'tokenAddress'),'Scoped observation identity mismatch');
  if p_resolution->>'resolvedQuoteToken' is not null then perform public.analyzer_require(c->>'quoteAsset'=p_resolution->>'resolvedQuoteToken','Scoped observation quote mismatch'); end if;
 end if;
end;$$;

revoke all on function public.analyzer_validate_resolution_receipt(uuid,uuid,jsonb),public.analyzer_validate_request(jsonb,jsonb),public.analyzer_validate_manifest(jsonb,jsonb,jsonb),public.analyzer_validate_observation(jsonb,jsonb) from public,anon,authenticated,service_role;

create or replace function public.analyzer_complete_delivery(p_delivery_key text,p_owner_token uuid,p_manifest jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare reservation public.analyzer_delivery_intents%rowtype; manifest jsonb; stored_manifest jsonb; manifest_id uuid; manifest_revision integer; manifest_hash text; analysis_id uuid; analysis_version integer; result jsonb; request_row public.analyzer_requests%rowtype; source public.analyzer_deliveries%rowtype;
begin
 perform public.analyzer_assert_operator(); perform public.analyzer_assert_enabled();
 select * into reservation from public.analyzer_delivery_intents where delivery_key=p_delivery_key;
 perform public.analyzer_require(reservation.delivery_key is not null and reservation.owner_id=auth.uid() and reservation.owner_token=p_owner_token,'Delivery completion is not owned by caller');
 select * into request_row from public.analyzer_requests where id=reservation.request_id for update;
 if exists(select 1 from public.analyzer_deliveries where delivery_key=p_delivery_key) then raise exception 'Sealed delivery: use key-only receipt lookup' using errcode='55000'; end if;
 perform public.analyzer_require(clock_timestamp()<reservation.expires_at,'Delivery reservation expired');
 perform public.analyzer_require((select not ai_enabled and not social_specialist_enabled and not escalation_enabled from public.analyzer_config where singleton),'AI remains disabled');
 if reservation.operation='EXPLICIT_REANALYSIS' then
  perform public.analyzer_require(p_manifest is null or p_manifest='null'::jsonb,'Reanalysis uses only its sealed source evidence');
  select * into source from public.analyzer_deliveries where delivery_key=reservation.source_delivery_key;
  select m.id,m.manifest_version,m.manifest_hash,m.manifest into manifest_id,manifest_revision,manifest_hash,stored_manifest from public.analyzer_evidence_manifests m where m.id=source.evidence_manifest_id;
  manifest:=stored_manifest-'manifestHash';
 else
  perform public.analyzer_validate_manifest_for_request(p_manifest,reservation.input,reservation.resolution,reservation.request_id);
  manifest:=p_manifest;
  select m.id,m.manifest_version,m.manifest_hash,m.manifest into manifest_id,manifest_revision,manifest_hash,stored_manifest from public.analyzer_evidence_manifests m where m.request_id=reservation.request_id and (m.manifest-'manifestHash'-'evidenceRevision')=(p_manifest-'evidenceRevision') limit 1;
  if manifest_id is null then
   select coalesce(max(m.manifest_version),0)+1 into manifest_revision from public.analyzer_evidence_manifests m where m.request_id=reservation.request_id;
   manifest:=jsonb_set(manifest,'{evidenceRevision}',to_jsonb(manifest_revision));
   manifest_hash:=public.analyzer_compute_delivery_key(public.analyzer_canonical_json(manifest));
   stored_manifest:=manifest||jsonb_build_object('manifestHash',manifest_hash);
   insert into public.analyzer_evidence_manifests(request_id,manifest_version,manifest_hash,manifest) values(reservation.request_id,manifest_revision,manifest_hash,stored_manifest) returning id into manifest_id;
  else manifest:=stored_manifest-'manifestHash'; end if;
 end if;
 select coalesce(max(a.analysis_version),0)+1 into analysis_version from public.analyzer_analyses a where a.request_id=reservation.request_id;
 result:=public.analyzer_derive_result(reservation.input,manifest)||jsonb_build_object('requestId',reservation.request_id,'analysisVersion',analysis_version,'evidenceManifestHash',manifest_hash,'evidenceRevision',manifest_revision,'deliveryId',p_delivery_key);
 insert into public.analyzer_analyses(request_id,evidence_manifest_id,analysis_version,status,result,methodology_version,schema_version,score_engine_version,analysis_mode,freshness_class,freshness_expires_at,evidence_manifest_hash,identity,analysis_operation,reanalysis_reason,evidence_revision,delivery_identity)
 values(reservation.request_id,manifest_id,analysis_version,result->>'status',result,null,'token-analyzer-v1',null,'DETERMINISTIC',manifest->'freshness'->>'state',reservation.expires_at,manifest_hash,reservation.intent_context,case when reservation.operation='ANALYZE' then 'FRESH_ANALYSIS' else reservation.operation end,reservation.reanalysis_reason,manifest_revision,p_delivery_key) returning id into analysis_id;
 insert into public.analyzer_deliveries(delivery_key,request_id,analysis_id,evidence_manifest_id,analysis_version,operation,manifest_hash,reanalysis_reason) values(p_delivery_key,reservation.request_id,analysis_id,manifest_id,analysis_version,case when reservation.operation='ANALYZE' then 'FRESH_ANALYSIS' else reservation.operation end,manifest_hash,reservation.reanalysis_reason);
 update public.analyzer_requests set status='ANALYZED' where id=reservation.request_id;
 return public.analyzer_get_delivery_receipt(p_delivery_key);
end;
$$;

revoke all on function public.analyzer_validate_manifest_for_request(jsonb,jsonb,jsonb,uuid) from public,anon,authenticated,service_role;
commit;
