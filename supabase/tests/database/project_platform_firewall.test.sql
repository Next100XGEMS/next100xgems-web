begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

-- Fixtures: staff profile, project member (no staff role), second project for CF-43,
-- radar/analyzer/research rows, SUBMITTED claim for CF-13.
insert into auth.users (id) values
  ('00000000-0000-4000-8000-00000000a001'),
  ('00000000-0000-4000-8000-00000000a002'),
  ('00000000-0000-4000-8000-00000000a003');
insert into public.profiles (id, display_name, status) values
  ('00000000-0000-4000-8000-00000000a001', 'Staff Admin', 'ACTIVE'),
  ('00000000-0000-4000-8000-00000000a002', 'Project Member', 'ACTIVE'),
  ('00000000-0000-4000-8000-00000000a003', 'Other Member', 'ACTIVE');

insert into public.user_roles (user_id, role_id)
select '00000000-0000-4000-8000-00000000a001', id from public.roles where key = 'admin';

insert into public.projects (id, slug, display_name, status)
values
  ('00000000-0000-4000-8000-00000000b001', 'firewall-project', 'Firewall Project', 'ACTIVE'),
  ('00000000-0000-4000-8000-00000000b002', 'firewall-project-q', 'Firewall Project Q', 'ACTIVE');

insert into public.project_members (project_id, user_id, role)
values
  (
    '00000000-0000-4000-8000-00000000b001',
    '00000000-0000-4000-8000-00000000a002',
    'project_owner'
  ),
  (
    '00000000-0000-4000-8000-00000000b002',
    '00000000-0000-4000-8000-00000000a003',
    'project_owner'
  );

insert into public.tokens (id, chain, contract_address)
values (
  '00000000-0000-4000-8000-00000000c001',
  'eip155:1',
  '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'
);
insert into public.radar_analyses (id, token_id, version, status, score, data_as_of)
values (
  '00000000-0000-4000-8000-00000000c002',
  '00000000-0000-4000-8000-00000000c001',
  1, 'EARLY', 42, now()
);

-- CF-03 fixtures: real Analyzer request/manifest/analysis rows for byte-equality.
insert into public.analyzer_requests (
  id, requester_id, raw_input, input_type, request_fingerprint, status
) values (
  '00000000-0000-4000-8000-00000000c010',
  '00000000-0000-4000-8000-00000000a001',
  '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
  'CONTRACT_ADDRESS',
  repeat('ab', 32),
  'ANALYZED'
);
insert into public.analyzer_evidence_manifests (
  id, request_id, manifest_version, manifest_hash, manifest
) values (
  '00000000-0000-4000-8000-00000000c011',
  '00000000-0000-4000-8000-00000000c010',
  1,
  repeat('cd', 32),
  '{"sources":["fixture"]}'::jsonb
);
insert into public.analyzer_analyses (
  id, request_id, evidence_manifest_id, analysis_version, status, result
) values (
  '00000000-0000-4000-8000-00000000c012',
  '00000000-0000-4000-8000-00000000c010',
  '00000000-0000-4000-8000-00000000c011',
  1,
  'ANALYZED',
  '{"conclusion":"fixture-safe","score":7}'::jsonb
);

-- CF-04 fixture: research article title must remain unchanged after denied UPDATE.
insert into public.articles (id, title, slug, author_id, status, category, tldr)
values (
  '00000000-0000-4000-8000-00000000c020',
  'Firewall Research Fixture',
  'firewall-research-fixture',
  '00000000-0000-4000-8000-00000000a001',
  'DRAFT',
  'MARKET',
  'Synthetic research conclusion fixture'
);

-- CF-13 fixture: SUBMITTED claim used to prove approve cannot skip UNDER_REVIEW.
insert into public.project_claims (
  id, claimant_user_id, proposed_slug, proposed_display_name, payload, state
) values (
  '00000000-0000-4000-8000-00000000d001',
  '00000000-0000-4000-8000-00000000a002',
  'firewall-skip-claim',
  'Firewall Skip Claim',
  '{"website_url":"https://example.test/claim"}'::jsonb,
  'SUBMITTED'
);

-- FZ-6: seed defaults must be strictly false before enabling any path under test.
select is(
  (select enabled from public.feature_flags where key = 'project_console_enabled'),
  false,
  'FZ-6: project_console_enabled seeded enabled=false'
);
select is(
  (select enabled from public.feature_flags where key = 'project_claims_enabled'),
  false,
  'FZ-6: project_claims_enabled seeded enabled=false'
);
select is(
  (select enabled from public.feature_flags where key = 'project_corrections_enabled'),
  false,
  'FZ-6: project_corrections_enabled seeded enabled=false'
);

-- Feature flags for claim/correction/Data Center paths under exercise.
update public.feature_flags set enabled = true where key in (
  'project_claims_enabled', 'project_corrections_enabled', 'project_console_enabled'
);

-- Act as project member (authenticated JWT subject).
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

-- CF-01: Direct table mutation against Radar must fail; score byte-equal after deny.
select throws_ok(
  $$update public.radar_analyses set score = 99 where id = '00000000-0000-4000-8000-00000000c002'$$,
  '42501',
  null,
  'CF-01: project member cannot UPDATE radar_analyses'
);

reset role;
select is(
  (select score from public.radar_analyses where id = '00000000-0000-4000-8000-00000000c002'),
  42::numeric,
  'CF-01: radar score unchanged after denied UPDATE'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select throws_ok(
  $$insert into public.radar_analyses (token_id, version, status, score, data_as_of)
    values ('00000000-0000-4000-8000-00000000c001', 2, 'EARLY', 1, now())$$,
  '42501',
  null,
  'CF-02: project member cannot INSERT radar_analyses'
);

select throws_ok(
  $$update public.analyzer_analyses
      set result = '{"hacked":true,"score":99}'::jsonb
      where id = '00000000-0000-4000-8000-00000000c012'$$,
  '42501',
  null,
  'CF-03: project member cannot UPDATE analyzer_analyses'
);

reset role;
select is(
  (select result from public.analyzer_analyses where id = '00000000-0000-4000-8000-00000000c012'),
  '{"conclusion":"fixture-safe","score":7}'::jsonb,
  'CF-03: analyzer result unchanged after denied UPDATE'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select throws_ok(
  $$insert into public.analyzer_evidence_manifests (request_id, manifest_version, manifest_hash, manifest)
    values (
      '00000000-0000-4000-8000-00000000c010',
      2,
      repeat('ef', 32),
      '{"sources":["forged"]}'::jsonb
    )$$,
  '42501',
  null,
  'CF-03: project member cannot INSERT analyzer_evidence_manifests'
);

select throws_ok(
  $$update public.articles
      set title = 'bought-research-conclusion'
      where id = '00000000-0000-4000-8000-00000000c020'$$,
  '42501',
  null,
  'CF-04: project member cannot UPDATE articles / research conclusions'
);

reset role;
select is(
  (select title from public.articles where id = '00000000-0000-4000-8000-00000000c020'),
  'Firewall Research Fixture',
  'CF-04: article title unchanged after denied UPDATE'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

-- Correction forbidden keys rejected by DB helper / submit RPC (CF-11).
select throws_ok(
  $$select public.submit_project_correction(
      '00000000-0000-4000-8000-00000000b001',
      'score',
      '"99"'::jsonb,
      'please boost score'
    )$$,
  '22023',
  null,
  'CF-11: correction cannot target score'
);

select throws_ok(
  $$select public.submit_project_correction(
      '00000000-0000-4000-8000-00000000b001',
      'risk',
      '"low"'::jsonb,
      'please clear risk'
    )$$,
  '22023',
  null,
  'CF-11: correction cannot target risk'
);

select throws_ok(
  $$select public.submit_project_correction(
      '00000000-0000-4000-8000-00000000b001',
      'organic_rank',
      '1'::jsonb,
      'please rank first'
    )$$,
  '22023',
  null,
  'CF-11: correction cannot target organic_rank'
);

select throws_ok(
  $$select public.submit_project_correction(
      '00000000-0000-4000-8000-00000000b001',
      'evidence',
      '{}'::jsonb,
      'please rewrite evidence'
    )$$,
  '22023',
  null,
  'CF-11: correction cannot target evidence'
);

select throws_ok(
  $$select public.submit_project_correction(
      '00000000-0000-4000-8000-00000000b001',
      'radar_score',
      '1'::jsonb,
      'please rewrite radar'
    )$$,
  '22023',
  null,
  'CF-11: correction cannot target radar_* keys'
);

-- CF-10: claim payload with intelligence keys must reject.
select throws_ok(
  $$select public.submit_project_claim(
      'firewall-claim',
      'Firewall Claim',
      '{"website_url":"https://example.test","score":99}'::jsonb,
      null
    )$$,
  '22023',
  null,
  'CF-10: claim payload with score key is rejected'
);

select throws_ok(
  $$select public.submit_project_claim(
      'firewall-claim-risk',
      'Firewall Claim Risk',
      '{"risk":"low","organic_rank":1,"evidence":{}}'::jsonb,
      null
    )$$,
  '22023',
  null,
  'CF-10: claim payload with risk/organic/evidence keys is rejected'
);

-- Staff Admin is not implied by project_owner: member cannot start claim review (CF-14).
select throws_ok(
  $$select public.review_project_claim_start('00000000-0000-4000-8000-00000000d001')$$,
  '42501',
  null,
  'CF-14: project_owner cannot call staff claim review RPC'
);

-- CF-13: staff approve cannot skip SUBMITTED → APPROVED without UNDER_REVIEW.
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select throws_ok(
  $$select public.review_project_claim_approve(
      '00000000-0000-4000-8000-00000000d001',
      'skip under review'
    )$$,
  '55000',
  null,
  'CF-13: claim approve refused when state is SUBMITTED (no skip)'
);

reset role;
select is(
  (select state from public.project_claims where id = '00000000-0000-4000-8000-00000000d001'),
  'SUBMITTED',
  'CF-13: claim remains SUBMITTED after refused skip-approve'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

-- Helper: staff role check is independent of project membership.
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select is(
  (select private.is_project_staff()),
  false,
  'project_owner without staff role is not project staff'
);
select is(
  (select private.is_project_member('00000000-0000-4000-8000-00000000b001', array['project_owner']::text[])),
  true,
  'project_owner membership predicate holds'
);

-- CF-12: staff approve of a forbidden-field correction must be refused (approve-time re-check).
-- Insert a corrupt UNDER_REVIEW row as postgres (bypasses submit allowlist), then approve as staff.
reset role;
insert into public.project_corrections (
  id, project_id, submitter_user_id, field_key, proposed_value, rationale, state,
  reviewer_user_id
) values (
  '00000000-0000-4000-8000-00000000d010',
  '00000000-0000-4000-8000-00000000b001',
  '00000000-0000-4000-8000-00000000a002',
  'score',
  '"99"'::jsonb,
  'laundered score correction for approve re-check',
  'UNDER_REVIEW',
  '00000000-0000-4000-8000-00000000a001'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select throws_ok(
  $$select public.review_project_correction_approve(
      '00000000-0000-4000-8000-00000000d010',
      'should refuse'
    )$$,
  '22023',
  null,
  'CF-12: staff approve of forbidden-field correction is refused'
);

reset role;
select is(
  (select state from public.project_corrections where id = '00000000-0000-4000-8000-00000000d010'),
  'UNDER_REVIEW',
  'CF-12: forbidden correction remains UNDER_REVIEW after refused approve'
);
select is(
  (select count(*)::integer from public.project_field_values
    where project_id = '00000000-0000-4000-8000-00000000b001' and field_key = 'score'),
  0,
  'CF-12: no score field written by refused approve'
);

-- CF-20: cannot overwrite INDEPENDENTLY_VERIFIED via set_project_field_value.
reset role;
insert into public.project_field_values (
  project_id, field_key, value, provenance, version, updated_by
) values (
  '00000000-0000-4000-8000-00000000b001',
  'website',
  '"https://verified.example"'::jsonb,
  'INDEPENDENTLY_VERIFIED',
  1,
  '00000000-0000-4000-8000-00000000a001'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select throws_ok(
  $$select public.set_project_field_value(
      '00000000-0000-4000-8000-00000000b001',
      'website',
      '"https://member-overwrite.example"'::jsonb
    )$$,
  '55000',
  null,
  'CF-20: cannot overwrite INDEPENDENTLY_VERIFIED via set_project_field_value'
);

reset role;
select is(
  (select value#>>'{}' from public.project_field_values
    where project_id = '00000000-0000-4000-8000-00000000b001' and field_key = 'website'),
  'https://verified.example',
  'CF-20: verified website value unchanged after denied overwrite'
);
select is(
  (select provenance::text from public.project_field_values
    where project_id = '00000000-0000-4000-8000-00000000b001' and field_key = 'website'),
  'INDEPENDENTLY_VERIFIED',
  'CF-20: verified provenance unchanged after denied overwrite'
);

-- CF-21: member cannot set provenance to verified/AI (RPC hardcodes PROJECT_PROVIDED;
-- direct table update denied).
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select throws_ok(
  $$update public.project_field_values
    set provenance = 'INDEPENDENTLY_VERIFIED'
    where project_id = '00000000-0000-4000-8000-00000000b001'
      and field_key = 'website'$$,
  '42501',
  null,
  'CF-21: member cannot UPDATE provenance to INDEPENDENTLY_VERIFIED directly'
);

select throws_ok(
  $$update public.project_field_values
    set provenance = 'AI_INFERENCE'
    where project_id = '00000000-0000-4000-8000-00000000b001'
      and field_key = 'website'$$,
  '42501',
  null,
  'CF-21: member cannot UPDATE provenance to AI_INFERENCE directly'
);

-- CF-21/CF-22: successful member write hardcodes PROJECT_PROVIDED + versions + updated_by.
select lives_ok(
  $$select public.set_project_field_value(
      '00000000-0000-4000-8000-00000000b001',
      'telegram_url',
      '"https://t.me/firewall"'::jsonb
    )$$,
  'CF-22: member can set allowlisted PROJECT_PROVIDED field'
);

reset role;
select is(
  (select provenance::text from public.project_field_values
    where project_id = '00000000-0000-4000-8000-00000000b001' and field_key = 'telegram_url'),
  'PROJECT_PROVIDED',
  'CF-21: set_project_field_value hardcodes PROJECT_PROVIDED provenance'
);
select is(
  (select version from public.project_field_values
    where project_id = '00000000-0000-4000-8000-00000000b001' and field_key = 'telegram_url'),
  1,
  'CF-22: first write sets version=1'
);
select is(
  (select updated_by from public.project_field_values
    where project_id = '00000000-0000-4000-8000-00000000b001' and field_key = 'telegram_url'),
  '00000000-0000-4000-8000-00000000a002'::uuid,
  'CF-22: write records updated_by'
);
select ok(
  exists (
    select 1 from public.project_field_versions
    where project_id = '00000000-0000-4000-8000-00000000b001'
      and field_key = 'telegram_url'
      and version = 1
      and provenance = 'PROJECT_PROVIDED'
  ),
  'CF-22: version history row written with provenance'
);

-- Second write bumps version.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select lives_ok(
  $$select public.set_project_field_value(
      '00000000-0000-4000-8000-00000000b001',
      'telegram_url',
      '"https://t.me/firewall-v2"'::jsonb
    )$$,
  'CF-22: member can update PROJECT_PROVIDED field'
);
reset role;
select is(
  (select version from public.project_field_values
    where project_id = '00000000-0000-4000-8000-00000000b001' and field_key = 'telegram_url'),
  2,
  'CF-22: second write bumps version to 2'
);

-- CF-23 / CF-24: commercial/paid tables do not auto-promote into projects or set verified.
select is(
  (
    select count(*)::integer
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    join pg_class frel on frel.oid = con.confrelid
    where nsp.nspname = 'public'
      and rel.relname in ('leads', 'partners', 'sponsors', 'ad_placements', 'ad_campaigns', 'ad_creatives', 'ad_campaign_placements')
      and frel.relname = 'projects'
      and con.contype = 'f'
  ),
  0,
  'CF-23/CF-24: commercial tables have no FK to projects'
);

select is(
  (
    select count(*)::integer
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('leads', 'partners', 'ad_campaigns', 'ad_placements')
      and not t.tgisinternal
      and pg_get_triggerdef(t.oid) ilike '%project%'
  ),
  0,
  'CF-23/CF-24: commercial tables have no project-promoting triggers'
);

-- Explicit lead insert does not create a project / verified field.
insert into public.leads (
  project_name, contact_name, contact_method, contact_value, interested_service
) values (
  'Paid Lead Autopromote Probe', 'Probe', 'EMAIL', 'probe@example.test', 'listing'
);
select is(
  (select count(*)::integer from public.projects where display_name = 'Paid Lead Autopromote Probe'),
  0,
  'CF-23: inserting a lead does not auto-create a project'
);
select is(
  (
    select count(*)::integer from public.project_field_values
    where provenance = 'INDEPENDENTLY_VERIFIED'
      and updated_at > now() - interval '1 minute'
      and field_key = 'website'
      and project_id not in (
        '00000000-0000-4000-8000-00000000b001'
      )
  ),
  0,
  'CF-24: paid/lead path does not mint INDEPENDENTLY_VERIFIED fields'
);

-- CF-43: member of project P cannot read/write project Q Data Center.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select throws_ok(
  $$select public.set_project_field_value(
      '00000000-0000-4000-8000-00000000b002',
      'website',
      '"https://cross-project.example"'::jsonb
    )$$,
  '42501',
  null,
  'CF-43: member of P cannot write project Q Data Center'
);

reset role;
insert into public.project_field_values (
  project_id, field_key, value, provenance, version, updated_by
) values (
  '00000000-0000-4000-8000-00000000b002',
  'website',
  '"https://q-only.example"'::jsonb,
  'PROJECT_PROVIDED',
  1,
  '00000000-0000-4000-8000-00000000a003'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (
    select count(*)::integer from public.project_field_values
    where project_id = '00000000-0000-4000-8000-00000000b002'
  ),
  0,
  'CF-43: member of P cannot SELECT project Q field values'
);

-- CF-33 / HIGH 2: Data Center RPC fail-closed when project_console_enabled is false.
reset role;
update public.feature_flags set enabled = false where key = 'project_console_enabled';

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select throws_ok(
  $$select public.set_project_field_value(
      '00000000-0000-4000-8000-00000000b001',
      'discord_url',
      '"https://discord.gg/firewall"'::jsonb
    )$$,
  '55000',
  null,
  'CF-33: set_project_field_value denied when project_console_enabled is false'
);

-- Restore seed-false for FZ-6 strict end assert.
reset role;
update public.feature_flags set enabled = false where key in (
  'project_console_enabled', 'project_claims_enabled', 'project_corrections_enabled'
);

select is(
  (select enabled from public.feature_flags where key = 'project_console_enabled'),
  false,
  'FZ-6 strict: project_console_enabled enabled=false'
);
select is(
  (select enabled from public.feature_flags where key = 'project_claims_enabled'),
  false,
  'FZ-6 strict: project_claims_enabled enabled=false'
);
select is(
  (select enabled from public.feature_flags where key = 'project_corrections_enabled'),
  false,
  'FZ-6 strict: project_corrections_enabled enabled=false'
);

select * from finish();
rollback;
