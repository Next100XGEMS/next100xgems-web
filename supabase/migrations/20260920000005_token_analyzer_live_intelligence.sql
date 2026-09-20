begin;

-- The live-intelligence extension is additive.  Keep the audited v1 registry
-- as the base and extend only the typed fields needed by deterministic live
-- observations.  No score or AI contract is changed here.
create or replace function public.analyzer_contract_registry_v1()
returns jsonb language sql immutable security definer set search_path='' as $base$
  select $policy${"versions":{"input":"token-analyzer-input-v1","resolution":"token-analyzer-resolution-v1","evidence":"token-analyzer-v1","manifestFormat":1,"result":"token-analyzer-v1","scoreEngine":null,"methodology":null},"reuseSeconds":300,"completionWaitMs":30000,"fields":{"price":{"identityType":"TOKEN","referenceType":"TOKEN","value":"decimal"},"liquidity":{"identityType":"POOL","referenceType":"POOL","value":"decimal"},"volume":{"identityType":"POOL","referenceType":"POOL","value":"decimal"},"transactions":{"identityType":"POOL","referenceType":"POOL","value":"integer"},"holders":{"identityType":"TOKEN","referenceType":"TOKEN","value":"integer"},"concentration":{"identityType":"TOKEN","referenceType":"TOKEN","value":"decimal"},"creator":{"identityType":"WALLET","referenceType":"WALLET","value":"address"},"wallet":{"identityType":"WALLET","referenceType":"WALLET","value":"decimal"},"trade":{"identityType":"WALLET","referenceType":"TRANSACTION","value":"decimal"},"supply":{"identityType":"TOKEN","referenceType":"TOKEN","value":"integer"},"mintAuthority":{"identityType":"TOKEN","referenceType":"TOKEN","value":"address"},"freezeAuthority":{"identityType":"TOKEN","referenceType":"TOKEN","value":"address"}},"verifiedProvenance":["DIRECT_CHAIN","OBJECTIVE_PROVIDER"],"signalProvenance":["DIRECT_CHAIN","OBJECTIVE_PROVIDER","PROVIDER_DERIVED"],"positiveConclusions":{"CLAIM_SUPPORTED":"EXACT_TYPED_OBSERVATION","TOP_TRADE_PRESENT":"EXACT_TRADE_OBSERVATION","WHY_MOVING_VERIFIED_FACT":"UNREGISTERED","WHY_MOVING_STRONG_SIGNAL":"UNREGISTERED","RISK_PRESENT":"UNREGISTERED","LIQUIDITY_PRESENT":"UNREGISTERED","HOLDER_FACT_PRESENT":"UNREGISTERED","CREATOR_FACT_PRESENT":"UNREGISTERED","MARKET_FACT_PRESENT":"UNREGISTERED","ACTIVITY_FACT_PRESENT":"UNREGISTERED"},"schemas":{"input":{"type":"object","properties":{"raw":{"type":"string","minLength":1,"maxLength":4096},"hintChain":{"type":"string","enum":["solana","ethereum","base","bnb","unknown"],"nullable":true}},"optional":[]},"provenance":{"type":"object","properties":{"source":{"type":"string","minLength":1},"kind":{"type":"string","enum":["DIRECT_INPUT","URL_STRUCTURE","DIRECT_CHAIN","OBJECTIVE_PROVIDER","PROVIDER_DERIVED","CONTEXTUAL_PROPRIETARY"]},"reference":{"type":"string","minLength":1,"nullable":true},"capturedAt":{"type":"string","format":"timestamp"},"referenceType":{"type":"string","enum":["TOKEN","POOL","WALLET","TRANSACTION"]}},"optional":["referenceType"]},"resolution":{"type":"object","properties":{"inputType":{"type":"string","enum":["CONTRACT_ADDRESS","TOKEN_MINT","DEX_URL","CHART_URL","X_POST","ARTICLE","FACEBOOK_POST","INSTAGRAM_POST","GENERIC_URL","UNKNOWN"]},"source":{"type":"string","minLength":1},"chain":{"type":"string","enum":["solana","ethereum","base","bnb","unknown"]},"tokenAddress":{"type":"string","minLength":1,"nullable":true},"canonicalTokenId":{"type":"string","minLength":1,"nullable":true},"pairAddress":{"type":"string","minLength":1,"nullable":true},"poolAddress":{"type":"string","minLength":1,"nullable":true},"symbol":{"type":"string","nullable":true},"name":{"type":"string","nullable":true},"decimals":{"type":"string","nullable":true},"supply":{"type":"string","nullable":true},"launchpad":{"type":"string","nullable":true},"creator":{"type":"string","nullable":true},"creationTimestamp":{"type":"string","nullable":true},"programOrContract":{"type":"string","nullable":true},"confidence":{"type":"string","enum":["RESOLVED","CANDIDATE_IDENTITY","PARTIAL","UNKNOWN"]},"provenance":{"type":"array","items":{"ref":"provenance"},"maxItems":1000}},"optional":[]},"observation":{"type":"object","properties":{"key":{"type":"string","enum":["price","liquidity","volume","transactions","holders","concentration","creator","wallet","trade","supply","mintAuthority","freezeAuthority"]},"label":{"type":"string","minLength":1},"value":{"type":"scalar"},"state":{"type":"string","enum":["AVAILABLE","UNKNOWN","UNAVAILABLE","UNSUPPORTED","STALE"]},"evidenceClass":{"type":"string","enum":["VERIFIED_DATA","STRONG_SIGNAL","UNKNOWN"]},"source":{"type":"string","minLength":1},"observedAt":{"type":"string","format":"timestamp","nullable":true},"evidenceId":{"type":"string","minLength":1,"maxLength":128},"identity":{"type":"string","minLength":1,"nullable":true},"identityType":{"type":"string","enum":["TOKEN","POOL","WALLET"],"nullable":true},"tokenId":{"type":"string","minLength":1,"nullable":true},"provenance":{"type":"array","items":{"ref":"provenance"},"maxItems":1000},"transactionReference":{"type":"string","minLength":1,"maxLength":88}},"optional":["transactionReference"]},"claim":{"type":"object","properties":{"conclusionType":{"type":"string","enum":["CLAIM_SUPPORTED"]},"claim":{"type":"string","minLength":1},"source":{"type":"string","minLength":1},"verification":{"type":"string","enum":["SUPPORTED","PARTIALLY_SUPPORTED"]},"evidenceRefs":{"type":"array","items":{"type":"string","minLength":1},"maxItems":1000},"evidenceType":{"type":"string","enum":["VERIFIED_DATA","STRONG_SIGNAL"]},"field":{"type":"string","enum":["price","liquidity","volume","transactions","holders","concentration","creator","wallet","trade","supply","mintAuthority","freezeAuthority"]},"identity":{"type":"string","minLength":1},"identityType":{"type":"string","enum":["TOKEN","POOL","WALLET"]},"tokenId":{"type":"string","minLength":1},"value":{"type":"scalar"}},"optional":[]},"manifest":{"type":"object","properties":{"schemaVersion":{"type":"string","const":"token-analyzer-v1"},"versions":{"const":{"input":"token-analyzer-input-v1","resolution":"token-analyzer-resolution-v1","evidence":"token-analyzer-v1","manifestFormat":1,"result":"token-analyzer-v1","scoreEngine":null,"methodology":null}},"manifestFormatVersion":{"type":"number","const":1},"evidenceRevision":{"type":"number","const":1},"capturedAt":{"type":"string","format":"timestamp"},"input":{"type":"object","properties":{"type":{"type":"string","enum":["CONTRACT_ADDRESS","TOKEN_MINT","DEX_URL","CHART_URL","X_POST","ARTICLE","FACEBOOK_POST","INSTAGRAM_POST","GENERIC_URL","UNKNOWN"]},"rawHash":{"type":"string","pattern":"^[0-9a-f]{64}$"}},"optional":[]},"resolvedToken":{"ref":"resolution"},"observations":{"type":"array","items":{"ref":"observation"},"maxItems":1000},"claims":{"type":"array","items":{"ref":"claim"},"maxItems":1000},"providerConflicts":{"type":"array","items":{"type":"scalar"},"maxItems":0},"missing":{"type":"array","items":{"type":"string","minLength":1},"maxItems":1000},"freshness":{"type":"object","properties":{"state":{"type":"string","enum":["FRESH","STALE","UNKNOWN"]},"reason":{"type":"string"}},"optional":[]},"methodologyVersion":{"const":null}},"optional":[]}},"requiredSignals":["price","marketCap","fdv","liquidity","volume","transactions","holders","distribution","creatorBehavior","authorities","topTrades","freshness"]}$policy$::jsonb
$base$;

create or replace function public.analyzer_contract_registry()
returns jsonb language sql immutable security definer set search_path='' as $$
  with base as (select public.analyzer_contract_registry_v1() as value),
  fields as (
    select value || jsonb_build_object('fields', (value->'fields') || jsonb_build_object(
      'marketCap', jsonb_build_object('identityType','TOKEN','referenceType','TOKEN','value','decimal'),
      'fdv', jsonb_build_object('identityType','TOKEN','referenceType','TOKEN','value','decimal'),
      'decimals', jsonb_build_object('identityType','TOKEN','referenceType','TOKEN','value','integer'),
      'pool', jsonb_build_object('identityType','POOL','referenceType','POOL','value','address'),
      'poolAge', jsonb_build_object('identityType','POOL','referenceType','POOL','value','integer'),
      'lifecycle', jsonb_build_object('identityType','TOKEN','referenceType','TOKEN','value','text'),
      'migration', jsonb_build_object('identityType','TOKEN','referenceType','TOKEN','value','text'),
      'creatorBehavior', jsonb_build_object('identityType','WALLET','referenceType','WALLET','value','text'),
      'activityChange', jsonb_build_object('identityType','POOL','referenceType','POOL','value','decimal')
    )) as value from base
  ),
  keys as (
    select jsonb_set(
      jsonb_set(value, '{schemas,observation,properties,key,enum}', (value #> '{schemas,observation,properties,key,enum}') || '["decimals","marketCap","fdv","pool","poolAge","lifecycle","migration","creatorBehavior","activityChange"]'::jsonb),
      '{schemas,claim,properties,field,enum}', (value #> '{schemas,claim,properties,field,enum}') || '["decimals","marketCap","fdv","pool","poolAge","lifecycle","migration","creatorBehavior","activityChange"]'::jsonb
    ) as value from fields
  ),
  conflict_schema as (
    select jsonb_set(value, '{schemas,manifest,properties,providerConflicts}', '{"type":"array","items":{"type":"object","properties":{"capability":{"type":"string","minLength":1,"maxLength":128},"providers":{"type":"array","items":{"type":"string","minLength":1,"maxLength":128},"maxItems":10},"state":{"type":"string","enum":["AGREEMENT","DISAGREEMENT","MISSING","STALE"]},"explanation":{"type":"string","minLength":1,"maxLength":1024},"evidenceRefs":{"type":"array","items":{"type":"string","minLength":1,"maxLength":128},"maxItems":100}},"optional":[]},"maxItems":50}'::jsonb, true) as value from keys
  )
  select value from conflict_schema
$$;

-- Permit provider-resolved URL identities while retaining strict direct-input
-- identity checks.  The server must prove the pair/pool path and the provider
-- observation remains evidence-backed; URL syntax alone is never authoritative.
create or replace function public.analyzer_validate_request(p_input jsonb,p_resolution jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare raw text:=p_input->>'raw'; chain text:=p_resolution->>'chain'; token text:=p_resolution->>'tokenAddress'; field text; address text; source text:=p_resolution->>'source';
begin
 perform public.analyzer_validate_shape(p_input,public.analyzer_contract_registry()->'schemas'->'input');
 perform public.analyzer_validate_shape(p_resolution,public.analyzer_contract_registry()->'schemas'->'resolution');
 perform public.analyzer_require(raw=btrim(raw),'Input must be canonical');
 -- DIRECT_INPUT and URL_STRUCTURE provenance are expected syntax evidence.
 -- Provider-backed identity is checked by the branch-specific validation
 -- below; syntax provenance must not make ordinary direct inputs fail.
 if raw ~ '^0x[0-9a-fA-F]{40}$' then
  perform public.analyzer_require(p_resolution->>'inputType'='CONTRACT_ADDRESS' and token=lower(raw) and chain=coalesce(p_input->>'hintChain','unknown') and chain<>'solana','EVM input identity mismatch');
  perform public.analyzer_require(source='direct-input' and p_resolution->>'confidence' in ('CANDIDATE_IDENTITY','PARTIAL'),'Direct input is only a syntax candidate');
 elsif public.analyzer_is_solana_address(raw) then
  perform public.analyzer_require(p_resolution->>'inputType'='TOKEN_MINT' and token=raw and chain in ('solana','unknown') and (p_input->>'hintChain' is null or p_input->>'hintChain' in ('solana','unknown')),'Solana input identity mismatch');
  perform public.analyzer_require(source='direct-input' and p_resolution->>'confidence' in ('CANDIDATE_IDENTITY','PARTIAL'),'Direct input is only a syntax candidate');
 else
  if token is null then
   perform public.analyzer_require(p_resolution->>'canonicalTokenId' is null and p_resolution->>'inputType' not in ('CONTRACT_ADDRESS','TOKEN_MINT'),'Unresolved input cannot assert a token');
  else
   perform public.analyzer_require(p_resolution->>'inputType' in ('DEX_URL','CHART_URL') and chain in ('solana','ethereum','base','bnb') and public.analyzer_valid_address(chain,token) and p_resolution->>'confidence'='PARTIAL','Provider URL resolution is invalid');
   perform public.analyzer_require(source in ('dexscreener.com','birdeye.so','gmgn.ai','geckoterminal.com') and jsonb_array_length(p_resolution->'provenance')>1,'Provider URL resolution lacks provider provenance');
  end if;
 end if;
 perform public.analyzer_require(p_resolution->>'canonicalTokenId' is not distinct from public.analyzer_canonical_token_id(p_resolution),'Canonical token mismatch');
 foreach field in array array['pairAddress','poolAddress'] loop
  address:=p_resolution->>field;
  if address is not null then
   perform public.analyzer_require(public.analyzer_valid_address(chain,address),'Pair/pool identity is invalid');
   if p_resolution->>'inputType'='DEX_URL' then perform public.analyzer_require(position('/'||address in raw)>0,'Pair/pool identity mismatch'); end if;
  end if;
 end loop;
 foreach field in array array['symbol','name','decimals','supply','launchpad','creator','creationTimestamp','programOrContract'] loop
  perform public.analyzer_require(p_resolution->field='null'::jsonb,'Unverified resolution metadata');
 end loop;
 perform public.analyzer_require(p_resolution->>'confidence'<>'RESOLVED','Syntax-only resolution cannot assert verification');
end;
$$;

-- Return typed evidence groups instead of empty placeholders.  The result is
-- still descriptive intelligence; score and methodology remain inactive.
create or replace function public.analyzer_derive_result(p_input jsonb,p_manifest jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare available integer; total integer; coverage integer; sources jsonb; trades jsonb; market jsonb; liquidity jsonb; holders jsonb; creator jsonb; activity jsonb; lifecycle jsonb;
begin
 select count(*) into available from jsonb_array_elements(p_manifest->'observations') o where o->>'state'='AVAILABLE';
 total:=jsonb_array_length(p_manifest->'observations')+jsonb_array_length(p_manifest->'missing');
 coverage:=case when total=0 then 0 else round(available::numeric/total*100)::integer end;
 select coalesce(jsonb_agg(source order by source),'[]') into sources from(select distinct value->>'source' source from jsonb_array_elements(p_manifest->'observations')) s;
 select coalesce(jsonb_agg(o),'[]') into trades from jsonb_array_elements(p_manifest->'observations') o where o->>'key'='trade' and o->>'state'='AVAILABLE';
 select coalesce(jsonb_object_agg(key, value),'{}') into market from (
  select o->>'key' key, jsonb_build_object('value',o->'value','state',o->'state','source',o->>'source','observedAt',o->'observedAt','evidenceId',o->>'evidenceId','provenance',o->'provenance') value
  from jsonb_array_elements(p_manifest->'observations') o where o->>'state'='AVAILABLE' and o->>'key' in ('price','marketCap','fdv','volume','transactions','supply','decimals')
 ) values;
 select coalesce(jsonb_object_agg(key, value),'{}') into liquidity from (
  select o->>'key' key, jsonb_build_object('value',o->'value','state',o->'state','source',o->>'source','observedAt',o->'observedAt','evidenceId',o->>'evidenceId','provenance',o->'provenance') value
  from jsonb_array_elements(p_manifest->'observations') o where o->>'state'='AVAILABLE' and o->>'key' in ('liquidity','pool','poolAge')
 ) values;
 select coalesce(jsonb_object_agg(key, value),'{}') into holders from (
  select o->>'key' key, jsonb_build_object('value',o->'value','state',o->'state','source',o->>'source','observedAt',o->'observedAt','evidenceId',o->>'evidenceId','provenance',o->'provenance') value
  from jsonb_array_elements(p_manifest->'observations') o where o->>'state'='AVAILABLE' and o->>'key' in ('holders','concentration')
 ) values;
 select coalesce(jsonb_object_agg(key, value),'{}') into creator from (
  select o->>'key' key, jsonb_build_object('value',o->'value','state',o->'state','source',o->>'source','observedAt',o->'observedAt','evidenceId',o->>'evidenceId','provenance',o->'provenance') value
  from jsonb_array_elements(p_manifest->'observations') o where o->>'state'='AVAILABLE' and o->>'key' in ('creator','creatorBehavior')
 ) values;
 select coalesce(jsonb_object_agg(key, value),'{}') into activity from (
  select o->>'key' key, jsonb_build_object('value',o->'value','state',o->'state','source',o->>'source','observedAt',o->'observedAt','evidenceId',o->>'evidenceId','provenance',o->'provenance') value
  from jsonb_array_elements(p_manifest->'observations') o where o->>'state'='AVAILABLE' and o->>'key' in ('volume','transactions','activityChange')
 ) values;
 select coalesce(jsonb_object_agg(key, value),'{}') into lifecycle from (
  select o->>'key' key, jsonb_build_object('value',o->'value','state',o->'state','source',o->>'source','observedAt',o->'observedAt','evidenceId',o->>'evidenceId','provenance',o->'provenance') value
  from jsonb_array_elements(p_manifest->'observations') o where o->>'state'='AVAILABLE' and o->>'key' in ('lifecycle','migration')
 ) values;
 return jsonb_build_object(
  'status',case when p_manifest->'resolvedToken'->>'tokenAddress' is null then 'TOKEN_NOT_RESOLVED' when available=0 then 'INSUFFICIENT_DATA' else 'PARTIAL' end,
  'input',p_input,'resolvedToken',p_manifest->'resolvedToken','chain',p_manifest->'resolvedToken'->'chain',
  'pair',jsonb_build_object('address',p_manifest->'resolvedToken'->'pairAddress','pool',p_manifest->'resolvedToken'->'poolAddress'),
  'freshness',p_manifest->'freshness','dataConfidence',jsonb_build_object('state',case when coverage>=80 then 'HIGH' when coverage>=40 then 'MEDIUM' when coverage>0 then 'LOW' else 'UNKNOWN' end,'coverage',coverage,'reason','Evidence coverage only; not investment confidence.'),
  'evidenceSummary',jsonb_build_object('total',jsonb_array_length(p_manifest->'observations'),'available',available,'unknown',jsonb_array_length(p_manifest->'missing'),'sources',sources),
  'score','{"status":"METHODOLOGY_NOT_ACTIVE","value":null,"max":100,"methodologyVersion":null,"components":{"marketStructure":null,"liquidityQuality":null,"distribution":null,"activity":null,"authorityRisk":null,"creatorRisk":null,"manipulationRisk":null,"dataQuality":null}}'::jsonb,
  'market',market,'liquidity',liquidity,'holders',holders,'creator',creator,'activity',activity,'lifecycle',lifecycle,
  'topTrades',trades,'whyMoving','[{"classification":"UNKNOWN","explanation":"Deterministic facts are shown; no unsupported causal claim is asserted.","evidenceRefs":[]}]'::jsonb,
  'claimVerification',p_manifest->'claims','riskFactors','[{"key":"data_quality","state":"UNKNOWN","explanation":"No risk derivation is registered.","evidenceRefs":[]}]'::jsonb,
  'unknowns',p_manifest->'missing','positionSizing','{"status":"POSITION_SIZE_UNAVAILABLE","riskBudget":null,"stopDistancePercent":null,"positionNotional":null,"reason":"No risk parameters supplied."}'::jsonb,
  'aiInterpretation','{"status":"DISABLED","provider":null,"model":null,"content":null}'::jsonb,
  'citations',p_manifest->'resolvedToken'->'provenance','providerConflicts',p_manifest->'providerConflicts','methodologyVersion',null,'schemaVersion','token-analyzer-v1','createdAt',clock_timestamp());
end;
$$;

-- Provider telemetry is joined at read time so the sealed analysis/result
-- remains immutable while later retries still expose the same safe usage data.
create or replace function public.analyzer_get_delivery_receipt(p_delivery_key text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare receipt jsonb;
begin
 perform public.analyzer_assert_operator();
 select jsonb_build_object(
   'status','COMPLETED',
   'delivery_key',d.delivery_key,
   'request_id',d.request_id,
   'analysis_id',d.analysis_id,
   'analysis_version',d.analysis_version,
   'manifest_hash',d.manifest_hash,
   'result',a.result || jsonb_build_object('providerUsage',coalesce((select jsonb_agg(jsonb_build_object('provider',e.provider,'capability',e.capability,'status',case when e.metadata ? 'capabilityStatus' then e.metadata->>'capabilityStatus' when e.status='SUCCEEDED' then 'SUCCESS' else e.status end,'requestMade',coalesce((e.metadata->>'requestMade')::boolean,true),'latencyMs',coalesce(e.latency_ms,0),'attempts',coalesce((e.metadata->>'attempts')::integer,0),'cache',coalesce(e.metadata->>'cache','NONE'),'error',e.metadata->>'error') order by e.received_at) from public.analyzer_provider_events e where e.analysis_id=a.id),'[]'::jsonb))
 ) into receipt
 from public.analyzer_deliveries d join public.analyzer_analyses a on a.id=d.analysis_id where d.delivery_key=p_delivery_key;
 if receipt is not null then return receipt; end if;
 perform public.analyzer_require(exists(select 1 from public.analyzer_delivery_intents where delivery_key=p_delivery_key),'Unknown delivery key');
 return jsonb_build_object('status','EXISTING_IN_PROGRESS','delivery_key',p_delivery_key);
end;
$$;

revoke all on function public.analyzer_get_delivery_receipt(text) from public,anon,authenticated,service_role;
grant execute on function public.analyzer_get_delivery_receipt(text) to authenticated;

revoke all on function public.analyzer_contract_registry_v1() from public,anon,authenticated,service_role;

commit;
