-- Gate 19C-F3 corrective contracts. All fixtures are synthetic and rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into public.radar_methodology_versions(methodology_version, state, is_test_only, content_hash, approved_at)
values ('f3-method', 'APPROVED', true, repeat('a', 64), now());
insert into public.radar_freshness_policies(freshness_policy_version, state, is_test_only, content_hash, approved_at)
values ('f3-policy', 'APPROVED', true, repeat('b', 64), now());
insert into auth.users(id) values
  ('3f000000-0000-4000-8000-000000000001'),
  ('3f000000-0000-4000-8000-000000000002'),
  ('3f000000-0000-4000-8000-000000000003');
insert into public.profiles(id, display_name, status) values
  ('3f000000-0000-4000-8000-000000000001', 'F3 Owner', 'ACTIVE'),
  ('3f000000-0000-4000-8000-000000000002', 'F3 Reviewer', 'ACTIVE'),
  ('3f000000-0000-4000-8000-000000000003', 'F3 Alternate Reviewer', 'ACTIVE');
insert into public.user_roles(user_id, role_id)
select x.user_id, r.id from (values
  ('3f000000-0000-4000-8000-000000000001'::uuid, 'owner'),
  ('3f000000-0000-4000-8000-000000000002'::uuid, 'radar_reviewer'),
  ('3f000000-0000-4000-8000-000000000003'::uuid, 'radar_reviewer')
) x(user_id, role_key) join public.roles r on r.key = x.role_key;
insert into public.tokens(id, chain, contract_address, symbol, name)
values ('3f000000-0000-4000-8000-000000000100', 'eip155:1',
  '0x3333333333333333333333333333333333333333', 'F3', 'F3 fixture token');
update public.feature_flags set enabled = case key
  when 'radar_enabled' then true when 'maintenance_mode' then false
  when 'radar_emergency_paused' then false else enabled end,
  configuration = case when key = 'radar_emergency_paused' then '{"generation":1}'::jsonb else configuration end
where key in ('radar_enabled', 'maintenance_mode', 'radar_emergency_paused');
insert into public.radar_events(id, event_key, event_type, token_id, source_provider, source_event_id,
  payload_hash, context, observed_at)
values ('3f000000-0000-4000-8000-000000000110', 'f3-event', 'DISCOVERY',
  '3f000000-0000-4000-8000-000000000100', 'f3-provider', 'source', repeat('c', 64), '{}', now()-interval '1 hour');
insert into public.radar_observations(id, event_id, token_id, provider, adapter_version, capability,
  metric_key, data_state, normalized_value, raw_integer_value, decimal_places, unit, context,
  provenance, content_hash, observed_at)
values ('3f000000-0000-4000-8000-000000000101', '3f000000-0000-4000-8000-000000000110',
  '3f000000-0000-4000-8000-000000000100', 'f3-provider', 'adapter-v1', 'market', 'liquidity',
  'AVAILABLE', 100, 100, 2, 'USD', '{}', '{"authority":"f3"}', repeat('d', 64), now()-interval '1 hour');

create function pg_temp.seed_f3_case(
  p_work_id uuid, p_analysis_id uuid, p_review_id uuid, p_version integer, p_data jsonb
) returns void language plpgsql as $$
begin
  insert into public.radar_work_items(id, work_kind, token_id, request_key, state,
    method_version, input_version, reserved_analysis_version, pause_generation)
  values (p_work_id, 'REANALYSIS', '3f000000-0000-4000-8000-000000000100',
    'f3-work-' || p_version, 'QUEUED', 'f3-method', 'f3-input', p_version, 1);
  insert into public.radar_work_inputs(work_item_id, observation_id)
  values (p_work_id, '3f000000-0000-4000-8000-000000000101');
  update public.radar_work_items
  set input_hash = private.radar_input_fingerprint(id), state = 'SUCCEEDED',
      screening_result = 'PASS', screening_evaluated_at = clock_timestamp(), sealed_at = clock_timestamp()
  where id = p_work_id;
  insert into public.radar_analyses(
    id, token_id, version, status, score, deterministic_data, ai_inference, risk_summary,
    analyzed_at, data_as_of, run_type, work_item_id, completed_at, scoring_method_version,
    methodology_hash, input_hash, component_breakdown, coverage, public_eligibility,
    freshness_policy_version, expires_at
  ) values (
    p_analysis_id, '3f000000-0000-4000-8000-000000000100', p_version, 'TRENDING', 42,
    p_data, '{}', 'F3 risk', clock_timestamp(), clock_timestamp()-interval '5 minutes',
    'REANALYSIS', p_work_id, clock_timestamp()-interval '1 second', 'f3-method', repeat('e', 64),
    (select input_hash from public.radar_work_items where id = p_work_id), '{}', '{}', true,
    'f3-policy', clock_timestamp()+interval '1 day'
  );
  update public.radar_work_items set result_analysis_id = p_analysis_id where id = p_work_id;
  insert into public.radar_evidence(
    analysis_id, token_id, evidence_key, classification, origin, category, label, statement,
    numeric_value, numeric_unit, decimal_places, provider, adapter_version, observation_id,
    source_reference, observed_at, received_at, evaluated_at, methodology_version, is_public, public_rank
  ) values (
    p_analysis_id, '3f000000-0000-4000-8000-000000000100', 'f3-evidence-' || p_version,
    'VERIFIED_DATA', 'DETERMINISTIC', 'market', 'F3 evidence', 'Bound observation', 100,
    'USD', 2, 'f3-provider', 'adapter-v1', '3f000000-0000-4000-8000-000000000101',
    'https://example.test/f3', now()-interval '1 hour', now()-interval '30 minutes', now(),
    'f3-method', true, 1
  );
  insert into public.radar_reviews(id, analysis_id, token_id)
  values (p_review_id, p_analysis_id, '3f000000-0000-4000-8000-000000000100');
end;
$$;

select pg_temp.seed_f3_case(
  '3f000000-0000-4000-8000-000000000201', '3f000000-0000-4000-8000-000000000211',
  '3f000000-0000-4000-8000-000000000221', 1, '{"why_on_radar":"F3 system reason"}'
);
select pg_temp.seed_f3_case(
  '3f000000-0000-4000-8000-000000000202', '3f000000-0000-4000-8000-000000000212',
  '3f000000-0000-4000-8000-000000000222', 2, '{"why_on_radar":{"private_marker":"audit-only"}}'
);
select pg_temp.seed_f3_case(
  '3f000000-0000-4000-8000-000000000203', '3f000000-0000-4000-8000-000000000213',
  '3f000000-0000-4000-8000-000000000223', 3, '{"why_on_radar":["private","array"]}'
);
select pg_temp.seed_f3_case(
  '3f000000-0000-4000-8000-000000000204', '3f000000-0000-4000-8000-000000000214',
  '3f000000-0000-4000-8000-000000000224', 4, '{"why_on_radar":"Conflict case"}'
);
select pg_temp.seed_f3_case(
  '3f000000-0000-4000-8000-000000000205', '3f000000-0000-4000-8000-000000000215',
  '3f000000-0000-4000-8000-000000000225', 5, '{"why_on_radar":"Revocation case"}'
);
select pg_temp.seed_f3_case(
  '3f000000-0000-4000-8000-000000000206', '3f000000-0000-4000-8000-000000000216',
  '3f000000-0000-4000-8000-000000000226', 6, '{"why_on_radar":"Replacement case"}'
);
select pg_temp.seed_f3_case(
  '3f000000-0000-4000-8000-000000000207', '3f000000-0000-4000-8000-000000000217',
  '3f000000-0000-4000-8000-000000000227', 7, '{"why_on_radar":"Audit case"}'
);

select ok(private.radar_public_text_is_safe('a valid string', 2000),
  'public analytical string accepts bounded string values');
select ok(not private.radar_public_presentation_is_valid(
  '{"why_on_radar":{"private":true},"risk_summary":"safe","metrics":[],"evidence":[]}'::jsonb),
  'public presentation rejects object analytical text');
select ok(not private.radar_public_presentation_is_valid(
  '{"why_on_radar":["private"],"risk_summary":"safe","metrics":[],"evidence":[]}'::jsonb),
  'public presentation rejects array analytical text');

select set_config('request.jwt.claims', '{"sub":"3f000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '3f000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select lives_ok($$select public.radar_approve_review('3f000000-0000-4000-8000-000000000221',1,'note','disclosure','f3-approve-1')$$,
  'string analytical text is accepted by approval');
select is((select public_presentation->>'why_on_radar' from public.radar_reviews where id='3f000000-0000-4000-8000-000000000221'),
  'F3 system reason', 'approved presentation contains only typed system text');
select throws_ok($$select public.radar_approve_review('3f000000-0000-4000-8000-000000000222',1,'note','disclosure','f3-object')$$,
  '55000', null, 'object analytical text is rejected before coercion');
select throws_ok($$select public.radar_approve_review('3f000000-0000-4000-8000-000000000223',1,'note','disclosure','f3-array')$$,
  '55000', null, 'array analytical text is rejected before coercion');
reset role;

select is(private.radar_user_effective_roles('3f000000-0000-4000-8000-000000000002'), '{radar_reviewer}',
  'reviewer resolves to the authoritative effective role');
set local role authenticated;
select lives_ok($$select public.radar_publish_review('3f000000-0000-4000-8000-000000000221',2,'f3-publish-1')$$,
  'valid effective Radar Reviewer approval publishes');
reset role;
select ok(not exists (select 1 from public.get_public_radar_detail('3f000000-0000-4000-8000-000000000100')
  where why_on_radar like '%private%'), 'nested analytical markers do not reach anonymous detail');
select ok(not exists (select 1 from public.get_public_radar_list(50, null)
  where why_on_radar like '%private%'), 'nested analytical markers do not reach anonymous list');

insert into public.user_roles(user_id, role_id)
select '3f000000-0000-4000-8000-000000000002', id from public.roles where key='ad_manager';
select is(private.radar_user_effective_roles('3f000000-0000-4000-8000-000000000002'), '{}',
  'Reviewer plus Ad Manager resolves to a conflict, not a Radar role');
set local role authenticated;
select lives_ok($$select public.radar_approve_review('3f000000-0000-4000-8000-000000000224',1,'note','disclosure','f3-approve-4')$$,
  'owner can create a review approval before approver revalidation');
reset role;
update public.radar_reviews set reviewed_by='3f000000-0000-4000-8000-000000000002'
where id='3f000000-0000-4000-8000-000000000224';
set local role authenticated;
select throws_ok($$select public.radar_publish_review('3f000000-0000-4000-8000-000000000224',2,'f3-conflict')$$,
  '55000', null, 'conflicted approver cannot publish through another reviewer');
reset role;
delete from public.user_roles
where user_id='3f000000-0000-4000-8000-000000000002'
  and role_id=(select id from public.roles where key='ad_manager');
set local role authenticated;
select lives_ok($$select public.radar_approve_review('3f000000-0000-4000-8000-000000000225',1,'note','disclosure','f3-approve-5')$$,
  'owner can approve another analysis for approver revalidation');
reset role;
update public.radar_reviews set reviewed_by='3f000000-0000-4000-8000-000000000002'
where id='3f000000-0000-4000-8000-000000000225';
update public.profiles set status='SUSPENDED' where id='3f000000-0000-4000-8000-000000000002';
set local role authenticated;
select throws_ok($$select public.radar_publish_review('3f000000-0000-4000-8000-000000000225',2,'f3-revoked')$$,
  '55000', null, 'inactive approver invalidates prior approval');
reset role;
update public.profiles set status='ACTIVE' where id='3f000000-0000-4000-8000-000000000002';
delete from public.user_roles where user_id='3f000000-0000-4000-8000-000000000002';
set local role authenticated;
select throws_ok($$select public.radar_publish_review('3f000000-0000-4000-8000-000000000225',2,'f3-revoked')$$,
  '55000', null, 'role-revoked approver invalidates prior approval');
reset role;
set local role authenticated;
select lives_ok($$select public.radar_reject_review('3f000000-0000-4000-8000-000000000224',2,'f3 rejection','f3-reject-4')$$,
  'approved review can transition to rejected without changing its freeze history');
reset role;
select throws_ok($$insert into public.radar_evidence(
  analysis_id, token_id, evidence_key, classification, origin, category, label, source_reference,
  observed_at, received_at, evaluated_at, methodology_version)
  values ('3f000000-0000-4000-8000-000000000214','3f000000-0000-4000-8000-000000000100','after-rejected',
  'STRONG_SIGNAL','DETERMINISTIC','market','After rejected','https://example.test/rejected',now(),now(),now(),'f3-method')$$,
  '55000', null, 'rejected review does not reopen approved evidence membership');

set local role authenticated;
select lives_ok($$select public.radar_approve_review('3f000000-0000-4000-8000-000000000226',1,'note','disclosure','f3-approve-6')$$,
  'a valid owner can create a new review after prior approver changes');
reset role;

select lives_ok($$insert into public.radar_evidence(
  analysis_id, token_id, evidence_key, classification, origin, category, label, source_reference,
  observed_at, received_at, evaluated_at, methodology_version)
  values ('3f000000-0000-4000-8000-000000000217','3f000000-0000-4000-8000-000000000100','before-freeze',
  'STRONG_SIGNAL','DETERMINISTIC','market','Before freeze','https://example.test/before',now(),now(),now(),'f3-method')$$,
  'evidence append is allowed before the irreversible review boundary');
set local role authenticated;
select throws_ok($$select public.radar_publish_review('3f000000-0000-4000-8000-000000000221',3,'f3-noop')$$,
  '55000', null, 'already-published review cannot be republished with a new action');
reset role;
select throws_ok($$insert into public.radar_evidence(
  analysis_id, token_id, evidence_key, classification, origin, category, label, source_reference,
  observed_at, received_at, evaluated_at, methodology_version)
  values ('3f000000-0000-4000-8000-000000000211','3f000000-0000-4000-8000-000000000100','after-approved',
  'STRONG_SIGNAL','DETERMINISTIC','market','After approved','https://example.test/after',now(),now(),now(),'f3-method')$$,
  '55000', null, 'approved analysis evidence membership is frozen');

select throws_ok($$insert into public.radar_observations(
  id,event_id,token_id,provider,adapter_version,capability,metric_key,data_state,context,provenance,content_hash,observed_at)
  values ('3f000000-0000-4000-8000-000000000301','3f000000-0000-4000-8000-000000000110',
  '3f000000-0000-4000-8000-000000000100','f3-provider','adapter-v1','market','infinite','UNKNOWN','{}','{}',repeat('1',64),'infinity')$$,
  '23514', null, 'infinite observation timestamp is rejected');
select throws_ok($$insert into public.radar_observations(
  id,event_id,token_id,provider,adapter_version,capability,metric_key,data_state,context,provenance,content_hash,observed_at)
  values ('3f000000-0000-4000-8000-000000000302','3f000000-0000-4000-8000-000000000110',
  '3f000000-0000-4000-8000-000000000100','f3-provider','adapter-v1','market','negative-infinite','UNKNOWN','{}','{}',repeat('2',64),'-infinity')$$,
  '23514', null, 'negative infinite observation timestamp is rejected');
select throws_ok($$insert into public.radar_evidence(
  analysis_id,token_id,evidence_key,classification,origin,category,label,source_reference,observed_at,received_at,evaluated_at,methodology_version)
  values ('3f000000-0000-4000-8000-000000000217','3f000000-0000-4000-8000-000000000100','infinite-evidence',
  'UNKNOWN','DETERMINISTIC','market','Infinite','https://example.test/infinite','infinity',now(),now(),'f3-method')$$,
  '23514', null, 'infinite evidence timestamp is rejected');
select throws_ok($$insert into public.radar_evidence(
  analysis_id,token_id,evidence_key,classification,origin,category,label,source_reference,observed_at,received_at,evaluated_at,methodology_version)
  values ('3f000000-0000-4000-8000-000000000217','3f000000-0000-4000-8000-000000000100','negative-infinite-evidence',
  'UNKNOWN','DETERMINISTIC','market','Negative infinite','https://example.test/negative','-infinity',now(),now(),'f3-method')$$,
  '23514', null, 'negative infinite evidence timestamp is rejected');
select throws_ok($$insert into public.radar_analyses(
  id,token_id,version,status,score,deterministic_data,ai_inference,risk_summary,analyzed_at,data_as_of,
  expires_at,scoring_method_version,methodology_hash,input_hash,public_eligibility,freshness_policy_version)
  values ('3f000000-0000-4000-8000-000000000318','3f000000-0000-4000-8000-000000000100',18,'EARLY',1,'{}','{}','bad',now(),now(),'infinity','f3-method',repeat('1',64),repeat('2',64),false,'f3-policy')$$,
  '23514', null, 'infinite analysis expiry is rejected');
select ok(isfinite(now()), 'finite Radar timestamps remain accepted');

set local role authenticated;
select lives_ok($$select public.radar_publish_review('3f000000-0000-4000-8000-000000000226',2,'f3-publish-6')$$,
  'replacement publication succeeds with finite deadlines');
select lives_ok($$select public.radar_hide_review('3f000000-0000-4000-8000-000000000226',3,'f3 hide','f3-hide-6')$$,
  'published review can be hidden without changing its immutable evidence set');
reset role;
select throws_ok($$insert into public.radar_evidence(
  analysis_id, token_id, evidence_key, classification, origin, category, label, source_reference,
  observed_at, received_at, evaluated_at, methodology_version)
  values ('3f000000-0000-4000-8000-000000000216','3f000000-0000-4000-8000-000000000100','after-hidden',
  'STRONG_SIGNAL','DETERMINISTIC','market','After hidden','https://example.test/hidden',now(),now(),now(),'f3-method')$$,
  '55000', null, 'hidden review does not reopen approved evidence membership');
set local role authenticated;
select lives_ok($$select public.radar_approve_review('3f000000-0000-4000-8000-000000000227',1,'note','disclosure','f3-approve-7')$$,
  'audit fixture can be approved before atomicity validation');
reset role;
create function pg_temp.fail_f3_audit() returns trigger language plpgsql as $$
begin raise exception 'Injected F3 audit failure' using errcode='23514'; end; $$;
create trigger test_f3_audit_failure before insert on public.audit_logs
for each row execute function pg_temp.fail_f3_audit();
select throws_ok($$select public.radar_publish_review('3f000000-0000-4000-8000-000000000227',2,'f3-audit-failure')$$,
  '23514', null, 'audit failure rolls back publication');
reset role;
drop trigger test_f3_audit_failure on public.audit_logs;
select is((select state from public.radar_reviews where id='3f000000-0000-4000-8000-000000000227'), 'APPROVED',
  'audit failure leaves the review approved and unpublished');
select is((select publication_snapshot from public.radar_reviews where id='3f000000-0000-4000-8000-000000000227'), '{}'::jsonb,
  'failed publication leaves no partial snapshot');
set local role authenticated;
select lives_ok($$select public.radar_publish_review('3f000000-0000-4000-8000-000000000227',2,'f3-publish-7')$$,
  'publication succeeds after injected audit failure is removed');
reset role;
select is((select count(*)::integer from public.get_public_radar_list(50,null)), 1,
  'approved methodology and policy keep publication visible');
update public.radar_methodology_versions set state='RETIRED', approved_at=null where methodology_version='f3-method';
select is((select count(*)::integer from public.get_public_radar_list(50,null)), 0,
  'methodology withdrawal hides anonymous Radar list');
select is((select count(*)::integer from public.radar_reviews where state='PUBLISHED'), 1,
  'methodology withdrawal preserves publication history');
update public.radar_methodology_versions set state='APPROVED', approved_at=now() where methodology_version='f3-method';
select is((select count(*)::integer from public.get_public_radar_detail('3f000000-0000-4000-8000-000000000100')), 1,
  're-approved methodology restores documented public eligibility');
update public.radar_freshness_policies set state='RETIRED', approved_at=null where freshness_policy_version='f3-policy';
select is((select count(*)::integer from public.get_public_radar_detail('3f000000-0000-4000-8000-000000000100')), 0,
  'freshness-policy withdrawal hides anonymous Radar detail');
select is((select count(*)::integer from public.radar_analyses where id='3f000000-0000-4000-8000-000000000216'), 1,
  'policy withdrawal preserves analysis history');
update public.radar_freshness_policies set state='APPROVED', approved_at=now() where freshness_policy_version='f3-policy';
select ok(not private.radar_publication_snapshot_is_valid(
  '{"token_id":"x","analysis_id":"x","analysis_version":1,"analytical_status":"EARLY","score":"1","methodology_version":"f3-method","freshness_policy_version":"f3-policy","data_as_of":"2026-01-01","analyzed_at":"2026-01-01","expires_at":"2026-01-02","why_on_radar":{"nested":true},"risk_summary":"safe","metrics":[],"evidence":[],"evidence_hash":"x","review_revision":1,"published_at":"2026-01-01"}'::jsonb),
  'publication snapshot rejects nested analytical text');
select ok(not private.radar_publication_snapshot_is_valid(
  '{"token_id":"x","analysis_id":"x","analysis_version":1,"analytical_status":"EARLY","score":"1","methodology_version":"f3-method","freshness_policy_version":"f3-policy","data_as_of":"2026-01-01","analyzed_at":"2026-01-01","expires_at":"2026-01-02","why_on_radar":"safe","risk_summary":["nested"],"metrics":[],"evidence":[],"evidence_hash":"x","review_revision":1,"published_at":"2026-01-01"}'::jsonb),
  'publication snapshot rejects nested risk text');
reset role;

select * from finish();
rollback;
