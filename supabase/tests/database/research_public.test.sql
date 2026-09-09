begin;
\ir ../fixtures/research.inc
select pg_temp.research_fixture(array[]::text[]);
insert into public.tokens(id,chain,contract_address,symbol,name) values
  ('10000000-0000-4000-8000-000000000203','eip155:1','0x3333333333333333333333333333333333333333',null,null);
insert into public.article_tokens(article_id,token_id,position)
  values('10000000-0000-4000-8000-000000000101','10000000-0000-4000-8000-000000000203',1);
set local role anon;
select results_eq($$select slug from public.read_public_research_page() order by slug$$,
  $$values ('fixture-published'),('fixture-related-published')$$,'Anon gets exactly eligible explicit publications');
select is((select count(*)::integer from public.read_public_research_article('fixture-draft')),0,'Draft detail denied');
select is((select count(*)::integer from public.read_public_research_article('fixture-scheduled')),0,'Future schedule denied');
select is((select count(*)::integer from public.read_public_research_article('fixture-due')),0,'Past-due schedule stays private');
select is((select count(*)::integer from public.read_public_research_article('fixture-archived')),0,'Archive denied');
select is((select count(*)::integer from public.read_public_research_article('fixture-future-published')),0,'Future publication denied');
select is((select count(*)::integer from public.read_public_research_article('nonexistent')),0,'Unknown slug has no record');
select is((select count(*)::integer from public.read_public_research_article('../fixture-published')),0,'Path traversal has no record');
select is((select author from public.read_public_research_article('fixture-published')),
  '{"display_name":"Other public author","title":null}'::jsonb,'Public author is explicit display-only overlay');
select is((select jsonb_array_length(sources) from public.read_public_research_article('fixture-published')),1,'Retired sources withheld');
select is((select related_research from public.read_public_research_article('fixture-published')),
  '[{"title":"related-published","slug":"fixture-related-published","category":"MARKET"}]'::jsonb,'Related draft/scheduled/due/archive targets independently filtered');
select is((select related_tokens from public.read_public_research_article('fixture-published')),
  '[{"symbol":"FIX","name":"Fixture","chain":"eip155:1","contract_address":"0x1111111111111111111111111111111111111111"},{"symbol":null,"name":null,"chain":"eip155:1","contract_address":"0x3333333333333333333333333333333333333333"}]'::jsonb,
  'Attached canonical token identity preserves nullable labels');
select ok((select row_to_json(p)::text !~ 'PRIVATE PROFILE|RETIRED SOURCE|HIDDEN|author_id|profile_id|revision|actor|body_markdown|created_at'
  from public.read_public_research_article('fixture-published') p),'DTO excludes private/security/legacy fields and unrelated values');
select is((select array_agg(k order by k) from public.read_public_research_article('fixture-published') p,
  lateral jsonb_object_keys(to_jsonb(p)) k),array['ai_assisted','author','body_blocks','category','classification','dek',
  'disclosure','id','key_facts','published_at','related_research','related_tokens','seo_description','seo_title','slug','sources','title','tldr','updated_at']::text[],
  'Detail DTO exact column contract');
select is((select count(*)::integer from public.read_public_research_page('ALTCOINS')),0,'Category filter is real');
select is((select count(*)::integer from public.read_public_research_page(null,null,1)),1,'Bounded page limit');
select is((select count(*)::integer from public.read_public_research_page(null,
  jsonb_build_object('id','10000000-0000-4000-8000-000000000109','published_at',now()-interval '2 days'),20)),1,'Keyset pagination tie uses ID');
select throws_ok($$select public.read_public_research_page(null,null,51)$$,'22023',null,'Oversized public page denied');
select throws_ok($$select public.read_public_research_page('UNKNOWN')$$,'22023',null,'Unknown category denied');
select throws_ok($$select public.read_public_research_page(null,'{"sql":"select *"}')$$,'22023',null,'Cursor cannot become a general query');
select throws_ok($$select * from public.articles$$,'42501',null,'Anon raw articles remain closed');
select throws_ok($$select * from public.research_authors$$,'42501',null,'Anon cannot enumerate bylines');
select throws_ok($$select * from public.article_sources$$,'42501',null,'Anon raw child data closed');
select throws_ok($$select * from public.profiles$$,'42501',null,'Private profiles closed');
select throws_ok($$select public.create_research_draft('{}')$$,'42501',null,'Anon mutation EXECUTE denied');
reset role;
update public.feature_flags set enabled=false where key='research_enabled';
set local role anon;
select is((select count(*)::integer from public.read_public_research_page()),0,'Research disablement suppresses public list');
select is((select count(*)::integer from public.read_public_research_article('fixture-published')),0,'Research disablement suppresses detail');
reset role;
update public.feature_flags set enabled=true where key in ('research_enabled','maintenance_mode');
set local role anon;
select is((select count(*)::integer from public.read_public_research_page()),0,'Maintenance suppresses publication');
reset role;
delete from public.feature_flags where key='maintenance_mode';
set local role anon;
select is((select count(*)::integer from public.read_public_research_page()),0,'Missing availability flag fails closed');
reset role;
select is((select status from public.articles where slug='fixture-due'),'SCHEDULED','Elapsed time never rewrote state');
select * from finish();
rollback;
