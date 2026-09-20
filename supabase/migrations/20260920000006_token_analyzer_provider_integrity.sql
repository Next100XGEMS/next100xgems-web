begin;

-- Closed, shared provider context registry. Existing sealed evidence is untouched.
create or replace function public.analyzer_contract_registry()
returns jsonb language sql immutable security definer set search_path='' as $registry$
select $policy${"versions":{"input":"token-analyzer-input-v1","resolution":"token-analyzer-resolution-v1","evidence":"token-analyzer-v1","manifestFormat":1,"result":"token-analyzer-v1","scoreEngine":null,"methodology":null},"reuseSeconds":300,"completionWaitMs":30000,"fields":{"price":{"identityType":"TOKEN","referenceType":"TOKEN","value":"decimal"},"liquidity":{"identityType":"POOL","referenceType":"POOL","value":"decimal"},"volume":{"identityType":"POOL","referenceType":"POOL","value":"decimal"},"transactions":{"identityType":"POOL","referenceType":"POOL","value":"integer"},"holders":{"identityType":"TOKEN","referenceType":"TOKEN","value":"integer"},"concentration":{"identityType":"TOKEN","referenceType":"TOKEN","value":"decimal"},"creator":{"identityType":"WALLET","referenceType":"WALLET","value":"address"},"wallet":{"identityType":"WALLET","referenceType":"WALLET","value":"decimal"},"trade":{"identityType":"WALLET","referenceType":"TRANSACTION","value":"decimal"},"supply":{"identityType":"TOKEN","referenceType":"TOKEN","value":"integer"},"decimals":{"identityType":"TOKEN","referenceType":"TOKEN","value":"integer"},"mintAuthority":{"identityType":"TOKEN","referenceType":"TOKEN","value":"address"},"freezeAuthority":{"identityType":"TOKEN","referenceType":"TOKEN","value":"address"},"marketCap":{"identityType":"TOKEN","referenceType":"TOKEN","value":"decimal"},"fdv":{"identityType":"TOKEN","referenceType":"TOKEN","value":"decimal"},"pool":{"identityType":"POOL","referenceType":"POOL","value":"address"},"poolAge":{"identityType":"POOL","referenceType":"POOL","value":"integer"},"lifecycle":{"identityType":"TOKEN","referenceType":"TOKEN","value":"text"},"migration":{"identityType":"TOKEN","referenceType":"TOKEN","value":"text"},"creatorBehavior":{"identityType":"WALLET","referenceType":"WALLET","value":"text"},"activityChange":{"identityType":"POOL","referenceType":"POOL","value":"decimal"},"owner":{"identityType":"WALLET","referenceType":"WALLET","value":"address"}},"verifiedProvenance":["DIRECT_CHAIN","OBJECTIVE_PROVIDER"],"signalProvenance":["DIRECT_CHAIN","OBJECTIVE_PROVIDER","PROVIDER_DERIVED"],"positiveConclusions":{"CLAIM_SUPPORTED":"EXACT_TYPED_OBSERVATION","TOP_TRADE_PRESENT":"EXACT_TRADE_OBSERVATION","WHY_MOVING_VERIFIED_FACT":"UNREGISTERED","WHY_MOVING_STRONG_SIGNAL":"UNREGISTERED","RISK_PRESENT":"UNREGISTERED","LIQUIDITY_PRESENT":"UNREGISTERED","HOLDER_FACT_PRESENT":"UNREGISTERED","CREATOR_FACT_PRESENT":"UNREGISTERED","MARKET_FACT_PRESENT":"UNREGISTERED","ACTIVITY_FACT_PRESENT":"UNREGISTERED"},"schemas":{"input":{"type":"object","properties":{"raw":{"type":"string","minLength":1,"maxLength":4096},"hintChain":{"type":"string","enum":["solana","ethereum","base","bnb","unknown"],"nullable":true}},"optional":[]},"provenance":{"type":"object","properties":{"source":{"type":"string","minLength":1},"kind":{"type":"string","enum":["DIRECT_INPUT","URL_STRUCTURE","DIRECT_CHAIN","OBJECTIVE_PROVIDER","PROVIDER_DERIVED","CONTEXTUAL_PROPRIETARY"]},"reference":{"type":"string","minLength":1,"nullable":true},"capturedAt":{"type":"string","format":"timestamp"},"referenceType":{"type":"string","enum":["TOKEN","POOL","WALLET","TRANSACTION"]}},"optional":["referenceType"]},"resolution":{"type":"object","properties":{"inputType":{"type":"string","enum":["CONTRACT_ADDRESS","TOKEN_MINT","DEX_URL","CHART_URL","X_POST","ARTICLE","FACEBOOK_POST","INSTAGRAM_POST","GENERIC_URL","UNKNOWN"]},"source":{"type":"string","minLength":1},"chain":{"type":"string","enum":["solana","ethereum","base","bnb","unknown"]},"tokenAddress":{"type":"string","minLength":1,"nullable":true},"canonicalTokenId":{"type":"string","minLength":1,"nullable":true},"pairAddress":{"type":"string","minLength":1,"nullable":true},"poolAddress":{"type":"string","minLength":1,"nullable":true},"symbol":{"type":"string","nullable":true},"name":{"type":"string","nullable":true},"decimals":{"type":"string","nullable":true},"supply":{"type":"string","nullable":true},"launchpad":{"type":"string","nullable":true},"creator":{"type":"string","nullable":true},"creationTimestamp":{"type":"string","nullable":true},"programOrContract":{"type":"string","nullable":true},"confidence":{"type":"string","enum":["RESOLVED","CANDIDATE_IDENTITY","PARTIAL","UNKNOWN"]},"provenance":{"type":"array","items":{"ref":"provenance"},"maxItems":1000},"pairProof":{"type":"object","properties":{"provider":{"type":"string","const":"dex-screener"},"chain":{"type":"string","enum":["solana","ethereum","base","bnb"]},"pair":{"type":"string","minLength":1},"baseToken":{"type":"string","minLength":1},"quoteToken":{"type":"string","minLength":1},"selection":{"type":"string","const":"BASE_TOKEN"}},"optional":[]}},"optional":["pairProof"]},"observation":{"type":"object","properties":{"key":{"type":"string","enum":["price","liquidity","volume","transactions","holders","concentration","creator","wallet","trade","supply","decimals","mintAuthority","freezeAuthority","marketCap","fdv","pool","poolAge","lifecycle","migration","creatorBehavior","activityChange","owner"]},"label":{"type":"string","minLength":1},"value":{"type":"scalar"},"state":{"type":"string","enum":["AVAILABLE","UNKNOWN","UNAVAILABLE","UNSUPPORTED","STALE"]},"evidenceClass":{"type":"string","enum":["VERIFIED_DATA","STRONG_SIGNAL","UNKNOWN"]},"source":{"type":"string","minLength":1},"observedAt":{"type":"string","format":"timestamp","nullable":true},"evidenceId":{"type":"string","minLength":1,"maxLength":128},"identity":{"type":"string","minLength":1,"nullable":true},"identityType":{"type":"string","enum":["TOKEN","POOL","WALLET"],"nullable":true},"tokenId":{"type":"string","minLength":1,"nullable":true},"provenance":{"type":"array","items":{"ref":"provenance"},"maxItems":1000},"transactionReference":{"type":"string","minLength":1,"maxLength":88},"context":{"type":"object","properties":{"scope":{"type":"string","enum":["TOKEN_AGGREGATE","PAIR","POOL","BONDING_CURVE","CHAIN_MARKET","UNKNOWN_SCOPE"]},"chain":{"type":"string","enum":["solana","ethereum","base","bnb"]},"token":{"type":"string","minLength":1},"poolId":{"type":"string","nullable":true},"quoteAsset":{"type":"string","nullable":true},"timeWindow":{"type":"string","nullable":true},"retrievedAt":{"type":"string","format":"timestamp"},"completeness":{"type":"string","enum":["PARTIAL","COMPLETE","UNKNOWN"]},"classification":{"type":"string","enum":["DIRECT","OBJECTIVE_DERIVED","PROVIDER_DERIVED"]},"methodology":{"type":"string","nullable":true},"denominatorType":{"type":"string","const":"TOTAL_SUPPLY"},"denominatorValue":{"type":"string","pattern":"^[1-9][0-9]*$"},"returnedAccountCount":{"type":"number"},"requestedTopN":{"type":"number"},"exclusions":{"type":"array","items":{"type":"string","minLength":1},"maxItems":100},"tokenProgram":{"type":"string","minLength":1},"decoderVersion":{"type":"string","minLength":1},"curveAddress":{"type":"string","minLength":1},"virtualTokenReserves":{"type":"string","minLength":1},"virtualSolReserves":{"type":"string","minLength":1},"realTokenReserves":{"type":"string","minLength":1},"realSolReserves":{"type":"string","minLength":1},"complete":{"type":"boolean"},"rawBalances":{"type":"array","items":{"type":"object","properties":{"address":{"type":"string","minLength":1},"balance":{"type":"string","pattern":"^(0|[1-9][0-9]*)$"}},"optional":[]},"maxItems":20},"metricTopN":{"type":"number"}},"optional":["denominatorType","denominatorValue","returnedAccountCount","requestedTopN","exclusions","tokenProgram","decoderVersion","curveAddress","virtualTokenReserves","virtualSolReserves","realTokenReserves","realSolReserves","complete","rawBalances","metricTopN"]}},"optional":["transactionReference","context"]},"claim":{"type":"object","properties":{"conclusionType":{"type":"string","enum":["CLAIM_SUPPORTED"]},"claim":{"type":"string","minLength":1},"source":{"type":"string","minLength":1},"verification":{"type":"string","enum":["SUPPORTED","PARTIALLY_SUPPORTED"]},"evidenceRefs":{"type":"array","items":{"type":"string","minLength":1},"maxItems":1000},"evidenceType":{"type":"string","enum":["VERIFIED_DATA","STRONG_SIGNAL"]},"field":{"type":"string","enum":["price","liquidity","volume","transactions","holders","concentration","creator","wallet","trade","supply","decimals","mintAuthority","freezeAuthority","marketCap","fdv","pool","poolAge","lifecycle","migration","creatorBehavior","activityChange","owner"]},"identity":{"type":"string","minLength":1},"identityType":{"type":"string","enum":["TOKEN","POOL","WALLET"]},"tokenId":{"type":"string","minLength":1},"value":{"type":"scalar"}},"optional":[]},"manifest":{"type":"object","properties":{"schemaVersion":{"type":"string","const":"token-analyzer-v1"},"versions":{"const":{"input":"token-analyzer-input-v1","resolution":"token-analyzer-resolution-v1","evidence":"token-analyzer-v1","manifestFormat":1,"result":"token-analyzer-v1","scoreEngine":null,"methodology":null}},"manifestFormatVersion":{"type":"number","const":1},"evidenceRevision":{"type":"number","const":1},"capturedAt":{"type":"string","format":"timestamp"},"input":{"type":"object","properties":{"type":{"type":"string","enum":["CONTRACT_ADDRESS","TOKEN_MINT","DEX_URL","CHART_URL","X_POST","ARTICLE","FACEBOOK_POST","INSTAGRAM_POST","GENERIC_URL","UNKNOWN"]},"rawHash":{"type":"string","pattern":"^[0-9a-f]{64}$"}},"optional":[]},"resolvedToken":{"ref":"resolution"},"observations":{"type":"array","items":{"ref":"observation"},"maxItems":1000},"claims":{"type":"array","items":{"ref":"claim"},"maxItems":1000},"providerConflicts":{"type":"array","items":{"type":"object","properties":{"capability":{"type":"string","minLength":1,"maxLength":128},"providers":{"type":"array","items":{"type":"string","minLength":1,"maxLength":128},"maxItems":10},"state":{"type":"string","enum":["AGREEMENT","DISAGREEMENT","MISSING","STALE"]},"explanation":{"type":"string","minLength":1,"maxLength":1024},"evidenceRefs":{"type":"array","items":{"type":"string","minLength":1,"maxLength":128},"maxItems":100}},"optional":[]},"maxItems":50},"missing":{"type":"array","items":{"type":"string","minLength":1},"maxItems":1000},"freshness":{"type":"object","properties":{"state":{"type":"string","enum":["FRESH","STALE","UNKNOWN"]},"reason":{"type":"string"}},"optional":[]},"methodologyVersion":{"const":null}},"optional":[]}},"requiredSignals":["price","marketCap","fdv","liquidity","volume","transactions","holders","distribution","creatorBehavior","authorities","topTrades","freshness"]}$policy$::jsonb
$registry$;

alter function public.analyzer_validate_request(jsonb,jsonb) rename to analyzer_validate_request_pre_provider_integrity;
create function public.analyzer_url_identity(p_raw text)
returns jsonb language plpgsql immutable security definer set search_path='' as $$
declare m text[]; host text; path text; query text; parts text[]; chain text; addr text; kind text;
begin
 m:=regexp_match(p_raw,'^https?://(www\.)?(dexscreener\.com|birdeye\.so|gmgn\.ai|geckoterminal\.com)(/[^?#]*)(\?[^#]*)?(#.*)?$');
 perform public.analyzer_require(m is not null,'Unrecognized provider URL');
 host:=m[2];path:=m[3];query:=coalesce(m[4],'');parts:=string_to_array(trim(both '/' from path),'/');
 perform public.analyzer_require(path !~ '//|%|\\' and (query !~ '([?&]chain=.*){2}'),'Invalid provider path');
 if host='birdeye.so' then
  perform public.analyzer_require(array_length(parts,1)=2 and parts[1]='token','Invalid Birdeye path');
  chain:=(regexp_match(query,'[?&]chain=([a-z]+)(&|$)'))[1];addr:=parts[2];kind:='TOKEN';
 elsif host='dexscreener.com' then
  perform public.analyzer_require(array_length(parts,1)=2,'Invalid DEX Screener path');
  chain:=parts[1];addr:=parts[2];kind:='PAIR';
 else
  perform public.analyzer_require(array_length(parts,1)=3 and parts[2]=case when host='gmgn.ai' then 'token' else 'pools' end,'Invalid provider path');
  chain:=parts[1];addr:=parts[3];kind:=case when host='gmgn.ai' then 'TOKEN' else 'POOL' end;
 end if;
 chain:=case chain when 'eth' then 'ethereum' when 'sol' then 'solana' when 'bsc' then 'bnb' else chain end;
 if host<>'birdeye.so' and query ~ '[?&]chain=' then
  perform public.analyzer_require((regexp_match(query,'[?&]chain=([a-z]+)(&|$)'))[1] in (chain,case chain when 'ethereum' then 'eth' when 'solana' then 'sol' when 'bnb' then 'bsc' else chain end),'URL chain conflict');
 end if;
 if chain<>'solana' then addr:=lower(addr);end if;
 perform public.analyzer_require(public.analyzer_valid_address(chain,addr),'Invalid provider address');
 return jsonb_build_object('host',host,'chain',chain,'address',addr,'kind',kind);
end;$$;

create or replace function public.analyzer_validate_request(p_input jsonb,p_resolution jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare u jsonb; proof jsonb:=p_resolution->'pairProof'; token text:=p_resolution->>'tokenAddress'; field text;
begin
 perform public.analyzer_validate_shape(p_input,public.analyzer_contract_registry()->'schemas'->'input');
 perform public.analyzer_validate_shape(p_resolution,public.analyzer_contract_registry()->'schemas'->'resolution');
 if p_resolution->>'inputType' in ('DEX_URL','CHART_URL') then
  u:=public.analyzer_url_identity(p_input->>'raw');
  perform public.analyzer_require(p_resolution->>'source'=u->>'host' and p_resolution->>'chain'=u->>'chain' and (p_input->>'hintChain' is null or p_input->>'hintChain'='unknown' or p_input->>'hintChain'=u->>'chain'),'IDENTITY_CONFLICT: provider URL');
  perform public.analyzer_require(p_resolution->>'inputType'=case when u->>'kind'='TOKEN' then 'CHART_URL' else 'DEX_URL' end,'Input type mismatch');
  if u->>'kind'='TOKEN' then
   perform public.analyzer_require(token=u->>'address' and proof is null and p_resolution->>'pairAddress' is null and p_resolution->>'poolAddress' is null,'IDENTITY_CONFLICT: URL token');
  else
   perform public.analyzer_require(coalesce(p_resolution->>'pairAddress',p_resolution->>'poolAddress')=u->>'address','IDENTITY_CONFLICT: URL pool');
   perform public.analyzer_require(case when u->>'kind'='PAIR' then p_resolution->>'poolAddress' is null else p_resolution->>'pairAddress' is null end,'Unexpected pool identity');
   if token is not null then
    perform public.analyzer_require(proof is not null and proof->>'chain'=u->>'chain' and proof->>'pair'=u->>'address' and proof->>'baseToken'=token and public.analyzer_valid_address(u->>'chain',proof->>'quoteToken') and public.analyzer_valid_address(u->>'chain',token),'IDENTITY_CONFLICT: pair response');
   else perform public.analyzer_require(proof is null,'Unresolved input cannot assert a pair proof'); end if;
  end if;
  perform public.analyzer_require(p_resolution->>'canonicalTokenId' is not distinct from public.analyzer_canonical_token_id(p_resolution),'Canonical token mismatch');
  perform public.analyzer_require(p_resolution->>'confidence'='PARTIAL','URL identity remains provider-derived');
  foreach field in array array['symbol','name','decimals','supply','launchpad','creator','creationTimestamp','programOrContract'] loop
   perform public.analyzer_require(p_resolution->field='null'::jsonb,'Unverified metadata');
  end loop;
 else
  perform public.analyzer_require(proof is null,'Direct input cannot supply pair proof');
  perform public.analyzer_validate_request_pre_provider_integrity(p_input,p_resolution);
  perform public.analyzer_require(p_resolution->>'inputType' in ('CONTRACT_ADDRESS','TOKEN_MINT') or token is null,'Unverified URL identity');
 end if;
end;$$;

-- Syntax reservation is immutable. Only the exact URL pair's typed resolution
-- may add a base token after the reservation owner retrieves the pair.
alter function public.analyzer_validate_manifest(jsonb,jsonb,jsonb) rename to analyzer_validate_manifest_pre_provider_integrity;
create or replace function public.analyzer_validate_manifest(p_manifest jsonb,p_input jsonb,p_resolution jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare resolved jsonb:=p_manifest->'resolvedToken'; o jsonb; c jsonb; numerator numeric; denominator numeric;
begin
 perform public.analyzer_validate_request(p_input,p_resolution);
 if resolved is distinct from p_resolution then
  perform public.analyzer_require(p_resolution->>'inputType'='DEX_URL' and p_resolution->>'tokenAddress' is null and resolved ? 'pairProof'
   and (resolved-'tokenAddress'-'canonicalTokenId'-'pairProof')=(p_resolution-'tokenAddress'-'canonicalTokenId'),'Reservation identity cannot change');
 end if;
 perform public.analyzer_validate_manifest_pre_provider_integrity(p_manifest,p_input,resolved);
 for o in select value from jsonb_array_elements(p_manifest->'observations') where value->>'key'='concentration' and value ? 'context' and value->>'state'='AVAILABLE' loop
  c:=o->'context';denominator:=(c->>'denominatorValue')::numeric;
  perform public.analyzer_require(exists(select 1 from jsonb_array_elements(p_manifest->'observations') s where s->>'key'='supply' and s->>'state'='AVAILABLE' and s->>'evidenceClass'='VERIFIED_DATA' and s->>'tokenId'=o->>'tokenId' and s->>'value'=c->>'denominatorValue'),'Concentration denominator requires verified total supply');
  select coalesce(sum(balance),0) into numerator from (select (r->>'balance')::numeric balance from jsonb_array_elements(c->'rawBalances') r where not (c->'exclusions' ? (r->>'address')) order by (r->>'balance')::numeric desc limit 10) eligible;
  perform public.analyzer_require(denominator>0 and numerator<=denominator and trunc(numerator/denominator,18)=(o->>'value')::numeric and (numerator=0 or (o->>'value')::numeric>0),'Incorrect total-supply concentration');
 end loop;
end;$$;

create or replace function public.analyzer_validate_observation(p_observation jsonb,p_resolution jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare rule jsonb; kinds jsonb; value text; reference text; identity text:=p_observation->>'identity'; chain text:=p_resolution->>'chain'; c jsonb:=p_observation->'context';
begin
 perform public.analyzer_validate_shape(p_observation,public.analyzer_contract_registry()->'schemas'->'observation');
 if p_observation->>'state' is distinct from 'AVAILABLE' then return; end if;
 rule:=public.analyzer_contract_registry()->'fields'->(p_observation->>'key');
 if p_observation->>'source' in ('birdeye','dex-screener','helius','alchemy') then perform public.analyzer_require(c is not null,'Provider scope required');end if;
 if p_observation->>'source'='birdeye' then perform public.analyzer_require(c->>'scope'='TOKEN_AGGREGATE' and c->>'methodology'='BIRDEYE_TOKEN_OVERVIEW','Birdeye overview cannot claim pool');end if;
 if c->>'scope'='TOKEN_AGGREGATE' and p_observation->>'key' in ('liquidity','volume','transactions') then rule:=rule||'{"identityType":"TOKEN","referenceType":"TOKEN"}';end if;
 if p_observation->>'key'='concentration' then perform public.analyzer_require(c is not null,'Concentration requires explicit denominator');end if;
 if c is not null then
  perform public.analyzer_require(c->>'chain'=chain and c->>'token'=p_resolution->>'tokenAddress','Scope identity conflict');
  if c->>'scope'='TOKEN_AGGREGATE' then perform public.analyzer_require(c->'poolId'='null'::jsonb,'Aggregate cannot claim pool');end if;
  if c->>'scope' in ('PAIR','POOL') then perform public.analyzer_require(public.analyzer_valid_address(chain,c->>'poolId'),'Scope pool required');end if;
  if c->>'quoteAsset' is not null then perform public.analyzer_require(public.analyzer_valid_address(chain,c->>'quoteAsset'),'Invalid quote asset');end if;
  if rule->>'identityType'='POOL' then perform public.analyzer_require(c->>'poolId'=identity,'Scope/provenance pool mismatch');end if;
  if c->>'classification'='OBJECTIVE_DERIVED' then perform public.analyzer_require(p_observation->>'evidenceClass'='STRONG_SIGNAL','Derived metric cannot claim direct verification');end if;
  if p_observation->>'key'='concentration' then
   perform public.analyzer_require(c->>'classification'='OBJECTIVE_DERIVED' and c->>'denominatorType'='TOTAL_SUPPLY' and c->>'methodology'='TOP10_TOTAL_SUPPLY_SHARE' and c->>'completeness'='PARTIAL' and c->'requestedTopN'='20'::jsonb and c->'metricTopN'='10'::jsonb and c ? 'rawBalances' and c ? 'exclusions' and c->'returnedAccountCount'=to_jsonb(jsonb_array_length(c->'rawBalances')),'Invalid distribution metadata');
   perform public.analyzer_require(not exists(select 1 from jsonb_array_elements(c->'rawBalances') r where not public.analyzer_valid_address(chain,r->>'address')) and (select count(*)=count(distinct r->>'address') from jsonb_array_elements(c->'rawBalances') r),'Invalid largest-account sample');
  end if;
 end if;
 perform public.analyzer_require(rule is not null and p_resolution->>'canonicalTokenId' is not null and p_observation->>'tokenId'=p_resolution->>'canonicalTokenId' and p_observation->>'identityType'=rule->>'identityType' and public.analyzer_valid_address(chain,identity) and jsonb_typeof(p_observation->'observedAt')='string','Invalid evidence identity');
 if rule->>'identityType'='TOKEN' then perform public.analyzer_require(identity=p_resolution->>'tokenAddress','Evidence token mismatch');end if;
 if rule->>'identityType'='POOL' and coalesce(p_resolution->>'poolAddress',p_resolution->>'pairAddress') is not null then perform public.analyzer_require(identity=coalesce(p_resolution->>'poolAddress',p_resolution->>'pairAddress'),'Evidence pool mismatch');end if;
 perform public.analyzer_require(jsonb_typeof(p_observation->'value')='string','Exact values must be strings');value:=p_observation->>'value';
 if rule->>'value'='decimal' then perform public.analyzer_require(value ~ '^(0|[1-9][0-9]*)(\.[0-9]+)?$','Invalid decimal evidence');
 elsif rule->>'value'='integer' then perform public.analyzer_require(value ~ '^(0|[1-9][0-9]*)$','Invalid integer evidence');
 elsif rule->>'value'='address' then perform public.analyzer_require(public.analyzer_valid_address(chain,value),'Invalid address evidence');
 elsif rule->>'value'='text' then perform public.analyzer_require(length(btrim(value))>0,'Invalid text evidence');end if;
 if p_observation->>'key' in ('creator','owner') then perform public.analyzer_require(value=identity,'Entity identity mismatch');end if;
 reference:=identity;
 if p_observation->>'key'='trade' then reference:=p_observation->>'transactionReference';perform public.analyzer_require(public.analyzer_valid_transaction_ref(chain,reference),'Trade transaction identity required');end if;
 kinds:=public.analyzer_contract_registry()->case when p_observation->>'evidenceClass'='VERIFIED_DATA' then 'verifiedProvenance' else 'signalProvenance' end;
 perform public.analyzer_require(p_observation->>'evidenceClass' in ('VERIFIED_DATA','STRONG_SIGNAL') and jsonb_array_length(p_observation->'provenance')>0 and not exists(select 1 from jsonb_array_elements(p_observation->'provenance') p where (p->>'source'=p_observation->>'source' and p->>'referenceType'=rule->>'referenceType' and p->>'reference'=reference and kinds ? (p->>'kind')) is not true),'Incompatible semantic provenance');
end;$$;

alter function public.analyzer_derive_result(jsonb,jsonb) rename to analyzer_derive_result_pre_provider_integrity;
create or replace function public.analyzer_scoped_group(p_manifest jsonb,p_keys text[])
returns jsonb language sql immutable security definer set search_path='' as $$
 select coalesce(jsonb_object_agg(key,rows),'{}') from (
  select o->>'key' key,jsonb_agg(o order by ordinal) rows
  from jsonb_array_elements(p_manifest->'observations') with ordinality v(o,ordinal)
  where o->>'state'='AVAILABLE' and o->>'key'=any(p_keys) group by o->>'key'
 ) groups
$$;
create or replace function public.analyzer_derive_result(p_input jsonb,p_manifest jsonb)
returns jsonb language sql security definer set search_path='' as $$
 select public.analyzer_derive_result_pre_provider_integrity(p_input,p_manifest)||jsonb_build_object(
 'market',public.analyzer_scoped_group(p_manifest,array['price','marketCap','fdv','volume','transactions','supply','decimals','owner','mintAuthority','freezeAuthority']),
 'liquidity',public.analyzer_scoped_group(p_manifest,array['liquidity','pool','poolAge']),
 'holders',public.analyzer_scoped_group(p_manifest,array['holders','concentration']),
 'creator',public.analyzer_scoped_group(p_manifest,array['creator','creatorBehavior']),
 'activity',public.analyzer_scoped_group(p_manifest,array['volume','transactions','activityChange']),
 'lifecycle',public.analyzer_scoped_group(p_manifest,array['lifecycle','migration']))
$$;

-- A sealed receipt never joins operational telemetry.
create or replace function public.analyzer_start_reanalysis(p_delivery_key text,p_intent_id uuid,p_reason text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare source public.analyzer_deliveries%rowtype; input jsonb; resolution jsonb;
begin
 perform public.analyzer_assert_operator();perform public.analyzer_assert_enabled();
 select * into source from public.analyzer_deliveries where delivery_key=p_delivery_key;
 perform public.analyzer_require(source.delivery_key is not null and (select requester_id=auth.uid() from public.analyzer_requests where id=source.request_id),'Source delivery must belong to operator');
 select a.result->'input' into input from public.analyzer_analyses a where a.id=source.analysis_id;
 select r.resolution into resolution from public.analyzer_resolutions r where r.request_id=source.request_id;
 return public.analyzer_reserve_internal(input,resolution,'EXPLICIT_REANALYSIS',p_intent_id,p_reason,p_delivery_key);
end;$$;

create or replace function public.analyzer_get_delivery_receipt(p_delivery_key text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare receipt jsonb;
begin
 perform public.analyzer_assert_operator();
 select jsonb_build_object('status','COMPLETED','delivery_key',d.delivery_key,'request_id',d.request_id,'analysis_id',d.analysis_id,'analysis_version',d.analysis_version,'evidence_manifest_id',d.evidence_manifest_id,'manifest_hash',d.manifest_hash,'completed_at',d.sealed_at,'schema_version',a.result->'schemaVersion','methodology_version',a.result->'methodologyVersion','result_hash',public.analyzer_compute_delivery_key(public.analyzer_canonical_json(a.result)),'result',a.result)
 into receipt from public.analyzer_deliveries d join public.analyzer_analyses a on a.id=d.analysis_id where d.delivery_key=p_delivery_key;
 if receipt is not null then return receipt;end if;
 perform public.analyzer_require(exists(select 1 from public.analyzer_delivery_intents where delivery_key=p_delivery_key),'Unknown delivery key');
 return jsonb_build_object('status','EXISTING_IN_PROGRESS','delivery_key',p_delivery_key);
end;$$;

create function public.analyzer_get_provider_telemetry(p_delivery_key text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 perform public.analyzer_assert_operator();
 select coalesce(jsonb_agg(jsonb_build_object('provider',e.provider,'capability',e.capability,
 'requestOutcome',coalesce(e.metadata->>'requestOutcome',case when e.status='SUCCEEDED' and e.metadata->>'requestMade'='true' then 'SUCCESS' else null end),
 'capabilityStatus',case when e.metadata->>'capabilityStatus' in ('AVAILABLE','UNAVAILABLE','UNSUPPORTED','DEGRADED') then e.metadata->>'capabilityStatus' else 'UNKNOWN' end,
 'requestMade',coalesce((e.metadata->>'requestMade')::boolean,true),'attempts',coalesce((e.metadata->>'attempts')::integer,0),
 'latencyMs',e.latency_ms,'cache',e.metadata->>'cache','error',e.metadata->>'error') order by e.received_at),'[]')
 into result from public.analyzer_provider_events e join public.analyzer_deliveries d on d.analysis_id=e.analysis_id where d.delivery_key=p_delivery_key;
 return result;
end;$$;

revoke all on function public.analyzer_url_identity(text),public.analyzer_validate_request_pre_provider_integrity(jsonb,jsonb),public.analyzer_validate_manifest_pre_provider_integrity(jsonb,jsonb,jsonb),public.analyzer_derive_result_pre_provider_integrity(jsonb,jsonb),public.analyzer_scoped_group(jsonb,text[]),public.analyzer_get_provider_telemetry(text) from public,anon,authenticated,service_role;
grant execute on function public.analyzer_get_provider_telemetry(text) to authenticated;
-- Recreated helpers are never browser entry points.
revoke all on function public.analyzer_validate_request(jsonb,jsonb),public.analyzer_validate_manifest(jsonb,jsonb,jsonb),public.analyzer_derive_result(jsonb,jsonb) from public,anon,authenticated,service_role;
commit;
