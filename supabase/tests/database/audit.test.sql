begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select ok(has_column_privilege('authenticated', 'public.audit_logs', 'actor_kind', 'SELECT') = false,
  'authenticated has no direct audit-log column access');
select ok(not has_table_privilege('anon', 'public.audit_logs', 'INSERT'),
  'anon cannot insert audit logs');
select ok(not has_table_privilege('authenticated', 'public.audit_logs', 'INSERT'),
  'authenticated cannot insert audit logs');
select ok(not has_table_privilege('authenticated', 'public.audit_logs', 'UPDATE'),
  'authenticated cannot update audit logs');
select ok(not has_table_privilege('authenticated', 'public.audit_logs', 'DELETE'),
  'authenticated cannot delete audit logs');
select ok(not has_table_privilege('service_role', 'public.audit_logs', 'INSERT'),
  'service_role cannot insert audit logs directly');
select ok(has_function_privilege(
  'service_role',
  'public.write_audit_event(text, uuid, text, text, uuid, jsonb, jsonb, jsonb)',
  'EXECUTE'
), 'service_role has only the narrow trusted audit writer path');
select ok(not has_function_privilege(
  'anon',
  'public.write_audit_event(text, uuid, text, text, uuid, jsonb, jsonb, jsonb)',
  'EXECUTE'
), 'anon cannot execute the trusted audit writer');
select ok(not has_function_privilege(
  'authenticated',
  'public.write_audit_event(text, uuid, text, text, uuid, jsonb, jsonb, jsonb)',
  'EXECUTE'
), 'authenticated cannot execute the trusted audit writer');

insert into auth.users (id) values ('00000000-0000-4000-8000-000000000101');
insert into public.profiles (id, display_name)
values ('00000000-0000-4000-8000-000000000101', 'Audit fixture');

set local role anon;
select throws_ok($$insert into public.audit_logs(actor_id, action, resource_type, resource_id)
  values ('00000000-0000-4000-8000-000000000101', 'forged.event', 'article', '00000000-0000-4000-8000-000000000102')$$,
  '42501', null, 'Anon cannot forge audit events');
reset role;

set local role authenticated;
select throws_ok($$insert into public.audit_logs(actor_id, action, resource_type, resource_id)
  values ('00000000-0000-4000-8000-000000000101', 'forged.event', 'article', '00000000-0000-4000-8000-000000000102')$$,
  '42501', null, 'Authenticated cannot forge audit events');
select throws_ok($$select * from public.audit_logs$$,
  '42501', null, 'Authenticated cannot read audit logs directly');
reset role;

set local role service_role;
select lives_ok($$select public.write_audit_event(
  'USER',
  '00000000-0000-4000-8000-000000000101',
  'article.updated',
  'article',
  '00000000-0000-4000-8000-000000000102',
  '{"status":"DRAFT"}'::jsonb,
  '{"status":"PUBLISHED"}'::jsonb,
  '{"source":"test"}'::jsonb
)$$, 'Trusted service-role writer can append an audit event');
select throws_ok($$insert into public.audit_logs(actor_id, action, resource_type, resource_id)
  values ('00000000-0000-4000-8000-000000000101', 'forged.event', 'article', '00000000-0000-4000-8000-000000000102')$$,
  '42501', null, 'Service role cannot bypass the direct table grant boundary');
select throws_ok($$update public.audit_logs set action = 'tampered'$$,
  '42501', null, 'Service role cannot update audit history directly');
select throws_ok($$delete from public.audit_logs$$,
  '42501', null, 'Service role cannot delete audit history directly');
reset role;

select is((select count(*)::integer from public.audit_logs), 1,
  'Trusted writer created exactly one audit event');
select is((select actor_kind from public.audit_logs limit 1), 'USER',
  'User audit event records explicit actor kind');
select throws_ok($$insert into public.audit_logs(actor_kind, actor_id, action, resource_type, resource_id)
  values ('SYSTEM', '00000000-0000-4000-8000-000000000101', 'invalid.system', 'article', '00000000-0000-4000-8000-000000000102')$$,
  '23514', null, 'System events cannot claim a user actor');

select * from finish();
rollback;
