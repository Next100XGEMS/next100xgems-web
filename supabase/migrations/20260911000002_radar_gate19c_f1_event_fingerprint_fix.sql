begin;

-- Correct the qualified legacy-row lookup in the F1 event replay function.
-- This is kept as a separate additive migration so an already-applied local
-- development database can be repaired without rewriting migration history.
create or replace function public.radar_system_insert_event(
  p_event_key text,
  p_event_type text,
  p_token_id uuid,
  p_source_provider text,
  p_source_event_id text,
  p_payload_hash text,
  p_context jsonb,
  p_observed_at timestamptz
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  event_id uuid;
  existing_fingerprint text;
  canonical_fingerprint text;
  canonical_context jsonb := coalesce(p_context, '{}'::jsonb);
begin
  perform private.radar_pause_guard(true);
  canonical_fingerprint := encode(
    extensions.digest(
      convert_to(jsonb_build_object(
        'event_key_version', 'v1', 'event_key', p_event_key,
        'event_type', p_event_type, 'token_id', p_token_id,
        'source_provider', p_source_provider, 'source_event_id', p_source_event_id,
        'context', canonical_context
      )::text, 'UTF8'), 'sha256'
    ),
    'hex'
  );
  insert into public.radar_events(
    event_key, event_type, token_id, source_provider, source_event_id,
    payload_hash, canonical_fingerprint, context, observed_at
  ) values (
    p_event_key, p_event_type, p_token_id, p_source_provider, p_source_event_id,
    canonical_fingerprint, canonical_fingerprint, canonical_context, p_observed_at
  ) on conflict (event_key_version, event_key) do nothing
  returning id into event_id;
  if event_id is null then
    select e.id, coalesce(e.canonical_fingerprint, encode(
      extensions.digest(convert_to(jsonb_build_object(
        'event_key_version', e.event_key_version, 'event_key', e.event_key,
        'event_type', e.event_type, 'token_id', e.token_id,
        'source_provider', e.source_provider, 'source_event_id', e.source_event_id,
        'context', e.context
      )::text, 'UTF8'), 'sha256'), 'hex'
    ))
    into event_id, existing_fingerprint
    from public.radar_events e
    where e.event_key_version = 'v1' and e.event_key = p_event_key;
    if existing_fingerprint is distinct from canonical_fingerprint then
      raise exception 'event key conflicts with an existing canonical request' using errcode = '23505';
    end if;
  end if;
  return event_id;
end;
$$;
revoke all on function public.radar_system_insert_event(text, text, uuid, text, text, text, jsonb, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.radar_system_insert_event(text, text, uuid, text, text, text, jsonb, timestamptz)
  to service_role;

commit;
