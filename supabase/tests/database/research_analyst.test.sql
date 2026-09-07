begin;
\ir ../fixtures/research.inc
select pg_temp.research_fixture(array['analyst']);
insert into public.articles(id,title,slug) values
  ('10000000-0000-4000-8000-000000000111','Unassigned legacy draft','unassigned-legacy');
\ir ../fixtures/research-authenticate.inc
select is((select count(*)::integer from public.articles where slug='unassigned-legacy'),0,'Analyst cannot read an unassigned legacy draft');
select throws_ok($$select public.save_research_draft('10000000-0000-4000-8000-000000000111',1,'{"title":"Claim unassigned"}')$$,'42501',null,'NULL ownership must explicitly deny an Analyst write');
select lives_ok($$select public.create_research_draft(pg_temp.research_input('analyst-created'))$$,'Analyst creates own Editorial draft');
select is((select author_id from public.articles where slug='analyst-created'),'10000000-0000-4000-8000-000000000001'::uuid,'Analyst ownership is derived');
select lives_ok($$select public.save_research_draft('10000000-0000-4000-8000-000000000107',1,'{"title":"Own changed"}')$$,'Analyst edits own Editorial draft');
select is((select revision from public.articles where slug='fixture-own-draft'),2::bigint,'Successful edit increments revision');
select throws_ok($$select public.save_research_draft('10000000-0000-4000-8000-000000000102',1,'{"title":"Stolen"}')$$,'42501',null,'Another author draft denied');
select is((select count(*)::integer from public.articles where slug='fixture-own-paid'),1,'Gate 6 own paid draft read preserved');
select throws_ok($$select public.save_research_draft('10000000-0000-4000-8000-000000000108',1,'{"title":"Paid changed"}')$$,'42501',null,'Own paid draft mutation denied');
select throws_ok($$select public.create_research_draft(pg_temp.research_input('analyst-paid')||'{"classification":"SPONSORED"}')$$,'42501',null,'Analyst cannot create paid content');
select throws_ok($$select public.create_research_draft(pg_temp.research_input('forged-author')||'{"author_id":"10000000-0000-4000-8000-000000000002"}')$$,'42501',null,'Analyst cannot impersonate another author');
select throws_ok($$select public.change_research_classification('10000000-0000-4000-8000-000000000107',2,'SPONSORED','Disclosure','Reason')$$,'42501',null,'Analyst classification escalation denied');
select throws_ok($$select public.assign_research_author('10000000-0000-4000-8000-000000000107',2,'10000000-0000-4000-8000-000000000002','Reason')$$,'42501',null,'Analyst author reassignment denied');
select throws_ok($$select public.transition_research_article('10000000-0000-4000-8000-000000000107',2,'publish')$$,'42501',null,'Analyst publish denied');
select throws_ok($$select public.transition_research_article('10000000-0000-4000-8000-000000000107',2,'schedule',now()+interval '1 day')$$,'42501',null,'Analyst schedule denied');
select throws_ok($$select public.transition_research_article('10000000-0000-4000-8000-000000000107',2,'archive',null,'Reason')$$,'42501',null,'Analyst archive denied');
select throws_ok($$select public.save_research_draft('10000000-0000-4000-8000-000000000107',1,'{"title":"Stale"}')$$,'40001',null,'Stale writer denied');
select throws_ok($$select public.save_research_draft('10000000-0000-4000-8000-000000000107',2,'{"related_research":["10000000-0000-4000-8000-000000000102"]}')$$,'22023',null,'Analyst hidden-target relationship denied');
select throws_ok($$delete from public.articles$$,'42501',null,'Analyst hard delete denied');
reset role;
select is((select title from public.articles where slug='unassigned-legacy'),'Unassigned legacy draft','Unassigned draft unchanged after denied mutation');
select is((select count(*)::integer from public.audit_logs),2,'Both successful Analyst operations audited, denied operations not');
select ok(not exists(select 1 from public.audit_logs where actor_id<>'10000000-0000-4000-8000-000000000001'),'Actor derived from subject, not forged owner metadata');
select * from finish();
rollback;
