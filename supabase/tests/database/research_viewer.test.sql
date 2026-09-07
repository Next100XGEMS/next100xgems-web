begin;
\ir ../fixtures/research.inc
select pg_temp.research_fixture(array['viewer']::text[],'ACTIVE');
\ir ../fixtures/research-authenticate.inc
select throws_ok($$select public.create_research_draft(pg_temp.research_input('denied-create'))$$,'42501',null,'viewer: create denied despite forged metadata role');
select throws_ok($$select public.save_research_draft('10000000-0000-4000-8000-000000000107',1,'{"title":"Unauthorized"}')$$,'42501',null,'viewer: save denied');
select throws_ok($$select public.transition_research_article('10000000-0000-4000-8000-000000000107',1,'publish')$$,'42501',null,'viewer: publish denied');
select throws_ok($$select public.transition_research_article('10000000-0000-4000-8000-000000000107',1,'schedule',now()+interval '1 day')$$,'42501',null,'viewer: schedule denied');
select throws_ok($$select public.transition_research_article('10000000-0000-4000-8000-000000000107',1,'archive',null,'Reason')$$,'42501',null,'viewer: archive denied');
select throws_ok($$select public.change_research_classification('10000000-0000-4000-8000-000000000107',1,'SPONSORED','Disclosure','Reason')$$,'42501',null,'viewer: classification escalation denied');
select throws_ok($$select public.assign_research_author('10000000-0000-4000-8000-000000000107',1,'10000000-0000-4000-8000-000000000002','Reason')$$,'42501',null,'viewer: author reassignment denied');
select throws_ok($$select public.save_research_author('10000000-0000-4000-8000-000000000001','Forged public name')$$,'42501',null,'viewer: public byline write denied');
select throws_ok($$delete from public.articles$$,'42501',null,'viewer: hard delete denied');
select throws_ok($$update public.article_sources set url='https://example.test/tamper'$$,'42501',null,'viewer: direct child write denied');
select is((select count(*)::integer from public.articles where status<>'PUBLISHED'),0,'viewer: unpublished raw content denied');
select is((select count(*)::integer from public.read_public_research_page()),2,'viewer: intentional public DTO is not a private privilege');
reset role;
select is((select title from public.articles where id='10000000-0000-4000-8000-000000000107'),'own-draft','viewer: denied mutations left content unchanged');
select is((select count(*)::integer from public.audit_logs),0,'viewer: no false success audit');
select * from finish();
rollback;

