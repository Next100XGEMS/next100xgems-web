begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users(id) values ('00000000-0000-4000-8000-000000987701');
insert into public.profiles(id, display_name) values ('00000000-0000-4000-8000-000000987701', 'Analyzer hardening admin');
insert into public.user_roles(user_id, role_id) select '00000000-0000-4000-8000-000000987701', id from public.roles where key = 'admin';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000987701","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000987701', true);
set local role authenticated;

select ok((analyzer_read_state()->>'enabled') = 'false', 'Analyzer state RPC reads the default-off flag');
select ok(has_table_privilege('authenticated', 'public.analyzer_requests', 'SELECT, INSERT, UPDATE, DELETE') = false, 'Browser role still has no raw Analyzer table access');
select ok(has_function_privilege('authenticated', 'public.analyzer_submit_run(jsonb)', 'EXECUTE'), 'Authenticated server session has only the named submit RPC');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000987701","role":"authenticated"}', true);
select public.set_token_analyzer_enabled(true);
select lives_ok($$select public.analyzer_submit_run('{"fingerprint":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","raw_input":"fixture","input_type":"UNKNOWN","requested_chain":"unknown","resolution":{"chain":"unknown"},"manifest":{"schemaVersion":"token-analyzer-v1"},"manifest_hash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","result":{"status":"INSUFFICIENT_DATA"},"status":"INSUFFICIENT_DATA","schema_version":"token-analyzer-v1","analysis_mode":"DETERMINISTIC","freshness_class":"UNKNOWN","freshness_expires_at":"2000-01-01T00:00:00Z","identity":{"chain":"unknown","canonicalTokenId":null,"inputType":"UNKNOWN","pairAddress":null,"poolAddress":null,"schemaVersion":"token-analyzer-v1","methodologyVersion":null,"scoreEngineVersion":null,"analysisMode":"DETERMINISTIC","freshnessClass":"UNKNOWN"}}'::jsonb)$$, 'Authorized Analyzer persistence succeeds');
select is(public.analyzer_submit_run('{"fingerprint":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","raw_input":"fixture","input_type":"UNKNOWN","requested_chain":"unknown","resolution":{"chain":"unknown"},"manifest":{"schemaVersion":"token-analyzer-v1"},"manifest_hash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","result":{"status":"INSUFFICIENT_DATA"},"status":"INSUFFICIENT_DATA","schema_version":"token-analyzer-v1","analysis_mode":"DETERMINISTIC","freshness_class":"UNKNOWN","freshness_expires_at":"2000-01-01T00:00:00Z","identity":{"chain":"unknown","canonicalTokenId":null,"inputType":"UNKNOWN","pairAddress":null,"poolAddress":null,"schemaVersion":"token-analyzer-v1","methodologyVersion":null,"scoreEngineVersion":null,"analysisMode":"DETERMINISTIC","freshnessClass":"UNKNOWN"}}'::jsonb)->>'status', 'CREATED', 'Stale result is not replayed as fresh');

select * from finish();
rollback;
