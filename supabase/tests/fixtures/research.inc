-- Included by each isolated .test.sql file. Never installed by migrations.
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
create function pg_temp.research_input(p_slug text) returns jsonb language sql as $$
  select jsonb_build_object('title','Research test fixture','slug',p_slug,'category','MARKET',
    'tldr','Synthetic test summary','disclosure','Synthetic independent research disclosure.',
    'body_blocks','{"version":1,"sections":[{"id":"context","heading":"Context","blocks":[{"type":"paragraph","text":"Synthetic test paragraph."}]}]}'::jsonb,
    'sources','[{"title":"Fixture source","publisher":"Test publisher","url":"https://example.test/source"}]'::jsonb);
$$;
create function pg_temp.research_fixture(p_roles text[],p_status text default 'ACTIVE') returns void language plpgsql as $$
begin
  insert into auth.users(id) values
    ('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002');
  insert into public.profiles(id,display_name,status) values
    ('10000000-0000-4000-8000-000000000001','PRIVATE PROFILE ONE',p_status),
    ('10000000-0000-4000-8000-000000000002','PRIVATE PROFILE TWO','ACTIVE');
  insert into public.user_roles(user_id,role_id)
    select '10000000-0000-4000-8000-000000000001',id from public.roles where key=any(p_roles);
  insert into public.research_authors(profile_id,display_name,title) values
    ('10000000-0000-4000-8000-000000000001','Public fixture author','Researcher'),
    ('10000000-0000-4000-8000-000000000002','Other public author',null);
  update public.feature_flags set enabled=(key='research_enabled') where key in ('research_enabled','maintenance_mode');
  insert into public.articles(id,title,slug,author_id,public_author_id,status,classification,category,tldr,disclosure,body_blocks,
    scheduled_at,published_at,published_revision)
  select ('10000000-0000-4000-8000-' || lpad(x.n::text,12,'0'))::uuid,x.label,'fixture-'||x.label,
    case when x.n in (107,108) then '10000000-0000-4000-8000-000000000001'::uuid else '10000000-0000-4000-8000-000000000002'::uuid end,
    case when x.n in (107,108) then '10000000-0000-4000-8000-000000000001'::uuid else '10000000-0000-4000-8000-000000000002'::uuid end,
    x.state,case when x.n=108 then 'SPONSORED' else 'EDITORIAL' end,'MARKET',
    'Test summary','Test disclosure',(pg_temp.research_input('unused')->'body_blocks'),
    case when x.n=103 then now()+interval '1 day' when x.n=104 then now()-interval '1 day' end,
    case when x.n=106 then now()+interval '1 day' when x.n in (101,105,109) then now()-interval '2 days' end,
    case when x.state='PUBLISHED' then 1 end
  from (values (101,'published','PUBLISHED'),(102,'draft','DRAFT'),(103,'scheduled','SCHEDULED'),
    (104,'due','SCHEDULED'),(105,'archived','ARCHIVED'),(106,'future-published','PUBLISHED'),
    (107,'own-draft','DRAFT'),(108,'own-paid','DRAFT'),(109,'related-published','PUBLISHED')) x(n,label,state);
  insert into public.article_sources(article_id,title,publisher,url,position)
    select id,'Source for '||slug,'Fixture publisher','https://example.test/source',0 from public.articles where slug like 'fixture-%';
  insert into public.article_sources(article_id,title,publisher,url,position,retired_at)
    values('10000000-0000-4000-8000-000000000101','RETIRED SOURCE','Test','https://example.test/retired',1,now());
  insert into public.article_related_research(article_id,related_article_id,position)
    select '10000000-0000-4000-8000-000000000101',id,row_number() over(order by id)-1
    from public.articles where id in ('10000000-0000-4000-8000-000000000102','10000000-0000-4000-8000-000000000103',
      '10000000-0000-4000-8000-000000000104','10000000-0000-4000-8000-000000000105','10000000-0000-4000-8000-000000000109');
  insert into public.tokens(id,chain,contract_address,symbol,name) values
    ('10000000-0000-4000-8000-000000000201','eip155:1','0x1111111111111111111111111111111111111111','FIX','Fixture'),
    ('10000000-0000-4000-8000-000000000202','eip155:1','0x2222222222222222222222222222222222222222','HIDDEN','Unreferenced');
  insert into public.article_tokens(article_id,token_id,position)
    values('10000000-0000-4000-8000-000000000101','10000000-0000-4000-8000-000000000201',0);
end;
$$;
