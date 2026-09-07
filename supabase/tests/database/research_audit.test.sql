begin;
\ir ../fixtures/research.inc
select pg_temp.research_fixture(array['owner']);
create temporary table checkpoint as select to_jsonb(a) as article,
  (select jsonb_agg(to_jsonb(s) order by s.id) from public.article_sources s where s.article_id=a.id) as sources
  from public.articles a where a.id='10000000-0000-4000-8000-000000000107';
create function pg_temp.fail_research_audit() returns trigger language plpgsql as $$
begin raise exception 'Injected required audit failure' using errcode='23514'; end;
$$;
create trigger test_research_audit_failure before insert on public.audit_logs
  for each row execute function pg_temp.fail_research_audit();
\ir ../fixtures/research-authenticate.inc
select throws_ok($$select public.create_research_draft(pg_temp.research_input('must-roll-back'))$$,'23514',null,'Create fails if required audit fails');
select throws_ok($$select public.save_research_draft('10000000-0000-4000-8000-000000000107',1,'{"title":"Partial write","sources":[{"title":"Changed source","publisher":"Test","url":"https://example.test/changed"}]}')$$,'23514',null,'Parent and child update fail atomically with audit');
select throws_ok($$select public.transition_research_article('10000000-0000-4000-8000-000000000107',1,'publish')$$,'23514',null,'Publication cannot succeed without audit');
select throws_ok($$select public.transition_research_article('10000000-0000-4000-8000-000000000107',1,'schedule',now()+interval '1 day')$$,'23514',null,'Schedule cannot succeed without audit');
select throws_ok($$select public.transition_research_article('10000000-0000-4000-8000-000000000107',1,'archive',null,'Reason')$$,'23514',null,'Archive cannot succeed without audit');
select throws_ok($$select public.change_research_classification('10000000-0000-4000-8000-000000000107',1,'PARTNER','Disclosure','Reason')$$,'23514',null,'Classification cannot succeed without audit');
select throws_ok($$select public.assign_research_author('10000000-0000-4000-8000-000000000107',1,'10000000-0000-4000-8000-000000000002','Reason')$$,'23514',null,'Attribution cannot succeed without audit');
select throws_ok($$select public.save_research_author('10000000-0000-4000-8000-000000000001','Partial byline')$$,'23514',null,'Byline cannot succeed without audit');
reset role;
select is((select to_jsonb(a) from public.articles a where id='10000000-0000-4000-8000-000000000107'),
  (select article from checkpoint),'All failed operations preserve exact article, revision and timestamps');
select is((select jsonb_agg(to_jsonb(s) order by s.id) from public.article_sources s where article_id='10000000-0000-4000-8000-000000000107'),
  (select sources from checkpoint),'Audit failure preserves exact source history');
select is((select count(*)::integer from public.articles where slug='must-roll-back'),0,'Failed creation leaves no article');
select is((select display_name from public.research_authors where profile_id='10000000-0000-4000-8000-000000000001'),'Public fixture author','Failed byline operation leaves no change');
select is((select count(*)::integer from public.audit_logs),0,'No fabricated success audit after rollback');
drop trigger test_research_audit_failure on public.audit_logs;
set local role authenticated;
select lives_ok($$select public.save_research_draft('10000000-0000-4000-8000-000000000107',1,'{"title":"Audited edit"}')$$,'Healthy audit path accepts write');
select lives_ok($$select public.transition_research_article('10000000-0000-4000-8000-000000000107',2,'publish')$$,'Publish with audit succeeds');
select lives_ok($$select public.transition_research_article('10000000-0000-4000-8000-000000000107',3,'archive',null,'Correct source')$$,'Withdraw before source correction');
select lives_ok($$select public.transition_research_article('10000000-0000-4000-8000-000000000107',4,'restore',null,'Review source')$$,'Restore withdrawn content');
select lives_ok($$select public.save_research_draft('10000000-0000-4000-8000-000000000107',5,
  jsonb_build_object('sources',jsonb_build_array(jsonb_build_object('id',
    (select id from public.article_sources where article_id='10000000-0000-4000-8000-000000000107' and retired_at is null),
    'title','Corrected source','publisher','Fixture publisher','url','https://example.test/corrected'))))$$,'Published source correction retires old identity');
select is((select count(*)::integer from public.article_sources where article_id='10000000-0000-4000-8000-000000000107'),2,'Historical source retained beside correction');
select lives_ok($$select public.transition_research_article('10000000-0000-4000-8000-000000000107',6,'publish')$$,'Corrected source republishes with fresh audit');
select is((select sources->0->>'title' from public.read_public_research_article('fixture-own-draft')),'Corrected source','Public source is corrected row only');
select is((select jsonb_array_length(sources) from public.read_public_research_article('fixture-own-draft')),1,'Historical source never public');
reset role;
select is((select count(*)::integer from public.audit_logs),6,'All six committed operations have exactly one audit event');
select ok(not exists(select 1 from public.audit_logs where actor_kind<>'USER' or actor_id<>'10000000-0000-4000-8000-000000000001'),'Exact verified subject in audit');
select ok(not exists(select 1 from public.audit_logs where coalesce(previous_state::text,'')||resulting_state::text||metadata::text
  ~ 'Synthetic test paragraph|https://|PRIVATE PROFILE|eyJ'),'Audit omits full body, source URLs and private account data');
select throws_ok($$delete from public.articles where slug='fixture-own-draft'$$,'23503',null,'Source/history references cannot cascade away even through infrastructure deletion');
select * from finish();
rollback;
