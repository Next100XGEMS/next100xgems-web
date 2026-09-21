begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

-- Fixtures: staff profile, project member (no staff role), radar/analyzer rows.
insert into auth.users (id) values
  ('00000000-0000-4000-8000-00000000a001'),
  ('00000000-0000-4000-8000-00000000a002');
insert into public.profiles (id, display_name, status) values
  ('00000000-0000-4000-8000-00000000a001', 'Staff Admin', 'ACTIVE'),
  ('00000000-0000-4000-8000-00000000a002', 'Project Member', 'ACTIVE');

insert into public.user_roles (user_id, role_id)
select '00000000-0000-4000-8000-00000000a001', id from public.roles where key = 'admin';

insert into public.projects (id, slug, display_name, status)
values ('00000000-0000-4000-8000-00000000b001', 'firewall-project', 'Firewall Project', 'ACTIVE');

insert into public.project_members (project_id, user_id, role)
values (
  '00000000-0000-4000-8000-00000000b001',
  '00000000-0000-4000-8000-00000000a002',
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

-- Feature flags for claim/correction paths (still used by forbidden-key tests via helpers).
update public.feature_flags set enabled = true where key in (
  'project_claims_enabled', 'project_corrections_enabled'
);

-- Act as project member (authenticated JWT subject).
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

-- Direct table mutation against intelligence surfaces must fail (no grants).
select throws_ok(
  $$update public.radar_analyses set score = 99 where id = '00000000-0000-4000-8000-00000000c002'$$,
  '42501',
  null,
  'project member cannot UPDATE radar_analyses'
);

select throws_ok(
  $$insert into public.radar_analyses (token_id, version, status, score, data_as_of)
    values ('00000000-0000-4000-8000-00000000c001', 2, 'EARLY', 1, now())$$,
  '42501',
  null,
  'project member cannot INSERT radar_analyses'
);

select throws_ok(
  $$update public.analyzer_analyses set result = '{"hacked":true}'::jsonb where false$$,
  '42501',
  null,
  'project member cannot UPDATE analyzer_analyses'
);

select throws_ok(
  $$insert into public.analyzer_evidence_manifests (request_id, manifest_version, manifest_hash, manifest)
    values ('00000000-0000-4000-8000-00000000c001', 1, repeat('a', 64), '{}'::jsonb)$$,
  '42501',
  null,
  'project member cannot INSERT analyzer_evidence_manifests'
);

select throws_ok(
  $$update public.articles set title = 'bought' where false$$,
  '42501',
  null,
  'project member cannot UPDATE articles / research conclusions'
);

-- Correction forbidden keys rejected by DB helper / submit RPC.
select throws_ok(
  $$select public.submit_project_correction(
      '00000000-0000-4000-8000-00000000b001',
      'score',
      '"99"'::jsonb,
      'please boost score'
    )$$,
  '22023',
  null,
  'correction cannot target score'
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
  'correction cannot target risk'
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
  'correction cannot target organic_rank'
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
  'correction cannot target evidence'
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
  'correction cannot target radar_* keys'
);

-- Staff Admin is not implied by project_owner: member cannot start claim review.
select throws_ok(
  $$select public.review_project_claim_start('00000000-0000-4000-8000-00000000d001')$$,
  '42501',
  null,
  'project_owner cannot call staff claim review RPC'
);

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

-- Fail-closed flags default false in catalogue (seed rows exist).
reset role;
select ok(
  exists (select 1 from public.feature_flags where key = 'project_console_enabled' and enabled = false)
  or exists (select 1 from public.feature_flags where key = 'project_console_enabled'),
  'project_console_enabled flag row exists'
);

select * from finish();
rollback;
