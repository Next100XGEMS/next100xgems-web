begin;
\ir ../fixtures/research.inc
select ok(not exists(select 1 from pg_roles where rolname='research_public_reader'),'No custom PostgreSQL reader role introduced');
select ok(c.relrowsecurity,'Research table has RLS: '||c.relname)
from pg_class c where c.oid in ('public.research_authors'::regclass,'public.article_sources'::regclass,
  'public.article_related_research'::regclass,'public.article_tokens'::regclass);
select ok(not has_table_privilege(r.name,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),
  r.name||': no Research DML/DDL grants on '||c.relname)
from pg_class c cross join (values('anon'),('authenticated'),('service_role')) r(name)
where c.oid in ('public.articles'::regclass,'public.research_authors'::regclass,'public.article_sources'::regclass,
  'public.article_related_research'::regclass,'public.article_tokens'::regclass);
select ok(not exists(select 1 from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
  and has_column_privilege(r.name,c.oid,a.attnum,'SELECT,INSERT,UPDATE')),
  r.name||': no hidden column grant on '||c.relname)
from pg_class c cross join (values('anon'),('service_role')) r(name)
where c.oid in ('public.articles'::regclass,'public.research_authors'::regclass,'public.article_sources'::regclass,
  'public.article_related_research'::regclass,'public.article_tokens'::regclass);
select ok(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private' and p.proname like 'research_%' and has_function_privilege(r.name,p.oid,'EXECUTE')),
  r.name||': internal Research functions are not callable')
from (values('anon'),('authenticated'),('service_role')) r(name);
select ok(p.prosecdef and pg_get_userbyid(p.proowner)='postgres' and p.proconfig @> array['search_path=""'],
  'Explicit trusted owner and empty search_path: '||p.proname)
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
  and p.proname in ('read_public_research_page','read_public_research_article','create_research_draft',
  'save_research_draft','transition_research_article','change_research_classification','assign_research_author',
  'save_research_author','research_token_options');
select ok(not has_function_privilege('anon',p.oid,'EXECUTE') and has_function_privilege('authenticated',p.oid,'EXECUTE')
  and not has_function_privilege('service_role',p.oid,'EXECUTE'),'Mutation/picker EXECUTE exact ACL: '||p.proname)
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
  and p.proname in ('create_research_draft','save_research_draft','transition_research_article',
  'change_research_classification','assign_research_author','save_research_author','research_token_options');
select ok(has_function_privilege('anon',p.oid,'EXECUTE') and has_function_privilege('authenticated',p.oid,'EXECUTE')
  and not has_function_privilege('service_role',p.oid,'EXECUTE'),'Public projection exact ACL: '||p.proname)
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
  and p.proname in ('read_public_research_page','read_public_research_article');
select ok(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace,
  lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
  where n.nspname in ('public','private') and p.proname like '%research%' and a.grantee=0),
  'No inherited PUBLIC EXECUTE on any Research function');
select ok(not exists(select 1 from pg_publication_tables where schemaname='public'
  and tablename in ('articles','research_authors','article_sources','article_related_research','article_tokens')),
  'Research is not accidentally published through Realtime');
select ok(not exists(select 1 from pg_policies where schemaname='public'
  and tablename in ('articles','research_authors','article_sources','article_related_research','article_tokens')
  and (cmd<>'SELECT' or roles<>array['authenticated']::name[])),'Research raw policies are staff SELECT only');
select * from finish();
rollback;
