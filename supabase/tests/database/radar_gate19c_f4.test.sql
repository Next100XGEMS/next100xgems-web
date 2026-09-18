-- Gate 19C-F4 upgrade-safe public validation and lease contracts.
-- Fixtures are synthetic and rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into public.radar_methodology_versions(methodology_version, state, is_test_only, content_hash, approved_at)
values ('f4-method', 'APPROVED', true, repeat('a', 64), now());
insert into public.radar_freshness_policies(freshness_policy_version, state, is_test_only, content_hash, approved_at)
values ('f4-policy', 'APPROVED', true, repeat('b', 64), now());
insert into auth.users(id) values
  ('4f000000-0000-4000-8000-000000000001'),
  ('4f000000-0000-4000-8000-000000000002');
insert into public.profiles(id, display_name, status) values
  ('4f000000-0000-4000-8000-000000000001', 'F4 Owner', 'ACTIVE'),
  ('4f000000-0000-4000-8000-000000000002', 'F4 Reviewer', 'ACTIVE');
insert into public.user_roles(user_id, role_id)
select x.user_id, r.id from (values
  ('4f000000-0000-4000-8000-000000000001'::uuid, 'owner'),
  ('4f000000-0000-4000-8000-000000000002'::uuid, 'radar_reviewer')
) x(user_id, role_key) join public.roles r on r.key = x.role_key;
insert into public.tokens(id, chain, contract_address, symbol, name) values
  ('4f000000-0000-4000-8000-000000000100', 'eip155:1', '0x4444444444444444444444444444444444444401', 'F4A', 'F4 valid token'),
  ('4f000000-0000-4000-8000-000000000101', 'eip155:1', '0x4444444444444444444444444444444444444402', 'F4B', 'F4 unsafe approval'),
  ('4f000000-0000-4000-8000-000000000102', 'eip155:1', '0x4444444444444444444444444444444444444403', 'F4C', 'F4 unsafe publication');
update public.feature_flags set enabled = case key
  when 'radar_enabled' then true when 'maintenance_mode' then false
  when 'radar_emergency_paused' then false else enabled end,
  configuration = case when key = 'radar_emergency_paused' then '{"generation":1}'::jsonb else configuration end
where key in ('radar_enabled', 'maintenance_mode', 'radar_emergency_paused');

insert into public.radar_events(id, event_key, event_type, token_id, source_provider, source_event_id,
  payload_hash, context, observed_at)
select event_id, 'f4-event-' || token_no, 'DISCOVERY', token_id, 'f4-provider', 'source-' || token_no,
  repeat('c', 64), '{}', now()-interval '1 hour'
from (values
  ('4f000000-0000-0000-0000-000000000110'::uuid, '4f000000-0000-4000-8000-000000000100'::uuid, '100'),
  ('4f000000-0000-0000-0000-000000000112'::uuid, '4f000000-0000-4000-8000-000000000101'::uuid, '101'),
  ('4f000000-0000-0000-0000-000000000113'::uuid, '4f000000-0000-4000-8000-000000000102'::uuid, '102')
) events(event_id, token_id, token_no);
insert into public.radar_observations(id, event_id, token_id, provider, adapter_version, capability,
  metric_key, data_state, normalized_value, raw_integer_value, decimal_places, unit, context,
  provenance, content_hash, observed_at)
select observation_id, event_id, token_id, 'f4-provider', 'adapter-v1', 'market', 'liquidity',
  'AVAILABLE', 100, 100, 2, 'USD', '{}', '{"authority":"f4"}', repeat('d', 64), now()-interval '1 hour'
from (values
  ('4f000000-0000-0000-0000-000000000111'::uuid, '4f000000-0000-0000-0000-000000000110'::uuid, '4f000000-0000-4000-8000-000000000100'::uuid),
  ('4f000000-0000-0000-0000-000000000114'::uuid, '4f000000-0000-0000-0000-000000000112'::uuid, '4f000000-0000-4000-8000-000000000101'::uuid),
  ('4f000000-0000-0000-0000-000000000115'::uuid, '4f000000-0000-0000-0000-000000000113'::uuid, '4f000000-0000-4000-8000-000000000102'::uuid)
) observations(observation_id, event_id, token_id);

create function pg_temp.seed_f4_case(
  p_token uuid, p_observation uuid, p_work uuid, p_analysis uuid, p_review uuid, p_version integer, p_data jsonb
) returns void language plpgsql as $$
begin
  insert into public.radar_work_items(id, work_kind, token_id, request_key, state,
    method_version, input_version, reserved_analysis_version, pause_generation)
  values (p_work, 'REANALYSIS', p_token, 'f4-work-' || p_token::text || '-' || p_version, 'QUEUED',
    'f4-method', 'f4-input', p_version, 1);
  insert into public.radar_work_inputs(work_item_id, observation_id)
  values (p_work, p_observation);
  update public.radar_work_items
  set state='SUCCEEDED', screening_result='PASS', screening_evaluated_at=now(), sealed_at=now(),
      input_hash=private.radar_input_fingerprint(id)
  where id=p_work;
  insert into public.radar_analyses(
    id, token_id, version, status, score, deterministic_data, ai_inference, risk_summary,
    analyzed_at, data_as_of, run_type, work_item_id, completed_at, scoring_method_version,
    methodology_hash, input_hash, component_breakdown, coverage, public_eligibility,
    freshness_policy_version, expires_at
  ) values (
    p_analysis, p_token, p_version, 'TRENDING', 42, p_data, '{}', 'F4 risk', now(),
    now()-interval '5 minutes', 'REANALYSIS', p_work, now(), 'f4-method', repeat('e',64),
    (select input_hash from public.radar_work_items where id=p_work), '{}', '{}', true,
    'f4-policy', now()+interval '1 day'
  );
  update public.radar_work_items set result_analysis_id=p_analysis where id=p_work;
  insert into public.radar_evidence(
    analysis_id, token_id, evidence_key, classification, origin, category, label, statement,
    numeric_value, numeric_unit, decimal_places, provider, adapter_version, observation_id,
    source_reference, observed_at, received_at, evaluated_at, methodology_version, is_public, public_rank
  ) values (
    p_analysis, p_token, 'f4-evidence-' || p_version, 'VERIFIED_DATA', 'DETERMINISTIC',
    'market', 'F4 evidence', 'Bound observation', 100, 'USD', 2, 'f4-provider', 'adapter-v1',
    p_observation, 'https://example.test/f4', now()-interval '1 hour',
    now()-interval '30 minutes', now(), 'f4-method', true, 1
  );
  insert into public.radar_reviews(id, analysis_id, token_id)
  values (p_review, p_analysis, p_token);
end;
$$;

select pg_temp.seed_f4_case('4f000000-0000-4000-8000-000000000100', '4f000000-0000-0000-0000-000000000111', '4f000000-0000-0000-0000-000000000201', '4f000000-0000-0000-0000-000000000211', '4f000000-0000-0000-0000-000000000221', 1, '{"why_on_radar":"Legacy valid string"}');
select pg_temp.seed_f4_case('4f000000-0000-4000-8000-000000000101', '4f000000-0000-0000-0000-000000000114', '4f000000-0000-0000-0000-000000000202', '4f000000-0000-0000-0000-000000000212', '4f000000-0000-0000-0000-000000000222', 1, '{"why_on_radar":{"private_marker":"audit-only"}}');
select pg_temp.seed_f4_case('4f000000-0000-4000-8000-000000000102', '4f000000-0000-0000-0000-000000000115', '4f000000-0000-0000-0000-000000000203', '4f000000-0000-0000-0000-000000000213', '4f000000-0000-0000-0000-000000000223', 1, '{"why_on_radar":{"private_marker":"published-audit-only"}}');
select pg_temp.seed_f4_case('4f000000-0000-4000-8000-000000000102', '4f000000-0000-0000-0000-000000000115', '4f000000-0000-0000-0000-000000000204', '4f000000-0000-0000-0000-000000000214', '4f000000-0000-0000-0000-000000000224', 2, '{"why_on_radar":"F4 replacement"}');

select ok(private.radar_public_analysis_is_safe('4f000000-0000-0000-0000-000000000211'), 'valid legacy source is safe'::text);
select ok(not private.radar_public_analysis_is_safe('4f000000-0000-0000-0000-000000000212'), 'legacy object source is unsafe'::text);
select extensions.is(private.radar_public_text_from_json('{"why_on_radar":["private"]}'::jsonb, 'why_on_radar', 2000), null, 'array source is rejected'::text);
select extensions.is(private.radar_public_text_from_json('{"why_on_radar":42}'::jsonb, 'why_on_radar', 2000), null, 'number source is rejected'::text);
select extensions.is(private.radar_public_text_from_json('{"why_on_radar":true}'::jsonb, 'why_on_radar', 2000), null, 'boolean source is rejected'::text);
select extensions.is(private.radar_public_text_from_json('{"why_on_radar":null}'::jsonb, 'why_on_radar', 2000), null, 'null source is rejected'::text);
select extensions.is(private.radar_public_text_from_json('{"why_on_radar":"valid"}'::jsonb, 'why_on_radar', 2000), 'valid', 'bounded string source is accepted'::text);

-- Model the F2-era approval: the source is unsafe, but the old text field is
-- already populated by the historical JSON ->> coercion.
update public.radar_reviews r
set state='APPROVED', reviewed_by='4f000000-0000-4000-8000-000000000001', reviewed_at=now(), approved_at=now(),
    public_presentation=jsonb_build_object('why_on_radar','{"private_marker":"audit-only"}', 'risk_summary','F4 risk','metrics',private.radar_public_metrics_snapshot(r.analysis_id),'evidence',private.radar_public_evidence_snapshot(r.analysis_id)),
    public_metrics_snapshot=private.radar_public_metrics_snapshot(r.analysis_id),
    public_evidence_snapshot=private.radar_public_evidence_snapshot(r.analysis_id),
    approval_analysis_version=1, approval_input_hash=a.input_hash, approval_methodology_hash=a.methodology_hash,
    approval_evidence_hash=encode(extensions.digest(convert_to(private.radar_public_evidence_snapshot(r.analysis_id)::text,'UTF8'),'sha256'),'hex'),
    approval_score_snapshot=a.score::text, revision=2
from public.radar_analyses a where r.id='4f000000-0000-0000-0000-000000000222' and a.id=r.analysis_id;

select set_config('request.jwt.claims', '{"sub":"4f000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '4f000000-0000-4000-8000-000000000001', true);
set local role authenticated;
do $$
declare
  returned_code text;
begin
  begin
    perform public.radar_publish_review('4f000000-0000-0000-0000-000000000222', 2, 'f4-unsafe-approval');
  exception when others then
    get stacked diagnostics returned_code = returned_sqlstate;
  end;
  if returned_code is null then
    raise exception 'unsafe legacy approval unexpectedly published';
  elsif returned_code <> '55000' then
    raise exception 'unsafe legacy approval returned SQLSTATE %', returned_code;
  end if;
end;
$$;
reset role;
select ok(true, 'unsafe legacy approval cannot publish after F4'::text);
select extensions.is((select state from public.radar_reviews where id='4f000000-0000-0000-0000-000000000222'), 'APPROVED', 'unsafe approval remains stored'::text);
select extensions.is((select publication_snapshot from public.radar_reviews where id='4f000000-0000-0000-0000-000000000222'), '{}'::jsonb, 'unsafe approval has no publication snapshot'::text);

-- Model an already-published F2 row. Its historical text is retained, but
-- read eligibility must consult the authoritative unsafe source.
update public.radar_reviews r
set state='PUBLISHED', reviewed_by='4f000000-0000-4000-8000-000000000001', reviewed_at=now(), approved_at=now(), published_at=now(),
    public_presentation=jsonb_build_object('why_on_radar','{"private_marker":"published-audit-only"}', 'risk_summary','F4 risk','metrics',private.radar_public_metrics_snapshot(r.analysis_id),'evidence',private.radar_public_evidence_snapshot(r.analysis_id)),
    public_metrics_snapshot=private.radar_public_metrics_snapshot(r.analysis_id), public_evidence_snapshot=private.radar_public_evidence_snapshot(r.analysis_id),
    approval_analysis_version=1, approval_input_hash=a.input_hash, approval_methodology_hash=a.methodology_hash,
    approval_evidence_hash=encode(extensions.digest(convert_to(private.radar_public_evidence_snapshot(r.analysis_id)::text,'UTF8'),'sha256'),'hex'), approval_score_snapshot=a.score::text,
    publication_snapshot=jsonb_build_object('token_id',r.token_id,'analysis_id',a.id,'analysis_version',a.version,'analytical_status',a.status,'score',a.score::text,'methodology_version',a.scoring_method_version,'freshness_policy_version',a.freshness_policy_version,'data_as_of',a.data_as_of,'analyzed_at',a.analyzed_at,'expires_at',a.expires_at,'why_on_radar','{"private_marker":"published-audit-only"}','risk_summary','F4 risk','metrics',private.radar_public_metrics_snapshot(r.analysis_id),'evidence',private.radar_public_evidence_snapshot(r.analysis_id),'evidence_hash',encode(extensions.digest(convert_to(private.radar_public_evidence_snapshot(r.analysis_id)::text,'UTF8'),'sha256'),'hex'),'review_revision',2,'published_at',now()), revision=3
from public.radar_analyses a where r.id='4f000000-0000-0000-0000-000000000223' and a.id=r.analysis_id;

set local role anon;
create temp table pg_temp.f4_unsafe_public_checks as
select
  (select count(*)::integer from public.get_public_radar_detail('4f000000-0000-4000-8000-000000000102')) as detail_count,
  (select count(*)::integer from public.get_public_radar_list(50,null) where token_id='4f000000-0000-4000-8000-000000000102') as list_count;
reset role;
select extensions.is((select detail_count from pg_temp.f4_unsafe_public_checks), 0, 'unsafe published history is hidden from anonymous detail'::text);
select extensions.is((select list_count from pg_temp.f4_unsafe_public_checks), 0, 'unsafe published history is hidden from anonymous list'::text);
select extensions.is((select count(*)::integer from public.radar_reviews where id='4f000000-0000-0000-0000-000000000223'), 1, 'unsafe publication history remains stored'::text);

-- A valid F2-era string approval remains eligible after F4.
update public.radar_reviews r
set state='APPROVED', reviewed_by='4f000000-0000-4000-8000-000000000001', reviewed_at=now(), approved_at=now(),
    public_presentation=jsonb_build_object('why_on_radar','Legacy valid string','risk_summary','F4 risk','metrics',private.radar_public_metrics_snapshot(r.analysis_id),'evidence',private.radar_public_evidence_snapshot(r.analysis_id)),
    public_metrics_snapshot=private.radar_public_metrics_snapshot(r.analysis_id), public_evidence_snapshot=private.radar_public_evidence_snapshot(r.analysis_id),
    approval_analysis_version=1, approval_input_hash=a.input_hash, approval_methodology_hash=a.methodology_hash,
    approval_evidence_hash=encode(extensions.digest(convert_to(private.radar_public_evidence_snapshot(r.analysis_id)::text,'UTF8'),'sha256'),'hex'), approval_score_snapshot=a.score::text, revision=2
from public.radar_analyses a where r.id='4f000000-0000-0000-0000-000000000221' and a.id=r.analysis_id;
set local role authenticated;
do $$
begin
  perform public.radar_publish_review('4f000000-0000-0000-0000-000000000221', 2, 'f4-valid-legacy');
end;
$$;
reset role;
select ok(true, 'valid legacy string approval publishes'::text);
set local role anon;
create temp table pg_temp.f4_valid_public_checks as
select
  (select count(*)::integer from public.get_public_radar_detail('4f000000-0000-4000-8000-000000000100')) as detail_count,
  (select count(*)::integer from public.get_public_radar_list(50,null) where token_id='4f000000-0000-4000-8000-000000000100') as list_count;
reset role;
select extensions.is((select detail_count from pg_temp.f4_valid_public_checks), 1, 'valid legacy publication remains visible in detail'::text);
select extensions.is((select list_count from pg_temp.f4_valid_public_checks), 1, 'valid legacy publication remains visible in list'::text);

select ok(not has_function_privilege('anon', 'public.radar_system_renew_work(uuid,text,uuid,bigint,integer)', 'EXECUTE'), 'anon cannot renew work'::text);
select ok(not has_function_privilege('authenticated', 'public.radar_system_renew_work(uuid,text,uuid,bigint,integer)', 'EXECUTE'), 'authenticated cannot renew work'::text);
select ok(has_function_privilege('service_role', 'public.radar_system_renew_work(uuid,text,uuid,bigint,integer)', 'EXECUTE'), 'service role can renew work'::text);
select ok(not has_function_privilege('authenticated', 'public.radar_system_fail_work(uuid,text,uuid,bigint,boolean,text,timestamptz)', 'EXECUTE'), 'authenticated cannot report work failure'::text);
select ok(has_function_privilege('service_role', 'public.radar_system_fail_work(uuid,text,uuid,bigint,boolean,text,timestamptz)', 'EXECUTE'), 'service role can report work failure'::text);

select * from finish();
rollback;
