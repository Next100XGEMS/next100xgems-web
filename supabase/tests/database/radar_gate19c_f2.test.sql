-- Gate 19C-F2 Radar publication, evidence and projection contracts.
-- All fixtures are synthetic and rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into public.radar_methodology_versions(
  methodology_version, state, is_test_only, content_hash, approved_at
) values ('contract-v1', 'APPROVED', true, repeat('a', 64), now());
insert into public.radar_freshness_policies(
  freshness_policy_version, state, is_test_only, content_hash, approved_at
) values ('f2-freshness-v1', 'APPROVED', true, repeat('b', 64), now());
insert into auth.users(id) values
  ('39000000-0000-4000-8000-000000000001'),
  ('39000000-0000-4000-8000-000000000002');
insert into public.profiles(id, display_name, status) values
  ('39000000-0000-4000-8000-000000000001', 'F2 Owner', 'ACTIVE'),
  ('39000000-0000-4000-8000-000000000002', 'F2 Reviewer', 'ACTIVE');
insert into public.user_roles(user_id, role_id)
select x.user_id, r.id from (values
  ('39000000-0000-4000-8000-000000000001'::uuid, 'owner'),
  ('39000000-0000-4000-8000-000000000002'::uuid, 'radar_reviewer')
) x(user_id, role_key) join public.roles r on r.key = x.role_key;
insert into public.tokens(id, chain, contract_address, symbol, name)
values ('39000000-0000-4000-8000-000000000100', 'eip155:1',
  '0x7777777777777777777777777777777777777777', 'F2', 'F2 fixture token');
update public.feature_flags set enabled = case key
  when 'radar_enabled' then true when 'maintenance_mode' then false
  when 'radar_emergency_paused' then false else enabled end,
  configuration = case when key = 'radar_emergency_paused' then '{"generation":1}'::jsonb else configuration end
where key in ('radar_enabled', 'maintenance_mode', 'radar_emergency_paused');

select public.radar_system_insert_event('f2-event', 'DISCOVERY',
  '39000000-0000-4000-8000-000000000100', 'f2_provider', 'f2-source', repeat('c',64), '{}',
  clock_timestamp() - interval '1 hour') into temporary f2_event;
select public.radar_system_record_observation((select * from f2_event),
  '39000000-0000-4000-8000-000000000100', 'f2_provider', 'adapter-v1', 'market',
  'liquidity', 'AVAILABLE', 100, 100, 2, 'USD', '{"private_metric":"do-not-leak"}',
  '{"authority":"F2 fixture","source_url":"https://example.test/f2"}', null, repeat('d',64),
  clock_timestamp() - interval '1 hour') into temporary f2_observation;
select public.radar_system_enqueue_work('f2-work', 'SCREENING',
  '39000000-0000-4000-8000-000000000100', (select * from f2_event), null,
  'contract-v1', 'f2-input-v1', now()) into temporary f2_work;
select public.radar_system_attach_observation((select * from f2_work), (select * from f2_observation));
select * into temporary f2_claim from public.radar_system_claim_work('f2-worker', 300);
select public.radar_system_complete_screening((select * from f2_work), 'f2-worker',
  (select lease_token from f2_claim), (select lease_generation from f2_claim), 'PASS', '["fixture"]',
  (select input_hash from public.radar_work_items where id=(select * from f2_work)), now());
select public.radar_system_create_analysis((select * from f2_work), 'EARLY', 42,
  '{"why_on_radar":"System reason","private_risk_override":"never-public"}', '{}',
  'System-owned risk', 'contract-v1', repeat('e',64),
  (select input_hash from public.radar_work_items where id=(select * from f2_work)),
  '{"coverage":"complete"}', '{}', null, 'f2-freshness-v1', now()+interval '1 day',
  now()-interval '30 minutes', (select lease_generation from f2_claim)) into temporary f2_analysis;
select public.radar_system_append_evidence((select * from f2_analysis),
  '39000000-0000-4000-8000-000000000100', 'f2-liquidity', 'VERIFIED_DATA', 'DETERMINISTIC',
  'market', 'Liquidity', 'System observation', 100, 'USD', 2, null, null, 'f2_provider',
  'adapter-v1', (select * from f2_observation), 'https://example.test/f2/liquidity',
  now()-interval '1 hour', now()-interval '30 minutes', now(), 'contract-v1', true, 1,
  (select lease_generation from f2_claim));
select public.radar_system_append_evidence((select * from f2_analysis),
  '39000000-0000-4000-8000-000000000100', 'f2-inference', 'AI_INFERENCE', 'INFERENCE',
  'context', 'Inference', 'Private inference', null, null, null, '{"internal":"private"}', null,
  null, null, null, null, now()-interval '1 hour', now()-interval '30 minutes', now(),
  'contract-v1', false, 2, (select lease_generation from f2_claim));
select public.radar_system_mark_analysis_ready_for_review((select * from f2_analysis),
  (select version from public.radar_analyses where id=(select * from f2_analysis)),
  (select lease_generation from f2_claim),
  (select input_hash from public.radar_analyses where id=(select * from f2_analysis)), repeat('e',64))
  into temporary f2_review;
grant select on table f2_review to authenticated;

-- H2: the old generic human analytical presentation contract is gone.
select throws_ok($$select public.radar_approve_review((select * from f2_review), 1,
  'note', 'disclosure', '{"risk_summary":"caller override","metrics":[{"private":true}]}', 'old-contract')$$,
  '42883', null, 'approval rejects the removed generic analytical JSON contract');
select set_config('request.jwt.claims', '{"sub":"39000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '39000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select lives_ok($$select public.radar_approve_review((select * from f2_review), 1,
  'Allowed editorial note', 'Required disclosure', 'f2-approve')$$,
  'approval accepts only typed human-owned fields');
select is((select public_note from public.radar_reviews where id=(select * from f2_review)),
  'Allowed editorial note', 'allowed public editorial note is retained');
select is((select public_presentation->>'risk_summary' from public.radar_reviews where id=(select * from f2_review)),
  'System-owned risk', 'risk summary is derived from the system analysis');
select is((select public_presentation->>'why_on_radar' from public.radar_reviews where id=(select * from f2_review)),
  'System reason', 'why-on-Radar text is derived from system output');
select ok((select (select count(*) from jsonb_object_keys(public_presentation)) = 4
  from public.radar_reviews where id=(select * from f2_review)),
  'human approval presentation has a closed key set');
select ok(not (select public_presentation ? 'private_risk_override'
  from public.radar_reviews where id=(select * from f2_review)),
  'caller-controlled private analytical fields are not copied');

-- Evidence origin, binding and source contracts are enforced at the database boundary.
reset role;
select throws_ok($$insert into public.radar_evidence(analysis_id, token_id, evidence_key,
  classification, origin, category, label, observation_id, source_reference)
  values ((select * from f2_analysis), '39000000-0000-4000-8000-000000000100', 'bad-origin',
  'VERIFIED_DATA', 'INFERENCE', 'market', 'Bad', (select * from f2_observation), 'https://example.test/bad')$$,
  '23514', null, 'VERIFIED_DATA cannot claim INFERENCE origin');
select throws_ok($$insert into public.radar_evidence(analysis_id, token_id, evidence_key,
  classification, origin, category, label, source_reference)
  values ((select * from f2_analysis), '39000000-0000-4000-8000-000000000100', 'unbound',
  'VERIFIED_DATA', 'DETERMINISTIC', 'market', 'Unbound', 'https://example.test/bad')$$,
  '23514', null, 'VERIFIED_DATA requires a compatible observation');
select throws_ok($$insert into public.radar_evidence(analysis_id, token_id, evidence_key,
  classification, origin, category, label, unknown_reason, source_reference)
  values ((select * from f2_analysis), '39000000-0000-4000-8000-000000000100', 'secret-source',
  'UNKNOWN', 'DETERMINISTIC', 'market', 'Secret', 'fixture',
  'https://example.test/source?api_key=leak')$$,
  '23514', null, 'credential-bearing evidence source is rejected');
select is((select origin from public.radar_evidence where evidence_key='f2-inference'), 'INFERENCE',
  'AI inference retains its explicit inference origin');
select throws_ok($$insert into public.radar_evidence(analysis_id, token_id, evidence_key,
  classification, origin, category, label, source_reference)
  values ((select * from f2_analysis), '39000000-0000-4000-8000-000000000100', 'bad-scheme',
  'UNKNOWN', 'DETERMINISTIC', 'market', 'Bad scheme', 'ftp://example.test/source')$$,
  '23514', null, 'unsupported evidence source scheme is rejected');
select throws_ok($$insert into public.radar_evidence(analysis_id, token_id, evidence_key,
  classification, origin, category, label, source_reference)
  values ((select * from f2_analysis), '39000000-0000-4000-8000-000000000100', 'userinfo-source',
  'UNKNOWN', 'DETERMINISTIC', 'market', 'Userinfo', 'https://user:password@example.test/source')$$,
  '23514', null, 'userinfo-bearing evidence source is rejected');

-- H5 methodology/freshness eligibility is a registry decision, not caller input.
select set_config('request.jwt.claims', '{"sub":"39000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
reset role;
update public.radar_methodology_versions set state='DRAFT', approved_at=null where methodology_version='contract-v1';
set local role authenticated;
select throws_ok($$select public.radar_publish_review((select * from f2_review), 2, 'f2-method-draft')$$,
  '55000', null, 'unapproved methodology cannot publish');
reset role;
update public.radar_methodology_versions set state='APPROVED', approved_at=now() where methodology_version='contract-v1';
update public.radar_freshness_policies set state='DRAFT', approved_at=null where freshness_policy_version='f2-freshness-v1';
set local role authenticated;
select throws_ok($$select public.radar_publish_review((select * from f2_review), 2, 'f2-freshness-draft')$$,
  '55000', null, 'unapproved freshness policy cannot publish');
reset role;
update public.radar_freshness_policies set state='APPROVED', approved_at=now() where freshness_policy_version='f2-freshness-v1';

-- A valid approval is published only while its approver remains active and authorized.
update public.profiles set status='SUSPENDED' where id='39000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims', '{"sub":"39000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '39000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select throws_ok($$select public.radar_publish_review((select * from f2_review), 2, 'f2-inactive-approver')$$,
  '55000', null, 'inactive approver invalidates prior approval');
reset role;
update public.profiles set status='ACTIVE' where id='39000000-0000-4000-8000-000000000001';
delete from public.user_roles where user_id='39000000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok($$select public.radar_publish_review((select * from f2_review), 2, 'f2-revoked-approver')$$,
  '55000', null, 'role-revoked approver invalidates prior approval');
reset role;
insert into public.user_roles(user_id, role_id)
select '39000000-0000-4000-8000-000000000001', id from public.roles where key='owner';
set local role authenticated;
reset role;
update public.radar_reviews set approval_score_snapshot='0'
where id=(select * from f2_review);
set local role authenticated;
select throws_ok($$select public.radar_publish_review((select * from f2_review), 2, 'f2-wrong-score')$$,
  '55000', null, 'wrong score snapshot cannot publish');
reset role;
update public.radar_reviews set approval_score_snapshot='42', approval_evidence_hash=repeat('0',64)
where id=(select * from f2_review);
set local role authenticated;
select throws_ok($$select public.radar_publish_review((select * from f2_review), 2, 'f2-wrong-evidence')$$,
  '55000', null, 'wrong evidence snapshot cannot publish');
reset role;
update public.radar_reviews set approval_evidence_hash=encode(
  extensions.digest(convert_to(private.radar_public_evidence_snapshot((select * from f2_analysis))::text, 'UTF8'), 'sha256'), 'hex')
where id=(select * from f2_review);
create function pg_temp.fail_f2_audit() returns trigger language plpgsql as $$
begin raise exception 'Injected F2 audit failure' using errcode='23514'; end; $$;
create trigger test_f2_audit_failure before insert on public.audit_logs
  for each row execute function pg_temp.fail_f2_audit();
select throws_ok($$select public.radar_publish_review((select * from f2_review), 2, 'f2-audit-fail')$$,
  '23514', null, 'publication rolls back when its required audit fails');
select is((select state from public.radar_reviews where id=(select * from f2_review)), 'APPROVED',
  'audit failure leaves the approved review unpublished');
drop trigger test_f2_audit_failure on public.audit_logs;
set local role authenticated;
select lives_ok($$select public.radar_publish_review((select * from f2_review), 2, 'f2-publish')$$,
  'authorized publisher succeeds after approver revalidation');
reset role;
select is((select state from public.radar_reviews where id=(select * from f2_review)), 'PUBLISHED',
  'publication state is persisted');
select ok((select private.radar_publication_snapshot_is_valid(publication_snapshot)
  from public.radar_reviews where id=(select * from f2_review)),
  'publication stores a valid frozen snapshot');
select is((select count(*)::integer from public.radar_reviews,
  jsonb_object_keys(publication_snapshot)
  where id=(select * from f2_review)), 17,
  'publication snapshot uses the closed 17-key contract');

-- The public contract exposes only frozen, allowlisted nested data.
select set_config('request.jwt.claims', '{"role":"anon","is_anonymous":"true"}', true);
set local role anon;
select * into temporary f2_public from public.get_public_radar_detail('39000000-0000-4000-8000-000000000100');
select is((select score from f2_public), '42',
  'public score comes from the frozen system snapshot');
select is((select jsonb_array_length(metrics) from f2_public), 1,
  'public metrics contain only normalized observation data');
select ok(not exists (select 1 from f2_public, jsonb_array_elements(metrics) metric
  where metric ? 'private_metric' or metric ? 'context' or metric ? 'credential'),
  'private nested metric fields are not projected');
select ok(not exists (select 1 from f2_public, jsonb_array_elements(evidence) evidence
  where evidence ? 'internal' or evidence ? 'structured_value' or evidence ? 'api_key'),
  'private evidence fields are not projected');
select ok((select (evidence->0->>'source_reference') = 'https://example.test/f2/liquidity' from f2_public),
  'safe evidence source reference is retained');
select ok(not exists (select 1 from f2_public where to_jsonb(f2_public) ? 'editorial_note'),
  'private editorial note is not public');

-- H3: the reviewed evidence set is frozen; replacement analysis gets a new set.
reset role;
select throws_ok($$select public.radar_system_append_evidence((select * from f2_analysis),
  '39000000-0000-4000-8000-000000000100', 'after-publication', 'UNKNOWN', 'DETERMINISTIC',
  'market', 'Later', null, null, null, null, null, 'later', 'f2_provider', 'adapter-v1', null,
  null, now(), now(), now(), 'contract-v1', false, 9,
  (select lease_generation from f2_claim))$$,
  '55000', null, 'evidence cannot be appended after publication');
select throws_ok($$update public.radar_evidence set label='mutated'$$, '55000', null,
  'evidence update remains rejected');
select throws_ok($$delete from public.radar_evidence$$, '55000', null,
  'evidence delete remains rejected');
select is((select jsonb_array_length(evidence) from public.get_public_radar_detail(
  '39000000-0000-4000-8000-000000000100')), 1,
  'published evidence projection remains frozen after rejected append');

-- Historical publication is hidden only by a newer eligible publication.
insert into public.radar_work_items(
  id, work_kind, token_id, request_key, state, screening_result, screening_evaluated_at, sealed_at, input_hash,
  method_version, input_version, reserved_analysis_version, pause_generation
) values ('39000000-0000-4000-8000-000000000301', 'REANALYSIS',
  '39000000-0000-4000-8000-000000000100', 'f2-replacement-work', 'QUEUED', null, null, null, null,
  'contract-v1', 'f2-input-v2', 2, 1);
insert into public.radar_work_inputs(work_item_id, observation_id)
values ('39000000-0000-4000-8000-000000000301', (select * from f2_observation));
update public.radar_work_items set state='SUCCEEDED', screening_result='PASS',
  screening_evaluated_at=now(), sealed_at=now(), input_hash=private.radar_input_fingerprint(id)
where id='39000000-0000-4000-8000-000000000301';
insert into public.radar_analyses(
  id, token_id, version, status, score, deterministic_data, ai_inference, risk_summary,
  analyzed_at, data_as_of, run_type, work_item_id, completed_at, scoring_method_version,
  methodology_hash, input_hash, component_breakdown, coverage, public_eligibility,
  freshness_policy_version, expires_at
) values ('39000000-0000-4000-8000-000000000302',
  '39000000-0000-4000-8000-000000000100', 2, 'TRENDING', 43,
  '{"why_on_radar":"Replacement system reason"}', '{}', 'Replacement system risk', now(),
  now()-interval '10 minutes', 'REANALYSIS', '39000000-0000-4000-8000-000000000301', now(),
  'contract-v1', repeat('f',64), (select input_hash from public.radar_work_items where id='39000000-0000-4000-8000-000000000301'), '{}', '{}', true,
  'f2-freshness-v1', now()+interval '1 day');
insert into public.radar_evidence(
  analysis_id, token_id, evidence_key, classification, origin, category, label, statement,
  numeric_value, numeric_unit, decimal_places, provider, adapter_version, observation_id,
  source_reference, observed_at, received_at, evaluated_at, methodology_version, is_public, public_rank
) values ('39000000-0000-4000-8000-000000000302', '39000000-0000-4000-8000-000000000100',
  'replacement-liquidity', 'VERIFIED_DATA', 'DETERMINISTIC', 'market', 'Replacement liquidity',
  'Replacement observation', 100, 'USD', 2, 'f2_provider', 'adapter-v1', (select * from f2_observation),
  'https://example.test/f2/replacement', now()-interval '1 hour', now()-interval '30 minutes', now(),
  'contract-v1', true, 1);
insert into public.radar_reviews(id, analysis_id, token_id)
values ('39000000-0000-4000-8000-000000000303',
  '39000000-0000-4000-8000-000000000302', '39000000-0000-4000-8000-000000000100');
select set_config('request.jwt.claims', '{"sub":"39000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select public.radar_approve_review('39000000-0000-4000-8000-000000000303', 1,
  'Replacement note', 'Replacement disclosure', 'f2-replacement-approve')$$,
  'new authorized reviewer can approve a replacement analysis');
select lives_ok($$select public.radar_publish_review('39000000-0000-4000-8000-000000000303', 2,
  'f2-replacement-publish')$$, 'replacement publication succeeds');
reset role;
select is((select state from public.radar_reviews where id=(select * from f2_review)), 'HIDDEN',
  'replacement publication hides the prior current publication');
select is((select analysis_version from public.get_public_radar_detail(
  '39000000-0000-4000-8000-000000000100')), 2,
  'anonymous detail resolves only the current replacement');

-- Classification matrix and publication prerequisites reject unsafe/incomplete results.
select throws_ok($$insert into public.radar_evidence(analysis_id, token_id, evidence_key,
  classification, origin, category, label, observation_id)
  values ('39000000-0000-4000-8000-000000000302','39000000-0000-4000-8000-000000000100',
  'bad-ai','AI_INFERENCE','DETERMINISTIC','context','Bad',null)$$,
  '23514', null, 'AI inference cannot be relabeled as VERIFIED_DATA origin');
select throws_ok($$insert into public.radar_methodology_versions(methodology_version,state,approved_at)
  values ('invalid-f2','APPROVED',null)$$, '23514', null, 'registry approval metadata remains constrained');

-- INCOMPLETE and inputless results cannot enter the normal publication path.
select ok(private.radar_safe_source_reference('https://example.test/f2/final') is not null,
  'final public source reference remains allowlisted');
select ok(private.radar_provenance_is_public_safe('{"authority":"F2 fixture","source_url":"https://example.test/f2"}'::jsonb),
  'final public provenance remains safe');
select ok(private.radar_public_presentation_is_valid((select public_presentation from public.radar_reviews where id='39000000-0000-4000-8000-000000000303')),
  'final presentation contract remains closed and typed');
select ok(private.radar_publication_snapshot_is_valid((select publication_snapshot from public.radar_reviews where state='PUBLISHED' limit 1)),
  'final publication snapshot contract remains closed and typed');
insert into public.radar_work_items(
  id, work_kind, token_id, request_key, state, method_version, input_version,
  reserved_analysis_version, pause_generation
) values ('39000000-0000-4000-8000-000000000401', 'REANALYSIS',
  '39000000-0000-4000-8000-000000000100', 'f2-incomplete-work', 'QUEUED', 'contract-v1', 'f2-input', 3, 1);
insert into public.radar_work_inputs(work_item_id, observation_id)
values ('39000000-0000-4000-8000-000000000401', (select * from f2_observation));
update public.radar_work_items set state='SUCCEEDED', screening_result='INCOMPLETE',
  screening_reasons='["missing"]', screening_evaluated_at=now(), sealed_at=now(),
  input_hash=private.radar_input_fingerprint(id)
where id='39000000-0000-4000-8000-000000000401';
insert into public.radar_analyses(
  id, token_id, version, status, score, deterministic_data, ai_inference, risk_summary,
  analyzed_at, data_as_of, run_type, work_item_id, completed_at, scoring_method_version,
  methodology_hash, input_hash, component_breakdown, coverage, public_eligibility,
  freshness_policy_version, expires_at
) values ('39000000-0000-4000-8000-000000000402',
  '39000000-0000-4000-8000-000000000100', 3, 'EARLY', 10, '{}', '{}', 'incomplete', now(),
  now()-interval '5 minutes', 'REANALYSIS', '39000000-0000-4000-8000-000000000401', now(),
  'contract-v1', repeat('1',64), (select input_hash from public.radar_work_items where id='39000000-0000-4000-8000-000000000401'), '{}', '{}', true,
  'f2-freshness-v1', now()+interval '1 day');
insert into public.radar_reviews(id, analysis_id, token_id)
values ('39000000-0000-4000-8000-000000000403',
  '39000000-0000-4000-8000-000000000402', '39000000-0000-4000-8000-000000000100');
select set_config('request.jwt.claims', '{"sub":"39000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.radar_approve_review('39000000-0000-4000-8000-000000000403', 1,
  'note', 'disclosure', 'f2-incomplete')$$, '55000', null,
  'INCOMPLETE screening cannot be approved for publication');
reset role;

insert into public.radar_work_items(
  id, work_kind, token_id, request_key, state, screening_result, screening_evaluated_at,
  sealed_at, input_hash, method_version, input_version, reserved_analysis_version, pause_generation
) values ('39000000-0000-4000-8000-000000000411', 'REANALYSIS',
  '39000000-0000-4000-8000-000000000100', 'f2-missing-input-work', 'SUCCEEDED', 'PASS', now(), now(),
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'contract-v1', 'f2-input', 4, 1);
insert into public.radar_analyses(
  id, token_id, version, status, score, deterministic_data, ai_inference, risk_summary,
  analyzed_at, data_as_of, run_type, work_item_id, completed_at, scoring_method_version,
  methodology_hash, input_hash, component_breakdown, coverage, public_eligibility,
  freshness_policy_version, expires_at
) values ('39000000-0000-4000-8000-000000000412',
  '39000000-0000-4000-8000-000000000100', 4, 'EARLY', 11, '{}', '{}', 'missing input', now(),
  now()-interval '5 minutes', 'REANALYSIS', '39000000-0000-4000-8000-000000000411', now(),
  'contract-v1', repeat('2',64), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', '{}', '{}', true,
  'f2-freshness-v1', now()+interval '1 day');
insert into public.radar_reviews(id, analysis_id, token_id)
values ('39000000-0000-4000-8000-000000000413',
  '39000000-0000-4000-8000-000000000412', '39000000-0000-4000-8000-000000000100');
select set_config('request.jwt.claims', '{"sub":"39000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.radar_approve_review('39000000-0000-4000-8000-000000000413', 1,
  'note', 'disclosure', 'f2-missing-input')$$, '55000', null,
  'missing frozen inputs cannot be approved for publication');
reset role;

insert into public.radar_work_items(
  id, work_kind, token_id, request_key, state, screening_result, screening_evaluated_at,
  sealed_at, input_hash, method_version, input_version, reserved_analysis_version, pause_generation
) values ('39000000-0000-4000-8000-000000000421', 'REANALYSIS',
  '39000000-0000-4000-8000-000000000100', 'f2-infinite-work', 'QUEUED', null, null, null, null,
  'contract-v1', 'f2-input', 5, 1);
insert into public.radar_work_inputs(work_item_id, observation_id)
values ('39000000-0000-4000-8000-000000000421', (select * from f2_observation));
update public.radar_work_items set state='SUCCEEDED', screening_result='PASS', screening_evaluated_at=now(),
  sealed_at=now(), input_hash=private.radar_input_fingerprint(id)
where id='39000000-0000-4000-8000-000000000421';
select throws_ok($$insert into public.radar_analyses(
  id, token_id, version, status, score, deterministic_data, ai_inference, risk_summary,
  analyzed_at, data_as_of, run_type, work_item_id, completed_at, scoring_method_version,
  methodology_hash, input_hash, component_breakdown, coverage, public_eligibility,
  freshness_policy_version, expires_at
) values ('39000000-0000-4000-8000-000000000422',
  '39000000-0000-4000-8000-000000000100', 5, 'EARLY', 12, '{}', '{}', 'infinite expiry', now(),
  now()-interval '5 minutes', 'REANALYSIS', '39000000-0000-4000-8000-000000000421', now(),
  'contract-v1', repeat('3',64), (select input_hash from public.radar_work_items where id='39000000-0000-4000-8000-000000000421'), '{}', '{}', true,
  'f2-freshness-v1', 'infinity')$$, '23514', null,
  'infinite expiry timestamp is rejected at insert');
select throws_ok($$insert into public.radar_analyses(
  id, token_id, version, status, score, deterministic_data, ai_inference, analyzed_at, data_as_of, expires_at
) values ('39000000-0000-4000-8000-000000000424',
  '39000000-0000-4000-8000-000000000100', 6, 'EARLY', 1, '{}', '{}', now(), now(), '-infinity')$$,
  '23514', null, '-infinity timestamp is rejected');

select is((select count(*)::integer from public.radar_reviews where state='PUBLISHED'), 1,
  'one current publication remains enforced per token');
select is((select count(*)::integer from public.get_public_radar_list(50, null)), 1,
  'public list exposes only the current publication');

select * from finish();
rollback;
