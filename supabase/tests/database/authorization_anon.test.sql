begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
insert into auth.users (id) values ('00000000-0000-4000-8000-000000001001');
insert into public.profiles (id, display_name) values ('00000000-0000-4000-8000-000000001001', 'Published author');
insert into public.research_authors(profile_id,display_name) values ('00000000-0000-4000-8000-000000001001','Published author');
insert into public.articles (id, title, slug, author_id, status, published_at,category,public_author_id,published_revision)
values ('00000000-0000-4000-8000-000000001002', 'Published', 'anon-published', '00000000-0000-4000-8000-000000001001', 'PUBLISHED', now(),'MARKET','00000000-0000-4000-8000-000000001001',1);
insert into public.tokens (id, chain, contract_address)
values ('00000000-0000-4000-8000-000000001003', 'eip155:1', '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
insert into public.radar_analyses (id, token_id, version, status, score, data_as_of)
values ('00000000-0000-4000-8000-000000001004', '00000000-0000-4000-8000-000000001003', 1, 'EARLY', 1, now());
insert into public.leads (id, project_name, contact_name, contact_method, contact_value, interested_service)
values ('00000000-0000-4000-8000-000000001005', 'Anon lead', 'Contact', 'EMAIL', 'anon@example.test', 'Research');
set local role anon;
select throws_ok($$select * from public.articles$$, '42501', null, 'Anon cannot read published articles');
select throws_ok($$select * from public.radar_analyses$$, '42501', null, 'Anon cannot read unpublished Radar');
select throws_ok($$select * from public.leads$$, '42501', null, 'Anon cannot read leads');
select throws_ok($$select * from public.audit_logs$$, '42501', null, 'Anon cannot read audit logs');
select throws_ok($$select * from public.get_my_authorization()$$, '42501', null, 'Anon cannot execute authorization RPC');
select * from finish();
rollback;
