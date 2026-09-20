begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
grant usage on schema extensions to authenticated;
grant execute on all functions in schema extensions to authenticated;
select no_plan();

insert into auth.users(id) values
  ('00000000-0000-0000-0000-000000987701'),
  ('00000000-0000-0000-0000-000000987702');
insert into public.profiles(id, display_name) values
  ('00000000-0000-0000-0000-000000987701', 'Analyzer hardening admin'),
  ('00000000-0000-0000-0000-000000987702', 'Analyzer hardening user');
insert into public.user_roles(user_id, role_id)
select '00000000-0000-0000-0000-000000987701', id from public.roles where key = 'admin';

create temporary table analyzer_fixture_payload(payload jsonb);
insert into analyzer_fixture_payload values ('{
  "fingerprint":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "raw_input":"fixture",
  "input_type":"UNKNOWN",
  "requested_chain":"unknown",
  "resolution":{"chain":"unknown","canonicalTokenId":null,"inputType":"UNKNOWN","pairAddress":null,"poolAddress":null,"provenance":[]},
  "manifest":{"schemaVersion":"token-analyzer-v1","manifestFormatVersion":1,"evidenceRevision":1,"resolvedToken":{"chain":"unknown","canonicalTokenId":null,"inputType":"UNKNOWN","pairAddress":null,"poolAddress":null,"provenance":[]},"observations":[],"claims":[],"providerConflicts":[],"missing":[],"freshness":{"state":"UNKNOWN"},"methodologyVersion":null},
  "result":{"status":"INSUFFICIENT_DATA","resolvedToken":{"chain":"unknown","canonicalTokenId":null,"inputType":"UNKNOWN","pairAddress":null,"poolAddress":null,"provenance":[]},"chain":"unknown","pair":{"address":null,"pool":null},"score":{"status":"METHODOLOGY_NOT_ACTIVE","value":null,"methodologyVersion":null,"components":{"marketStructure":null}},"aiInterpretation":{"status":"DISABLED","provider":null,"model":null,"content":null},"market":{},"liquidity":{},"holders":{},"creator":{},"activity":{},"topTrades":[],"whyMoving":[],"claimVerification":[],"riskFactors":[],"unknowns":[],"citations":[],"providerConflicts":[],"schemaVersion":"token-analyzer-v1","methodologyVersion":null},
  "status":"INSUFFICIENT_DATA",
  "schema_version":"token-analyzer-v1",
  "analysis_mode":"DETERMINISTIC",
  "freshness_class":"UNKNOWN",
  "freshness_expires_at":"2000-01-01T00:00:00Z",
  "identity":{"chain":"unknown","canonicalTokenId":null,"inputType":"UNKNOWN","pairAddress":null,"poolAddress":null,"schemaVersion":"token-analyzer-v1","methodologyVersion":null,"scoreEngineVersion":null,"analysisMode":"DETERMINISTIC"},
  "operation":"DELIVERY_RETRY"
}'::jsonb);
grant select, update on analyzer_fixture_payload to authenticated;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000987701","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000987701', true);
set local role authenticated;
set local search_path = public, extensions;

select ok((analyzer_read_state()->>'enabled') = 'false', 'Analyzer state RPC reads the default-off flag');
select ok(has_table_privilege('authenticated', 'public.analyzer_requests', 'SELECT, INSERT, UPDATE, DELETE') = false, 'Browser role still has no raw Analyzer table access');
select ok(has_function_privilege('authenticated', 'public.analyzer_submit_run(jsonb)', 'EXECUTE'), 'Authenticated session has only the named submit RPC');
select throws_ok($$select public.analyzer_submit_run((select payload from analyzer_fixture_payload))$$, '55000', null, 'Direct submit is rejected while the master flag is OFF');

select public.set_token_analyzer_enabled(true);
select lives_ok($$select public.analyzer_submit_run((select payload from analyzer_fixture_payload))$$, 'Authorized persistence succeeds with a canonical manifest computed by the database');
select is((select public.analyzer_submit_run((select payload from analyzer_fixture_payload))->>'status'), 'REPLAY', 'Delivery retry reuses the completed receipt');

update analyzer_fixture_payload set payload = jsonb_set(payload, '{manifest_hash}', to_jsonb(repeat('b', 64)), true);
select throws_ok($$select public.analyzer_submit_run((select payload from analyzer_fixture_payload))$$, '23P01', null, 'Caller-supplied fake manifest hash is rejected');
update analyzer_fixture_payload set payload = payload - 'manifest_hash';
update analyzer_fixture_payload set payload = jsonb_set(payload, '{result,score,value}', '99'::jsonb, true);
select throws_ok($$select public.analyzer_submit_run((select payload from analyzer_fixture_payload))$$, '23P01', null, 'Forged score is rejected at the database boundary');
update analyzer_fixture_payload set payload = jsonb_set(payload, '{result,score,value}', 'null'::jsonb, true);
update analyzer_fixture_payload set payload = jsonb_set(payload, '{result,aiInterpretation,status}', '"SUCCEEDED"'::jsonb, true);
select throws_ok($$select public.analyzer_submit_run((select payload from analyzer_fixture_payload))$$, '23P01', null, 'Forged AI result is rejected while AI is disabled');
update analyzer_fixture_payload set payload = jsonb_set(payload, '{result,aiInterpretation,status}', '"DISABLED"'::jsonb, true);

reset role;
select is((select count(*) from public.analyzer_analyses), 1::bigint, 'Rejected payloads do not create additional analysis versions');
select is((select count(*) from public.analyzer_evidence_manifests), 1::bigint, 'Rejected payloads do not create additional manifests');
select is((select analysis_operation from public.analyzer_analyses limit 1), 'DELIVERY_RETRY', 'Initial operation is durable');

set local role authenticated;
set local search_path = public, extensions;
update analyzer_fixture_payload set payload = jsonb_set(payload, '{operation}', '"EXPLICIT_REANALYSIS"'::jsonb, true);
update analyzer_fixture_payload set payload = jsonb_set(payload, '{reanalysis_reason}', '"audit replay"'::jsonb, true);
select is((select public.analyzer_submit_run((select payload from analyzer_fixture_payload))->>'analysis_version'), '2', 'Explicit reanalysis appends a new version');
reset role;
select is((select count(*) from public.analyzer_analyses), 2::bigint, 'Prior analysis version is preserved');

set local role authenticated;
set local search_path = public, extensions;
select public.set_token_analyzer_enabled(false);
update analyzer_fixture_payload set payload = jsonb_set(payload, '{fingerprint}', to_jsonb(repeat('c', 64)), true);
update analyzer_fixture_payload set payload = jsonb_set(payload, '{operation}', '"DELIVERY_RETRY"'::jsonb, true);
select throws_ok($$select public.analyzer_submit_run((select payload from analyzer_fixture_payload))$$, '55000', null, 'A disable committed before submission fails closed');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000987702","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000987702', true);
select throws_ok($$select public.analyzer_submit_run((select payload from analyzer_fixture_payload))$$, '42501', null, 'Ordinary authenticated users cannot submit regardless of flag state');

select * from finish();
rollback;
