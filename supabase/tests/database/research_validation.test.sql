begin;
\ir ../fixtures/research.inc
select pg_temp.research_fixture(array['editor']);
\ir ../fixtures/research-authenticate.inc
select throws_ok(format('select public.create_research_draft(%L::jsonb)',pg_temp.research_input(slug)),
  '23514',null,'Unsafe slug denied: '||slug)
from (values(''),('../escape'),('a/b'),('a%2fb'),('Uppercase'),('a?b'),('a#b'),('a b'),('a--b'),(repeat('x',161))) s(slug);
select throws_ok($$select public.create_research_draft(pg_temp.research_input('fixture-draft'))$$,'23505',null,'Slug collision across existing drafts denied');
select throws_ok(format('select public.create_research_draft(%L::jsonb)',
  pg_temp.research_input('bad-source')||jsonb_build_object('sources',jsonb_build_array(jsonb_build_object('title','Test','publisher','Test','url',url)))),
  '22023',null,'Unsafe source denied: '||url)
from (values('javascript:alert(1)'),('data:text/html,hello'),('file:///etc/passwd'),('//example.test/x'),
  ('https://user:pass@example.test'),('https:///empty'),('https://example.test:99999'),('https://example.test:'),
  ('https://example.test/%0a'),(E'https://example.test\\evil'),('https://bad_host.test'),('https://example.test/%xx')) u(url);
select lives_ok($$select public.create_research_draft(pg_temp.research_input('https-valid')||'{"sources":[{"title":"HTTPS","publisher":"Test","url":"https://docs.example.test:8443/a?b=1#c"},{"title":"HTTP","publisher":"Test","url":"http://example.test/a"}]}')$$,'Supported absolute HTTP(S) sources accepted');
select throws_ok(format('select public.create_research_draft(%L::jsonb)', pg_temp.research_input('source-title-too-long') || jsonb_build_object('sources', jsonb_build_array(jsonb_build_object('title', repeat('T',241), 'publisher','Test','url','https://example.test/source')))), '22023', null, 'Source title cannot exceed the public 240-character boundary');
select throws_ok(format('select public.create_research_draft(%L::jsonb)', pg_temp.research_input('source-publisher-too-long') || jsonb_build_object('sources', jsonb_build_array(jsonb_build_object('title','Test','publisher',repeat('P',161),'url','https://example.test/source')))), '22023', null, 'Source publisher cannot exceed the public 160-character boundary');
select throws_ok($$select public.save_research_draft('10000000-0000-4000-8000-000000000107',1,'{"body_blocks":{"version":1,"sections":[{"id":"duplicate","heading":"One","blocks":[{"type":"paragraph","text":"A"}]},{"id":"duplicate","heading":"Two","blocks":[{"type":"paragraph","text":"B"}]}]}}')$$,'22023',null,'Duplicate section IDs denied at the database boundary');
select throws_ok($$select public.save_research_draft('10000000-0000-4000-8000-000000000107',1,'{"body_blocks":{"version":1,"sections":[{"id":"callout","heading":"Callout","blocks":[{"type":"callout","text":"Missing label"}]}]}}')$$,'22023',null,'Callouts require a public label at the database boundary');
select throws_ok($$select public.save_research_draft('10000000-0000-4000-8000-000000000107',1,'{"actor_id":"10000000-0000-4000-8000-000000000002"}')$$,'22023',null,'Actor spoofing field denied');
select throws_ok($$select public.save_research_draft('10000000-0000-4000-8000-000000000107',1,'{"status":"PUBLISHED","published_at":"2020-01-01"}')$$,'22023',null,'State and time spoofing denied');
select throws_ok($$select public.save_research_draft('10000000-0000-4000-8000-000000000107',1,'{"classification":"SPONSORED"}')$$,'22023',null,'Ordinary save cannot mutate classification');
select throws_ok($$select public.save_research_draft('10000000-0000-4000-8000-000000000107',1,'{"ai_assisted":"false"}')$$,'22023',null,'AI string coercion denied');
select throws_ok($$select public.save_research_draft('10000000-0000-4000-8000-000000000107',1,'{"body_blocks":[]}')$$,'22023',null,'Invalid body container denied');
select throws_ok($$select public.save_research_draft('10000000-0000-4000-8000-000000000107',1,'{"body_blocks":{"version":1,"sections":[{"id":"x","heading":"X","blocks":[{"type":"html","text":"<script>alert(1)</script>"}]}]}}')$$,'22023',null,'Executable HTML block feature denied');
select throws_ok($$select public.save_research_draft('10000000-0000-4000-8000-000000000107',1,'{"key_facts":{}}')$$,'22023',null,'Invalid Key Facts container denied');
select throws_ok($$select public.save_research_draft('10000000-0000-4000-8000-000000000107',1,'{"key_facts":[{"label":"x","detail":"y","evidence":"GUARANTEED"}]}')$$,'22023',null,'Unknown evidence state denied');
select throws_ok($$select public.save_research_draft('10000000-0000-4000-8000-000000000107',1,'{"related_research":["10000000-0000-4000-8000-000000000107"]}')$$,'22023',null,'Self-related article denied');
select throws_ok($$select public.save_research_draft('10000000-0000-4000-8000-000000000107',1,'{"related_research":["10000000-0000-4000-8000-000000000109","10000000-0000-4000-8000-000000000109"]}')$$,'23505',null,'Duplicate article relationship denied');
select throws_ok($$select public.save_research_draft('10000000-0000-4000-8000-000000000107',1,'{"related_tokens":["10000000-0000-4000-8000-000000000999"]}')$$,'22023',null,'Missing canonical token denied without upsert');
select throws_ok($$select public.save_research_draft('10000000-0000-4000-8000-000000000107',1,'{"related_tokens":["10000000-0000-4000-8000-000000000201","10000000-0000-4000-8000-000000000201"]}')$$,'23505',null,'Duplicate token relationship denied');
select lives_ok($$select public.save_research_draft('10000000-0000-4000-8000-000000000107',1,'{"related_research":["10000000-0000-4000-8000-000000000102"],"related_tokens":["10000000-0000-4000-8000-000000000201"],"key_facts":[{"label":"Observation","detail":"Test value","evidence":"UNKNOWN"}],"ai_assisted":true}')$$,'Permitted draft references and independent AI/facts save');
select throws_ok($$select public.transition_research_article('10000000-0000-4000-8000-000000000107',2,'publish')$$,'23514',null,'Unpublished related target blocks publication');
select throws_ok($$select public.save_research_draft('10000000-0000-4000-8000-000000000107',2,'{"ai_assisted":false}')$$,'22023',null,'AI removal requires explanation');
select lives_ok($$select public.save_research_draft('10000000-0000-4000-8000-000000000107',2,'{"ai_assisted":false,"reason":"Incorrect draft indicator","related_research":[]}')$$,'Audited AI correction retains primary classification');
select is((select classification from public.articles where slug='fixture-own-draft'),'EDITORIAL','AI flag is not primary classification');
select lives_ok($$select public.create_research_draft('{"title":"Incomplete","slug":"incomplete"}')$$,'Incomplete draft can be saved');
select throws_ok($$select public.transition_research_article((select id from public.articles where slug='incomplete'),1,'publish')$$,'23514',null,'Incomplete draft cannot publish');
select throws_ok($$select public.transition_research_article((select id from public.articles where slug='incomplete'),1,'schedule',now()+interval '1 day')$$,'23514',null,'Incomplete draft cannot schedule');
select throws_ok($$select public.create_research_draft(pg_temp.research_input('undisclosed')||'{"classification":"PARTNER","disclosure":null}')$$,'23514',null,'Paid draft requires disclosure');
select is((select count(*)::integer from public.article_related_research where article_id='10000000-0000-4000-8000-000000000107'),0,'Invalid reference attempts and later removal do not leave hidden relationships');
reset role;
select throws_ok($$insert into public.article_tokens(article_id,token_id,position) values('10000000-0000-4000-8000-000000000107','10000000-0000-4000-8000-000000000999',1)$$,'23503',null,'Canonical token FK independently enforced');
select throws_ok($$update public.articles set published_revision=null where slug='fixture-published'$$,'23514',null,'Published revision cannot be absent');
select throws_ok($$update public.articles set published_revision=revision+1 where slug='fixture-published'$$,'23514',null,'Stale publication marker rejected');
select throws_ok($$update public.articles set scheduled_at='infinity' where slug='fixture-due'$$,'23514',null,'Non-finite scheduled time rejected');
select * from finish();
rollback;
