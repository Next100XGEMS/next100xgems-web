begin;

alter table public.audit_logs
  add column actor_kind text;

update public.audit_logs
set actor_kind = case when actor_id is null then 'SYSTEM' else 'USER' end
where actor_kind is null;

alter table public.audit_logs
  alter column actor_kind set default 'USER',
  alter column actor_kind set not null;

alter table public.audit_logs
  add constraint audit_logs_actor_kind_check
  check (actor_kind in ('USER', 'SYSTEM')),
  add constraint audit_logs_actor_consistency_check
  check (
    (actor_kind = 'USER' and actor_id is not null)
    or (actor_kind = 'SYSTEM' and actor_id is null)
  );

create function public.write_audit_event(
  p_actor_kind text,
  p_actor_id uuid,
  p_action text,
  p_resource_type text,
  p_resource_id uuid,
  p_previous_state jsonb,
  p_resulting_state jsonb,
  p_metadata jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  audit_id uuid;
begin
  insert into public.audit_logs (
    actor_kind,
    actor_id,
    action,
    resource_type,
    resource_id,
    previous_state,
    resulting_state,
    metadata
  )
  values (
    p_actor_kind,
    p_actor_id,
    p_action,
    p_resource_type,
    p_resource_id,
    p_previous_state,
    p_resulting_state,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into audit_id;

  return audit_id;
end;
$$;

revoke all on function public.write_audit_event(text, uuid, text, text, uuid, jsonb, jsonb, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.write_audit_event(text, uuid, text, text, uuid, jsonb, jsonb, jsonb)
  to service_role;

commit;
