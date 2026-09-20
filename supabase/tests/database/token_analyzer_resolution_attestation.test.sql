begin;
\ir ../fixtures/analyzer.inc
select extensions.no_plan();
select public.set_token_analyzer_enabled(true);

select extensions.ok(not has_function_privilege('authenticated','public.analyzer_attest_resolution(text,jsonb,jsonb,text,text)','EXECUTE'),'Browser Admin cannot create trusted resolution receipts');
select extensions.ok(not has_table_privilege('authenticated','public.analyzer_resolution_receipts','SELECT, INSERT, UPDATE, DELETE'),'Browser Admin cannot access trusted resolution receipts directly');

update analyzer_case set r=public.analyzer_reserve_delivery(f->'input',f->'resolution');
set local role service_role;
update analyzer_case set f=jsonb_set(f,'{manifest,resolvedToken}',(select public.analyzer_attest_resolution(r->>'delivery_key',f->'input',f->'resolution',repeat('a',64),'token-analyzer-live-collector-v2')->'resolution'));
update analyzer_case set p=jsonb_set(p,'{resolvedToken}',f->'manifest'->'resolvedToken');
set local role authenticated;

select extensions.lives_ok($$select public.analyzer_complete_delivery((select r->>'delivery_key' from analyzer_case),(select (r->>'owner_token')::uuid from analyzer_case),(select f->'manifest' from analyzer_case))$$,'Correct receipt is accepted for its reserved request');
reset role;
select extensions.throws_ok($$update public.analyzer_resolution_receipts set resolution=resolution$$,'55000',null,'Resolution receipt is immutable');
select extensions.throws_ok($$delete from public.analyzer_resolution_receipts$$,'55000',null,'Resolution receipt cannot be deleted');
set local role authenticated;

create temporary table second_case(i jsonb,r jsonb);
insert into second_case(i,r) values (
  '{"raw":"0x0000000000000000000000000000000000000002","hintChain":"ethereum"}'::jsonb,
  (select jsonb_set(jsonb_set(f->'resolution','{tokenAddress}','"0x0000000000000000000000000000000000000002"'),'{canonicalTokenId}','"ethereum:0x0000000000000000000000000000000000000002"') from analyzer_case)
);
update second_case set r=public.analyzer_reserve_delivery(i,r);
select extensions.throws_ok($$select public.analyzer_complete_delivery((select r->>'delivery_key' from second_case),(select (r->>'owner_token')::uuid from second_case),(select f->'manifest' from analyzer_case))$$,'23P01',null,'Receipt from request A cannot be reused for request B');

create temporary table mismatch_case(i jsonb,r jsonb);
grant all on mismatch_case to service_role;
insert into mismatch_case values (
  '{"raw":"0x0000000000000000000000000000000000000001","hintChain":"ethereum"}'::jsonb,
  (select f->'resolution' from analyzer_case)
);
update mismatch_case set r=public.analyzer_reserve_delivery(i,r);
set local role service_role;
select extensions.throws_ok($$select public.analyzer_attest_resolution((select r->>'delivery_key' from mismatch_case),(select i from mismatch_case),(select jsonb_set(jsonb_set(r,'{tokenAddress}','"0x0000000000000000000000000000000000000002"'),'{canonicalTokenId}','"ethereum:0x0000000000000000000000000000000000000002"') from mismatch_case),repeat('a',64),'token-analyzer-live-collector-v2')$$,'23P01',null,'Direct raw token cannot attest a different canonical token');

select * from extensions.finish();
rollback;
