-- Gate 19C Radar contracts. All fixtures are synthetic and rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

-- Foundation-only fixtures are explicitly test-scoped; production registries
-- remain empty until a real methodology and freshness policy are approved.
insert into public.radar_methodology_versions(
  methodology_version, state, is_test_only, content_hash, approved_at
) values ('contract-v1', 'APPROVED', true, repeat('c', 64), now());
insert into public.radar_freshness_policies(
  freshness_policy_version, state, is_test_only, content_hash, approved_at
) values ('freshness-contract-v1', 'APPROVED', true, repeat('d', 64), now());

insert into auth.users(id) values
  ('19000000-0000-4000-8000-000000000001'),
  ('19000000-0000-4000-8000-000000000002'),
  ('19000000-0000-4000-8000-000000000003'),
  ('19000000-0000-4000-8000-000000000004'),
  ('19000000-0000-4000-8000-000000000005'),
  ('19000000-0000-4000-8000-000000000006'),
  ('19000000-0000-4000-8000-000000000007'),
  ('19000000-0000-4000-8000-000000000008');
insert into public.profiles(id, display_name, status) values
  ('19000000-0000-4000-8000-000000000001', 'Radar Owner', 'ACTIVE'),
  ('19000000-0000-4000-8000-000000000002', 'Radar Viewer', 'ACTIVE'),
  ('19000000-0000-4000-8000-000000000003', 'Radar Analyst', 'ACTIVE'),
  ('19000000-0000-4000-8000-000000000004', 'Ad Manager', 'ACTIVE'),
  ('19000000-0000-4000-8000-000000000005', 'Editor', 'ACTIVE'),
  ('19000000-0000-4000-8000-000000000006', 'Radar Reviewer', 'ACTIVE'),
  ('19000000-0000-4000-8000-000000000007', 'No Role', 'ACTIVE'),
  ('19000000-0000-4000-8000-000000000008', 'Inactive', 'SUSPENDED');
insert into public.user_roles(user_id, role_id)
select x.user_id, r.id from (values
  ('19000000-0000-4000-8000-000000000001'::uuid, 'owner'),
  ('19000000-0000-4000-8000-000000000002'::uuid, 'viewer'),
  ('19000000-0000-4000-8000-000000000003'::uuid, 'analyst'),
  ('19000000-0000-4000-8000-000000000004'::uuid, 'ad_manager'),
  ('19000000-0000-4000-8000-000000000005'::uuid, 'editor'),
  ('19000000-0000-4000-8000-000000000006'::uuid, 'radar_reviewer')
) x(user_id, role_key) join public.roles r on r.key = x.role_key;
insert into public.tokens(id, chain, contract_address, symbol, name)
values ('19000000-0000-4000-8000-000000000100', 'eip155:1',
  '0x9999999999999999999999999999999999999999', 'R19', 'Radar fixture token');
update public.feature_flags set enabled = case key
  when 'radar_enabled' then true when 'maintenance_mode' then false when 'radar_emergency_paused' then false else enabled end
where key in ('radar_enabled', 'maintenance_mode', 'radar_emergency_paused');

-- Events are immutable envelopes with a database-enforced identity key.
select is(
  public.radar_system_insert_event('event-1', 'DISCOVERY', '19000000-0000-4000-8000-000000000100',
    'fixture_provider', 'provider-event-1', repeat('a', 64), '{"chain":"eip155:1"}', now() - interval '1 hour'),
  public.radar_system_insert_event('event-1', 'DISCOVERY', '19000000-0000-4000-8000-000000000100',
    'fixture_provider', 'provider-event-1', repeat('a', 64), '{"chain":"eip155:1"}', now() - interval '1 hour'),
  'same normalized event key is idempotent');
select is((select count(*)::integer from public.radar_events where event_key = 'event-1'), 1,
  'same event key creates one logical event');
select throws_ok($$select public.radar_system_insert_event('event-1', 'DISCOVERY', '19000000-0000-4000-8000-000000000100',
  'fixture_provider', 'provider-event-1', repeat('c', 64), '{"changed":true}', now() - interval '1 hour')$$,
  '23505', null, 'reused event key with changed payload is rejected');
select lives_ok($$select public.radar_system_insert_event('event-2', 'SIGNAL', '19000000-0000-4000-8000-000000000100',
  'fixture_provider', 'provider-event-2', repeat('b', 64), '{}', now() - interval '30 minutes')$$,
  'distinct events for one token are allowed');
select is((select count(*)::integer from public.radar_events where token_id = '19000000-0000-4000-8000-000000000100'), 2,
  'event history is not reduced to one token row');
select throws_ok($$select public.radar_system_insert_event('bad-event', 'DISCOVERY', '19000000-0000-4000-8000-000000000199',
  'fixture_provider', null, repeat('c', 64), '{}', now())$$, '23503', null,
  'event token foreign key is enforced');

-- Observations preserve exact numeric values and explicit missingness.
select public.radar_system_record_observation(
  (select id from public.radar_events where event_key='event-1'), '19000000-0000-4000-8000-000000000100',
  'fixture_provider', 'adapter-v1', 'market', 'liquidity', 'AVAILABLE',
  123456789012345.6789, null, 4, 'USD', '{}', '{"authority":"market-provider"}', null,
  repeat('d', 64), now() - interval '1 hour');
select public.radar_system_record_observation(
  (select id from public.radar_events where event_key='event-1'), '19000000-0000-4000-8000-000000000100',
  'fixture_provider', 'adapter-v1', 'market', 'holders', 'UNKNOWN', null, null, null, 'count',
  '{}', '{"reason":"timeout"}', null, repeat('e', 64), now() - interval '1 hour');
select public.radar_system_record_observation(
  (select id from public.radar_events where event_key='event-1'), '19000000-0000-4000-8000-000000000100',
  'fixture_provider', 'adapter-v1', 'market', 'volume', 'UNAVAILABLE', null, null, null, 'USD',
  '{}', '{"reason":"rate_limited"}', null, repeat('f', 64), now() - interval '1 hour');
select public.radar_system_record_observation(
  (select id from public.radar_events where event_key='event-1'), '19000000-0000-4000-8000-000000000100',
  'fixture_provider', 'adapter-v1', 'chain', 'authority', 'UNSUPPORTED', null, null, null, null,
  '{}', '{"chain":"unsupported"}', null, repeat('1', 64), now() - interval '1 hour');
select public.radar_system_record_observation(
  (select id from public.radar_events where event_key='event-1'), '19000000-0000-4000-8000-000000000100',
  'fixture_provider', 'adapter-v1', 'market', 'price', 'STALE', null, null, 2, 'USD',
  '{}', '{"last_verified":"historical"}', null, repeat('2', 64), now() - interval '1 day');
select is((select normalized_value::text from public.radar_observations where metric_key='liquidity'),
  '123456789012345.6789', 'available numeric observation preserves exact decimal text');
select is((select normalized_value from public.radar_observations where metric_key='holders'), null::numeric,
  'UNKNOWN is stored as NULL, not zero');
select is((select normalized_value from public.radar_observations where metric_key='volume'), null::numeric,
  'UNAVAILABLE is stored as NULL, not zero');
select is((select data_state from public.radar_observations where metric_key='authority'), 'UNSUPPORTED',
  'unsupported capability is explicit');
select throws_ok($$select public.radar_system_record_observation(
  (select id from public.radar_events where event_key='event-1'), '19000000-0000-4000-8000-000000000100',
  'fixture_provider', 'adapter-v1', 'market', 'bad', 'AVAILABLE', 'NaN'::numeric, null, null, 'USD',
  '{}', '{"authority":"market-provider"}', null, repeat('3', 64), now())$$, '23514', null,
  'non-finite observation value is rejected');
select throws_ok($$insert into public.radar_observations(event_id, token_id, provider, adapter_version, capability, metric_key,
  data_state, provenance, content_hash, observed_at) values ((select id from public.radar_events limit 1),
  '19000000-0000-4000-8000-000000000100','fixture_provider','adapter-v1','market','bad','AVAILABLE','{}',repeat('4',64),now())$$,
  '23514', null, 'observation provenance/value contract is enforced');

-- Work is durable, request-idempotent, lease-fenced and input-sealed.
select public.radar_system_enqueue_work('screen-request', 'SCREENING',
  '19000000-0000-4000-8000-000000000100', (select id from public.radar_events where event_key='event-1'), null,
  'contract-v1', 'input-v1', now()) into temporary radar_screen_work;
select is((select count(*)::integer from radar_screen_work), 1, 'screening work item is created');
select is((select public.radar_system_enqueue_work('screen-request', 'SCREENING',
  '19000000-0000-4000-8000-000000000100', (select id from public.radar_events where event_key='event-1'), null,
  'contract-v1', 'input-v1', now())),
  (select * from radar_screen_work), 'duplicate request key returns the same work item');
select public.radar_system_attach_observation((select * from radar_screen_work),
  (select id from public.radar_observations where metric_key='liquidity'));
select is((select count(*)::integer from public.radar_work_inputs where work_item_id=(select * from radar_screen_work)), 1,
  'work input association is recorded');
select public.radar_system_finalize_work_inputs((select * from radar_screen_work), 'contract-v1', 'input-v1');
select * into temporary radar_claim_a from public.radar_system_claim_work('worker-a', 300);
select is((select count(*)::integer from radar_claim_a), 1, 'due work can be claimed');
select lives_ok($$select public.radar_system_complete_screening(
  (select work_item_id from radar_claim_a), 'worker-a', (select lease_token from radar_claim_a),
  (select lease_generation from radar_claim_a), 'PASS', '["fixture"]'::jsonb,
  (select input_hash from public.radar_work_items where id=(select work_item_id from radar_claim_a)), now())$$,
  'screening completion accepts the current lease');
select is((select state from public.radar_work_items where id=(select work_item_id from radar_claim_a)), 'SUCCEEDED',
  'completed screening reaches terminal success');
select is((select sealed_at is not null from public.radar_work_items where id=(select work_item_id from radar_claim_a)), true,
  'completed work seals its input set');
select throws_ok($$insert into public.radar_work_inputs(work_item_id, observation_id)
  values ((select work_item_id from radar_claim_a), (select id from public.radar_observations where metric_key='holders'))$$,
  '55000', null, 'sealed work input cannot be expanded through raw DML');
select lives_ok($$select public.radar_system_complete_screening(
  (select work_item_id from radar_claim_a), 'worker-a', (select lease_token from radar_claim_a),
  (select lease_generation from radar_claim_a), 'PASS', '["fixture"]'::jsonb,
  (select input_hash from public.radar_work_items where id=(select work_item_id from radar_claim_a)), now())$$,
  'repeated completion returns the existing accepted result');
select is((select count(*)::integer from public.audit_logs where action='radar.screening_completed'), 1,
  'duplicate completion does not append a second system audit');

select public.radar_system_enqueue_work('lease-request', 'OBSERVATION',
  '19000000-0000-4000-8000-000000000100', (select id from public.radar_events where event_key='event-2'), null,
  null, null, now()) into temporary radar_lease_work;
select * into temporary radar_old_claim from public.radar_system_claim_work('worker-old', 300);
update public.radar_work_items set lease_expires_at = now() - interval '1 second'
where id=(select work_item_id from radar_old_claim);
select * into temporary radar_new_claim from public.radar_system_claim_work('worker-new', 300);
select is((select count(*)::integer from radar_new_claim), 1, 'expired leases are recoverable by another worker');
select throws_ok($$select public.radar_system_complete_screening(
  (select work_item_id from radar_old_claim), 'worker-old', (select lease_token from radar_old_claim),
  (select lease_generation from radar_old_claim), 'PASS', '[]'::jsonb,
  (select input_hash from public.radar_work_items where id=(select work_item_id from radar_old_claim)), now())$$,
  '40001', null, 'old lease fence cannot complete recovered work');
select is(public.radar_system_fail_work((select work_item_id from radar_new_claim), 'worker-new',
  (select lease_token from radar_new_claim), (select lease_generation from radar_new_claim), true,
  'temporary provider timeout', now() + interval '1 day'), 'RETRY_WAIT', 'retryable work failure is explicit');

-- Analysis runs are immutable score snapshots bound to reserved work/input versions.
select public.radar_system_create_analysis((select * from radar_screen_work), 'EARLY', 12.3400,
  '{"screened":true}', '{}', 'Fixture risk summary', 'contract-v1', repeat('7',64),
  (select input_hash from public.radar_work_items where id=(select * from radar_screen_work)),
  '{"coverage":"complete"}', '{"known":1}', null, 'freshness-contract-v1', now() + interval '1 day',
  now() - interval '1 hour', (select lease_generation from public.radar_work_items where id=(select * from radar_screen_work))) into temporary radar_analysis;
select is((select count(*)::integer from radar_analysis), 1, 'completed work creates one analysis run');
select is((select score::text from public.radar_analyses where id=(select * from radar_analysis)), '12.3400',
  'score snapshot keeps exact numeric representation');
select is((select work_item_id from public.radar_analyses where id=(select * from radar_analysis)),
  (select * from radar_screen_work), 'analysis remains bound to its producing work item');
select throws_ok($$update public.radar_analyses set score = 99$$, '55000', null,
  'analysis and score snapshots are immutable');
select throws_ok($$delete from public.radar_analyses$$, '55000', null,
  'analysis history cannot be deleted');
select throws_ok($$select public.radar_system_create_analysis((select * from radar_screen_work), 'EARLY', 1,
  '{}','{}',null,'invented-method',repeat('8',64),
  (select input_hash from public.radar_work_items where id=(select * from radar_screen_work)),
  '{}','{}',null,'freshness-contract-v1',now()+interval '1 day',now(),
  (select lease_generation from public.radar_work_items where id=(select * from radar_screen_work)))$$,
  '22023', null, 'unapproved methodology identifier is rejected');

-- Evidence supports all four classes, is append-only, and preserves UNKNOWN.
select public.radar_system_append_evidence((select * from radar_analysis),
  '19000000-0000-4000-8000-000000000100', 'liquidity', 'VERIFIED_DATA', 'DETERMINISTIC', 'market',
  'Liquidity', 'Observed by fixture provider', 123456789012345.6789, 'USD', 4, null, null,
  'fixture_provider', 'adapter-v1', (select id from public.radar_observations where metric_key='liquidity'),
  'https://example.test/liquidity', now()-interval '1 hour', now()-interval '30 minutes', now(),
  'contract-v1', true, 1, (select lease_generation from public.radar_work_items where id=(select work_item_id from public.radar_analyses where id=(select * from radar_analysis))));
select public.radar_system_append_evidence((select * from radar_analysis),
  '19000000-0000-4000-8000-000000000100', 'activity-signal', 'STRONG_SIGNAL', 'DETERMINISTIC', 'activity',
  'Activity signal', 'Derived from the frozen fixture input', null, null, null, '{"signal":"present"}', null,
  'fixture_provider', 'adapter-v1', null, 'https://example.test/activity', now()-interval '1 hour', now()-interval '30 minutes', now(),
  'contract-v1', true, 2, (select lease_generation from public.radar_work_items where id=(select work_item_id from public.radar_analyses where id=(select * from radar_analysis))));
select public.radar_system_append_evidence((select * from radar_analysis),
  '19000000-0000-4000-8000-000000000100', 'narrative', 'AI_INFERENCE', 'INFERENCE', 'context',
  'Inference', 'Clearly labeled model-assisted context', null, null, null, '{"confidence_context":"limited"}', null,
  null, null, null, null, now()-interval '1 hour', now()-interval '30 minutes', now(),
  'contract-v1', false, 3, (select lease_generation from public.radar_work_items where id=(select work_item_id from public.radar_analyses where id=(select * from radar_analysis))));
select public.radar_system_append_evidence((select * from radar_analysis),
  '19000000-0000-4000-8000-000000000100', 'holder-coverage', 'UNKNOWN', 'DETERMINISTIC', 'holders',
  'Holder coverage', null, null, null, null, null, 'provider timeout', 'fixture_provider', 'adapter-v1',
  null, null, now()-interval '1 hour', now()-interval '30 minutes', now(),
  'contract-v1', false, 4, (select lease_generation from public.radar_work_items where id=(select work_item_id from public.radar_analyses where id=(select * from radar_analysis))));
select is((select count(*)::integer from public.radar_evidence where analysis_id=(select * from radar_analysis)), 4,
  'all four evidence classes are representable');
select throws_ok($$update public.radar_evidence set classification='VERIFIED_DATA'$$, '55000', null,
  'evidence history cannot be relabeled in place');
select is((select unknown_reason from public.radar_evidence where classification='UNKNOWN'), 'provider timeout',
  'UNKNOWN retains an explicit reason');

-- Review/publication is audited, revisioned, fail-closed and public-only after approval.
insert into public.radar_reviews(id, analysis_id, token_id)
values ('19000000-0000-4000-8000-000000000200', (select * from radar_analysis),
  '19000000-0000-4000-8000-000000000100');
select set_config('request.jwt.claims', '{"sub":"19000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '19000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select lives_ok($$select public.radar_approve_review('19000000-0000-4000-8000-000000000200', 1,
  'Public fixture note', 'Fixture disclosure',
  'approve-1')$$, 'Owner can approve an eligible review');
select is((select revision from public.radar_reviews where id='19000000-0000-4000-8000-000000000200'), 2,
  'approval advances the optimistic revision');
select lives_ok($$select public.radar_publish_review('19000000-0000-4000-8000-000000000200', 2, 'publish-1')$$,
  'Owner can publish an approved eligible review');
select is((select state from public.radar_reviews where id='19000000-0000-4000-8000-000000000200'), 'PUBLISHED',
  'publication state is persisted');
reset role;
select is((select count(*)::integer from public.audit_logs where action='radar.published'), 1,
  'publication appends one audit event');
select set_config('request.jwt.claims', '{"sub":"19000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '19000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select throws_ok($$update public.radar_analyses set score=99$$, '42501', null,
  'authenticated roles cannot directly mutate score');
select throws_ok($$insert into public.radar_evidence(analysis_id, token_id, evidence_key, classification, origin, category, label)
  values ((select * from radar_analysis),'19000000-0000-4000-8000-000000000100','forged','VERIFIED_DATA','DETERMINISTIC','x','Forged')$$,
  '42501', null, 'authenticated roles cannot directly insert evidence');
select throws_ok($$select public.radar_system_insert_event('browser-event','DISCOVERY',null,null,null,repeat('9',64),'{}',now())$$,
  '42501', null, 'authenticated callers cannot execute system ingestion functions');
reset role;
select set_config('request.jwt.claims', '{"sub":"19000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '19000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select throws_ok($$select public.radar_approve_review('19000000-0000-4000-8000-000000000200', 3, '', 'x', 'viewer-1')$$,
  '42501', null, 'Viewer cannot perform Radar moderation');
reset role;
select set_config('request.jwt.claims', '{"sub":"19000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '19000000-0000-4000-8000-000000000004', true);
set local role authenticated;
select throws_ok($$select public.radar_request_reanalysis((select * from radar_analysis),'Ad request','ad-request')$$,
  '42501', null, 'Ad Manager cannot request analytical work');
reset role;
select set_config('request.jwt.claims', '{"sub":"19000000-0000-4000-8000-000000000007","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '19000000-0000-4000-8000-000000000007', true);
set local role authenticated;
select throws_ok($$select public.radar_hide_review('19000000-0000-4000-8000-000000000200', 3, 'No role', 'no-role-1')$$,
  '42501', null, 'authenticated no-role cannot moderate Radar');
reset role;
select set_config('request.jwt.claims', '{"sub":"19000000-0000-4000-8000-000000000008","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '19000000-0000-4000-8000-000000000008', true);
set local role authenticated;
select throws_ok($$select public.radar_hide_review('19000000-0000-4000-8000-000000000200', 3, 'Inactive', 'inactive-1')$$,
  '42501', null, 'inactive profile cannot moderate Radar');
reset role;

-- Public callers see the frozen allowlist, never raw/private fields.
select set_config('request.jwt.claims', '{"role":"anon","is_anonymous":"true"}', true);
set local role anon;
select is((select count(*)::integer from public.get_public_radar_list(50, null)), 1,
  'anonymous list projection returns the published record');
select is((select count(*)::integer from public.get_public_radar_detail('19000000-0000-4000-8000-000000000100')), 1,
  'anonymous detail projection returns the published record');
select is((select score from public.get_public_radar_detail('19000000-0000-4000-8000-000000000100')), '12.3400',
  'public score is serialized as exact text');
select ok(not exists (select 1 from public.get_public_radar_detail('19000000-0000-4000-8000-000000000100') x
  where to_jsonb(x) ? 'editorial_note' or to_jsonb(x) ? 'work_item_id' or to_jsonb(x) ? 'reviewer_id'),
  'public detail does not expose private review or work metadata');
select throws_ok($$select * from public.radar_analyses$$, '42501', null,
  'anonymous raw analysis read remains denied');
reset role;

-- Newer analysis publication supersedes older publication only after checks.
select public.radar_system_enqueue_work('analysis-2-request', 'REANALYSIS',
  '19000000-0000-4000-8000-000000000100', (select id from public.radar_events where event_key='event-2'),
  (select * from radar_analysis), 'contract-v1', 'input-v2', now()) into temporary radar_analysis_work_2;
select public.radar_system_attach_observation((select * from radar_analysis_work_2),
  (select id from public.radar_observations where metric_key='holders'));
select public.radar_system_finalize_work_inputs((select * from radar_analysis_work_2), 'contract-v1', 'input-v2');
select * into temporary radar_claim_b from public.radar_system_claim_work('worker-b', 300);
select public.radar_system_complete_screening((select work_item_id from radar_claim_b), 'worker-b',
  (select lease_token from radar_claim_b), (select lease_generation from radar_claim_b), 'PASS',
  '["fixture"]',
  (select input_hash from public.radar_work_items where id=(select work_item_id from radar_claim_b)), now());
select public.radar_system_create_analysis((select * from radar_analysis_work_2), 'TRENDING', 15.5,
  '{"screened":true}', '{}', 'Newer risk', 'contract-v1', repeat('b',64),
  (select input_hash from public.radar_work_items where id=(select * from radar_analysis_work_2)),
  '{"coverage":"partial"}', '{"unknown":["holders"]}', null, 'freshness-contract-v1', now()+interval '1 day', now()-interval '1 hour',
  (select lease_generation from public.radar_work_items where id=(select * from radar_analysis_work_2)))
  into temporary radar_analysis_2;
select public.radar_system_append_evidence((select * from radar_analysis_2),
  '19000000-0000-4000-8000-000000000100', 'activity-signal-2', 'STRONG_SIGNAL', 'DETERMINISTIC', 'activity',
  'New activity', 'Second immutable analysis', null, null, null, '{"signal":"present"}', null,
  'fixture_provider', 'adapter-v1', null, 'https://example.test/activity-2', now()-interval '1 hour', now()-interval '30 minutes', now(),
  'contract-v1', true, 1, (select lease_generation from public.radar_work_items where id=(select work_item_id from public.radar_analyses where id=(select * from radar_analysis_2))));
insert into public.radar_reviews(id, analysis_id, token_id)
values ('19000000-0000-4000-8000-000000000201', (select * from radar_analysis_2),
  '19000000-0000-4000-8000-000000000100');
select set_config('request.jwt.claims', '{"sub":"19000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '19000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select lives_ok($$select public.radar_approve_review('19000000-0000-4000-8000-000000000201', 1,
  'New note', 'New disclosure', 'approve-2')$$,
  'new analysis receives its own approval');
select public.radar_set_emergency_pause(true, 1, 'pause-1');
select throws_ok($$select public.radar_publish_review('19000000-0000-4000-8000-000000000201', 2, 'publish-paused')$$,
  '55000', null, 'emergency pause blocks publication');
select public.radar_set_emergency_pause(false, 2, 'resume-1');
select lives_ok($$select public.radar_publish_review('19000000-0000-4000-8000-000000000201', 2, 'publish-2')$$,
  'resume permits a valid human publication');
select is((select state from public.radar_reviews where id='19000000-0000-4000-8000-000000000200'), 'HIDDEN',
  'newer publication hides the prior publication');
select is((select count(*)::integer from public.radar_reviews where state='PUBLISHED'), 1,
  'partial unique publication contract leaves one published token row');
select throws_ok($$select public.radar_publish_review('19000000-0000-4000-8000-000000000201', 2, 'publish-2-stale')$$,
  '40001', null, 'stale review revision is rejected');
reset role;

update public.feature_flags set enabled = true where key='radar_auto_publish';
select is((select count(*)::integer from public.radar_reviews where state='PUBLISHED'), 1,
  'enabling radar_auto_publish alone performs no publication');
select set_config('request.jwt.claims', '{"role":"anon","is_anonymous":"true"}', true);
set local role anon;
select is((select count(*)::integer from public.get_public_radar_list(50, null)), 1,
  'public projection remains published-only after supersession');
reset role;
select set_config('request.jwt.claims', '{"sub":"19000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '19000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select lives_ok($$select public.radar_request_reanalysis((select id from public.radar_analyses where version=1),'Refresh inputs','request-reanalysis')$$,
  'Owner can request reanalysis without supplying output');
select is((select public.radar_request_reanalysis((select id from public.radar_analyses where version=1),'Refresh inputs','request-reanalysis')),
  (select id from public.radar_work_items where request_key='request-reanalysis'),
  'reanalysis request is idempotent');
select lives_ok($$select public.radar_request_score_recalculation((select id from public.radar_analyses where version=1),'Recheck method','request-recalc')$$,
  'Owner can request score recalculation without a score argument');
reset role;
select is((select count(*)::integer from public.radar_work_items where request_key in ('request-reanalysis','request-recalc')), 2,
  'reanalysis and recalculation create durable work requests');
select is((select count(*)::integer from public.audit_logs where action='radar.reanalysis_requested'), 1,
  'duplicate reanalysis request is audited once');
select is((select count(*)::integer from public.audit_logs where action='radar.score_recalculation_requested'), 1,
  'score recalculation request is audited once');
select set_config('request.jwt.claims', '{"sub":"19000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '19000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select throws_ok($$select public.radar_request_score_recalculation((select id from public.radar_analyses where version=1),'Recheck method','request-recalc',99)$$,
  '42883', null, 'score recalculation has no browser-supplied score parameter');
select lives_ok($$select public.radar_hide_review('19000000-0000-4000-8000-000000000201', 3, 'Fixture cleanup', 'hide-2')$$,
  'authorized human can hide a published record');
reset role;
select set_config('request.jwt.claims', '{"role":"anon","is_anonymous":"true"}', true);
set local role anon;
select is((select count(*)::integer from public.get_public_radar_list(50, null)), 0,
  'hidden Radar record is suppressed from public projection');
select is((select count(*)::integer from public.get_public_radar_detail('19000000-0000-4000-8000-000000000100')), 0,
  'hidden Radar detail is non-disclosing');
reset role;

-- ACLs and schema inventory enforce the commercial and execution boundary.
select ok(not has_function_privilege('anon', 'public.radar_system_insert_event(text,text,uuid,text,text,text,jsonb,timestamptz)', 'EXECUTE'),
  'anon has no system ingestion EXECUTE grant');
select ok(not has_function_privilege('authenticated', 'public.radar_system_insert_event(text,text,uuid,text,text,text,jsonb,timestamptz)', 'EXECUTE'),
  'authenticated has no system ingestion EXECUTE grant');
select ok(has_function_privilege('service_role', 'public.radar_system_insert_event(text,text,uuid,text,text,text,jsonb,timestamptz)', 'EXECUTE'),
  'only the trusted service role has system ingestion EXECUTE');
select ok(has_function_privilege('anon', 'public.get_public_radar_list(integer,timestamptz)', 'EXECUTE'),
  'anon has only the narrow public list projection');
select ok(not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' and c.relname ~* '(wallet|transaction|trade|order|position|fill|pnl)'),
  'Radar schema exposes no wallet/trading/execution table');
select ok(not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname ~* '(buy|sell|execute_trade|sign_transaction|route_order)'),
  'Radar schema exposes no trading/execution mutation function');

select * from finish();
rollback;
