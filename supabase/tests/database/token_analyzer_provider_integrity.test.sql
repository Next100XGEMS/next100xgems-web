begin;
\ir ../fixtures/analyzer.inc
select extensions.no_plan();
select public.set_token_analyzer_enabled(true);

create temporary table url_case(i jsonb,r jsonb);
insert into url_case select '{"raw":"https://birdeye.so/token/0x0000000000000000000000000000000000000001?chain=ethereum","hintChain":"ethereum"}',
 f->'resolution'||'{"inputType":"CHART_URL","source":"birdeye.so","confidence":"PARTIAL"}' from analyzer_case;
select extensions.lives_ok($$select public.analyzer_reserve_delivery(i,r) from url_case$$,'Valid Birdeye original token URL');
select extensions.throws_ok($$select public.analyzer_reserve_delivery(i||'{"raw":"https://attacker.invalid/token/different"}',r||'{"provenance":[{"source":"birdeye","kind":"OBJECTIVE_PROVIDER","reference":"fake","capturedAt":"2026-09-20T00:00:00Z"},{"source":"birdeye","kind":"OBJECTIVE_PROVIDER","reference":"fake","capturedAt":"2026-09-20T00:00:00Z"}]}') from url_case$$,'23P01',null,'Provenance cannot authorize attacker hostname');
select extensions.throws_ok($$select public.analyzer_reserve_delivery(i||'{"raw":"https://fake.birdeye.so/token/0x0000000000000000000000000000000000000001?chain=ethereum"}',r) from url_case$$,'23P01',null,'Unapproved subdomain rejected');
select extensions.throws_ok($$select public.analyzer_reserve_delivery(i,r||'{"tokenAddress":"0x0000000000000000000000000000000000000002","canonicalTokenId":"ethereum:0x0000000000000000000000000000000000000002"}') from url_case$$,'23P01',null,'URL token cannot change');
select extensions.throws_ok($$select public.analyzer_reserve_delivery(i,r||'{"source":"dexscreener.com"}') from url_case$$,'23P01',null,'URL provider cannot change');

update url_case set i='{"raw":"https://dexscreener.com/base/0x0000000000000000000000000000000000000002","hintChain":"base"}',
 r=r||'{"inputType":"DEX_URL","source":"dexscreener.com","chain":"base","tokenAddress":null,"canonicalTokenId":null,"pairAddress":"0x0000000000000000000000000000000000000002"}';
select extensions.lives_ok($$select public.analyzer_reserve_delivery(i,r) from url_case$$,'DEX syntax reservation needs no provider retrieval');
select extensions.throws_ok($$select public.analyzer_reserve_delivery(i,r||'{"chain":"ethereum"}') from url_case$$,'23P01',null,'URL chain conflict rejected');
select extensions.throws_ok($$select public.analyzer_reserve_delivery(i,r||'{"pairAddress":"0x0000000000000000000000000000000000000003"}') from url_case$$,'23P01',null,'URL pair conflict rejected');
update url_case set r=r||'{"tokenAddress":"0x0000000000000000000000000000000000000001","canonicalTokenId":"base:0x0000000000000000000000000000000000000001"}';
select extensions.throws_ok($$select public.analyzer_reserve_delivery(i,r) from url_case$$,'23P01',null,'Provider-resolved pair requires typed response proof');
update url_case set r=r||'{"pairProof":{"provider":"dex-screener","chain":"base","pair":"0x0000000000000000000000000000000000000002","baseToken":"0x0000000000000000000000000000000000000001","quoteToken":"0x0000000000000000000000000000000000000003","selection":"BASE_TOKEN"}}';
select extensions.throws_ok($$select public.analyzer_reserve_delivery(i,r) from url_case$$,'23P01',null,'Caller-authored pair proof is rejected');
select extensions.throws_ok($$select public.analyzer_reserve_delivery(i,jsonb_set(r,'{pairProof,chain}','"ethereum"')) from url_case$$,'23P01',null,'Ethereum pair proof cannot resolve Base');
select extensions.throws_ok($$select public.analyzer_reserve_delivery(i,jsonb_set(r,'{pairProof,pair}','"0x0000000000000000000000000000000000000003"')) from url_case$$,'23P01',null,'Wrong response pool rejected');
select extensions.throws_ok($$select public.analyzer_reserve_delivery(i,jsonb_set(r,'{pairProof,baseToken}','"0x0000000000000000000000000000000000000003"')) from url_case$$,'23P01',null,'Wrong response token rejected');

update analyzer_case set r=public.analyzer_reserve_delivery(f->'input',f->'resolution');
set local role service_role;
update analyzer_case set f=jsonb_set(f,'{manifest,resolvedToken}',(select public.analyzer_attest_resolution(r->>'delivery_key',f->'input',f->'resolution',repeat('a',64),'token-analyzer-live-collector-v2')->'resolution'));
update analyzer_case set p=jsonb_set(p,'{resolvedToken}',f->'manifest'->'resolvedToken');
set local role authenticated;
update analyzer_case set d1=public.analyzer_complete_delivery(r->>'delivery_key',(r->>'owner_token')::uuid,f->'manifest');
select extensions.ok(not ((select d1->'result' from analyzer_case) ? 'providerUsage'),'Completed receipt has no telemetry');
select public.analyzer_record_provider_event(jsonb_build_object('request_id',d1->>'request_id','analysis_id',d1->>'analysis_id','provider','dex-screener','capability','MARKET','status','SUCCEEDED','latency_ms',1,'metadata','{"capabilityStatus":null,"requestMade":true,"attempts":1,"requestOutcome":"SUCCESS","cache":"MISS"}'::jsonb)) from analyzer_case;
select extensions.is((select public.analyzer_get_delivery_receipt(d1->>'delivery_key') from analyzer_case),(select d1 from analyzer_case),'Later telemetry cannot mutate receipt');
select extensions.is((select public.analyzer_get_provider_telemetry(d1->>'delivery_key')->0->>'capabilityStatus' from analyzer_case),'UNKNOWN','Null availability is UNKNOWN');
select extensions.is((select public.analyzer_get_provider_telemetry(d1->>'delivery_key')->0->>'requestOutcome' from analyzer_case),'SUCCESS','HTTP outcome separate from capability availability');
select extensions.is((select public.analyzer_get_provider_telemetry(d1->>'delivery_key')->0->>'attempts' from analyzer_case),'1','Actual attempts retained');
select public.set_token_analyzer_enabled(false);
select extensions.throws_ok($$select public.analyzer_reserve_delivery(f->'input',f->'resolution') from analyzer_case$$,'55000',null,'Master OFF still rejects mutations');
reset role;
select extensions.ok(not has_function_privilege('authenticated','public.analyzer_url_identity(text)','EXECUTE'),'URL validation helper not browser callable');
select extensions.ok(not has_table_privilege('authenticated','public.analyzer_deliveries','SELECT'),'Raw delivery access remains denied');
select extensions.ok(not has_table_privilege('service_role','public.analyzer_evidence_manifests','INSERT'),'Raw service-role evidence writes remain denied');
select * from extensions.finish();
rollback;
