begin;
create extension if not exists pgtap with schema extensions; set local search_path = public, extensions; select no_plan();
insert into auth.users (id) values ('00000000-0000-4000-8000-000000001082');
insert into public.profiles (id, display_name) values ('00000000-0000-4000-8000-000000001082', 'Conflicting Editor');
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-8000-000000001082', id from public.roles where key in ('ad_manager', 'editor');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000001082","role":"authenticated"}', true); select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001082', true); set local role authenticated; select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000001082","role":"authenticated"}', true); select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001082', true);
select is((select role_keys from public.get_my_authorization()), array[]::text[], 'Ad Manager plus Editor fails closed');
select * from finish(); rollback;
