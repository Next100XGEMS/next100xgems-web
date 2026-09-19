-- Gate 19G-F2 durable Deep Lane request/attempt/receipt contracts.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users(id) values ('7f000000-0000-4000-8000-000000000001');
insert into public.profiles(id, display_name, status)
values ('7f000000-0000-4000-8000-000000000001', 'Gate 19G-F2 owner', 'ACTIVE');
insert into public.user_roles(user_id, role_id)
select '7f000000-0000-4000-8000-000000000001', id from public.roles where key = 'owner';
insert into public.tokens(id, chain, contract_address, symbol, name)
values ('7f000000-0000-4000-8000-000000000100', 'eip155:1',
  '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'G19F2', 'Gate 19G-F2 fixture token');
insert into public.radar_events(
  id, event_key, event_type, token_id, source_provider, source_event_id,
  payload_hash, canonical_fingerprint, context, observed_at
) values (
  '7f000000-0000-4000-8000-000000000110', 'g19f2-event', 'OBSERVATION',
  '7f000000-0000-4000-8000-000000000100', 'fixture-provider', 'g19f2-source',
  repeat('a', 64), repeat('b', 64), '{}', now() - interval '1 hour'
);
insert into public.radar_observations(
  id, event_id, token_id, provider, adapter_version, capability, metric_key,
  data_state, normalized_value, raw_integer_value, decimal_places, unit,
  context, provenance, content_hash, observed_at
) values (
  '7f000000-0000-4000-8000-000000000101',
  '7f000000-0000-4000-8000-000000000110',
  '7f000000-0000-4000-8000-000000000100', 'fixture-provider', 'fixture-v1',
  'market', 'liquidity', 'AVAILABLE', 123.45, 12345, 2, 'USD', '{}',
  '{"authority":"fixture"}', repeat('c', 64), now() - interval '1 hour'
);
update public.feature_flags
set enabled = case key when 'radar_enabled' then true when 'maintenance_mode' then false
  when 'radar_emergency_paused' then false else enabled end,
  configuration = case when key = 'radar_emergency_paused' then '{"generation":1}'::jsonb else configuration end
where key in ('radar_enabled', 'maintenance_mode', 'radar_emergency_paused');

select public.radar_system_enqueue_work(
  'g19f2-deep-success', 'DEEP_ANALYSIS',
  '7f000000-0000-4000-8000-000000000100',
  '7f000000-0000-4000-8000-000000000110', null,
  'fixture-method-v1', 'fixture-input-v1', now()
) into temporary f2_success_work;
select public.radar_system_attach_observation((select * from f2_success_work),
  '7f000000-0000-4000-8000-000000000101');
select * into temporary f2_success_manifest from public.radar_system_finalize_work_inputs(
  (select * from f2_success_work), 'fixture-method-v1', 'fixture-input-v1'
);
select * into temporary f2_claim from public.radar_system_claim_work('f2-worker-a', 300);

select * into temporary f2_reservation from public.radar_system_reserve_deep_lane_attempt(
  (select work_item_id from f2_claim), 'f2-worker-a',
  (select lease_token from f2_claim), (select lease_generation from f2_claim),
  'DEEP_ANALYSIS', 'fixture-method-v1', 'fixture-input-v1',
  'deep-lane-request-v2', 'deep-lane-output-v1',
  (select input_manifest from f2_success_manifest),
  '[{"evidenceId":"evidence-1","contentHash":"dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd","classification":"VERIFIED_DATA","statement":"A bounded source observation."}]'::jsonb,
  'fixture', 'fixture-model', 'fixture-v1', 'fixture-deep-lane-v1', 3, false
);
select ok((select invocation_owner from f2_reservation), 'first request durably owns one invocation');
select ok((select logical_request_hash ~ '^[0-9a-f]{64}$' from f2_reservation), 'logical request has a durable hash');
select ok((select provider_idempotency_key like 'deep-lane-v1:%' from f2_reservation), 'attempt exposes a provider idempotency key');
select is((select count(*)::integer from public.radar_deep_lane_attempts), 1, 'first request creates exactly one durable attempt');

select * into temporary f2_duplicate from public.radar_system_reserve_deep_lane_attempt(
  (select work_item_id from f2_claim), 'f2-worker-a',
  (select lease_token from f2_claim), (select lease_generation from f2_claim),
  'DEEP_ANALYSIS', 'fixture-method-v1', 'fixture-input-v1',
  'deep-lane-request-v2', 'deep-lane-output-v1',
  (select input_manifest from f2_success_manifest),
  '[{"evidenceId":"evidence-1","contentHash":"dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd","classification":"VERIFIED_DATA","statement":"A bounded source observation."}]'::jsonb,
  'fixture', 'fixture-model', 'fixture-v1', 'fixture-deep-lane-v1', 3, false
);
select ok(not (select invocation_owner from f2_duplicate), 'duplicate delivery cannot own a second in-progress invocation');
select is((select count(*)::integer from public.radar_deep_lane_attempts), 1, 'duplicate delivery does not create another attempt');

select * into temporary f2_completion from public.radar_system_complete_deep_lane_attempt(
  (select request_id from f2_reservation), (select attempt_id from f2_reservation),
  (select work_item_id from f2_claim), 'f2-worker-a',
  (select lease_token from f2_claim), (select lease_generation from f2_claim),
  (select pause_generation from f2_reservation), (select logical_request_hash from f2_reservation),
  (select attempt_number from f2_reservation),
  ('{"schemaVersion":"deep-lane-output-v1","provider":"fixture","model":"fixture-model","modelRevision":"fixture-v1","requestHash":"' || (select logical_request_hash from f2_reservation) || '","generatedAt":"2026-09-19T00:00:00.000Z","inferences":[]}')::jsonb,
  private.radar_deep_lane_output_hash(('{"schemaVersion":"deep-lane-output-v1","provider":"fixture","model":"fixture-model","modelRevision":"fixture-v1","requestHash":"' || (select logical_request_hash from f2_reservation) || '","generatedAt":"2026-09-19T00:00:00.000Z","inferences":[]}')::jsonb)
);
select is((select state from f2_completion), 'SUCCEEDED', 'validated output produces a durable completion receipt');
select is((select state from public.radar_deep_lane_requests), 'SUCCEEDED', 'logical request becomes durably successful');
select is((select state from public.radar_work_items where id=(select work_item_id from f2_claim)), 'SUCCEEDED', 'work item completes through the Deep Lane receipt');

select * into temporary f2_replay from public.radar_system_complete_deep_lane_attempt(
  (select request_id from f2_reservation), (select attempt_id from f2_reservation),
  (select work_item_id from f2_claim), 'f2-worker-a',
  (select lease_token from f2_claim), (select lease_generation from f2_claim),
  (select pause_generation from f2_reservation), (select logical_request_hash from f2_reservation),
  (select attempt_number from f2_reservation), (select output from f2_completion),
  (select output_hash from f2_completion)
);
select is((select state from f2_replay), 'SUCCEEDED', 'exact completion replay returns the durable receipt');
select throws_ok($$select public.radar_system_complete_deep_lane_attempt(
  (select request_id from f2_reservation), (select attempt_id from f2_reservation),
  (select work_item_id from f2_claim), 'f2-worker-a',
  (select lease_token from f2_claim), (select lease_generation from f2_claim),
  (select pause_generation from f2_reservation), (select logical_request_hash from f2_reservation),
  (select attempt_number from f2_reservation), '{"conflict":true}'::jsonb,
  (select output_hash from f2_completion))$$,
  '23505', null, 'conflicting completion replay is rejected');

select ok(not has_function_privilege('anon', 'public.radar_system_reserve_deep_lane_attempt(uuid,text,uuid,bigint,text,text,text,text,text,jsonb,jsonb,text,text,text,text,integer,boolean)', 'EXECUTE'), 'anon cannot reserve Deep Lane attempts');
select ok(not has_function_privilege('authenticated', 'public.radar_system_complete_deep_lane_attempt(uuid,uuid,uuid,text,uuid,bigint,bigint,text,integer,jsonb,text)', 'EXECUTE'), 'authenticated users cannot complete Deep Lane attempts');
select ok(has_function_privilege('service_role', 'public.radar_system_recover_deep_lane_attempt(uuid,uuid,uuid,text,text,text)', 'EXECUTE'), 'service role can invoke explicit Deep Lane recovery');

-- A retryable failure requires a deliberate new claim and explicit retry flag.
select public.radar_system_enqueue_work(
  'g19f2-retry', 'DEEP_ANALYSIS', '7f000000-0000-4000-8000-000000000100',
  '7f000000-0000-4000-8000-000000000110', null, 'fixture-method-v1', 'fixture-input-v1', now()
) into temporary f2_retry_work;
select public.radar_system_attach_observation((select * from f2_retry_work), '7f000000-0000-4000-8000-000000000101');
select * into temporary f2_retry_manifest from public.radar_system_finalize_work_inputs((select * from f2_retry_work), 'fixture-method-v1', 'fixture-input-v1');
select * into temporary f2_retry_claim from public.radar_system_claim_work('f2-retry-a', 300);
select * into temporary f2_retry_reservation from public.radar_system_reserve_deep_lane_attempt(
  (select work_item_id from f2_retry_claim), 'f2-retry-a', (select lease_token from f2_retry_claim), (select lease_generation from f2_retry_claim),
  'DEEP_ANALYSIS', 'fixture-method-v1', 'fixture-input-v1', 'deep-lane-request-v2', 'deep-lane-output-v1',
  (select input_manifest from f2_retry_manifest), '[]'::jsonb, 'fixture', 'fixture-model', 'fixture-v1', 'fixture-deep-lane-v1', 2, false);
select is(public.radar_system_fail_deep_lane_attempt((select request_id from f2_retry_reservation), (select attempt_id from f2_retry_reservation), (select work_item_id from f2_retry_claim), 'f2-retry-a', (select lease_token from f2_retry_claim), (select lease_generation from f2_retry_claim), (select pause_generation from f2_retry_reservation), true, 'PROVIDER_TIMEOUT', 'Fixture did not invoke the provider.', 'NOT_INVOKED'), 'FAILED_RETRYABLE', 'retryable failure releases work for an explicit retry');
select * into temporary f2_retry_claim_2 from public.radar_system_claim_work('f2-retry-b', 300);
select * into temporary f2_retry_reservation_2 from public.radar_system_reserve_deep_lane_attempt(
  (select work_item_id from f2_retry_claim_2), 'f2-retry-b', (select lease_token from f2_retry_claim_2), (select lease_generation from f2_retry_claim_2),
  'DEEP_ANALYSIS', 'fixture-method-v1', 'fixture-input-v1', 'deep-lane-request-v2', 'deep-lane-output-v1',
  (select input_manifest from f2_retry_manifest), '[]'::jsonb, 'fixture', 'fixture-model', 'fixture-v1', 'fixture-deep-lane-v1', 2, true);
select is((select attempt_number from f2_retry_reservation_2), 2, 'explicit retry creates exactly one new attempt');
select ok((select provider_idempotency_key from f2_retry_reservation_2) <> (select provider_idempotency_key from f2_retry_reservation), 'each attempt receives a distinct idempotency key');

select * into temporary f2_uncertain_work from public.radar_system_enqueue_work(
  'g19f2-uncertain', 'DEEP_ANALYSIS', '7f000000-0000-4000-8000-000000000100',
  '7f000000-0000-4000-8000-000000000110', null, 'fixture-method-v1', 'fixture-input-v1', now()
);
select public.radar_system_attach_observation((select * from f2_uncertain_work), '7f000000-0000-4000-8000-000000000101');
select * into temporary f2_uncertain_manifest from public.radar_system_finalize_work_inputs((select * from f2_uncertain_work), 'fixture-method-v1', 'fixture-input-v1');
select * into temporary f2_uncertain_claim from public.radar_system_claim_work('f2-uncertain-a', 300);
select * into temporary f2_uncertain_reservation from public.radar_system_reserve_deep_lane_attempt(
  (select work_item_id from f2_uncertain_claim), 'f2-uncertain-a', (select lease_token from f2_uncertain_claim), (select lease_generation from f2_uncertain_claim),
  'DEEP_ANALYSIS', 'fixture-method-v1', 'fixture-input-v1', 'deep-lane-request-v2', 'deep-lane-output-v1',
  (select input_manifest from f2_uncertain_manifest), '[]'::jsonb, 'fixture', 'fixture-model', 'fixture-v1', 'fixture-deep-lane-v1', 2, false);
update public.radar_work_items set lease_expires_at = clock_timestamp() - interval '1 second' where id=(select work_item_id from f2_uncertain_claim);
select is(public.radar_system_recover_deep_lane_attempt((select request_id from f2_uncertain_reservation), (select attempt_id from f2_uncertain_reservation), (select work_item_id from f2_uncertain_claim), 'UNKNOWN', 'PROVIDER_UNKNOWN', 'Provider execution cannot be proven.'), 'UNCERTAIN', 'uncertain recovery never becomes an automatic retry');
select is((select state from public.radar_deep_lane_requests where id=(select request_id from f2_uncertain_reservation)), 'UNCERTAIN', 'uncertain state is durable');

select * from finish();
rollback;
