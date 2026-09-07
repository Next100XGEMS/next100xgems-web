begin;

-- Preserve compatible legacy drafts/archives; never infer the commercial meaning
-- of AI_ASSISTED or silently validate/unpublish a historical publication.
do $$
begin
  if exists (select 1 from public.articles where classification = 'AI_ASSISTED'
    or status in ('SCHEDULED', 'PUBLISHED') or published_at is not null) then
    raise exception 'Research legacy publication/classification requires reviewed reconciliation'
      using errcode = '55000';
  end if;
end;
$$;

-- Structural storage boundary only. Detailed editor/renderer schemas remain a
-- later application concern; no HTML/MDX/script block type is supported.
create function private.research_body_valid(p_body jsonb)
returns boolean language plpgsql immutable security invoker set search_path = '' as $$
declare s jsonb; b jsonb; total integer := 0;
begin
  if p_body is null or jsonb_typeof(p_body) <> 'object'
    or p_body->'version' is distinct from '1'::jsonb
    or jsonb_typeof(p_body->'sections') is distinct from 'array'
    or octet_length(p_body::text) > 262144 then return false; end if;
  if jsonb_array_length(p_body->'sections') > 40 then return false; end if;
  for s in select value from jsonb_array_elements(p_body->'sections') loop
    if jsonb_typeof(s) <> 'object' or jsonb_typeof(s->'blocks') is distinct from 'array'
      or jsonb_typeof(s->'id') is distinct from 'string'
      or jsonb_typeof(s->'heading') is distinct from 'string' then return false; end if;
    if length(s->>'id') not between 1 and 80 or length(s->>'heading') > 160
      or jsonb_array_length(s->'blocks') not between 1 and 50 then return false; end if;
    total := total + jsonb_array_length(s->'blocks');
    for b in select value from jsonb_array_elements(s->'blocks') loop
      if jsonb_typeof(b) <> 'object' or jsonb_typeof(b->'type') is distinct from 'string'
        or (b->>'type') not in ('paragraph', 'quote', 'callout', 'data_placeholder') then return false; end if;
      if b->>'type' <> 'data_placeholder' and
        (jsonb_typeof(b->'text') is distinct from 'string' or length(b->>'text') > 10000) then return false; end if;
      if b->>'type' = 'data_placeholder' and
        (jsonb_typeof(b->'description') is distinct from 'string' or length(b->>'description') > 10000) then return false; end if;
    end loop;
  end loop;
  return total <= 250;
end;
$$;

create function private.research_facts_valid(p_facts jsonb)
returns boolean language plpgsql immutable security invoker set search_path = '' as $$
declare f jsonb;
begin
  if p_facts is null or jsonb_typeof(p_facts) <> 'array' or octet_length(p_facts::text) > 16384 then return false; end if;
  if jsonb_array_length(p_facts) > 12 then return false; end if;
  for f in select value from jsonb_array_elements(p_facts) loop
    if jsonb_typeof(f) <> 'object' or jsonb_typeof(f->'label') is distinct from 'string'
      or jsonb_typeof(f->'detail') is distinct from 'string'
      or length(btrim(f->>'label')) not between 1 and 120
      or length(btrim(f->>'detail')) not between 1 and 1000 then return false; end if;
    if f ? 'evidence' and (jsonb_typeof(f->'evidence') is distinct from 'string'
      or f->>'evidence' not in ('VERIFIED_DATA', 'STRONG_SIGNAL', 'AI_INFERENCE', 'UNKNOWN')) then return false; end if;
  end loop;
  return true;
end;
$$;

-- Deliberately narrow ASCII DNS/IPv4 HTTP(S) subset; never fetch/unfurl URLs.
create function private.research_source_url_valid(p_url text)
returns boolean language plpgsql immutable security invoker set search_path = '' as $$
declare authority text; host text; port text;
begin
  if p_url is null or length(p_url) not between 8 and 2048
    or p_url !~ '^https?://' or p_url ~ '[[:space:][:cntrl:]<>"\\]'
    or p_url ~* '%(0[0-9a-f]|1[0-9a-f]|7f|5c)'
    or strpos(regexp_replace(p_url, '%[0-9A-Fa-f]{2}', '', 'g'), '%') > 0 then return false; end if;
  authority := substring(p_url from '^https?://([^/?#]+)');
  if authority is null or authority ~ '[@%]' then return false; end if;
  host := split_part(authority, ':', 1);
  if length(host) > 253 or host !~ '^[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$' then return false; end if;
  if strpos(authority, ':') > 0 then
    port := split_part(authority, ':', 2);
    if authority !~ '^[^:]+:[0-9]{1,5}$' then return false; end if;
    if port::integer not between 1 and 65535 then return false; end if;
  end if;
  return true;
end;
$$;

create table public.research_authors (
  profile_id uuid primary key references public.profiles(id) on delete restrict,
  display_name text not null check (length(btrim(display_name)) between 1 and 200 and display_name !~ '[[:cntrl:]]'),
  title text check (title is null or (length(btrim(title)) between 1 and 200 and title !~ '[[:cntrl:]]')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.articles
  add column dek text check (length(dek) <= 500),
  add column category text check (category in ('MARKET', 'MEMECOINS', 'ALTCOINS', 'DEEP_DIVES')),
  add column ai_assisted boolean not null default false,
  add column public_author_id uuid references public.research_authors(profile_id) on delete restrict,
  add column body_blocks jsonb not null default '{"version":1,"sections":[]}'::jsonb,
  add column key_facts jsonb not null default '[]'::jsonb,
  add column revision bigint not null default 1 check (revision > 0),
  add column published_revision bigint,
  drop constraint articles_classification_check,
  add constraint articles_classification_check check (classification in ('EDITORIAL', 'SPONSORED', 'PARTNER')),
  add constraint articles_body_blocks_check check (private.research_body_valid(body_blocks)),
  add constraint articles_key_facts_check check (private.research_facts_valid(key_facts)),
  add constraint articles_text_bounds_check check (
    length(title) <= 200 and title !~ '[[:cntrl:]]' and length(slug) <= 160
    and length(tldr) <= 1200 and length(seo_title) <= 200
    and length(seo_description) <= 320 and length(disclosure) <= 2000),
  add constraint articles_public_author_check check (public_author_id is null or
    (author_id is not null and public_author_id = author_id)),
  add constraint articles_research_state_check check (
    (scheduled_at is null or isfinite(scheduled_at))
    and (published_at is null or isfinite(published_at))
    and (status not in ('SCHEDULED', 'PUBLISHED') or (category is not null and public_author_id is not null))
    and ((status = 'PUBLISHED' and published_revision is not null and published_revision = revision)
      or (status <> 'PUBLISHED' and published_revision is null)));
create index articles_public_author_id_idx on public.articles(public_author_id);
create index articles_scheduled_idx on public.articles(scheduled_at, id) where status = 'SCHEDULED';

create table public.article_sources (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete restrict,
  title text not null check (length(btrim(title)) between 1 and 300),
  publisher text not null check (length(btrim(publisher)) between 1 and 200),
  url text not null check (private.research_source_url_valid(url)),
  published_on date check (published_on is null or isfinite(published_on)),
  accessed_on date check (accessed_on is null or isfinite(accessed_on)),
  position integer not null check (position between 0 and 49),
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index article_sources_active_position_key on public.article_sources(article_id, position) where retired_at is null;
create index article_sources_article_id_idx on public.article_sources(article_id);
create table public.article_related_research (
  article_id uuid not null references public.articles(id) on delete restrict,
  related_article_id uuid not null references public.articles(id) on delete restrict,
  position integer not null check (position between 0 and 11),
  created_at timestamptz not null default now(),
  primary key (article_id, related_article_id),
  unique (article_id, position),
  check (article_id <> related_article_id)
);
create index article_related_research_target_idx on public.article_related_research(related_article_id);
create table public.article_tokens (
  article_id uuid not null references public.articles(id) on delete restrict,
  token_id uuid not null references public.tokens(id) on delete restrict,
  position integer not null check (position between 0 and 11),
  created_at timestamptz not null default now(),
  primary key (article_id, token_id),
  unique (article_id, position)
);
create index article_tokens_token_id_idx on public.article_tokens(token_id);

alter table public.research_authors enable row level security;
alter table public.article_sources enable row level security;
alter table public.article_related_research enable row level security;
alter table public.article_tokens enable row level security;
revoke all on table public.research_authors, public.article_sources,
  public.article_related_research, public.article_tokens from public, anon, authenticated, service_role;
revoke all on function private.research_body_valid(jsonb), private.research_facts_valid(jsonb),
  private.research_source_url_valid(text) from public, anon, authenticated, service_role;
create trigger set_updated_at before update on public.research_authors
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.article_sources
  for each row execute function public.set_updated_at();

commit;
