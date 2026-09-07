begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
insert into auth.users (id) values ('00000000-0000-4000-8000-000000001021');
insert into public.profiles (id, display_name) values ('00000000-0000-4000-8000-000000001021', 'Viewer');
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-8000-000000001021', id from public.roles where key = 'viewer';
insert into public.research_authors(profile_id,display_name) values ('00000000-0000-4000-8000-000000001021','Viewer fixture byline');
insert into public.articles (id, title, slug, author_id, status, scheduled_at, published_at,category,public_author_id,published_revision)
values ('00000000-0000-4000-8000-000000001022', 'Published', 'viewer-published', '00000000-0000-4000-8000-000000001021', 'PUBLISHED', null, now(),'MARKET','00000000-0000-4000-8000-000000001021',1), ('00000000-0000-4000-8000-000000001023', 'Future', 'viewer-future', '00000000-0000-4000-8000-000000001021', 'SCHEDULED', now() + interval '1 day', null,'MARKET','00000000-0000-4000-8000-000000001021',null);
insert into public.partners (id, name, slug, active, disclosure, starts_at, ends_at)
values ('00000000-0000-4000-8000-000000001024', 'Active', 'viewer-active', true, 'Disclosure', now() - interval '1 day', now() + interval '1 day'), ('00000000-0000-4000-8000-000000001025', 'Future', 'viewer-future-partner', true, 'Disclosure', now() + interval '1 day', null);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000001021","role":"authenticated"}', true); select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001021', true); set local role authenticated; select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000001021","role":"authenticated"}', true); select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001021', true); discard plans;
select is((select role_keys from public.get_my_authorization()), array['viewer']::text[], 'Viewer membership is live');
select is((select count(*)::integer from public.articles), 1, 'Viewer reads eligible published articles');
select is((select count(*)::integer from public.partners), 1, 'Viewer reads active partners');
select throws_ok($$update public.articles set title = 'tampered'$$, '42501', null, 'Viewer cannot write articles');
select throws_ok($$delete from public.user_roles$$, '42501', null, 'Viewer cannot mutate role assignments');
select * from finish(); rollback;
