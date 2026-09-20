begin;

-- One canonical key representation for new reservations and legacy backfill.
create or replace function public.analyzer_compute_delivery_key(p_context text)
returns text language sql immutable security definer set search_path='' as $$
 select encode(extensions.digest(convert_to(p_context,'UTF8'),'sha256'),'hex')
$$;


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
    delivery_identity = coalesce(nullif(a.delivery_identity, ''), public.analyzer_compute_delivery_key('legacy:'||a.id::text))
from public.analyzer_evidence_manifests as m
where m.id = a.evidence_manifest_id
  and (a.evidence_revision is null or a.delivery_identity is null or a.delivery_identity = '');
update public.analyzer_analyses as a
set evidence_revision = coalesce(a.evidence_revision, 1),
    delivery_identity = coalesce(nullif(a.delivery_identity, ''), public.analyzer_compute_delivery_key('legacy:'||a.id::text))
where a.evidence_revision is null or a.delivery_identity is null or a.delivery_identity = '';
insert into public.analyzer_deliveries(delivery_key, request_id, analysis_id, evidence_manifest_id, analysis_version, operation, manifest_hash, reanalysis_reason, created_at, sealed_at)
select a.delivery_identity, a.request_id, a.id, a.evidence_manifest_id, a.analysis_version, a.analysis_operation, a.evidence_manifest_hash, a.reanalysis_reason, a.created_at, a.created_at
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

-- The embedded registry is byte-for-byte JSON-equivalent to persistence-policy.json.
create or replace function public.analyzer_contract_registry()
returns jsonb language sql immutable security definer set search_path='' as $registry$
 select $policy${"versions":{"input":"token-analyzer-input-v1","resolution":"token-analyzer-resolution-v1","evidence":"token-analyzer-v1","manifestFormat":1,"result":"token-analyzer-v1","scoreEngine":null,"methodology":null},"reuseSeconds":300,"completionWaitMs":30000,"fields":{"price":{"identityType":"TOKEN","referenceType":"TOKEN","value":"decimal"},"liquidity":{"identityType":"POOL","referenceType":"POOL","value":"decimal"},"volume":{"identityType":"POOL","referenceType":"POOL","value":"decimal"},"transactions":{"identityType":"POOL","referenceType":"POOL","value":"integer"},"holders":{"identityType":"TOKEN","referenceType":"TOKEN","value":"integer"},"concentration":{"identityType":"TOKEN","referenceType":"TOKEN","value":"decimal"},"creator":{"identityType":"WALLET","referenceType":"WALLET","value":"address"},"wallet":{"identityType":"WALLET","referenceType":"WALLET","value":"decimal"},"trade":{"identityType":"WALLET","referenceType":"TRANSACTION","value":"decimal"},"supply":{"identityType":"TOKEN","referenceType":"TOKEN","value":"integer"},"mintAuthority":{"identityType":"TOKEN","referenceType":"TOKEN","value":"address"},"freezeAuthority":{"identityType":"TOKEN","referenceType":"TOKEN","value":"address"}},"verifiedProvenance":["DIRECT_CHAIN","OBJECTIVE_PROVIDER"],"signalProvenance":["DIRECT_CHAIN","OBJECTIVE_PROVIDER","PROVIDER_DERIVED"],"positiveConclusions":{"CLAIM_SUPPORTED":"EXACT_TYPED_OBSERVATION","TOP_TRADE_PRESENT":"EXACT_TRADE_OBSERVATION","WHY_MOVING_VERIFIED_FACT":"UNREGISTERED","WHY_MOVING_STRONG_SIGNAL":"UNREGISTERED","RISK_PRESENT":"UNREGISTERED","LIQUIDITY_PRESENT":"UNREGISTERED","HOLDER_FACT_PRESENT":"UNREGISTERED","CREATOR_FACT_PRESENT":"UNREGISTERED","MARKET_FACT_PRESENT":"UNREGISTERED","ACTIVITY_FACT_PRESENT":"UNREGISTERED"},"schemas":{"input":{"type":"object","properties":{"raw":{"type":"string","minLength":1,"maxLength":4096},"hintChain":{"type":"string","enum":["solana","ethereum","base","bnb","unknown"],"nullable":true}},"optional":[]},"provenance":{"type":"object","properties":{"source":{"type":"string","minLength":1},"kind":{"type":"string","enum":["DIRECT_INPUT","URL_STRUCTURE","DIRECT_CHAIN","OBJECTIVE_PROVIDER","PROVIDER_DERIVED","CONTEXTUAL_PROPRIETARY"]},"reference":{"type":"string","minLength":1,"nullable":true},"capturedAt":{"type":"string","format":"timestamp"},"referenceType":{"type":"string","enum":["TOKEN","POOL","WALLET","TRANSACTION"]}},"optional":["referenceType"]},"resolution":{"type":"object","properties":{"inputType":{"type":"string","enum":["CONTRACT_ADDRESS","TOKEN_MINT","DEX_URL","CHART_URL","X_POST","ARTICLE","FACEBOOK_POST","INSTAGRAM_POST","GENERIC_URL","UNKNOWN"]},"source":{"type":"string","minLength":1},"chain":{"type":"string","enum":["solana","ethereum","base","bnb","unknown"]},"tokenAddress":{"type":"string","minLength":1,"nullable":true},"canonicalTokenId":{"type":"string","minLength":1,"nullable":true},"pairAddress":{"type":"string","minLength":1,"nullable":true},"poolAddress":{"type":"string","minLength":1,"nullable":true},"symbol":{"type":"string","nullable":true},"name":{"type":"string","nullable":true},"decimals":{"type":"string","nullable":true},"supply":{"type":"string","nullable":true},"launchpad":{"type":"string","nullable":true},"creator":{"type":"string","nullable":true},"creationTimestamp":{"type":"string","nullable":true},"programOrContract":{"type":"string","nullable":true},"confidence":{"type":"string","enum":["RESOLVED","CANDIDATE_IDENTITY","PARTIAL","UNKNOWN"]},"provenance":{"type":"array","items":{"ref":"provenance"},"maxItems":1000}},"optional":[]},"observation":{"type":"object","properties":{"key":{"type":"string","enum":["price","liquidity","volume","transactions","holders","concentration","creator","wallet","trade","supply","mintAuthority","freezeAuthority"]},"label":{"type":"string","minLength":1},"value":{"type":"scalar"},"state":{"type":"string","enum":["AVAILABLE","UNKNOWN","UNAVAILABLE","UNSUPPORTED","STALE"]},"evidenceClass":{"type":"string","enum":["VERIFIED_DATA","STRONG_SIGNAL","UNKNOWN"]},"source":{"type":"string","minLength":1},"observedAt":{"type":"string","format":"timestamp","nullable":true},"evidenceId":{"type":"string","minLength":1,"maxLength":128},"identity":{"type":"string","minLength":1,"nullable":true},"identityType":{"type":"string","enum":["TOKEN","POOL","WALLET"],"nullable":true},"tokenId":{"type":"string","minLength":1,"nullable":true},"provenance":{"type":"array","items":{"ref":"provenance"},"maxItems":1000},"transactionReference":{"type":"string","minLength":1,"maxLength":88}},"optional":["transactionReference"]},"claim":{"type":"object","properties":{"conclusionType":{"type":"string","enum":["CLAIM_SUPPORTED"]},"claim":{"type":"string","minLength":1},"source":{"type":"string","minLength":1},"verification":{"type":"string","enum":["SUPPORTED","PARTIALLY_SUPPORTED"]},"evidenceRefs":{"type":"array","items":{"type":"string","minLength":1},"maxItems":1000},"evidenceType":{"type":"string","enum":["VERIFIED_DATA","STRONG_SIGNAL"]},"field":{"type":"string","enum":["price","liquidity","volume","transactions","holders","concentration","creator","wallet","trade","supply","mintAuthority","freezeAuthority"]},"identity":{"type":"string","minLength":1},"identityType":{"type":"string","enum":["TOKEN","POOL","WALLET"]},"tokenId":{"type":"string","minLength":1},"value":{"type":"scalar"}},"optional":[]},"manifest":{"type":"object","properties":{"schemaVersion":{"type":"string","const":"token-analyzer-v1"},"versions":{"const":{"input":"token-analyzer-input-v1","resolution":"token-analyzer-resolution-v1","evidence":"token-analyzer-v1","manifestFormat":1,"result":"token-analyzer-v1","scoreEngine":null,"methodology":null}},"manifestFormatVersion":{"type":"number","const":1},"evidenceRevision":{"type":"number","const":1},"capturedAt":{"type":"string","format":"timestamp"},"input":{"type":"object","properties":{"type":{"type":"string","enum":["CONTRACT_ADDRESS","TOKEN_MINT","DEX_URL","CHART_URL","X_POST","ARTICLE","FACEBOOK_POST","INSTAGRAM_POST","GENERIC_URL","UNKNOWN"]},"rawHash":{"type":"string","pattern":"^[0-9a-f]{64}$"}},"optional":[]},"resolvedToken":{"ref":"resolution"},"observations":{"type":"array","items":{"ref":"observation"},"maxItems":1000},"claims":{"type":"array","items":{"ref":"claim"},"maxItems":1000},"providerConflicts":{"type":"array","items":{"type":"scalar"},"maxItems":0},"missing":{"type":"array","items":{"type":"string","minLength":1},"maxItems":1000},"freshness":{"type":"object","properties":{"state":{"type":"string","enum":["FRESH","STALE","UNKNOWN"]},"reason":{"type":"string"}},"optional":[]},"methodologyVersion":{"const":null}},"optional":[]}},"requiredSignals":["price","marketCap","fdv","liquidity","volume","transactions","holders","distribution","creatorBehavior","authorities","topTrades","freshness"]}$policy$::jsonb
$registry$;

create or replace function public.analyzer_require(p_condition boolean, p_reason text)
returns void language plpgsql security definer set search_path='' as $$
begin if p_condition is not true then raise exception '%',p_reason using errcode='23P01'; end if; end;
$$;

create or replace function public.analyzer_validate_shape(p_value jsonb,p_shape jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare s jsonb:=p_shape; item record; v jsonb; t text; text_value text;
begin
 if s ? 'ref' then s:=public.analyzer_contract_registry()->'schemas'->(s->>'ref'); end if;
 perform public.analyzer_require(p_value is not null and s is not null,'Missing Analyzer field');
 if s ? 'const' then perform public.analyzer_require(p_value=s->'const','Unsupported Analyzer version'); return; end if;
 if s->>'nullable'='true' and p_value='null'::jsonb then return; end if;
 t:=jsonb_typeof(p_value);
 if s->>'type'='scalar' then perform public.analyzer_require(t in ('string','number','boolean','null'),'Invalid Analyzer scalar'); return; end if;
 perform public.analyzer_require(t=s->>'type','Invalid Analyzer JSON type');
 if s ? 'enum' then perform public.analyzer_require(s->'enum' @> jsonb_build_array(p_value),'Invalid Analyzer enum'); end if;
 if t='object' then
  perform public.analyzer_require(not exists(select 1 from jsonb_object_keys(p_value) k where not (s->'properties' ? k)),'Unknown Analyzer field');
  for item in select key,value from jsonb_each(s->'properties') loop
   if not (p_value ? item.key) and coalesce(s->'optional','[]'::jsonb) ? item.key then continue; end if;
   perform public.analyzer_validate_shape(p_value->item.key,item.value);
  end loop;
 elsif t='array' then
  perform public.analyzer_require(jsonb_array_length(p_value)<=coalesce((s->>'maxItems')::integer,1000),'Analyzer array too large');
  for v in select value from jsonb_array_elements(p_value) loop perform public.analyzer_validate_shape(v,s->'items'); end loop;
 elsif t='string' then
  text_value:=p_value#>>'{}';
  perform public.analyzer_require(length(text_value) between coalesce((s->>'minLength')::integer,0) and coalesce((s->>'maxLength')::integer,4096),'Invalid Analyzer string');
  if s ? 'pattern' then perform public.analyzer_require(text_value ~ (s->>'pattern'),'Invalid Analyzer string format'); end if;
  if s->>'format'='timestamp' then
   perform public.analyzer_require(text_value ~ '^\d{4}-\d\d-\d\dT','Invalid Analyzer timestamp');
   perform text_value::timestamptz;
  end if;
 end if;
end;
$$;

create or replace function public.analyzer_canonical_json(p_value jsonb)
returns text language plpgsql immutable security definer set search_path='' as $$
declare result text;
begin
 if jsonb_typeof(p_value)='object' then
  select '{'||coalesce(string_agg(to_jsonb(key)::text||':'||public.analyzer_canonical_json(value),',' order by key collate "C"),'')||'}' into result from jsonb_each(p_value);
 elsif jsonb_typeof(p_value)='array' then
  select '['||coalesce(string_agg(public.analyzer_canonical_json(value),',' order by ordinal),'')||']' into result from jsonb_array_elements(p_value) with ordinality a(value,ordinal);
 else result:=p_value::text; end if;
 return result;
end;
$$;


create or replace function public.analyzer_valid_address(p_chain text,p_address text)
returns boolean language sql immutable security definer set search_path='' as $$
 select case when p_chain='solana' then public.analyzer_is_solana_address(p_address)
 when p_chain in ('ethereum','base','bnb') then coalesce(p_address ~ '^0x[0-9a-f]{40}$',false) else false end
$$;

create or replace function public.analyzer_valid_transaction_ref(p_chain text,p_value text)
returns boolean language plpgsql immutable security definer set search_path='' as $$
declare alphabet text:='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'; n numeric:=0; bytes integer:=0; leading_count integer:=0; i integer;
begin
 if p_chain<>'solana' then return p_chain in ('ethereum','base','bnb') and coalesce(p_value ~ '^0x[0-9a-f]{64}$',false); end if;
 if p_value is null or p_value !~ '^[1-9A-HJ-NP-Za-km-z]{64,88}$' then return false; end if;
 for i in 1..length(p_value) loop n:=n*58+strpos(alphabet,substr(p_value,i,1))-1; end loop;
 while n>=1 loop bytes:=bytes+1;n:=trunc(n/256);end loop;
 while leading_count<length(p_value) and substr(p_value,leading_count+1,1)='1' loop leading_count:=leading_count+1;end loop;
 return bytes+leading_count=64;
end;
$$;

create or replace function public.analyzer_validate_request(p_input jsonb,p_resolution jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare raw text:=p_input->>'raw'; chain text:=p_resolution->>'chain'; token text:=p_resolution->>'tokenAddress'; field text; address text;
begin
 perform public.analyzer_validate_shape(p_input,public.analyzer_contract_registry()->'schemas'->'input');
 perform public.analyzer_validate_shape(p_resolution,public.analyzer_contract_registry()->'schemas'->'resolution');
 perform public.analyzer_require(raw=btrim(raw),'Input must be canonical');
 perform public.analyzer_require(not exists(select 1 from jsonb_array_elements(p_resolution->'provenance') p where
   (p->>'kind'=case when p_resolution->>'source'='direct-input' then 'DIRECT_INPUT' else 'URL_STRUCTURE' end
    and p->>'source'=p_resolution->>'source' and p->>'reference'=raw) is not true),'Syntax resolution cannot assert provider provenance');
 if raw ~ '^0x[0-9a-fA-F]{40}$' then
  perform public.analyzer_require(p_resolution->>'inputType'='CONTRACT_ADDRESS' and token=lower(raw) and chain=coalesce(p_input->>'hintChain','unknown') and chain<>'solana','EVM input identity mismatch');
  perform public.analyzer_require(p_resolution->>'source'='direct-input' and p_resolution->>'confidence'='CANDIDATE_IDENTITY','Direct input is only a syntax candidate');
 elsif public.analyzer_is_solana_address(raw) then
  perform public.analyzer_require(p_resolution->>'inputType'='TOKEN_MINT' and token=raw and chain=case when p_input->>'hintChain'='solana' then 'solana' else 'unknown' end,'Solana input identity mismatch');
  perform public.analyzer_require(p_resolution->>'source'='direct-input' and p_resolution->>'confidence'='CANDIDATE_IDENTITY','Direct input is only a syntax candidate');
 else
  -- No live resolver is enabled. URL/text cannot invent a resolved mint.
  perform public.analyzer_require(token is null and p_resolution->>'canonicalTokenId' is null and p_resolution->>'inputType' not in ('CONTRACT_ADDRESS','TOKEN_MINT'),'Unresolved input cannot assert a token');
 end if;
 perform public.analyzer_require(p_resolution->>'canonicalTokenId' is not distinct from public.analyzer_canonical_token_id(p_resolution),'Canonical token mismatch');
 foreach field in array array['pairAddress','poolAddress'] loop
  address:=p_resolution->>field;
  if address is not null then
   perform public.analyzer_require(public.analyzer_valid_address(chain,address) and p_resolution->>'inputType'='DEX_URL' and position('/'||address in raw)>0,'Pair/pool identity mismatch');
  end if;
 end loop;
 foreach field in array array['symbol','name','decimals','supply','launchpad','creator','creationTimestamp','programOrContract'] loop
  perform public.analyzer_require(p_resolution->field='null'::jsonb,'Unverified resolution metadata');
 end loop;
 perform public.analyzer_require(p_resolution->>'confidence'<>'RESOLVED','Syntax-only resolution cannot assert verification');
end;
$$;

create or replace function public.analyzer_validate_observation(p_observation jsonb,p_resolution jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare rule jsonb; kinds jsonb; value text; reference text; identity text:=p_observation->>'identity'; chain text:=p_resolution->>'chain';
begin
 perform public.analyzer_validate_shape(p_observation,public.analyzer_contract_registry()->'schemas'->'observation');
 if p_observation->>'state' is distinct from 'AVAILABLE' then return; end if;
 rule:=public.analyzer_contract_registry()->'fields'->(p_observation->>'key');
 perform public.analyzer_require(rule is not null and p_resolution->>'canonicalTokenId' is not null and p_observation->>'tokenId'=p_resolution->>'canonicalTokenId' and p_observation->>'identityType'=rule->>'identityType' and public.analyzer_valid_address(chain,identity) and jsonb_typeof(p_observation->'observedAt')='string','Invalid evidence identity');
 if rule->>'identityType'='TOKEN' then perform public.analyzer_require(identity=p_resolution->>'tokenAddress','Evidence token mismatch'); end if;
 if rule->>'identityType'='POOL' and coalesce(p_resolution->>'poolAddress',p_resolution->>'pairAddress') is not null then
  perform public.analyzer_require(identity=coalesce(p_resolution->>'poolAddress',p_resolution->>'pairAddress'),'Evidence pool mismatch');
 end if;
 perform public.analyzer_require(jsonb_typeof(p_observation->'value')='string','Exact values must be strings');
 value:=p_observation->>'value';
 if rule->>'value'='decimal' then perform public.analyzer_require(value ~ '^(0|[1-9][0-9]*)(\.[0-9]+)?$','Invalid decimal evidence');
 elsif rule->>'value'='integer' then perform public.analyzer_require(value ~ '^(0|[1-9][0-9]*)$','Invalid integer evidence');
 elsif rule->>'value'='address' then perform public.analyzer_require(public.analyzer_valid_address(chain,value),'Invalid address evidence'); end if;
 if p_observation->>'key'='creator' then perform public.analyzer_require(value=identity,'Creator identity mismatch'); end if;
 reference:=identity;
 if p_observation->>'key'='trade' then reference:=p_observation->>'transactionReference';perform public.analyzer_require(public.analyzer_valid_transaction_ref(chain,reference),'Trade transaction identity required');end if;
 kinds:=public.analyzer_contract_registry()->case when p_observation->>'evidenceClass'='VERIFIED_DATA' then 'verifiedProvenance' else 'signalProvenance' end;
 perform public.analyzer_require(p_observation->>'evidenceClass' in ('VERIFIED_DATA','STRONG_SIGNAL') and jsonb_array_length(p_observation->'provenance')>0 and not exists(
  select 1 from jsonb_array_elements(p_observation->'provenance') p where (p->>'source'=p_observation->>'source' and p->>'referenceType'=rule->>'referenceType' and p->>'reference'=reference and kinds ? (p->>'kind')) is not true
 ),'Incompatible semantic provenance');
end;
$$;

create or replace function public.analyzer_validate_claim(p_claim jsonb,p_manifest jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare evidence_id text; observation jsonb; field text;
begin
 perform public.analyzer_validate_shape(p_claim,public.analyzer_contract_registry()->'schemas'->'claim');
 perform public.analyzer_require(p_claim->>'claim'=(p_claim->>'field')||' ('||(p_claim->>'identity')||') = '||(p_claim->>'value'),'Positive claim text must be derived from typed fact');
 perform public.analyzer_require(jsonb_array_length(p_claim->'evidenceRefs')>0,'Claim requires evidence');
 for evidence_id in select jsonb_array_elements_text(p_claim->'evidenceRefs') loop
  select value into observation from jsonb_array_elements(p_manifest->'observations') where value->>'evidenceId'=evidence_id;
  perform public.analyzer_require(observation is not null and observation->>'state' is not distinct from 'AVAILABLE','Claim requires AVAILABLE evidence');
  perform public.analyzer_validate_observation(observation,p_manifest->'resolvedToken');
  perform public.analyzer_require(p_claim->>'field'=observation->>'key' and p_claim->>'evidenceType'=observation->>'evidenceClass','Claim evidence type mismatch');
  foreach field in array array['identity','identityType','tokenId','source','value'] loop
   perform public.analyzer_require(p_claim->field=observation->field,'Claim field/value/identity mismatch');
  end loop;
  perform public.analyzer_require(p_claim->>'verification'<>'SUPPORTED' or p_claim->>'evidenceType'='VERIFIED_DATA','Supported claims require verified facts');
 end loop;
end;
$$;

-- A closed draft schema plus one semantic pass. No caller result is accepted.
create or replace function public.analyzer_validate_manifest(p_manifest jsonb,p_input jsonb,p_resolution jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare observation jsonb; claim jsonb; missing jsonb;
begin
 perform public.analyzer_validate_shape(p_manifest,public.analyzer_contract_registry()->'schemas'->'manifest');
 perform public.analyzer_validate_request(p_input,p_resolution);
 perform public.analyzer_require(p_manifest->'resolvedToken'=p_resolution,'Manifest resolution differs from reservation');
 perform public.analyzer_require(p_manifest->'input'->>'type'=p_resolution->>'inputType' and p_manifest->'input'->>'rawHash'=public.analyzer_compute_delivery_key(public.analyzer_canonical_json(p_input)),'Manifest nested input mismatch');
 perform public.analyzer_require((select count(*)=count(distinct v->>'evidenceId') from jsonb_array_elements(p_manifest->'observations') v),'Duplicate evidence identifiers');
 for observation in select value from jsonb_array_elements(p_manifest->'observations') loop perform public.analyzer_validate_observation(observation,p_resolution); end loop;
 for claim in select value from jsonb_array_elements(p_manifest->'claims') loop perform public.analyzer_validate_claim(claim,p_manifest); end loop;
 select coalesce(jsonb_agg(field order by ordinal),'[]') into missing from jsonb_array_elements(public.analyzer_contract_registry()->'requiredSignals') with ordinality f(field,ordinal)
 where not exists(select 1 from jsonb_array_elements(p_manifest->'observations') o where o->>'state'='AVAILABLE' and o->'key'=field);
 perform public.analyzer_require(p_manifest->'missing'=missing,'Missingness must be derived from evidence');
 -- No TTL is activated at this foundation boundary. Presence of a time is not freshness.
 perform public.analyzer_require(p_manifest->'freshness'->>'state' in ('UNKNOWN','STALE'),'No current evidence freshness policy is active');
end;
$$;

create table public.analyzer_delivery_intents (
 delivery_key text primary key check(delivery_key ~ '^[0-9a-f]{64}$'),
 request_id uuid not null references public.analyzer_requests(id),
 intent_context jsonb not null,
 owner_id uuid not null references public.profiles(id),
 owner_token uuid not null default gen_random_uuid(),
 operation text not null check(operation in ('ANALYZE','FRESH_ANALYSIS','EXPLICIT_REANALYSIS')),
 input jsonb not null, resolution jsonb not null,
 source_delivery_key text references public.analyzer_deliveries(delivery_key),
 reanalysis_reason text,
 reserved_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null
);
alter table public.analyzer_delivery_intents enable row level security;
revoke all on public.analyzer_delivery_intents from public,anon,authenticated,service_role;
create trigger analyzer_delivery_intents_no_mutation before update or delete on public.analyzer_delivery_intents for each row execute function public.reject_immutable_change();
create index analyzer_delivery_intents_request_idx on public.analyzer_delivery_intents(request_id,reserved_at desc);

create or replace function public.analyzer_reserve_internal(p_input jsonb,p_resolution jsonb,p_operation text,p_intent_id uuid,p_reason text,p_source text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare request_context jsonb; request_key text; key text; request_row public.analyzer_requests%rowtype; reservation public.analyzer_delivery_intents%rowtype; resolution jsonb; config_context jsonb; context jsonb; receipt jsonb;
begin
 perform public.analyzer_assert_operator(); perform public.analyzer_assert_enabled();
 perform public.analyzer_validate_request(p_input,p_resolution);
 perform public.analyzer_require(p_operation in ('ANALYZE','FRESH_ANALYSIS','EXPLICIT_REANALYSIS'),'Invalid intent operation');
 if p_operation<>'ANALYZE' then perform public.analyzer_require(p_intent_id is not null,'Explicit intent UUID required'); end if;
 if p_operation='EXPLICIT_REANALYSIS' then perform public.analyzer_require(length(btrim(p_reason)) between 1 and 4096 and p_source is not null,'Reanalysis requires reason and source'); end if;
 select jsonb_build_object('ai',ai_enabled,'social',social_specialist_enabled,'escalation',escalation_enabled) into config_context from public.analyzer_config where singleton;
 perform public.analyzer_require(config_context='{"ai":false,"social":false,"escalation":false}'::jsonb,'AI configuration must remain inactive');
 request_context:=jsonb_build_object('actor',auth.uid(),'input',p_input,'chain',p_resolution->'chain','token',p_resolution->'canonicalTokenId','inputType',p_resolution->'inputType','pair',p_resolution->'pairAddress','pool',p_resolution->'poolAddress','versions',public.analyzer_contract_registry()->'versions','mode','DETERMINISTIC','config',config_context);
 request_key:=public.analyzer_compute_delivery_key(public.analyzer_canonical_json(request_context));
 perform pg_advisory_xact_lock(hashtextextended(request_key,0));
 select * into request_row from public.analyzer_requests where request_fingerprint=request_key for update;
 if request_row.id is null then
  insert into public.analyzer_requests(requester_id,raw_input,input_type,requested_chain,request_fingerprint) values(auth.uid(),p_input->>'raw',p_resolution->>'inputType',p_resolution->>'chain',request_key) returning * into request_row;
  insert into public.analyzer_resolutions(request_id,resolution) values(request_row.id,p_resolution);
 end if;
 select r.resolution into resolution from public.analyzer_resolutions r where r.request_id=request_row.id;
 if p_operation='ANALYZE' then
  select * into reservation from public.analyzer_delivery_intents where request_id=request_row.id and operation='ANALYZE' and expires_at>clock_timestamp() order by reserved_at desc limit 1;
  if reservation.delivery_key is null then p_intent_id:=gen_random_uuid(); end if;
 end if;
 context:=jsonb_build_object('request',request_key,'operation',p_operation,'intent',p_intent_id,'reason',p_reason,'source',p_source);
 key:=public.analyzer_compute_delivery_key(public.analyzer_canonical_json(context));
 if reservation.delivery_key is null then select * into reservation from public.analyzer_delivery_intents where delivery_key=key; end if;
 if reservation.delivery_key is not null then
  if exists(select 1 from public.analyzer_deliveries where delivery_key=reservation.delivery_key) then receipt:=public.analyzer_get_delivery_receipt(reservation.delivery_key); end if;
  return jsonb_build_object('status',case when receipt is null then 'EXISTING_IN_PROGRESS' else 'COMPLETED' end,'delivery_key',reservation.delivery_key,'receipt',receipt);
 end if;
 insert into public.analyzer_delivery_intents(delivery_key,request_id,intent_context,owner_id,operation,input,resolution,source_delivery_key,reanalysis_reason,expires_at)
 values(key,request_row.id,context,auth.uid(),p_operation,p_input,resolution,p_source,p_reason,clock_timestamp()+make_interval(secs=>(public.analyzer_contract_registry()->>'reuseSeconds')::integer)) returning * into reservation;
 return jsonb_build_object('status','NEW','delivery_key',key,'owner_token',reservation.owner_token,'input',p_input,'resolution',resolution,'source_delivery_key',p_source);
end;
$$;

create or replace function public.analyzer_reserve_delivery(p_input jsonb,p_resolution jsonb)
returns jsonb language sql volatile security definer set search_path='' as $$
 select public.analyzer_reserve_internal(p_input,p_resolution,'ANALYZE',null,null,null)
$$;
create or replace function public.analyzer_start_fresh_analysis(p_input jsonb,p_resolution jsonb,p_intent_id uuid)
returns jsonb language sql volatile security definer set search_path='' as $$
 select public.analyzer_reserve_internal(p_input,p_resolution,'FRESH_ANALYSIS',p_intent_id,null,null)
$$;
create or replace function public.analyzer_start_reanalysis(p_delivery_key text,p_intent_id uuid,p_reason text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare source public.analyzer_deliveries%rowtype; manifest jsonb; input jsonb;
begin
 perform public.analyzer_assert_operator(); perform public.analyzer_assert_enabled();
 select * into source from public.analyzer_deliveries where delivery_key=p_delivery_key;
 perform public.analyzer_require(source.delivery_key is not null,'Source delivery not found');
 perform public.analyzer_require((select requester_id=auth.uid() from public.analyzer_requests where id=source.request_id),'Reanalysis must belong to the original operator request');
 select m.manifest into manifest from public.analyzer_evidence_manifests m where m.id=source.evidence_manifest_id;
 -- Only current validated contracts can be reinterpreted. Legacy receipts remain readable.
 perform public.analyzer_require(manifest->'versions'=public.analyzer_contract_registry()->'versions','Legacy evidence requires fresh capture');
 select a.result->'input' into input from public.analyzer_analyses a where a.id=source.analysis_id;
 return public.analyzer_reserve_internal(input,manifest->'resolvedToken','EXPLICIT_REANALYSIS',p_intent_id,p_reason,p_delivery_key);
end;
$$;

create or replace function public.analyzer_derive_result(p_input jsonb,p_manifest jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare available integer; total integer; coverage integer; sources jsonb; trades jsonb;
begin
 select count(*) into available from jsonb_array_elements(p_manifest->'observations') o where o->>'state'='AVAILABLE';
 total:=jsonb_array_length(p_manifest->'observations')+jsonb_array_length(p_manifest->'missing');
 coverage:=case when total=0 then 0 else round(available::numeric/total*100)::integer end;
 select coalesce(jsonb_agg(source order by source),'[]') into sources from(select distinct value->>'source' source from jsonb_array_elements(p_manifest->'observations')) s;
 select coalesce(jsonb_agg(o),'[]') into trades from jsonb_array_elements(p_manifest->'observations') o where o->>'key'='trade' and o->>'state'='AVAILABLE';
 return jsonb_build_object(
 'status',case when p_manifest->'resolvedToken'->>'tokenAddress' is null then 'TOKEN_NOT_RESOLVED' when available=0 then 'INSUFFICIENT_DATA' else 'PARTIAL' end,
 'input',p_input,'resolvedToken',p_manifest->'resolvedToken','chain',p_manifest->'resolvedToken'->'chain',
 'pair',jsonb_build_object('address',p_manifest->'resolvedToken'->'pairAddress','pool',p_manifest->'resolvedToken'->'poolAddress'),
 'freshness',p_manifest->'freshness','dataConfidence',jsonb_build_object('state',case when coverage>=80 then 'HIGH' when coverage>=40 then 'MEDIUM' when coverage>0 then 'LOW' else 'UNKNOWN' end,'coverage',coverage,'reason','Evidence coverage only; not investment confidence.'),
 'evidenceSummary',jsonb_build_object('total',jsonb_array_length(p_manifest->'observations'),'available',available,'unknown',jsonb_array_length(p_manifest->'missing'),'sources',sources),
 'score','{"status":"METHODOLOGY_NOT_ACTIVE","value":null,"max":100,"methodologyVersion":null,"components":{"marketStructure":null,"liquidityQuality":null,"distribution":null,"activity":null,"authorityRisk":null,"creatorRisk":null,"manipulationRisk":null,"dataQuality":null}}'::jsonb,
 'market','{}'::jsonb,'liquidity','{}'::jsonb,'holders','{}'::jsonb,'creator','{}'::jsonb,'activity','{}'::jsonb,
 'topTrades',trades,'whyMoving','[{"classification":"UNKNOWN","explanation":"No causal derivation is registered.","evidenceRefs":[]}]'::jsonb,
 'claimVerification',p_manifest->'claims','riskFactors','[{"key":"data_quality","state":"UNKNOWN","explanation":"No risk derivation is registered.","evidenceRefs":[]}]'::jsonb,
 'unknowns',p_manifest->'missing',
 'positionSizing','{"status":"POSITION_SIZE_UNAVAILABLE","riskBudget":null,"stopDistancePercent":null,"positionNotional":null,"reason":"No risk parameters supplied."}'::jsonb,
 'aiInterpretation','{"status":"DISABLED","provider":null,"model":null,"content":null}'::jsonb,
 'citations',p_manifest->'resolvedToken'->'provenance','providerConflicts',p_manifest->'providerConflicts','methodologyVersion',null,'schemaVersion','token-analyzer-v1','createdAt',clock_timestamp());
end;
$$;

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
  perform public.analyzer_validate_manifest(p_manifest,reservation.input,reservation.resolution);
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

create or replace function public.analyzer_get_delivery_receipt(p_delivery_key text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare receipt jsonb;
begin
 perform public.analyzer_assert_operator();
 select jsonb_build_object('status','COMPLETED','delivery_key',d.delivery_key,'request_id',d.request_id,'analysis_id',d.analysis_id,'analysis_version',d.analysis_version,'manifest_hash',d.manifest_hash,'result',a.result)
 into receipt from public.analyzer_deliveries d join public.analyzer_analyses a on a.id=d.analysis_id where d.delivery_key=p_delivery_key;
 if receipt is not null then return receipt; end if;
 perform public.analyzer_require(exists(select 1 from public.analyzer_delivery_intents where delivery_key=p_delivery_key),'Unknown delivery key');
 return jsonb_build_object('status','EXISTING_IN_PROGRESS','delivery_key',p_delivery_key);
end;
$$;
create or replace function public.analyzer_get_analysis_by_version(p_request_id uuid,p_analysis_version integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare key text;
begin perform public.analyzer_assert_operator();select d.delivery_key into key from public.analyzer_deliveries d where d.request_id=p_request_id and d.analysis_version=p_analysis_version;perform public.analyzer_require(key is not null,'Historical receipt not found');return public.analyzer_get_delivery_receipt(key);end;
$$;
create or replace function public.analyzer_get_latest_analysis(p_request_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare key text;
begin perform public.analyzer_assert_operator();select d.delivery_key into key from public.analyzer_deliveries d where d.request_id=p_request_id order by d.analysis_version desc limit 1;perform public.analyzer_require(key is not null,'Latest receipt not found');return public.analyzer_get_delivery_receipt(key);end;
$$;

-- Retire ambiguous caller-result persistence. Kept only as an explicitly denied
-- signature for upgrade compatibility; no role can invoke it.
create or replace function public.analyzer_submit_run(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
begin raise exception 'Use reserve, complete, and key-only receipt operations' using errcode='0A000';end;
$$;

do $permissions$
declare fn record;
begin
 for fn in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'analyzer_%' or p.proname='reject_analyzer_delivery_mutation') loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',fn.signature);
 end loop;
end;
$permissions$;
grant execute on function public.analyzer_read_state(),public.analyzer_record_provider_event(jsonb),public.analyzer_record_cost_usage(jsonb),public.analyzer_record_model_call(jsonb) to authenticated;
grant execute on function public.analyzer_reserve_delivery(jsonb,jsonb),public.analyzer_start_fresh_analysis(jsonb,jsonb,uuid),public.analyzer_start_reanalysis(text,uuid,text),public.analyzer_complete_delivery(text,uuid,jsonb),public.analyzer_get_delivery_receipt(text),public.analyzer_get_analysis_by_version(uuid,integer),public.analyzer_get_latest_analysis(uuid) to authenticated;

commit;
