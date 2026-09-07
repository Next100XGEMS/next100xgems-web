begin;
\ir ../fixtures/research.inc
select pg_temp.research_fixture(array['owner']);
\ir ../fixtures/research-authenticate.inc
\ir ../fixtures/research-privileged.inc
select * from finish();
rollback;
