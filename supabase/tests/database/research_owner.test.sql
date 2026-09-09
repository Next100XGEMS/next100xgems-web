begin;
\ir ../fixtures/research.inc
select pg_temp.research_fixture(array['owner']);
\ir ../fixtures/research-authenticate.inc
\ir ../fixtures/research-privileged.inc
select throws_ok($$select public.save_research_author('10000000-0000-4000-8000-000000000001',repeat('A',161),'Role')$$,'22023',null,'Byline display name cannot exceed the public 160-character boundary');
select throws_ok($$select public.save_research_author('10000000-0000-4000-8000-000000000001','Author',repeat('R',161))$$,'22023',null,'Byline title cannot exceed the public 160-character boundary');
select * from finish();
rollback;
