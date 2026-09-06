begin;
create extension if not exists pgtap with schema extensions; set local search_path = public, extensions; select no_plan();
insert into auth.users (id) values ('00000000-0000-4000-8000-000000001083');
insert into public.profiles (id, display_name, status) values ('00000000-0000-4000-8000-000000001083', 'Suspended', 'SUSPENDED');
insert into public.user_roles (user_id, role_id) select '00000000-0000-4000-8000-000000001083', id from public.roles where key = 'owner';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000001083","role":"authenticated"}', true); select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001083', true); set local role authenticated; select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000001083","role":"authenticated"}', true); select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001083', true);
select is((select role_keys from public.get_my_authorization()), array[]::text[], 'Suspended profile fails closed');
select * from finish(); rollback;
