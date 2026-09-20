begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select extensions.no_plan();

insert into auth.users(id) values ('00000000-0000-0000-0000-000000987703');
insert into public.profiles(id, display_name) values ('00000000-0000-0000-0000-000000987703', 'Analyzer receipt integrity admin');
insert into public.user_roles(user_id, role_id)
select '00000000-0000-0000-0000-000000987703', id from public.roles where key = 'admin';

create temporary table analyzer_receipt_payload(payload jsonb);
insert into analyzer_receipt_payload values ('{
  "fingerprint":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "raw_input":"0x0000000000000000000000000000000000000001",
  "input_type":"CONTRACT_ADDRESS",
  "requested_chain":"ethereum",
  "resolution":{"inputType":"CONTRACT_ADDRESS","source":"direct-input","chain":"ethereum","tokenAddress":"0x0000000000000000000000000000000000000001","canonicalTokenId":"ethereum:0x0000000000000000000000000000000000000001","pairAddress":null,"poolAddress":null,"symbol":null,"name":null,"decimals":null,"supply":null,"launchpad":null,"creator":null,"creationTimestamp":null,"programOrContract":null,"confidence":"CANDIDATE_IDENTITY","provenance":[]},
  "manifest":{"schemaVersion":"token-analyzer-v1","manifestVersion":1,"capturedAt":"2026-09-20T00:00:00Z","input":{"type":"CONTRACT_ADDRESS","rawHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},"resolvedToken":{"inputType":"CONTRACT_ADDRESS","source":"direct-input","chain":"ethereum","tokenAddress":"0x0000000000000000000000000000000000000001","canonicalTokenId":"ethereum:0x0000000000000000000000000000000000000001","pairAddress":null,"poolAddress":null,"symbol":null,"name":null,"decimals":null,"supply":null,"launchpad":null,"creator":null,"creationTimestamp":null,"programOrContract":null,"confidence":"CANDIDATE_IDENTITY","provenance":[]},"observations":[],"claims":[],"providerConflicts":[],"missing":[],"freshness":{"state":"UNKNOWN","reason":"No explicit freshness policy is available."},"methodologyVersion":null},
  "result":{"requestId":"00000000-0000-0000-0000-000000000000","status":"INSUFFICIENT_DATA","input":{"raw":"0x0000000000000000000000000000000000000001","hintChain":"ethereum"},"resolvedToken":{"inputType":"CONTRACT_ADDRESS","source":"direct-input","chain":"ethereum","tokenAddress":"0x0000000000000000000000000000000000000001","canonicalTokenId":"ethereum:0x0000000000000000000000000000000000000001","pairAddress":null,"poolAddress":null,"symbol":null,"name":null,"decimals":null,"supply":null,"launchpad":null,"creator":null,"creationTimestamp":null,"programOrContract":null,"confidence":"CANDIDATE_IDENTITY","provenance":[]},"chain":"ethereum","pair":{"address":null,"pool":null},"freshness":{"state":"UNKNOWN","reason":"No explicit freshness policy is available."},"dataConfidence":{"state":"UNKNOWN","coverage":0,"reason":"No evidence."},"evidenceSummary":{"total":0,"available":0,"unknown":0,"sources":[]},"score":{"value":null,"max":100,"methodologyVersion":null,"status":"METHODOLOGY_NOT_ACTIVE","components":{"marketStructure":null,"liquidityQuality":null,"distribution":null,"activity":null,"authorityRisk":null,"creatorRisk":null,"manipulationRisk":null,"dataQuality":null}},"market":{},"liquidity":{},"holders":{},"creator":{},"activity":{},"topTrades":[],"whyMoving":[],"claimVerification":[],"riskFactors":[],"unknowns":[],"positionSizing":{"status":"POSITION_SIZE_UNAVAILABLE","riskBudget":null,"stopDistancePercent":null,"positionNotional":null,"reason":"No inputs."},"aiInterpretation":{"status":"DISABLED","provider":null,"model":null,"content":null},"citations":[],"providerConflicts":[],"methodologyVersion":null,"schemaVersion":"token-analyzer-v1","createdAt":"2026-09-20T00:00:00Z"},
  "status":"INSUFFICIENT_DATA","schema_version":"token-analyzer-v1","analysis_mode":"DETERMINISTIC","freshness_class":"UNKNOWN","freshness_expires_at":"2000-01-01T00:00:00Z","identity":{"chain":"ethereum","canonicalTokenId":"ethereum:0x0000000000000000000000000000000000000001","inputType":"CONTRACT_ADDRESS","pairAddress":null,"poolAddress":null,"schemaVersion":"token-analyzer-v1","methodologyVersion":null,"scoreEngineVersion":null,"analysisMode":"DETERMINISTIC"},"operation":"DELIVERY_RETRY"
}'::jsonb);
grant select, update on analyzer_receipt_payload to authenticated;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000987703","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000987703', true);
set local role authenticated;
select public.set_token_analyzer_enabled(true);

select extensions.is((select public.analyzer_submit_run(payload)->>'analysis_version' from analyzer_receipt_payload), '1'::text, 'Initial sealed delivery creates version one'::text);
select extensions.throws_ok($$select public.analyzer_submit_run(jsonb_set((select payload from analyzer_receipt_payload), '{result,score,components,marketStructure}', '99'::jsonb, true))$$, '23P01', null, 'Non-null component score is rejected while methodology is inactive');
select extensions.throws_ok($$select public.analyzer_submit_run(jsonb_set(jsonb_set((select payload from analyzer_receipt_payload), '{resolution,tokenAddress}', '"0x0000000000000000000000000000000000000002"', true), '{manifest,resolvedToken,tokenAddress}', '"0x0000000000000000000000000000000000000002"', true))$$, '23P01', null, 'Canonical token identity mismatch is rejected');
select extensions.throws_ok($$select public.analyzer_submit_run(jsonb_set((select payload from analyzer_receipt_payload), '{schema_version}', '"made-up-schema-v999"', true))$$, '23P01', null, 'Invented schema version is rejected');
select extensions.throws_ok($$select public.analyzer_submit_run(jsonb_set((select payload from analyzer_receipt_payload), '{result,liquidity}', '{"value":"999999999"}'::jsonb, true))$$, '23P01', null, 'Unsupported nested liquidity result is rejected');
select extensions.is((select public.analyzer_submit_run(jsonb_set((select payload from analyzer_receipt_payload), '{operation}', '"FRESH_ANALYSIS"', true))->>'analysis_version'), '2'::text, 'Fresh analysis appends version two'::text);
select extensions.is((select public.analyzer_submit_run(jsonb_set(jsonb_set((select payload from analyzer_receipt_payload), '{operation}', '"EXPLICIT_REANALYSIS"', true), '{reanalysis_reason}', '"receipt test"', true))->>'analysis_version'), '3'::text, 'Explicit reanalysis appends version three'::text);
select extensions.is((select public.analyzer_submit_run((select payload from analyzer_receipt_payload))->>'analysis_version'), '1'::text, 'Delivery retry returns the original sealed version one'::text);
reset role;
select extensions.is((select result->>'analysisVersion' from public.analyzer_analyses where request_id = (select id from public.analyzer_requests where request_fingerprint = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa') and analysis_version = 1), '1'::text, 'Embedded analysis version matches relational version'::text);
select extensions.is((select count(*) from public.analyzer_analyses where request_id = (select id from public.analyzer_requests where request_fingerprint = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')), 3::bigint, 'Replay does not create a fourth analysis'::text);

reset role;
select * from extensions.finish(true);
rollback;
