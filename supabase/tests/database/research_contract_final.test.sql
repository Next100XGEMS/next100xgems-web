begin;
\ir ../fixtures/research.inc
select pg_temp.research_fixture(array['owner']);
\ir ../fixtures/research-authenticate.inc

create function pg_temp.source_input(p_slug text, p_url text, p_date text default null) returns jsonb language sql as $$
  select pg_temp.research_input(p_slug) || jsonb_build_object('sources', jsonb_build_array(
    jsonb_build_object('title','Source','publisher','Publisher','url',p_url)
    || case when p_date is null then '{}'::jsonb else jsonb_build_object('published_on',p_date) end));
$$;
create function pg_temp.callout_input(p_slug text, p_label text) returns jsonb language sql as $$
  select pg_temp.research_input(p_slug) || jsonb_build_object('body_blocks', jsonb_build_object(
    'version',1,'sections',jsonb_build_array(jsonb_build_object('id','context','heading','Context',
      'blocks',jsonb_build_array(jsonb_build_object('type','callout','label',p_label,'text','Text'))))));
$$;

select lives_ok(format('select public.create_research_draft(%L::jsonb)', pg_temp.research_input('contract-title-valid')),
  'Valid title creates through the direct RPC');
select lives_ok(format('select public.create_research_draft(%L::jsonb)', pg_temp.source_input('contract-url-dns','https://example.com/source')),
  'DNS source URL is accepted');
select lives_ok(format('select public.create_research_draft(%L::jsonb)', pg_temp.source_input('contract-url-ip','https://127.0.0.1/source')),
  'IPv4 source URL is accepted');
select lives_ok(format('select public.create_research_draft(%L::jsonb)', pg_temp.source_input('contract-date-low','https://example.com/source','0001-01-01')),
  'Lower source date boundary is accepted');
select lives_ok(format('select public.create_research_draft(%L::jsonb)', pg_temp.source_input('contract-date-high','https://example.com/source','9999-12-31')),
  'Upper source date boundary is accepted');

select throws_ok(format('select public.create_research_draft(%L::jsonb)', pg_temp.research_input('contract-title-whitespace-'||codepoint) || jsonb_build_object('title',chr(codepoint))),
  '22023', null, 'Canonical whitespace-only title is rejected by the direct RPC')
from unnest(array[9,10,11,12,13,32,160,5760,8192,8199,8201,8232,8233,8239,8287,12288,65279]) codepoint;
select throws_ok(format('select public.create_research_draft(%L::jsonb)', pg_temp.callout_input('contract-callout-whitespace-'||codepoint,chr(codepoint))),
  '22023', null, 'Canonical whitespace-only callout label is rejected by the direct RPC')
from unnest(array[9,10,11,12,13,32,160,5760,8192,8199,8201,8232,8233,8239,8287,12288,65279]) codepoint;
select throws_ok(format('select public.create_research_draft(%L::jsonb)', pg_temp.research_input('contract-id-whitespace-'||codepoint) || jsonb_build_object(
  'body_blocks',jsonb_build_object('version',1,'sections',jsonb_build_array(jsonb_build_object('id',chr(codepoint),'heading','Context','blocks',jsonb_build_array(jsonb_build_object('type','paragraph','text','Text'))))))),
  '22023', null, 'Canonical whitespace-only section ID is rejected by the direct RPC')
from unnest(array[9,10,11,12,13,32,160,5760,8192,8199,8201,8232,8233,8239,8287,12288,65279]) codepoint;
select throws_ok(format('select public.create_research_draft(%L::jsonb)', pg_temp.research_input('contract-title-mixed') || jsonb_build_object('title',chr(32)||chr(8239)||chr(65279))),
  '22023', null, 'Mixed canonical Unicode whitespace title is rejected by the direct RPC');

select lives_ok(format('select public.create_research_draft(%L::jsonb)', pg_temp.source_input('contract-url-valid-http','http://example.com/source')),
  'HTTP DNS source URL is accepted');
select lives_ok(format('select public.create_research_draft(%L::jsonb)', pg_temp.source_input('contract-url-valid-query','https://sub.example.com/a?b=c#d')),
  'DNS source URL with query and fragment is accepted');
select lives_ok(format('select public.create_research_draft(%L::jsonb)', pg_temp.source_input('contract-url-valid-private','https://192.168.1.10/source')),
  'Private IPv4 source URL is accepted');
select throws_ok(format('select public.create_research_draft(%L::jsonb)', pg_temp.source_input('contract-url-bad-ip','https://999.999.999.999/source')),
  '22023', null, 'Out-of-range numeric host is rejected by the direct RPC');
select throws_ok(format('select public.create_research_draft(%L::jsonb)', pg_temp.source_input('contract-url-bad-ip-2','https://256.1.1.1/source')),
  '22023', null, 'Second out-of-range numeric host is rejected by the direct RPC');
select throws_ok(format('select public.create_research_draft(%L::jsonb)', pg_temp.source_input('contract-url-bad-dns','https://example..com/path')),
  '22023', null, 'Malformed DNS host is rejected by the direct RPC');
select throws_ok(format('select public.create_research_draft(%L::jsonb)', pg_temp.source_input('contract-url-userinfo','https://user:pass@example.com/source')),
  '22023', null, 'URL userinfo is rejected by the direct RPC');
select throws_ok(format('select public.create_research_draft(%L::jsonb)', pg_temp.source_input('contract-url-javascript','javascript:alert(1)')),
  '22023', null, 'javascript URL is rejected by the direct RPC');
select throws_ok(format('select public.create_research_draft(%L::jsonb)', pg_temp.source_input('contract-url-data','data:text/html,test')),
  '22023', null, 'data URL is rejected by the direct RPC');
select throws_ok(format('select public.create_research_draft(%L::jsonb)', pg_temp.source_input('contract-url-file','file:///tmp/test')),
  '22023', null, 'file URL is rejected by the direct RPC');
select throws_ok(format('select public.create_research_draft(%L::jsonb)', pg_temp.source_input('contract-url-relative','//example.com/path')),
  '22023', null, 'Protocol-relative URL is rejected by the direct RPC');
select throws_ok(format('select public.create_research_draft(%L::jsonb)', pg_temp.source_input('contract-url-empty','https://')),
  '22023', null, 'Empty-host URL is rejected by the direct RPC');
select throws_ok(format('select public.create_research_draft(%L::jsonb)', pg_temp.source_input('contract-date-bc','https://example.com/source','0001-01-01 BC')),
  '22023', null, 'BC source date is rejected by the direct RPC');
select throws_ok(format('select public.create_research_draft(%L::jsonb)', pg_temp.source_input('contract-date-invalid','https://example.com/source','2026-02-30')),
  '22023', null, 'Malformed source date is rejected by the direct RPC');
select throws_ok(format('select public.create_research_draft(%L::jsonb)', pg_temp.source_input('contract-date-out-of-range','https://example.com/source','10000-01-01')),
  '22023', null, 'Out-of-contract source date is rejected by the direct RPC');

select * from finish();
rollback;
