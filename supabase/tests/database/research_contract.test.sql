begin;
\ir ../fixtures/research.inc
select pg_temp.research_fixture(array['owner']);
\ir ../fixtures/research-authenticate.inc

create function pg_temp.body_with_callout(p_label text) returns jsonb language sql as $$
  select jsonb_build_object('version',1,'sections',jsonb_build_array(jsonb_build_object(
    'id','context','heading','Context','blocks',jsonb_build_array(
      jsonb_build_object('type','paragraph','text','A paragraph.'),
      jsonb_build_object('type','callout','label',p_label,'text','A callout.')))));
$$;
create function pg_temp.body_with_section(p_id text) returns jsonb language sql as $$
  select jsonb_build_object('version',1,'sections',jsonb_build_array(jsonb_build_object(
    'id',p_id,'heading','Context','blocks',jsonb_build_array(
      jsonb_build_object('type','paragraph','text','A paragraph.')))));
$$;
create function pg_temp.input_with(p_slug text, p_body jsonb, p_facts jsonb default null) returns jsonb language sql as $$
  select pg_temp.research_input(p_slug) || jsonb_build_object('body_blocks',p_body)
    || case when p_facts is null then '{}'::jsonb else jsonb_build_object('key_facts',p_facts) end;
$$;

select lives_ok(format('select public.create_research_draft(%L::jsonb)',
  pg_temp.research_input('contract-source-exact') || jsonb_build_object('sources',jsonb_build_array(
    jsonb_build_object('title',repeat('T',240),'publisher',repeat('P',160),'url','https://example.test/source')))),
  'Exact source title/publisher boundaries are accepted');
select lives_ok($$select public.transition_research_article((select id from public.articles where slug='contract-source-exact'),1,'publish')$$,
  'Exact source boundaries publish successfully');
select throws_ok(format('select public.create_research_draft(%L::jsonb)',
  pg_temp.research_input('contract-source-title-space') || jsonb_build_object('sources',jsonb_build_array(
    jsonb_build_object('title',repeat('T',240)||' ','publisher','Publisher','url','https://example.test/source')))),
  '22023',null,'Raw source title overlength is rejected');
select throws_ok(format('select public.create_research_draft(%L::jsonb)',
  pg_temp.research_input('contract-publisher-space') || jsonb_build_object('sources',jsonb_build_array(
    jsonb_build_object('title','Source','publisher',repeat('P',160)||' ','url','https://example.test/source')))),
  '22023',null,'Raw source publisher overlength is rejected');

select lives_ok(format('select public.create_research_draft(%L::jsonb)',
  pg_temp.input_with('contract-callout-exact',pg_temp.body_with_callout(repeat('L',120)))),
  'Exact callout label boundary is accepted');
select throws_ok(format('select public.create_research_draft(%L::jsonb)',
  pg_temp.input_with('contract-callout-space',pg_temp.body_with_callout(repeat('L',120)||' '))),
  '22023',null,'Raw callout label overlength is rejected');
select throws_ok(format('select public.create_research_draft(%L::jsonb)',
  pg_temp.input_with('contract-callout-tab',pg_temp.body_with_callout(E'\t'))),
  '22023',null,'Tab-only callout label is rejected');
select throws_ok(format('select public.create_research_draft(%L::jsonb)',
  pg_temp.input_with('contract-blank-id',pg_temp.body_with_section(' '))),
  '22023',null,'Whitespace-only section ID is rejected');
select lives_ok(format('select public.create_research_draft(%L::jsonb)',
  pg_temp.input_with('contract-callout-unicode',pg_temp.body_with_callout(repeat('😀',120)))),
  '120 Unicode code-point callout label is accepted');
select throws_ok(format('select public.create_research_draft(%L::jsonb)',
  pg_temp.input_with('contract-callout-unicode-over',pg_temp.body_with_callout(repeat('😀',121)))),
  '22023',null,'121 Unicode code-point callout label is rejected');

select lives_ok(format('select public.create_research_draft(%L::jsonb)',
  pg_temp.input_with('contract-fact-exact',pg_temp.body_with_section('facts'),jsonb_build_array(
    jsonb_build_object('label','Fact','detail',repeat('D',1000),'evidence','UNKNOWN')))),
  'Exact Key Fact detail boundary is accepted');
select throws_ok(format('select public.create_research_draft(%L::jsonb)',
  pg_temp.input_with('contract-fact-space',pg_temp.body_with_section('fact-space'),jsonb_build_array(
    jsonb_build_object('label','Fact','detail',repeat('D',1000)||' ','evidence','UNKNOWN')))),
  '22023',null,'Raw Key Fact detail overlength is rejected');

reset role;
insert into auth.users(id) values ('10000000-0000-4000-8000-000000000003');
insert into public.profiles(id,display_name,status) values ('10000000-0000-4000-8000-000000000003','Byline boundary profile','ACTIVE');
set local role authenticated;
select lives_ok($$select public.save_research_author('10000000-0000-4000-8000-000000000003',repeat('A',160),repeat('R',160))$$,
  'Exact public byline ASCII boundaries are accepted');
select throws_ok($$select public.save_research_author('10000000-0000-4000-8000-000000000003',repeat('A',160)||' ','Role')$$,
  '22023',null,'Raw public byline name overlength is rejected');
select throws_ok($$select public.save_research_author('10000000-0000-4000-8000-000000000003','Author',repeat('R',160)||' ')$$,
  '22023',null,'Raw public byline title overlength is rejected');
select lives_ok($$select public.save_research_author('10000000-0000-4000-8000-000000000003',repeat('😀',160),repeat('😀',160))$$,
  'Exact public byline Unicode boundaries are accepted');
select throws_ok($$select public.save_research_author('10000000-0000-4000-8000-000000000003',repeat('😀',161),'Role')$$,
  '22023',null,'161 Unicode code-point public byline is rejected');

select * from finish();
rollback;
