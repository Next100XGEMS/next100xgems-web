-- All fixtures, including synthetic auth IDs, are rolled back. No login flow.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select tables_are('public', array[
  'profiles', 'roles', 'user_roles', 'feature_flags', 'site_settings', 'audit_logs',
  'articles', 'partners', 'sponsors', 'ad_placements', 'ad_campaigns',
  'ad_creatives', 'ad_campaign_placements', 'leads', 'tokens',
  'radar_analyses', 'radar_reviews', 'radar_events', 'radar_observations',
  'radar_work_items', 'radar_work_inputs', 'radar_deep_lane_requests', 'radar_deep_lane_attempts',
  'radar_evidence', 'radar_methodology_versions',
  'radar_freshness_policies', 'radar_evidence_freezes', 'research_authors', 'article_sources',
  'article_related_research', 'article_tokens',
  'analyzer_config', 'analyzer_requests', 'analyzer_resolutions', 'analyzer_resolution_receipts',
  'analyzer_evidence_manifests', 'analyzer_analyses', 'analyzer_model_calls',
  'analyzer_provider_events', 'analyzer_cost_usage', 'analyzer_deliveries', 'analyzer_delivery_intents'
], 'Only the intended foundation/Research/Radar/Analyzer tables exist; no trading or analytics event tables');

select ok(c.relrowsecurity, c.relname || ': RLS enabled')
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' order by c.relname;

select is((select count(*)::integer from pg_policies where schemaname = 'public'), 25,
  'Exactly the Gate 6B, Research, and Radar staff-read policies exist');

select ok(not exists (
  select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and has_table_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
), 'anon: no application-table grants');
select ok(not exists (
  select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and has_table_privilege('authenticated', c.oid, 'INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
), 'authenticated: no application-table mutation grants');
select ok(not exists (
  select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and has_table_privilege('service_role', c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
), 'service_role: no application-table grants');
select ok(has_column_privilege('authenticated', 'public.profiles', 'id', 'SELECT'),
  'authenticated: scoped profile SELECT grant exists');

select ok(not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('set_updated_at', 'reject_immutable_change', 'preserve_review_target')
    and has_function_privilege(r.name, p.oid, 'EXECUTE')
), r.name || ': helper functions are not exposed RPC operations')
from (values ('anon'), ('authenticated'), ('service_role')) r(name);

select ok(not has_function_privilege('anon', 'public.get_my_authorization()', 'EXECUTE'),
  'anon cannot execute authorization context RPC');
select ok(has_function_privilege('authenticated', 'public.get_my_authorization()', 'EXECUTE'),
  'authenticated can execute self-only authorization context RPC');
select ok(not has_function_privilege('service_role', 'public.get_my_authorization()', 'EXECUTE'),
  'service_role has no authorization context RPC grant');
select ok(has_function_privilege('authenticated', 'private.current_app_roles()', 'EXECUTE'),
  'authenticated can execute the RLS role helper');
select ok(not has_function_privilege('anon', 'private.current_app_roles()', 'EXECUTE'),
  'anon cannot execute the private role helper');

select ok(not exists (
  select 1 from pg_attribute a join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and a.attname = 'id'
    and a.atttypid <> 'uuid'::regtype
), 'Application identifiers use UUIDs');
select ok(not exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and column_name like '%\_at' escape '\'
    and data_type <> 'timestamp with time zone'
), 'Application timestamps use timestamptz');
select columns_are('public', 'profiles', array['id', 'display_name', 'status', 'created_at', 'updated_at'],
  'Profiles contain application identity only, no credentials');

select results_eq(
  $$select key from public.roles order by key$$,
  $$values ('ad_manager'), ('admin'), ('analyst'), ('editor'), ('owner'), ('radar_reviewer'), ('viewer')$$,
  'Exactly the seven role definitions are seeded');
select ok(not exists (
  select 1 from public.user_roles u
  left join public.profiles p on p.id = u.user_id
  left join public.roles r on r.id = u.role_id
  where p.id is null or r.id is null
), 'Every role assignment references an existing profile and seeded role');
select is((select count(*)::integer from public.feature_flags), 11, 'Eleven shared safe feature defaults');
select is((select enabled from public.feature_flags where key = 'radar_auto_publish'), false, 'Auto-publish OFF');
select is((select enabled from public.feature_flags where key = 'maintenance_mode'), true, 'Maintenance ON initially');
select is((select enabled from public.feature_flags where key = 'radar_emergency_paused'), true, 'Radar emergency pause ON initially');
select is((select enabled from public.feature_flags where key = 'token_analyzer_enabled'), false, 'Token Analyzer OFF initially');
select is((select enabled from public.feature_flags where key = 'token_analyzer_public_enabled'), false, 'Public Token Analyzer OFF initially');
select is((select count(*)::integer from public.feature_flags where key not in ('maintenance_mode', 'radar_emergency_paused') and enabled), 0,
  'All feature availability defaults OFF');

select ok(exists (
  select 1 from pg_constraint c join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public' and c.conname = required.name and c.contype = 'u'
), required.name || ': uniqueness enforced')
from (values
  ('articles_slug_key'), ('partners_slug_key'), ('feature_flags_key_key'),
  ('ad_placements_code_key'), ('tokens_chain_contract_key'),
  ('user_roles_user_role_key'), ('ad_campaign_placements_campaign_placement_key'),
  ('radar_analyses_token_version_key'), ('radar_reviews_analysis_id_key')
) required(name);

select ok(not exists (
  select 1 from pg_constraint c
  where c.contype = 'f' and c.conrelid in (
    'public.sponsors'::regclass, 'public.partners'::regclass,
    'public.ad_campaigns'::regclass, 'public.ad_placements'::regclass,
    'public.ad_creatives'::regclass, 'public.ad_campaign_placements'::regclass
  ) and c.confrelid in ('public.articles'::regclass, 'public.tokens'::regclass,
    'public.radar_analyses'::regclass, 'public.radar_reviews'::regclass)
), 'Commercial records have no foreign keys into analytical/editorial data');

-- Fixtures use reserved example domains, synthetic UUIDs and rollback only.
insert into auth.users (id) values ('00000000-0000-4000-8000-000000000001');
insert into public.profiles (id, display_name)
values ('00000000-0000-4000-8000-000000000001', 'Database test');
select throws_ok(
  $$insert into public.profiles(id) values ('00000000-0000-4000-8000-000000000099')$$,
  '23503', null, 'Profile requires an auth.users identity');

insert into public.articles (id, title, slug, author_id)
values ('00000000-0000-4000-8000-000000000010', 'Fixture', 'fixture', '00000000-0000-4000-8000-000000000001');
select throws_ok($$insert into public.articles(title, slug) values ('Other', 'fixture')$$,
  '23505', null, 'Duplicate article slug rejected');
select throws_ok($$update public.articles set status = 'UNKNOWN'$$,
  '23514', null, 'Invalid article lifecycle rejected');
select throws_ok($$update public.articles set classification = 'SPONSORED', disclosure = null$$,
  '23514', null, 'Sponsored article requires disclosure');
select throws_ok($$update public.articles set status = 'PUBLISHED'$$,
  '23514', null, 'Published article requires publication time');

insert into public.site_settings(site_name) values ('Fixture');
select throws_ok($$insert into public.site_settings(site_name) values ('Duplicate')$$,
  '23505', null, 'Settings permit only one typed row');
select throws_ok($$insert into public.feature_flags(key) values ('radar_auto_publish')$$,
  '23505', null, 'Duplicate flag key rejected');

insert into public.sponsors (id, name) values ('00000000-0000-4000-8000-000000000020', 'Fixture');
insert into public.ad_campaigns(id, sponsor_id, name) values
  ('00000000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-000000000020', 'A'),
  ('00000000-0000-4000-8000-000000000022', '00000000-0000-4000-8000-000000000020', 'B');
insert into public.ad_placements(id, code, name)
values ('00000000-0000-4000-8000-000000000023', 'HP-01', 'Fixture');
insert into public.ad_creatives(id, campaign_id, headline, cta, destination_url)
values ('00000000-0000-4000-8000-000000000024', '00000000-0000-4000-8000-000000000021',
  'Fixture', 'Read', 'https://example.invalid');
select throws_ok($$insert into public.ad_campaign_placements(campaign_id, placement_id, creative_id)
  values ('00000000-0000-4000-8000-000000000022', '00000000-0000-4000-8000-000000000023', '00000000-0000-4000-8000-000000000024')$$,
  '23503', null, 'Creative cannot be attached to a different campaign');
select throws_ok($$update public.ad_placements set sponsored_label = 'Editorial'$$,
  '23514', null, 'Sponsored ad label cannot impersonate editorial content');
select throws_ok($$update public.ad_campaigns set starts_at = '2026-09-10Z', ends_at = '2026-09-09Z'$$,
  '23514', null, 'Reversed campaign dates rejected');

insert into public.tokens(id, chain, contract_address)
values ('00000000-0000-4000-8000-000000000030', 'eip155:1', '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
select throws_ok($$insert into public.tokens(chain, contract_address)
  values ('eip155:1', '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')$$,
  '23505', null, 'Same EVM contract with different casing is a duplicate');
select lives_ok($$insert into public.tokens(chain, contract_address) values
  ('solana:testnet', 'CaseSensitiveFixture'), ('solana:testnet', 'casesensitivefixture')$$,
  'Non-EVM address casing remains significant');
select lives_ok($$insert into public.tokens(chain, contract_address)
  values ('eip155:2', '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')$$,
  'Identical address on another chain is a distinct identity');

insert into public.radar_analyses(id, token_id, version, status, score, data_as_of)
values ('00000000-0000-4000-8000-000000000031', '00000000-0000-4000-8000-000000000030', 1, 'EARLY', 10, now());
select throws_ok($$update public.radar_analyses set score = 99$$,
  '55000', null, 'Existing Radar score cannot be manually edited');
select throws_ok($$delete from public.radar_analyses$$,
  '55000', null, 'Analysis history cannot be deleted');
select throws_ok($$truncate public.radar_analyses cascade$$,
  '55000', null, 'Analysis history cannot be truncated');
select throws_ok($$insert into public.radar_analyses(token_id, version, status, score, data_as_of)
  values ('00000000-0000-4000-8000-000000000030', 2, 'EARLY', 'NaN', now())$$,
  '23514', null, 'Non-finite Radar score rejected');
select throws_ok($$insert into public.radar_analyses(token_id, version, status, data_as_of)
  values ('00000000-0000-4000-8000-000000000030', 2, 'EARLY', now() + interval '1 day')$$,
  '23514', null, 'Evidence freshness cannot be later than analysis time');
insert into public.radar_reviews(analysis_id)
values ('00000000-0000-4000-8000-000000000031');
select is((select state from public.radar_reviews limit 1), 'PENDING', 'Review defaults to pending');
select throws_ok($$update public.radar_reviews set state = 'PUBLISHED', published_at = now()$$,
  '23514', null, 'Publication requires human reviewer metadata');
select lives_ok($$update public.radar_reviews set state = 'PUBLISHED', published_at = now(),
  reviewed_at = now(), reviewed_by = '00000000-0000-4000-8000-000000000001', editorial_note = 'Fixture review'$$,
  'Reviewed publication state can be represented without changing analysis');
select is((select score from public.radar_analyses limit 1), 10::numeric,
  'Editorial review leaves analysis score unchanged');
insert into public.radar_analyses(id, token_id, version, status, data_as_of)
values ('00000000-0000-4000-8000-000000000032', '00000000-0000-4000-8000-000000000030', 2, 'EARLY', now());
select throws_ok($$update public.radar_reviews set analysis_id = '00000000-0000-4000-8000-000000000032'$$,
  '55000', null, 'Published review cannot be retargeted to an unreviewed analysis');

insert into public.audit_logs(actor_id, action, resource_type, resource_id)
values ('00000000-0000-4000-8000-000000000001', 'fixture.created', 'article', '00000000-0000-4000-8000-000000000010');
delete from public.articles where id = '00000000-0000-4000-8000-000000000010';
select is((select count(*)::integer from public.audit_logs), 1, 'Resource deletion preserves audit event');
select throws_ok($$update public.audit_logs set action = 'tamper'$$,
  '55000', null, 'Audit event cannot be edited');
select throws_ok($$delete from public.audit_logs$$,
  '55000', null, 'Audit event cannot be deleted');
select throws_ok($$truncate public.audit_logs$$,
  '55000', null, 'Audit events cannot be truncated');
select throws_ok($$delete from public.profiles where id = '00000000-0000-4000-8000-000000000001'$$,
  '23503', null, 'Referenced reviewer/actor profile cannot cascade away');

-- Baseline denial only; no role permission matrix or final RLS behavior suite.
set local role anon;
select throws_ok($$select * from public.articles$$, '42501', null, 'Anonymous direct read is denied');
reset role;
set local role authenticated;
select throws_ok($$insert into public.roles(key, name) values ('self_escalated', 'Self escalated')$$,
  '42501', null, 'Authenticated direct privilege mutation is denied');
reset role;
set local role service_role;
select throws_ok($$update public.radar_analyses set score = 99$$,
  '42501', null, 'RLS bypass role has no generic analytical write grant');
reset role;

select * from finish();
rollback;
