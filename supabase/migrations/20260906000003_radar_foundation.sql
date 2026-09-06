begin;

create table public.tokens (
  id uuid primary key default gen_random_uuid(),
  -- Namespaced chain identifiers (for example eip155:<chain-id>), not display labels.
  chain text not null check (chain ~ '^[a-z0-9-]{3,8}:[A-Za-z0-9_-]{1,32}$'),
  contract_address text not null check (length(contract_address) > 0 and contract_address !~ '[[:space:]]'),
  -- EVM hexadecimal addresses are case-insensitive; other chains retain case.
  contract_address_key text generated always as (
    case when chain like 'eip155:%' then lower(contract_address) else contract_address end
  ) stored,
  symbol text,
  name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tokens_evm_identity_check check (
    chain not like 'eip155:%' or (chain ~ '^eip155:[1-9][0-9]*$' and contract_address ~ '^0x[0-9A-Fa-f]{40}$')
  ),
  constraint tokens_chain_contract_key unique (chain, contract_address_key)
);

-- Immutable analysis snapshots. There is no scoring function or ingestion job.
create table public.radar_analyses (
  id uuid primary key default gen_random_uuid(),
  token_id uuid not null references public.tokens(id) on delete restrict,
  version integer not null check (version > 0),
  status text not null check (status in ('EARLY', 'TRENDING', 'HIGH_RISK', 'REJECTED')),
  score numeric check (score is null or (score >= 0 and score < 'Infinity'::numeric)),
  deterministic_data jsonb not null default '{}'::jsonb check (jsonb_typeof(deterministic_data) = 'object'),
  ai_inference jsonb not null default '{}'::jsonb check (jsonb_typeof(ai_inference) = 'object'),
  risk_summary text,
  analyzed_at timestamptz not null default now(),
  data_as_of timestamptz not null,
  created_at timestamptz not null default now(),
  constraint radar_analyses_token_version_key unique (token_id, version),
  constraint radar_analyses_freshness_check check (data_as_of <= analyzed_at)
);
create index radar_analyses_status_analyzed_idx on public.radar_analyses(status, analyzed_at desc);
create trigger radar_analyses_no_mutation before update or delete on public.radar_analyses
  for each row execute function public.reject_immutable_change();
create trigger radar_analyses_no_truncate before truncate on public.radar_analyses
  for each statement execute function public.reject_immutable_change();

-- Mutable moderation state is physically separate from scores/evidence/risk.
create table public.radar_reviews (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null unique references public.radar_analyses(id) on delete restrict,
  state text not null default 'PENDING' check (state in ('PENDING', 'APPROVED', 'PUBLISHED', 'REJECTED', 'HIDDEN')),
  reviewed_by uuid references public.profiles(id) on delete restrict,
  reviewed_at timestamptz,
  editorial_note text not null default '',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint radar_reviews_reviewer_pair_check check ((reviewed_by is null) = (reviewed_at is null)),
  constraint radar_reviews_review_required_check check (
    state not in ('APPROVED', 'PUBLISHED', 'REJECTED') or (reviewed_by is not null and reviewed_at is not null)
  ),
  constraint radar_reviews_publication_check check (
    (state <> 'PUBLISHED' or published_at is not null) and
    (published_at is null or (state in ('PUBLISHED', 'HIDDEN') and reviewed_by is not null and reviewed_at is not null and published_at >= reviewed_at))
  )
);
create index radar_reviews_reviewed_by_idx on public.radar_reviews(reviewed_by);
create index radar_reviews_state_published_idx on public.radar_reviews(state, published_at desc);
create function public.preserve_review_target()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.analysis_id is distinct from old.analysis_id then
    raise exception 'A review cannot be reassigned to another analysis' using errcode = '55000';
  end if;
  return new;
end;
$$;
revoke all on function public.preserve_review_target() from public, anon, authenticated, service_role;
create trigger radar_reviews_preserve_target before update on public.radar_reviews
  for each row execute function public.preserve_review_target();
create trigger set_updated_at before update on public.radar_reviews
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.tokens
  for each row execute function public.set_updated_at();

do $$
declare table_name text;
begin
  foreach table_name in array array['tokens', 'radar_analyses', 'radar_reviews'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated, service_role', table_name);
  end loop;
end;
$$;

commit;
