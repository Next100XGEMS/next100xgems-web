-- Token Analyzer foundation security and immutability checks. All fixtures
-- are synthetic and rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
grant usage on schema extensions to authenticated;
grant execute on all functions in schema extensions to authenticated;
select no_plan();

select has_table('public', 'analyzer_requests', 'Analyzer requests table exists');
select has_table('public', 'analyzer_evidence_manifests', 'Analyzer manifests table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.analyzer_requests'::regclass), 'Analyzer requests use RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.analyzer_evidence_manifests'::regclass), 'Analyzer manifests use RLS');
select ok(not has_table_privilege('anon', 'public.analyzer_requests', 'SELECT, INSERT, UPDATE, DELETE'), 'Anonymous cannot access Analyzer requests');
select ok(not has_table_privilege('authenticated', 'public.analyzer_requests', 'SELECT, INSERT, UPDATE, DELETE'), 'Authenticated browser cannot access Analyzer requests');
select ok(not has_table_privilege('service_role', 'public.analyzer_requests', 'SELECT, INSERT, UPDATE, DELETE'), 'Service role has no generic raw-table grant');
select ok(has_function_privilege('authenticated', 'public.set_token_analyzer_enabled(boolean)', 'EXECUTE'), 'Authenticated role can reach only the named Analyzer toggle RPC');
select ok(not has_function_privilege('anon', 'public.set_token_analyzer_enabled(boolean)', 'EXECUTE'), 'Anonymous cannot toggle Analyzer');
select ok(not has_function_privilege('anon', 'public.set_token_analyzer_enabled(boolean)', 'EXECUTE'), 'Anonymous cannot toggle Analyzer');
set local role authenticated;
set local search_path = public, extensions;
select throws_ok($$insert into public.analyzer_requests(requester_id, raw_input, input_type, request_fingerprint)
  values ('00000000-0000-4000-8000-000000000001', 'x', 'UNKNOWN', repeat('a', 64))$$,
  '42501', null, 'Direct browser-style insert is denied');
reset role;
select * from finish();
rollback;
