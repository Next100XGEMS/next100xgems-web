begin;
create extension if not exists pgtap with schema extensions; set local search_path = public, extensions; select no_plan();
insert into auth.users (id) values ('00000000-0000-4000-8000-000000001031'), ('00000000-0000-4000-8000-000000001032');
insert into public.profiles (id, display_name) values ('00000000-0000-4000-8000-000000001031', 'Analyst'), ('00000000-0000-4000-8000-000000001032', 'Editor author');
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-8000-000000001031', id from public.roles where key = 'analyst';
insert into public.research_authors(profile_id,display_name) values ('00000000-0000-4000-8000-000000001032','Editor author');
insert into public.articles (id, title, slug, author_id, status, published_at,category,public_author_id,published_revision) values
 ('00000000-0000-4000-8000-000000001033', 'Published', 'analyst-published', '00000000-0000-4000-8000-000000001032', 'PUBLISHED', now(),'MARKET','00000000-0000-4000-8000-000000001032',1),
 ('00000000-0000-4000-8000-000000001034', 'Own draft', 'analyst-draft', '00000000-0000-4000-8000-000000001031', 'DRAFT', null,null,null,null);
insert into public.tokens (id, chain, contract_address) values ('00000000-0000-4000-8000-000000001035', 'eip155:1', '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB');
insert into public.radar_analyses (id, token_id, version, status, score, data_as_of) values ('00000000-0000-4000-8000-000000001036', '00000000-0000-4000-8000-000000001035', 1, 'EARLY', 1, now());
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000001031","role":"authenticated"}', true); select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001031', true); set local role authenticated; select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000001031","role":"authenticated"}', true); select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001031', true); discard plans;
select is((select role_keys from public.get_my_authorization()), array['analyst']::text[], 'Analyst membership is live');
select is((select count(*)::integer from public.articles), 2, 'Analyst reads own draft and published research');
select is((select count(*)::integer from public.radar_analyses), 1, 'Analyst reads analysis');
select throws_ok($$insert into public.radar_analyses(token_id, version, status, score, data_as_of) values ('00000000-0000-4000-8000-000000001035', 2, 'EARLY', 99, now())$$, '42501', null, 'Analyst cannot fabricate analysis');
select * from finish(); rollback;
