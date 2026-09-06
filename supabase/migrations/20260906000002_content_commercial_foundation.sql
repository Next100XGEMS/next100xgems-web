begin;

create table public.articles (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  author_id uuid references public.profiles(id) on delete restrict,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED')),
  classification text not null default 'EDITORIAL' check (classification in ('EDITORIAL', 'SPONSORED', 'PARTNER', 'AI_ASSISTED')),
  tldr text not null default '',
  body_markdown text not null default '',
  seo_title text,
  seo_description text,
  disclosure text,
  scheduled_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint articles_disclosure_check check (
    classification = 'EDITORIAL' or (disclosure is not null and length(btrim(disclosure)) > 0)
  ),
  constraint articles_publication_check check (
    (status <> 'SCHEDULED' or scheduled_at is not null) and
    (status <> 'PUBLISHED' or published_at is not null) and
    (status not in ('SCHEDULED', 'PUBLISHED') or author_id is not null)
  )
);
create index articles_author_id_idx on public.articles(author_id);
create index articles_status_published_idx on public.articles(status, published_at desc);

create table public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  logo_reference text,
  description text not null default '',
  website_url text,
  x_url text,
  telegram_url text,
  active boolean not null default false,
  disclosure text not null check (length(btrim(disclosure)) > 0),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partners_dates_check check (ends_at is null or (starts_at is not null and ends_at > starts_at))
);
create index partners_active_dates_idx on public.partners(active, starts_at, ends_at);

create table public.sponsors (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  website_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ad_placements (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z]{2}-[0-9]{2}$'),
  name text not null check (length(btrim(name)) > 0),
  enabled boolean not null default false,
  desktop_enabled boolean not null default true,
  mobile_enabled boolean not null default false,
  sponsored_label text not null default 'Sponsored' check (sponsored_label = 'Sponsored'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.sponsors(id) on delete restrict,
  name text not null check (length(btrim(name)) > 0),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ad_campaigns_dates_check check (ends_at is null or (starts_at is not null and ends_at > starts_at)),
  constraint ad_campaigns_schedule_check check (status not in ('SCHEDULED', 'ACTIVE') or (starts_at is not null and ends_at is not null))
);
create index ad_campaigns_sponsor_id_idx on public.ad_campaigns(sponsor_id);
create index ad_campaigns_status_dates_idx on public.ad_campaigns(status, starts_at, ends_at);

create table public.ad_creatives (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.ad_campaigns(id) on delete restrict,
  headline text not null check (length(btrim(headline)) > 0),
  body text not null default '',
  media_reference text,
  cta text not null check (length(btrim(cta)) > 0),
  destination_url text not null check (destination_url ~ '^https?://[^[:space:]]+$'),
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Supports a composite FK that prevents serving another campaign's creative.
  constraint ad_creatives_campaign_id_id_key unique (campaign_id, id)
);

create table public.ad_campaign_placements (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.ad_campaigns(id) on delete restrict,
  placement_id uuid not null references public.ad_placements(id) on delete restrict,
  creative_id uuid not null,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ad_campaign_placements_campaign_placement_key unique (campaign_id, placement_id),
  constraint ad_campaign_placements_creative_fk foreign key (campaign_id, creative_id)
    references public.ad_creatives(campaign_id, id) on delete restrict
);
create index ad_campaign_placements_placement_id_idx on public.ad_campaign_placements(placement_id);
create index ad_campaign_placements_creative_idx on public.ad_campaign_placements(campaign_id, creative_id);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  project_name text not null check (length(btrim(project_name)) > 0),
  contact_name text not null check (length(btrim(contact_name)) > 0),
  contact_method text not null check (contact_method in ('EMAIL', 'TELEGRAM', 'X', 'OTHER')),
  contact_value text not null check (length(btrim(contact_value)) > 0),
  website_url text,
  interested_service text not null check (length(btrim(interested_service)) > 0),
  budget_note text,
  launch_date date,
  notes text not null default '',
  status text not null default 'NEW' check (status in ('NEW', 'CONTACTED', 'NEGOTIATING', 'WON', 'LOST')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index leads_status_created_idx on public.leads(status, created_at desc);

do $$
declare table_name text;
begin
  foreach table_name in array array['articles', 'partners', 'sponsors', 'ad_placements', 'ad_campaigns', 'ad_creatives', 'ad_campaign_placements', 'leads'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated, service_role', table_name);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name);
  end loop;
end;
$$;

commit;
