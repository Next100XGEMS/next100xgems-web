-- Gate 19C-F1 corrective contracts. All fixtures are synthetic and rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users(id) values
  ('29000000-0000-4000-8000-000000000001'),
  ('29000000-0000-4000-8000-000000000002');
insert into public.profiles(id, display_name, status) values
  ('29000000-0000-4000-8000-000000000001', 'F1 Owner One', 'ACTIVE'),
  ('29000000-0000-4000-8000-000000000002', 'F1 Owner Two', 'ACTIVE');
insert into public.user_roles(user_id, role_id)
select x.user_id, r.id from (values
  ('29000000-0000-4000-8000-000000000001'::uuid, 'owner'),
  ('29000000-0000-4000-8000-000000000002'::uuid, 'owner')
) x(user_id, role_key) join public.roles r on r.key = x.role_key;
insert into public.tokens(id, chain, contract_address, symbol, name) values
  ('29000000-0000-4000-8000-000000000100', 'eip155:1', '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'F1', 'F1 fixture'),
  ('29000000-0000-4000-8000-000000000101', 'eip155:1', '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'F1B', 'F1 second fixture');
update public.feature_flags set enabled = case key
  when 'radar_enabled' then true when 'maintenance_mode' then false
  when 'radar_emergency_paused' then false else enabled end,
  configuration = case when key = 'radar_emergency_paused' then '{"generation":1}'::jsonb else configuration end
where key in ('radar_enabled', 'maintenance_mode', 'radar_emergency_paused');

-- Canonical event identity ignores an untrusted caller hash and binds the
-- complete normalized request instead.
select public.radar_system_insert_event('f1-event', 'DISCOVERY', '29000000-0000-4000-8000-000000000100',
  'f1_provider', 'provider-1', repeat('a',64), '{"payload":"one"}', clock_timestamp()-interval '1 hour') into temporary f1_event;
select is((select public.radar_system_insert_event('f1-event', 'DISCOVERY', '29000000-0000-4000-8000-000000000100',
  'f1_provider', 'provider-1', repeat('b',64), '{"payload":"one"}', clock_timestamp()-interval '1 hour')),
  (select * from f1_event), 'same canonical event request is idempotent');
select throws_ok($$select public.radar_system_insert_event('f1-event', 'DISCOVERY', '29000000-0000-4000-8000-000000000100',
  'f1_provider', 'provider-1', repeat('c',64), '{"payload":"changed"}', clock_timestamp()-interval '1 hour')$$,
  '23505', null, 'same event key with changed payload conflicts');
select throws_ok($$select public.radar_system_insert_event('f1-event', 'DISCOVERY', '29000000-0000-4000-8000-000000000100',
  'other_provider', 'provider-1', repeat('a',64), '{"payload":"one"}', clock_timestamp()-interval '1 hour')$$,
  '23505', null, 'same event key with changed provider conflicts');
select throws_ok($$select public.radar_system_insert_event('f1-event', 'DISCOVERY', '29000000-0000-4000-8000-000000000101',
  'f1_provider', 'provider-1', repeat('a',64), '{"payload":"one"}', clock_timestamp()-interval '1 hour')$$,
  '23505', null, 'same event key with changed token conflicts');

-- Observation state/value matrix and bounded provenance are database contracts.
select public.radar_system_record_observation((select * from f1_event), '29000000-0000-4000-8000-000000000100',
  'f1_provider', 'adapter-v1', 'market', 'liquidity', 'AVAILABLE', 100, 100, 2, 'USD', '{}',
  '{"authority":"f1"}', null, repeat('1',64), clock_timestamp()-interval '1 hour') into temporary f1_observation;
select ok((select * from f1_observation) is not null, 'AVAILABLE numeric observation succeeds');
select throws_ok($$select public.radar_system_record_observation((select * from f1_event), '29000000-0000-4000-8000-000000000100',
  'f1_provider', 'adapter-v1', 'market', 'unknown-value', 'UNKNOWN', 42, null, null, null, '{}', '{"reason":"timeout"}', null, repeat('2',64), now())$$,
  '23514', null, 'UNKNOWN cannot contain an authoritative numeric value');
select throws_ok($$select public.radar_system_record_observation((select * from f1_event), '29000000-0000-4000-8000-000000000100',
  'f1_provider', 'adapter-v1', 'market', 'unavailable-value', 'UNAVAILABLE', null, 42, null, null, '{}', '{"reason":"timeout"}', null, repeat('3',64), now())$$,
  '23514', null, 'UNAVAILABLE cannot contain an authoritative numeric value');
select throws_ok($$select public.radar_system_record_observation((select * from f1_event), '29000000-0000-4000-8000-000000000100',
  'f1_provider', 'adapter-v1', 'market', 'unsupported-value', 'UNSUPPORTED', 42, null, null, null, '{}', '{"reason":"unsupported"}', null, repeat('4',64), now())$$,
  '23514', null, 'UNSUPPORTED cannot contain an authoritative numeric value');
select throws_ok($$select public.radar_system_record_observation((select * from f1_event), '29000000-0000-4000-8000-000000000100',
  'f1_provider', 'adapter-v1', 'market', 'credential-provenance', 'UNKNOWN', null, null, null, null, '{}', '{"api_key":"secret"}', null, repeat('5',64), now())$$,
  '23514', null, 'credential-shaped provenance is rejected');

-- Finalization seals the exact input set before claim and establishes the
-- DB-authoritative manifest retained by downstream result operations.
select public.radar_system_enqueue_work('f1-screen', 'SCREENING', '29000000-0000-4000-8000-000000000100',
  (select * from f1_event), null, 'contract-v1', 'input-v1', now()) into temporary f1_work;
select public.radar_system_attach_observation((select * from f1_work), (select * from f1_observation));
select public.radar_system_finalize_work_inputs((select * from f1_work), 'contract-v1', 'input-v1');
select * into temporary f1_claim_a from public.radar_system_claim_work('f1-worker-a', 300);
select ok((select sealed_at is not null and input_hash is not null from public.radar_work_items where id=(select * from f1_work)),
  'finalization seals input membership before claim');
select public.radar_system_record_observation((select * from f1_event), '29000000-0000-4000-8000-000000000100',
  'f1_provider', 'adapter-v1', 'market', 'unfrozen', 'AVAILABLE', 7, 7, 0, 'USD', '{}',
  '{"authority":"f1"}', null, repeat('6',64), clock_timestamp()-interval '1 hour') into temporary f1_unfrozen_observation;
select throws_ok($$select public.radar_system_attach_observation((select * from f1_work), (select * from f1_observation))$$,
  '55000', null, 'sealed or claimed work cannot accept input changes');
update public.radar_work_items set lease_expires_at = now() - interval '1 second' where id=(select * from f1_work);
select * into temporary f1_claim_b from public.radar_system_claim_work('f1-worker-b', 300);
select is((select lease_generation from f1_claim_b), (select lease_generation from f1_claim_a) + 1,
  'recovered work receives a new fence');
select ok(not public.radar_system_renew_work((select * from f1_work), 'f1-worker-a',
  (select lease_token from f1_claim_a), (select lease_generation from f1_claim_a), 300),
  'stale worker cannot renew after recovery');
select throws_ok($$select public.radar_system_fail_work((select * from f1_work), 'f1-worker-a',
  (select lease_token from f1_claim_a), (select lease_generation from f1_claim_a), false, 'stale', now())$$,
  '40001', null, 'stale worker cannot fail recovered work');
select throws_ok($$select public.radar_system_complete_screening((select * from f1_work), 'f1-worker-a',
  (select lease_token from f1_claim_a), (select lease_generation from f1_claim_a), 'PASS', '[]',
  (select input_hash from public.radar_work_items where id=(select * from f1_work)), now())$$,
  '40001', null, 'stale worker cannot complete screening');
select public.radar_system_complete_screening((select * from f1_work), 'f1-worker-b',
  (select lease_token from f1_claim_b), (select lease_generation from f1_claim_b), 'PASS', '[]',
  (select input_hash from public.radar_work_items where id=(select * from f1_work)), now());

-- Final analytical persistence remains fenced and binds to the sealed hash,
-- reserved version, producing work and method.
select throws_ok($$select public.radar_system_create_analysis((select * from f1_work), 'EARLY', 10, '{}', '{}', 'risk',
  'contract-v1', repeat('6',64), (select input_hash from public.radar_work_items where id=(select * from f1_work)),
  '{}', '{}', null, 'freshness-v1', now()+interval '1 day', now(), (select lease_generation from f1_claim_a))$$,
  '40001', null, 'stale worker cannot insert an analysis');
select throws_ok($$select public.radar_system_create_analysis((select * from f1_work), 'EARLY', 10, '{}', '{}', 'risk',
  'contract-v1', repeat('6',64), repeat('9',64), '{}', '{}', null, 'freshness-v1', now()+interval '1 day', now(),
  (select lease_generation from f1_claim_b))$$,
  '55000', null, 'analysis input hash must match the sealed work');
select public.radar_system_create_analysis((select * from f1_work), 'EARLY', 10, '{}', '{}', 'risk',
  'contract-v1', repeat('6',64), (select input_hash from public.radar_work_items where id=(select * from f1_work)),
  '{}', '{}', null, 'freshness-v1', now()+interval '1 day', now(), (select lease_generation from f1_claim_b)) into temporary f1_analysis;
select throws_ok($$select public.radar_system_create_analysis((select * from f1_work), 'INCOMPLETE', 1, '{}', '{}', 'different',
  'contract-v1', repeat('6',64), (select input_hash from public.radar_work_items where id=(select * from f1_work)),
  '{}', '{}', null, 'freshness-v1', now()+interval '1 day', now(), (select lease_generation from f1_claim_b))$$,
  '22023', null, 'conflicting analysis completion replay is rejected');
select throws_ok($$select public.radar_system_append_evidence((select * from f1_analysis),
  '29000000-0000-4000-8000-000000000100', 'stale', 'VERIFIED_DATA', 'DETERMINISTIC', 'market', 'Stale', 'stale', null, null, null, null, null,
  'f1_provider', 'adapter-v1', null, 'https://example.test/stale', now(), now(), now(), 'contract-v1', true, 1,
  (select lease_generation from f1_claim_a))$$, '40001', null, 'stale worker cannot append evidence');
select throws_ok($$select public.radar_system_append_evidence((select * from f1_analysis),
  '29000000-0000-4000-8000-000000000100', 'outside', 'VERIFIED_DATA', 'DETERMINISTIC', 'market', 'Outside', 'outside', null, null, null, null, null,
  'f1_provider', 'adapter-v1', (select * from f1_unfrozen_observation), 'https://example.test/outside', now(), now(), now(), 'contract-v1', true, 1,
  (select lease_generation from f1_claim_b))$$, '23514', null, 'evidence cannot reference an unfrozen observation');
select public.radar_system_append_evidence((select * from f1_analysis),
  '29000000-0000-4000-8000-000000000100', 'liquidity', 'VERIFIED_DATA', 'DETERMINISTIC', 'market', 'Liquidity', 'Observed', 100, 'USD', 2, null, null,
  'f1_provider', 'adapter-v1', (select * from f1_observation), 'https://example.test/liquidity', clock_timestamp()-interval '2 hours', clock_timestamp()-interval '1 hour', clock_timestamp(), 'contract-v1', true, 1,
  (select lease_generation from f1_claim_b));
select public.radar_system_mark_analysis_ready_for_review((select * from f1_analysis),
  (select version from public.radar_analyses where id=(select * from f1_analysis)),
  (select lease_generation from f1_claim_b), (select input_hash from public.radar_analyses where id=(select * from f1_analysis)),
  repeat('6',64)) into temporary f1_review;
select ok((select state='PENDING' from public.radar_reviews where id=(select * from f1_review)),
  'fenced system path creates a pending review without publishing');
grant select on table f1_analysis, f1_review to authenticated;

-- Failure completion requires the current unexpired lease and exact replay.
select public.radar_system_enqueue_work('f1-failure', 'OBSERVATION', '29000000-0000-4000-8000-000000000100',
  (select * from f1_event), null, null, null, now()) into temporary f1_failure_work;
select * into temporary f1_failure_claim_a from public.radar_system_claim_work('f1-failure-a', 300);
update public.radar_work_items set lease_expires_at = now() - interval '1 second' where id=(select * from f1_failure_work);
select * into temporary f1_failure_claim_b from public.radar_system_claim_work('f1-failure-b', 300);
select throws_ok($$select public.radar_system_fail_work((select * from f1_failure_work), 'f1-failure-a',
  (select lease_token from f1_failure_claim_a), (select lease_generation from f1_failure_claim_a), false, 'old', now())$$,
  '40001', null, 'expired worker cannot permanently fail recovered work');
select is(public.radar_system_fail_work((select * from f1_failure_work), 'f1-failure-b',
  (select lease_token from f1_failure_claim_b), (select lease_generation from f1_failure_claim_b), true, 'retry', now()+interval '1 hour'),
  'RETRY_WAIT', 'current worker can fail into retry');
select is(public.radar_system_fail_work((select * from f1_failure_work), 'f1-failure-b',
  (select lease_token from f1_failure_claim_b), (select lease_generation from f1_failure_claim_b), true, 'retry', now()+interval '1 hour'),
  'RETRY_WAIT', 'exact failure replay is idempotent');
select throws_ok($$select public.radar_system_fail_work((select * from f1_failure_work), 'f1-failure-b',
  (select lease_token from f1_failure_claim_b), (select lease_generation from f1_failure_claim_b), true, 'different', now()+interval '1 hour')$$,
  '40001', null, 'conflicting failure replay is rejected');

-- Version allocation accounts for both persisted and pending versions.
insert into public.radar_work_items(work_kind, token_id, request_key, request_operation, reserved_analysis_version, available_at, pause_generation)
values ('SCREENING', '29000000-0000-4000-8000-000000000100', 'f1-reserved-version', 'SCREENING', 99, now()+interval '1 day', 1);
select public.radar_system_enqueue_work('f1-version-after-reserved', 'SCREENING', '29000000-0000-4000-8000-000000000100',
  (select * from f1_event), null, 'contract-v1', 'input-v1', now()) into temporary f1_version_work;
select is((select reserved_analysis_version from public.radar_work_items where id=(select * from f1_version_work)), 100,
  'new version skips persisted and already-reserved versions');

-- Pause state is complete-record validated, fail-closed, and consistently
-- enforced on ingestion, work and result paths.
update public.feature_flags set configuration='{}'::jsonb where key='radar_emergency_paused';
select throws_ok($$select public.radar_system_insert_event('f1-malformed-event','DISCOVERY','29000000-0000-4000-8000-000000000100','f1_provider','x',repeat('a',64),'{}',now())$$,
  '55000', null, 'malformed emergency control blocks event ingestion');
select throws_ok($$select public.radar_system_enqueue_work('f1-malformed-work','SCREENING','29000000-0000-4000-8000-000000000100',null,null,'contract-v1','input-v1',now())$$,
  '55000', null, 'malformed emergency control blocks work enqueue');
update public.feature_flags set configuration='{"generation":"not-a-number"}'::jsonb where key='radar_emergency_paused';
select throws_ok($$select public.radar_system_claim_work('malformed-worker',300)$$,
  '55000', null, 'malformed generation blocks work claim');
delete from public.feature_flags where key='radar_emergency_paused';
select throws_ok($$select public.radar_system_record_observation((select * from f1_event),'29000000-0000-4000-8000-000000000100','f1_provider','adapter-v1','market','missing-control','UNKNOWN',null,null,null,null,'{}','{"reason":"missing"}',null,repeat('a',64),now())$$,
  '55000', null, 'missing emergency control blocks observation ingestion');
insert into public.feature_flags(key, enabled, configuration) values ('radar_emergency_paused', false, '{"generation":1}'::jsonb);

select set_config('request.jwt.claims', '{"sub":"29000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '29000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select is(public.radar_set_emergency_pause(true, 1, 'f1-pause-1'), 2::bigint, 'pause increments generation');
select is(public.radar_set_emergency_pause(true, 2, 'f1-pause-2'), 3::bigint, 'repeated same-state pause increments generation');
reset role;
select is((select previous_state->>'enabled' from public.audit_logs where action='feature_flag.updated'
  and resulting_state->>'generation' = '3' limit 1), 'true',
  'pause audit records the actual previous enabled state');
select throws_ok($$select public.radar_system_insert_event('f1-paused-event','DISCOVERY','29000000-0000-4000-8000-000000000100','f1_provider','paused',repeat('a',64),'{}',now())$$,
  '55000', null, 'paused event ingestion is blocked');
select throws_ok($$select public.radar_system_record_observation((select * from f1_event),'29000000-0000-4000-8000-000000000100','f1_provider','adapter-v1','market','paused','UNKNOWN',null,null,null,null,'{}','{"reason":"paused"}',null,repeat('b',64),now())$$,
  '55000', null, 'paused observation ingestion is blocked');
select throws_ok($$select public.radar_system_enqueue_work('f1-paused-work','SCREENING','29000000-0000-4000-8000-000000000100',null,null,'contract-v1','input-v1',now())$$,
  '55000', null, 'paused work enqueue is blocked');
select throws_ok($$select public.radar_system_claim_work('paused-worker',300)$$,
  '55000', null, 'paused work claim is blocked');
select throws_ok($$select public.radar_system_create_analysis((select * from f1_work), 'EARLY', 10, '{}', '{}', 'risk', 'contract-v1', repeat('6',64),
  (select input_hash from public.radar_work_items where id=(select * from f1_work)), '{}', '{}', null, 'freshness-v1', now()+interval '1 day', now(), null)$$,
  '22023', null, 'NULL analytical fence is rejected');
select throws_ok($$select public.radar_system_append_evidence((select * from f1_analysis),'29000000-0000-4000-8000-000000000100','null-fence','UNKNOWN','DETERMINISTIC','market','Null','Null',null,null,null,null,'reason',null,null,null,null,now(),now(),now(),'contract-v1',false,1,null)$$,
  '22023', null, 'NULL evidence fence is rejected');
select throws_ok($$select public.radar_set_emergency_pause(false, null, 'f1-null-generation')$$,
  '22023', null, 'NULL emergency generation is rejected');
select throws_ok($$select public.radar_approve_review((select * from f1_review), null, 'note', 'disclosure', 'f1-null-review')$$,
  '22023', null, 'NULL review revision is rejected');
reset role;

-- Resume, then verify an old pause generation cannot complete a result.
select set_config('request.jwt.claims', '{"sub":"29000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '29000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select is(public.radar_set_emergency_pause(false, 3, 'f1-resume'), 4::bigint, 'resume increments generation');
reset role;
select public.radar_system_enqueue_work('f1-generation-work', 'SCREENING', '29000000-0000-4000-8000-000000000100',
  (select * from f1_event), null, 'contract-v1', 'input-v1', now()) into temporary f1_generation_work;
select public.radar_system_attach_observation((select * from f1_generation_work), (select * from f1_observation));
select public.radar_system_finalize_work_inputs((select * from f1_generation_work), 'contract-v1', 'input-v1');
select * into temporary f1_generation_claim from public.radar_system_claim_work('generation-worker',300);
select set_config('request.jwt.claims', '{"sub":"29000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select is(public.radar_set_emergency_pause(true, 4, 'f1-generation-pause'), 5::bigint, 'pause generation changes while worker is active');
reset role;
select throws_ok($$select public.radar_system_complete_screening((select * from f1_generation_work),'generation-worker',
  (select lease_token from f1_generation_claim),(select lease_generation from f1_generation_claim),'PASS','[]',
  (select input_hash from public.radar_work_items where id=(select * from f1_generation_work)),now())$$,
  '55000', null, 'old pause generation rejects worker result');

-- Human request receipts bind actor/action/target/payload and recalculation
-- copies the original frozen input set rather than selecting newer inputs.
select set_config('request.jwt.claims', '{"sub":"29000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select is(public.radar_set_emergency_pause(false, 5, 'f1-resume-before-human'), 6::bigint, 'resume restores the operational control');
reset role;
insert into public.radar_analyses(id, token_id, version, status, deterministic_data, ai_inference, analyzed_at, data_as_of)
values ('29000000-0000-4000-8000-000000000200', '29000000-0000-4000-8000-000000000100', 50,
  'REJECTED', '{}', '{}', now(), now());
select set_config('request.jwt.claims', '{"sub":"29000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select is(public.radar_request_reanalysis((select * from f1_analysis), 'refresh', 'f1-human-key'),
  (select public.radar_request_reanalysis((select * from f1_analysis), 'refresh', 'f1-human-key')), 'same human request is idempotent');
select throws_ok($$select public.radar_request_reanalysis((select * from f1_analysis), 'changed payload', 'f1-human-key')$$,
  '23505', null, 'same human key with changed payload conflicts');
select throws_ok($$select public.radar_request_score_recalculation((select * from f1_analysis), 'recalc', 'f1-human-key')$$,
  '23505', null, 'same human key with changed action conflicts');
select throws_ok($$select public.radar_request_reanalysis('29000000-0000-4000-8000-000000000200', 'refresh', 'f1-human-key')$$,
  '23505', null, 'same human key with different target conflicts');
select is(public.radar_request_score_recalculation((select * from f1_analysis), 'recalc', 'f1-recalc-key') is not null, true,
  'score recalculation request creates a distinct durable job');
select is((select count(*)::integer from public.radar_work_inputs where work_item_id=(select id from public.radar_work_items where request_key='f1-recalc-key')), 1,
  'recalculation copies the exact historical frozen inputs');
select is((select input_hash from public.radar_work_items where request_key='f1-recalc-key'),
  (select input_hash from public.radar_work_items where id=(select work_item_id from public.radar_analyses where id=(select * from f1_analysis))),
  'recalculation preserves the historical input hash');
select ok((select reserved_analysis_version from public.radar_work_items where request_key='f1-recalc-key') > 99,
  'recalculation reserves a version above existing and pending versions');
reset role;
select set_config('request.jwt.claims', '{"sub":"29000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '29000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select throws_ok($$select public.radar_request_reanalysis((select * from f1_analysis), 'refresh', 'f1-human-key')$$,
  '23505', null, 'same human key with different actor conflicts');
reset role;

select * from finish();
rollback;
