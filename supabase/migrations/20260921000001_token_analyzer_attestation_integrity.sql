begin;

-- Resolution identity is immutable, but it is not one receipt forever.  A
-- receipt version represents one sealed provider collection context.
alter table public.analyzer_resolution_receipts
  add column if not exists resolution_fingerprint text,
  add column if not exists resolution_version integer not null default 1;

update public.analyzer_resolution_receipts
set resolution_fingerprint = public.analyzer_compute_delivery_key(
  public.analyzer_canonical_json(jsonb_build_object('resolution', resolution - 'resolutionReceiptId', 'providerResponseFingerprint', provider_response_fingerprint))
)
where resolution_fingerprint is null;

alter table public.analyzer_resolution_receipts
  alter column resolution_fingerprint set not null;

alter table public.analyzer_resolution_receipts
  drop constraint if exists analyzer_resolution_receipts_request_id_input_fingerprint_key;
create unique index if not exists analyzer_resolution_receipts_context_key
  on public.analyzer_resolution_receipts(request_id, input_fingerprint, resolution_fingerprint);
create index if not exists analyzer_resolution_receipts_request_version_idx
  on public.analyzer_resolution_receipts(request_id, input_fingerprint, resolution_version);

alter function public.analyzer_contract_registry() rename to analyzer_contract_registry_pre_attestation_integrity;
create function public.analyzer_contract_registry()
returns jsonb language sql immutable security definer set search_path='' as $$
  select jsonb_set(
    jsonb_set(
      public.analyzer_contract_registry_pre_attestation_integrity(),
      '{schemas,resolution,properties,trustedPools}',
      '{"type":"array","items":{"type":"object","properties":{"provider":{"type":"string","minLength":1},"chain":{"type":"string","enum":["solana","ethereum","base","bnb"]},"poolAddress":{"type":"string","minLength":1},"baseToken":{"type":"string","minLength":1},"quoteToken":{"type":"string","minLength":1}},"optional":[]},"maxItems":100}'::jsonb
    ),
    '{schemas,resolution,properties,lifecycleReceiptId}',
    '{"type":"string","pattern":"^[0-9a-fA-F-]{36}$"}'::jsonb
  )
$$;

-- The previous migration's optional list is extended without making the
-- caller-authored legacy pool-ID list authoritative.
create or replace function public.analyzer_contract_registry()
returns jsonb language sql immutable security definer set search_path='' as $$
  select jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          public.analyzer_contract_registry_pre_attestation_integrity(),
          '{schemas,resolution,properties,trustedPools}',
          '{"type":"array","items":{"type":"object","properties":{"provider":{"type":"string","minLength":1},"chain":{"type":"string","enum":["solana","ethereum","base","bnb"]},"poolAddress":{"type":"string","minLength":1},"baseToken":{"type":"string","minLength":1},"quoteToken":{"type":"string","minLength":1}},"optional":[]},"maxItems":100}'::jsonb
        ),
        '{schemas,resolution,properties,lifecycleReceiptId}',
        '{"type":"string","pattern":"^[0-9a-fA-F-]{36}$"}'::jsonb
      ),
      '{schemas,resolution,properties,resolutionVersion}',
      '{"type":"number"}'::jsonb
    ),
    '{schemas,resolution,optional}',
    ((public.analyzer_contract_registry_pre_attestation_integrity()->'schemas'->'resolution'->'optional') || '["trustedPools","lifecycleReceiptId","resolutionVersion"]'::jsonb)
  )
$$;

create table public.analyzer_pump_lifecycle_receipts (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.analyzer_requests(id) on delete restrict,
  delivery_key text not null references public.analyzer_delivery_intents(delivery_key) on delete restrict,
  mint text not null,
  program_id text not null check (program_id = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P'),
  curve_address text not null,
  decoder_version text not null check (decoder_version = 'radar-pump-bonding-curve-v1'),
  facts jsonb not null,
  facts_fingerprint text not null check (facts_fingerprint ~ '^[0-9a-f]{64}$'),
  observed_at timestamptz not null default clock_timestamp(),
  unique(delivery_key, facts_fingerprint)
);
alter table public.analyzer_pump_lifecycle_receipts enable row level security;
revoke all on table public.analyzer_pump_lifecycle_receipts from public, anon, authenticated, service_role;
create trigger analyzer_pump_lifecycle_receipts_no_mutation
before update or delete on public.analyzer_pump_lifecycle_receipts
for each row execute function public.reject_immutable_change();

create or replace function public.analyzer_attest_pump_lifecycle(p_delivery_key text, p_lifecycle jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare d public.analyzer_delivery_intents%rowtype; r public.analyzer_requests%rowtype; lifecycle_id uuid; fingerprint text;
begin
  perform public.analyzer_require(current_setting('role', true)='service_role','Pump lifecycle attestation requires server authority');
  perform public.analyzer_assert_enabled();
  select * into d from public.analyzer_delivery_intents where delivery_key=p_delivery_key for update;
  perform public.analyzer_require(d.delivery_key is not null,'Analyzer delivery not found');
  select * into r from public.analyzer_requests where id=d.request_id;
  perform public.analyzer_require(r.id is not null,'Analyzer request not found');
  perform public.analyzer_require(
    public.analyzer_valid_address('solana',p_lifecycle->>'mint')
    and exists (
      select 1
      from public.analyzer_resolution_receipts rr
      where rr.request_id=d.request_id
        and rr.chain='solana'
        and rr.canonical_token='solana:' || (p_lifecycle->>'mint')
    ),
    'Pump lifecycle mint mismatch'
  );
  perform public.analyzer_require(p_lifecycle->>'programId'='6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P','Unsupported Pump program');
  perform public.analyzer_require(p_lifecycle->>'decoderVersion'='radar-pump-bonding-curve-v1','Unsupported Pump decoder');
  perform public.analyzer_require(public.analyzer_valid_address('solana',p_lifecycle->>'curveAddress'),'Invalid Pump curve address');
  perform public.analyzer_require(p_lifecycle ? 'complete' and p_lifecycle ? 'virtualTokenReserves' and p_lifecycle ? 'virtualSolReserves' and p_lifecycle ? 'realTokenReserves' and p_lifecycle ? 'realSolReserves','Incomplete Pump lifecycle facts');
  fingerprint:=public.analyzer_compute_delivery_key(public.analyzer_canonical_json(p_lifecycle));
  select l.id into lifecycle_id from public.analyzer_pump_lifecycle_receipts l where l.delivery_key=p_delivery_key and l.facts_fingerprint=fingerprint;
  if lifecycle_id is null then
    insert into public.analyzer_pump_lifecycle_receipts(request_id,delivery_key,mint,program_id,curve_address,decoder_version,facts,facts_fingerprint)
    values(d.request_id,p_delivery_key,p_lifecycle->>'mint',p_lifecycle->>'programId',p_lifecycle->>'curveAddress',p_lifecycle->>'decoderVersion',p_lifecycle,fingerprint)
    returning analyzer_pump_lifecycle_receipts.id into lifecycle_id;
  end if;
  return jsonb_build_object('id',lifecycle_id,'facts',p_lifecycle);
end;
$$;
revoke all on function public.analyzer_attest_pump_lifecycle(text,jsonb) from public, anon, authenticated;
grant execute on function public.analyzer_attest_pump_lifecycle(text,jsonb) to service_role;

create or replace function public.analyzer_attest_resolution(p_delivery_key text,p_input jsonb,p_resolution jsonb,p_provider_response_fingerprint text,p_collector_version text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare d public.analyzer_delivery_intents%rowtype; r public.analyzer_requests%rowtype; existing public.analyzer_resolution_receipts%rowtype; u jsonb; fingerprint text; context_fingerprint text; provider_name text; capability_name text; provenance_kind text; stored jsonb; receipt_id uuid; quote_token text; attested_request_id uuid; version integer; pool jsonb;
begin
  perform public.analyzer_require(current_setting('role', true)='service_role','Trusted resolution requires server authority');
  perform public.analyzer_assert_enabled();
  select * into d from public.analyzer_delivery_intents where delivery_key=p_delivery_key for update;
  perform public.analyzer_require(d.delivery_key is not null,'Analyzer delivery not found'); attested_request_id:=d.request_id;
  select * into r from public.analyzer_requests where id=attested_request_id for update;
  perform public.analyzer_require(r.id is not null and r.raw_input=btrim(p_input->>'raw') and d.input=p_input,'Resolution input mismatch');
  perform public.analyzer_require(p_input->>'hintChain' is null or p_input->>'hintChain'=r.requested_chain,'Resolution chain hint mismatch');
  perform public.analyzer_require(p_provider_response_fingerprint ~ '^[0-9a-f]{64}$','Invalid provider response fingerprint');
  perform public.analyzer_require(p_collector_version='token-analyzer-live-collector-v2','Unsupported collector version');
  perform public.analyzer_require(not (p_resolution ? 'resolutionReceiptId') and not (p_resolution ? 'pairProof'),'Resolution attestation must be fresh');
  perform public.analyzer_require(p_resolution->>'canonicalTokenId' is not null and p_resolution->>'canonicalTokenId'=public.analyzer_canonical_token_id(p_resolution),'Canonical resolution identity invalid');
  if p_resolution->>'inputType' in ('DEX_URL','CHART_URL') then
    u:=public.analyzer_url_identity(r.raw_input);
    perform public.analyzer_require(p_resolution->>'source'=u->>'host' and p_resolution->>'chain'=u->>'chain','Provider URL identity mismatch');
    if u->>'kind'='PAIR' then
      perform public.analyzer_require(p_resolution->>'pairAddress'=u->>'address' and p_resolution->>'poolAddress' is null,'Provider pair mismatch');
      perform public.analyzer_require(p_resolution->>'tokenAddress' is not null and p_resolution->>'confidence'='PARTIAL','Provider token resolution incomplete');
      quote_token:=p_resolution->>'resolvedQuoteToken';
      perform public.analyzer_require(p_resolution->>'resolvedBaseToken'=p_resolution->>'tokenAddress' and public.analyzer_valid_address(p_resolution->>'chain',quote_token),'Provider base/quote identity invalid');
    else
      perform public.analyzer_require(p_resolution->>'tokenAddress'=u->>'address' and p_resolution->>'pairAddress' is null and p_resolution->>'poolAddress' is null,'Provider token URL mismatch');
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
  perform public.analyzer_require(p_resolution->>'chain' in ('solana','ethereum','base','bnb') and p_resolution->>'tokenAddress' is not null,'Unsupported attested identity');
  if p_resolution ? 'trustedPools' then
    for pool in select value from jsonb_array_elements(p_resolution->'trustedPools') loop
      perform public.analyzer_require(jsonb_typeof(pool)='object' and pool->>'provider' in ('dex-screener','birdeye') and pool->>'chain'=p_resolution->>'chain' and public.analyzer_valid_address(pool->>'chain',pool->>'poolAddress') and public.analyzer_valid_address(pool->>'chain',pool->>'baseToken') and public.analyzer_valid_address(pool->>'chain',pool->>'quoteToken') and pool->>'baseToken'=p_resolution->>'tokenAddress','Invalid trusted pool tuple');
    end loop;
  end if;
  fingerprint:=public.analyzer_compute_delivery_key(public.analyzer_canonical_json(p_input));
  context_fingerprint:=public.analyzer_compute_delivery_key(public.analyzer_canonical_json(jsonb_build_object('resolution',p_resolution,'providerResponseFingerprint',p_provider_response_fingerprint)));
  select * into existing from public.analyzer_resolution_receipts rr where rr.request_id=attested_request_id and rr.input_fingerprint=fingerprint and rr.resolution_fingerprint=context_fingerprint;
  if existing.id is not null then return jsonb_build_object('id',existing.id,'resolution',existing.resolution); end if;
  select coalesce(max(resolution_version),0)+1 into version from public.analyzer_resolution_receipts rr where rr.request_id=attested_request_id and rr.input_fingerprint=fingerprint;
  provider_name:=case when p_resolution->>'source'='dexscreener.com' then 'dex-screener' when p_resolution->>'source'='birdeye.so' then 'birdeye' else 'direct-chain' end;
  capability_name:=case when p_resolution->>'inputType'='DEX_URL' then 'PAIR_RESOLUTION' else 'TOKEN_IDENTITY' end;
  provenance_kind:=case when provider_name='direct-chain' then 'DIRECT_CHAIN' else 'OBJECTIVE_PROVIDER' end;
  receipt_id:=gen_random_uuid(); stored:=p_resolution||jsonb_build_object('resolutionReceiptId',receipt_id::text,'resolutionVersion',version);
  insert into public.analyzer_resolution_receipts(id,request_id,input_fingerprint,resolution_fingerprint,resolution_version,normalized_input,provider,capability,chain,pair_address,pool_address,base_token,quote_token,canonical_token,provider_response_fingerprint,collector_version,schema_version,resolution,provenance_kind,observed_at)
  values(receipt_id,attested_request_id,fingerprint,context_fingerprint,version,p_input,provider_name,capability_name,p_resolution->>'chain',p_resolution->>'pairAddress',p_resolution->>'poolAddress',p_resolution->>'tokenAddress',quote_token,p_resolution->>'canonicalTokenId',p_provider_response_fingerprint,p_collector_version,'token-analyzer-resolution-v1',stored,provenance_kind,clock_timestamp());
  return jsonb_build_object('id',receipt_id,'resolution',stored);
end;
$$;

-- The authoritative manifest path includes the concentration relation checks;
-- later wrappers must not call the stale pre-provider function directly.
create or replace function public.analyzer_validate_manifest_current(p_manifest jsonb,p_input jsonb,p_resolution jsonb,p_request_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare o jsonb; c jsonb; numerator numeric; denominator numeric; lifecycle jsonb; receipt public.analyzer_pump_lifecycle_receipts%rowtype;
begin
  perform public.analyzer_validate_request(p_input,p_resolution);
  perform public.analyzer_require((p_manifest->'resolvedToken')->>'resolutionReceiptId' is not null,'Manifest requires trusted resolution receipt');
  perform public.analyzer_validate_resolution_receipt(((p_manifest->'resolvedToken')->>'resolutionReceiptId')::uuid,p_request_id,p_manifest->'resolvedToken');
  perform public.analyzer_validate_manifest_pre_provider_integrity(p_manifest,p_input,p_manifest->'resolvedToken');
  for o in select value from jsonb_array_elements(p_manifest->'observations') loop
    if o->>'key'='concentration' and o->>'state'='AVAILABLE' then
      c:=o->'context'; denominator:=(c->>'denominatorValue')::numeric;
      perform public.analyzer_require(denominator>0 and c->>'denominatorType'='TOTAL_SUPPLY','Invalid concentration denominator');
      perform public.analyzer_require(exists(select 1 from jsonb_array_elements(p_manifest->'observations') s where s->>'key'='supply' and s->>'state'='AVAILABLE' and s->>'evidenceClass'='VERIFIED_DATA' and s->>'tokenId'=o->>'tokenId' and s->>'value'=c->>'denominatorValue'),'Concentration requires verified total supply');
      perform public.analyzer_require(not exists(select 1 from jsonb_array_elements(coalesce(c->'rawBalances','[]'::jsonb)) b where b->>'balance' !~ '^(0|[1-9][0-9]*)$'),'Invalid concentration balance');
      select coalesce(sum((b->>'balance')::numeric),0) into numerator from (select value b from jsonb_array_elements(c->'rawBalances') order by (value->>'balance')::numeric desc limit 10) rows where not (c->'exclusions' ? (b->>'address'));
      perform public.analyzer_require(numerator<=denominator and trunc(numerator/denominator,18)=(o->>'value')::numeric,'Incorrect total-supply concentration');
    end if;
    if o->>'key'='lifecycle' and o->>'state'='AVAILABLE' and o->>'evidenceClass'='VERIFIED_DATA' then
      lifecycle:=o->'context';
      perform public.analyzer_require((o->>'evidenceId') is not null,'Verified Pump lifecycle requires attestation');
      select * into receipt from public.analyzer_pump_lifecycle_receipts where id=(o->>'evidenceId')::uuid and request_id=p_request_id;
      perform public.analyzer_require(receipt.id is not null and receipt.mint=(p_manifest->'resolvedToken')->>'tokenAddress' and receipt.program_id=lifecycle->>'tokenProgram' and receipt.curve_address=lifecycle->>'curveAddress' and receipt.decoder_version=lifecycle->>'decoderVersion','Pump lifecycle attestation mismatch');
    end if;
  end loop;
end;
$$;

create or replace function public.analyzer_validate_manifest_for_request(p_manifest jsonb,p_input jsonb,p_resolution jsonb,p_request_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform public.analyzer_validate_manifest_current(p_manifest,p_input,p_resolution,p_request_id);
end;
$$;

create or replace function public.analyzer_validate_observation(p_observation jsonb,p_resolution jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare c jsonb:=p_observation->'context'; pool jsonb; provider text:=coalesce(c->>'provider',p_observation->>'source');
begin
  perform public.analyzer_validate_observation_pre_attestation(p_observation,p_resolution);
  if c->>'scope' in ('PAIR','POOL') then
    select value into pool from jsonb_array_elements(coalesce(p_resolution->'trustedPools','[]'::jsonb)) where value->>'provider'=provider and value->>'chain'=c->>'chain' and value->>'poolAddress'=c->>'poolId' and value->>'baseToken'=c->>'token' and value->>'quoteToken'=c->>'quoteAsset' limit 1;
    perform public.analyzer_require(pool is not null,'Scoped observation is not bound to an attested provider tuple');
  end if;
  if p_observation->>'key'='lifecycle' and p_observation->>'state'='AVAILABLE' and p_observation->>'evidenceClass'='VERIFIED_DATA' then
    perform public.analyzer_require(c->>'scope'='BONDING_CURVE' and c->>'tokenProgram'='6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P' and c->>'decoderVersion'='radar-pump-bonding-curve-v1' and p_observation->>'evidenceId' is not null,'Pump lifecycle requires trusted attestation');
  end if;
end;
$$;

revoke all on function public.analyzer_validate_manifest_current(jsonb,jsonb,jsonb,uuid),public.analyzer_attest_pump_lifecycle(text,jsonb) from public,anon,authenticated;
revoke all on function public.analyzer_validate_manifest_current(jsonb,jsonb,jsonb,uuid),public.analyzer_validate_observation(jsonb,jsonb) from public,anon,authenticated,service_role;

commit;
