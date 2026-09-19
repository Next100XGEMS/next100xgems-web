-- Gate 19G-F1 input finalization and authoritative manifest contracts.
-- All fixtures are synthetic and rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users(id) values ('9f000000-0000-4000-8000-000000000001');
insert into public.profiles(id, display_name, status)
values ('9f000000-0000-4000-8000-000000000001', 'Gate 19G owner', 'ACTIVE');
insert into public.user_roles(user_id, role_id)
select '9f000000-0000-4000-8000-000000000001', id from public.roles where key = 'owner';
insert into public.tokens(id, chain, contract_address, symbol, name)
values ('9f000000-0000-4000-8000-000000000100', 'eip155:1',
  '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'G19G', 'Gate 19G fixture token');
insert into public.radar_events(
  id, event_key, event_type, token_id, source_provider, source_event_id,
  payload_hash, context, observed_at
) values (
  '9f000000-0000-4000-8000-000000000110', 'g19g-event', 'DISCOVERY',
  '9f000000-0000-4000-8000-000000000100', 'fixture-provider', 'g19g-source',
  repeat('a', 64), '{}', now() - interval '1 hour'
);
insert into public.radar_observations(
  id, event_id, token_id, provider, adapter_version, capability, metric_key,
  data_state, normalized_value, raw_integer_value, decimal_places, unit,
  context, provenance, content_hash, observed_at
) values (
  '9f000000-0000-4000-8000-000000000101',
  '9f000000-0000-4000-8000-000000000110',
  '9f000000-0000-4000-8000-000000000100', 'fixture-provider', 'fixture-v1',
  'market', 'liquidity', 'AVAILABLE', 123.4500, 12345, 2, 'USD', '{}',
  '{"authority":"fixture"}', repeat('b', 64), now() - interval '1 hour'
);
update public.feature_flags
set enabled = case key when 'radar_enabled' then true when 'maintenance_mode' then false
  when 'radar_emergency_paused' then false else enabled end,
  configuration = case when key = 'radar_emergency_paused' then '{"generation":1}'::jsonb else configuration end
where key in ('radar_enabled', 'maintenance_mode', 'radar_emergency_paused');

select public.radar_system_enqueue_work(
  'g19g-screen', 'SCREENING', '9f000000-0000-4000-8000-000000000100',
  '9f000000-0000-4000-8000-000000000110', null, 'g19g-method-v1', 'g19g-input-v1', now()
) into temporary g19g_work;
select public.radar_system_attach_observation((select * from g19g_work),
  '9f000000-0000-4000-8000-000000000101');

select is((select count(*)::integer from public.radar_system_claim_work('g19g-early-worker', 300)), 0,
  'input-bearing work cannot be claimed before finalization');
select lives_ok($$select public.radar_system_attach_observation((select * from g19g_work),
  '9f000000-0000-4000-8000-000000000101')$$,
  'duplicate attachment remains idempotent while inputs are open');

select * into temporary g19g_manifest from public.radar_system_finalize_work_inputs(
  (select * from g19g_work), 'g19g-method-v1', 'g19g-input-v1'
);
select is((select sealed_input_hash from g19g_manifest),
  (select input_hash from public.radar_work_items where id = (select * from g19g_work)),
  'finalization returns the database-authoritative sealed fingerprint');
select is((select count(*)::integer from jsonb_array_elements((select input_manifest from g19g_manifest))), 1,
  'finalization returns a complete ordered input manifest');
select is((select input_assembly_state from public.radar_work_items where id = (select * from g19g_work)),
  'FINALIZED', 'finalization advances the explicit input assembly state');
select * into temporary g19g_replay from public.radar_system_finalize_work_inputs(
  (select * from g19g_work), 'g19g-method-v1', 'g19g-input-v1'
);
select is((select sealed_input_hash from g19g_replay), (select sealed_input_hash from g19g_manifest),
  'exact finalization replay returns the same sealed fingerprint');
select throws_ok($$select public.radar_system_finalize_work_inputs((select * from g19g_work),
  'g19g-method-other', 'g19g-input-v1')$$,
  '23505', null, 'conflicting finalization metadata is rejected');
select throws_ok($$select public.radar_system_attach_observation((select * from g19g_work),
  '9f000000-0000-4000-8000-000000000101')$$,
  '55000', null, 'finalized work cannot accept new input membership');

select * into temporary g19g_claim from public.radar_system_claim_work('g19g-worker', 300);
select is((select count(*)::integer from g19g_claim), 1,
  'finalized input-bearing work becomes claimable');
select * into temporary g19g_claim_manifest from public.radar_system_get_work_manifest(
  (select work_item_id from g19g_claim), 'g19g-worker',
  (select lease_token from g19g_claim), (select lease_generation from g19g_claim)
);
select is((select sealed_input_hash from g19g_claim_manifest), (select sealed_input_hash from g19g_manifest),
  'fenced system manifest exposes the same sealed fingerprint to the worker');
select is((select jsonb_array_length(input_manifest) from g19g_claim_manifest), 1,
  'fenced system manifest exposes exactly the sealed observation set');
select throws_ok($$select public.radar_system_get_work_manifest((select work_item_id from g19g_claim),
  'wrong-worker', (select lease_token from g19g_claim), (select lease_generation from g19g_claim))$$,
  '40001', null, 'manifest access is fenced to the active worker');
select public.radar_system_complete_screening((select work_item_id from g19g_claim), 'g19g-worker',
  (select lease_token from g19g_claim), (select lease_generation from g19g_claim), 'PASS', '[]',
  (select sealed_input_hash from g19g_manifest), now());

select ok(not has_function_privilege('anon',
  'public.radar_system_finalize_work_inputs(uuid,text,text)', 'EXECUTE'),
  'anon cannot finalize system work inputs');
select ok(not has_function_privilege('authenticated',
  'public.radar_system_get_work_manifest(uuid,text,uuid,bigint)', 'EXECUTE'),
  'authenticated users cannot read system work manifests');
select ok(has_function_privilege('service_role',
  'public.radar_system_finalize_work_inputs(uuid,text,text)', 'EXECUTE'),
  'service role can finalize system work inputs');

select * from finish();
rollback;
