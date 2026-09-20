begin;

-- Universal Token Analyzer is private, additive, and disabled by default.
-- No table below is exposed to browser roles; named server operations own all
-- writes and reads after application authorization.
insert into public.feature_flags (key, enabled)
values ('token_analyzer_enabled', false), ('token_analyzer_public_enabled', false)
on conflict (key) do nothing;

create table public.analyzer_config (
  id uuid primary key default gen_random_uuid(),
  singleton boolean not null default true unique check (singleton),
  default_model text,
  ai_enabled boolean not null default false,
  social_specialist_enabled boolean not null default false,
  escalation_enabled boolean not null default false,
  max_model_cost_per_analysis numeric(20, 8),
  max_daily_model_spend numeric(20, 8),
  max_monthly_model_spend numeric(20, 8),
  max_escalation_cost numeric(20, 8),
  updated_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (max_model_cost_per_analysis is null or max_model_cost_per_analysis >= 0),
  check (max_daily_model_spend is null or max_daily_model_spend >= 0),
  check (max_monthly_model_spend is null or max_monthly_model_spend >= 0),
  check (max_escalation_cost is null or max_escalation_cost >= 0)
);
insert into public.analyzer_config (singleton) values (true);

create table public.analyzer_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete restrict,
  raw_input text not null check (length(btrim(raw_input)) between 1 and 4096),
  input_type text not null check (input_type in ('CONTRACT_ADDRESS','TOKEN_MINT','DEX_URL','CHART_URL','X_POST','ARTICLE','FACEBOOK_POST','INSTAGRAM_POST','GENERIC_URL','UNKNOWN')),
  requested_chain text,
  request_fingerprint text not null check (request_fingerprint ~ '^[0-9a-f]{64}$'),
  status text not null default 'RECEIVED' check (status in ('RECEIVED','RESOLVED','ANALYZED','FAILED')),
  created_at timestamptz not null default now()
);
create index analyzer_requests_requester_created_idx on public.analyzer_requests(requester_id, created_at desc);
create index analyzer_requests_fingerprint_idx on public.analyzer_requests(request_fingerprint, created_at desc);

create table public.analyzer_resolutions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.analyzer_requests(id) on delete restrict,
  resolution jsonb not null check (jsonb_typeof(resolution) = 'object'),
  created_at timestamptz not null default now()
);

create table public.analyzer_evidence_manifests (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.analyzer_requests(id) on delete restrict,
  manifest_version integer not null check (manifest_version > 0),
  manifest_hash text not null check (manifest_hash ~ '^[0-9a-f]{64}$'),
  manifest jsonb not null check (jsonb_typeof(manifest) = 'object'),
  captured_at timestamptz not null default now(),
  unique (request_id, manifest_version),
  unique (request_id, manifest_hash)
);
create index analyzer_evidence_request_idx on public.analyzer_evidence_manifests(request_id, manifest_version desc);
create trigger analyzer_evidence_no_mutation before update or delete on public.analyzer_evidence_manifests for each row execute function public.reject_immutable_change();

create table public.analyzer_analyses (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.analyzer_requests(id) on delete restrict,
  evidence_manifest_id uuid not null references public.analyzer_evidence_manifests(id) on delete restrict,
  analysis_version integer not null check (analysis_version > 0),
  status text not null check (status in ('ANALYZED','PARTIAL','INSUFFICIENT_DATA','UNSUPPORTED_CHAIN','TOKEN_NOT_RESOLVED','PROVIDER_FAILURE','FEATURE_DISABLED')),
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  methodology_version text,
  created_at timestamptz not null default now(),
  unique (request_id, analysis_version)
);
create index analyzer_analyses_created_idx on public.analyzer_analyses(created_at desc);

create table public.analyzer_model_calls (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analyzer_analyses(id) on delete restrict,
  provider text not null,
  model text not null,
  input_tokens integer,
  output_tokens integer,
  estimated_cost numeric(20, 8),
  actual_cost numeric(20, 8),
  latency_ms integer,
  status text not null check (status in ('SUCCEEDED','FAILED','BUDGET_EXCEEDED','DISABLED','VALIDATION_FAILED')),
  created_at timestamptz not null default now(),
  check (input_tokens is null or input_tokens >= 0),
  check (output_tokens is null or output_tokens >= 0),
  check (estimated_cost is null or estimated_cost >= 0),
  check (actual_cost is null or actual_cost >= 0),
  check (latency_ms is null or latency_ms >= 0)
);

create table public.analyzer_provider_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.analyzer_requests(id) on delete restrict,
  analysis_id uuid references public.analyzer_analyses(id) on delete restrict,
  provider text not null,
  capability text not null,
  status text not null check (status in ('SUCCEEDED','FAILED','MISSING','STALE','UNSUPPORTED')),
  latency_ms integer,
  source_timestamp timestamptz,
  received_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  check (latency_ms is null or latency_ms >= 0)
);

create table public.analyzer_cost_usage (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.analyzer_requests(id) on delete restrict,
  analysis_id uuid references public.analyzer_analyses(id) on delete restrict,
  provider text not null,
  operation text not null,
  units numeric(20, 8),
  unit_kind text,
  estimated_cost numeric(20, 8),
  created_at timestamptz not null default now(),
  check (units is null or units >= 0),
  check (estimated_cost is null or estimated_cost >= 0)
);

do $$
declare table_name text;
begin
  foreach table_name in array array['analyzer_config','analyzer_requests','analyzer_resolutions','analyzer_evidence_manifests','analyzer_analyses','analyzer_model_calls','analyzer_provider_events','analyzer_cost_usage'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated, service_role', table_name);
  end loop;
  execute 'create trigger analyzer_config_set_updated_at before update on public.analyzer_config for each row execute function public.set_updated_at()';
  foreach table_name in array array['analyzer_resolutions','analyzer_analyses','analyzer_model_calls','analyzer_provider_events','analyzer_cost_usage'] loop
    execute format('create trigger %I before update or delete on public.%I for each row execute function public.reject_immutable_change()', table_name || '_no_mutation', table_name);
  end loop;
end;
$$;

-- The server-only named operation uses the existing secret-key boundary. No
-- anonymous, authenticated, or browser RPC grant is created here.
revoke all on function public.reject_immutable_change() from public, anon, authenticated, service_role;

create function public.set_token_analyzer_enabled(p_enabled boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  flag_id uuid;
  previous_enabled boolean;
begin
  if actor is null or not ((select private.current_app_roles()) && array['owner', 'admin']::text[]) then
    raise exception 'Token Analyzer administration is not authorized' using errcode = '42501';
  end if;

  select id, enabled into flag_id, previous_enabled
  from public.feature_flags
  where key = 'token_analyzer_enabled'
  for update;

  if flag_id is null then
    raise exception 'Token Analyzer flag is unavailable' using errcode = '55000';
  end if;

  update public.feature_flags
  set enabled = coalesce(p_enabled, false), updated_by = actor
  where id = flag_id;

  insert into public.audit_logs (
    actor_kind, actor_id, action, resource_type, resource_id,
    previous_state, resulting_state, metadata
  ) values (
    'USER', actor, 'feature_flag.updated', 'feature_flag', flag_id,
    jsonb_build_object('key', 'token_analyzer_enabled', 'enabled', previous_enabled),
    jsonb_build_object('key', 'token_analyzer_enabled', 'enabled', coalesce(p_enabled, false)),
    jsonb_build_object('source', 'token_analyzer_admin')
  );

  return coalesce(p_enabled, false);
end;
$$;
revoke all on function public.set_token_analyzer_enabled(boolean) from public, anon;
grant execute on function public.set_token_analyzer_enabled(boolean) to authenticated;

commit;
