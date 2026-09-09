begin;

-- Gate 18F4: one explicit public Research contract for SQL and TypeScript.
-- The whitespace set is:
-- U+0009..U+000D, U+0020, U+00A0, U+1680, U+2000..U+200A,
-- U+2028, U+2029, U+202F, U+205F, U+3000, and U+FEFF.
create or replace function private.research_is_blank(text)
returns boolean language plpgsql immutable security invoker set search_path = '' as $$
declare
  value text := $1;
  codepoint integer;
begin
  if value is null or value = '' then return true; end if;
  foreach codepoint in array array[9,10,11,12,13,32,160,5760,8192,8193,8194,8195,8196,
    8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288,65279] loop
    value := replace(value, chr(codepoint), '');
  end loop;
  return value = '';
end;
$$;

create or replace function private.research_has_whitespace(text)
returns boolean language plpgsql immutable security invoker set search_path = '' as $$
declare
  codepoint integer;
begin
  if $1 is null or $1 = '' then return false; end if;
  foreach codepoint in array array[9,10,11,12,13,32,160,5760,8192,8193,8194,8195,8196,
    8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288,65279] loop
    if strpos($1, chr(codepoint)) > 0 then return true; end if;
  end loop;
  return false;
end;
$$;

create or replace function private.research_source_date_valid(text)
returns boolean language plpgsql immutable security invoker set search_path = '' as $$
begin
  if $1 !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then return false; end if;
  return $1::date between date '0001-01-01' and date '9999-12-31';
exception when others then
  return false;
end;
$$;

-- Supported URLs are HTTP(S) with an ASCII DNS hostname or an unambiguous
-- dotted-decimal IPv4 host, plus an optional 1..65535 port. IPv6 and IDNs
-- are intentionally deferred until both runtimes have an explicit contract.
create or replace function private.research_source_url_valid(p_url text)
returns boolean language plpgsql immutable security invoker set search_path = '' as $$
declare
  authority text;
  host text;
  port text;
  octet text;
begin
  if p_url is null or char_length(p_url) not between 8 and 2048
    or p_url !~ '^https?://'
    or p_url ~ '[[:space:][:cntrl:]<>"\\]'
    or p_url ~* '%(0[0-9a-f]|1[0-9a-f]|7f|5c)'
    or strpos(regexp_replace(p_url, '%[0-9A-Fa-f]{2}', '', 'g'), '%') > 0
    or private.research_has_whitespace(p_url) then
    return false;
  end if;
  authority := substring(p_url from '^https?://([^/?#]+)');
  if authority is null or authority = '' or authority ~ '[@%]' then return false; end if;
  if authority ~ ':' then
    if authority !~ '^[^:]+:[0-9]{1,5}$' then return false; end if;
    port := split_part(authority, ':', 2);
    if port::integer not between 1 and 65535 then return false; end if;
    host := split_part(authority, ':', 1);
  else
    host := authority;
  end if;
  if host = '' or char_length(host) > 253 then return false; end if;
  if host ~ '^[0-9]+(\.[0-9]+){3}$' then
    foreach octet in array string_to_array(host, '.') loop
      if octet !~ '^(0|[1-9][0-9]{0,2})$' or octet::integer > 255 then return false; end if;
    end loop;
  elsif host !~ '^[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$' then
    return false;
  end if;
  return true;
end;
$$;

create or replace function private.research_timestamp_valid(p_value timestamptz)
returns boolean language sql immutable security invoker set search_path = '' as $$
  select p_value is not null and isfinite(p_value)
    and p_value between timestamptz '0001-01-01 00:00:00+00'
    and timestamptz '9999-12-31 23:59:59.999+00';
$$;

create or replace function private.research_body_valid(p_body jsonb)
returns boolean language plpgsql immutable security invoker set search_path = '' as $$
declare
  s jsonb; b jsonb; total integer := 0; section_id text; block_id text;
  section_ids text[] := array[]::text[]; block_ids text[] := array[]::text[];
begin
  if p_body is null or jsonb_typeof(p_body) <> 'object'
    or p_body->'version' is distinct from '1'::jsonb
    or jsonb_typeof(p_body->'sections') is distinct from 'array'
    or octet_length(p_body::text) > 262144
    or jsonb_array_length(p_body->'sections') > 40 then return false; end if;
  for s in select value from jsonb_array_elements(p_body->'sections') loop
    if jsonb_typeof(s) <> 'object' or jsonb_typeof(s->'blocks') is distinct from 'array'
      or jsonb_typeof(s->'id') is distinct from 'string'
      or jsonb_typeof(s->'heading') is distinct from 'string' then return false; end if;
    section_id := s->>'id';
    if char_length(section_id) not between 1 and 80
      or private.research_is_blank(section_id) or private.research_has_whitespace(section_id)
      or section_id ~ '[[:cntrl:]]'
      or char_length(s->>'heading') > 160 or private.research_is_blank(s->>'heading')
      or jsonb_array_length(s->'blocks') not between 1 and 50
      or section_id = any(section_ids) then return false; end if;
    section_ids := array_append(section_ids, section_id);
    total := total + jsonb_array_length(s->'blocks');
    for b in select value from jsonb_array_elements(s->'blocks') loop
      if jsonb_typeof(b) <> 'object' or jsonb_typeof(b->'type') is distinct from 'string'
        or (b->>'type') not in ('paragraph', 'quote', 'callout', 'data_placeholder') then return false; end if;
      if b ? 'id' then
        if jsonb_typeof(b->'id') is distinct from 'string' then return false; end if;
        block_id := b->>'id';
        if char_length(block_id) not between 1 and 80
          or private.research_is_blank(block_id) or private.research_has_whitespace(block_id)
          or block_id ~ '[[:cntrl:]]' or block_id = any(block_ids) then return false; end if;
        block_ids := array_append(block_ids, block_id);
      end if;
      if b->>'type' <> 'data_placeholder' and
        (jsonb_typeof(b->'text') is distinct from 'string' or char_length(b->>'text') > 10000) then return false; end if;
      if b->>'type' = 'quote' and b ? 'attribution' and
        (jsonb_typeof(b->'attribution') is distinct from 'string' or char_length(b->>'attribution') > 240) then return false; end if;
      if b->>'type' = 'callout' and
        (jsonb_typeof(b->'label') is distinct from 'string' or char_length(b->>'label') not between 1 and 120
          or private.research_is_blank(b->>'label')) then return false; end if;
      if b->>'type' = 'data_placeholder' and
        (jsonb_typeof(b->'label') is distinct from 'string' or char_length(b->>'label') not between 1 and 160
          or private.research_is_blank(b->>'label')
          or jsonb_typeof(b->'description') is distinct from 'string' or char_length(b->>'description') > 10000) then return false; end if;
    end loop;
  end loop;
  return total <= 250;
end;
$$;

create or replace function private.research_facts_valid(p_facts jsonb)
returns boolean language plpgsql immutable security invoker set search_path = '' as $$
declare f jsonb;
begin
  if p_facts is null or jsonb_typeof(p_facts) <> 'array' or octet_length(p_facts::text) > 16384
    or jsonb_array_length(p_facts) > 12 then return false; end if;
  for f in select value from jsonb_array_elements(p_facts) loop
    if jsonb_typeof(f) <> 'object' or jsonb_typeof(f->'label') is distinct from 'string'
      or jsonb_typeof(f->'detail') is distinct from 'string'
      or char_length(f->>'label') not between 1 and 120
      or char_length(f->>'detail') not between 1 and 1000
      or private.research_is_blank(f->>'label') or private.research_is_blank(f->>'detail') then return false; end if;
    if f ? 'evidence' and (jsonb_typeof(f->'evidence') is distinct from 'string'
      or f->>'evidence' not in ('VERIFIED_DATA', 'STRONG_SIGNAL', 'AI_INFERENCE', 'UNKNOWN')) then return false; end if;
  end loop;
  return true;
end;
$$;

create or replace function private.research_input_valid(p_input jsonb, p_create boolean)
returns void language plpgsql immutable security invoker set search_path = '' as $$
declare
  keys text[] := array['title','slug','dek','category','ai_assisted','tldr','body_blocks',
    'key_facts','disclosure','seo_title','seo_description','sources','related_research','related_tokens','reason'];
  k text; item jsonb;
begin
  if p_create then keys := keys || array['classification','author_id']; end if;
  if p_input is null or jsonb_typeof(p_input) <> 'object' or octet_length(p_input::text) > 393216
    or p_input - keys <> '{}'::jsonb then
    raise exception 'Invalid Research input fields' using errcode = '22023';
  end if;
  foreach k in array array['title','slug','dek','category','tldr','disclosure','seo_title','seo_description','reason','classification','author_id'] loop
    if p_input ? k and p_input->k <> 'null'::jsonb and jsonb_typeof(p_input->k) <> 'string' then
      raise exception 'Invalid Research text field' using errcode = '22023';
    end if;
  end loop;
  if p_input ? 'title' and p_input->'title' <> 'null'::jsonb
    and (char_length(p_input->>'title') not between 1 and 200 or private.research_is_blank(p_input->>'title')) then
    raise exception 'Invalid Research title' using errcode = '22023';
  end if;
  if p_input ? 'ai_assisted' and jsonb_typeof(p_input->'ai_assisted') <> 'boolean' then
    raise exception 'Invalid AI indicator' using errcode = '22023';
  end if;
  if p_input ? 'body_blocks' and not private.research_body_valid(p_input->'body_blocks') then
    raise exception 'Invalid Research body structure' using errcode = '22023';
  end if;
  if p_input ? 'key_facts' and not private.research_facts_valid(p_input->'key_facts') then
    raise exception 'Invalid Research facts structure' using errcode = '22023';
  end if;
  foreach k in array array['sources','related_research','related_tokens'] loop
    if p_input ? k then
      if jsonb_typeof(p_input->k) <> 'array' then
        raise exception 'Invalid Research relationships' using errcode = '22023';
      end if;
      if jsonb_array_length(p_input->k) > (case when k = 'sources' then 50 else 12 end) then
        raise exception 'Too many Research relationships' using errcode = '22023';
      end if;
    end if;
  end loop;
  if p_input ? 'sources' then
    for item in select value from jsonb_array_elements(p_input->'sources') loop
      if jsonb_typeof(item) <> 'object'
        or item - array['id','title','publisher','url','published_on','accessed_on']::text[] <> '{}'::jsonb
        or jsonb_typeof(item->'title') is distinct from 'string'
        or jsonb_typeof(item->'publisher') is distinct from 'string'
        or jsonb_typeof(item->'url') is distinct from 'string'
        or char_length(item->>'title') not between 1 and 240
        or char_length(item->>'publisher') not between 1 and 160
        or private.research_is_blank(item->>'title')
        or private.research_is_blank(item->>'publisher')
        or not private.research_source_url_valid(item->>'url') then
        raise exception 'Invalid Research source' using errcode = '22023';
      end if;
      foreach k in array array['id','published_on','accessed_on'] loop
        if item ? k and item->k <> 'null'::jsonb and jsonb_typeof(item->k) <> 'string' then
          raise exception 'Invalid Research source field' using errcode = '22023';
        end if;
        if k in ('published_on','accessed_on') and item ? k and item->k <> 'null'::jsonb
          and not private.research_source_date_valid(item->>k) then
          raise exception 'Invalid Research source date' using errcode = '22023';
        end if;
      end loop;
    end loop;
  end if;
  if p_input ? 'reason' and (char_length(p_input->>'reason') not between 1 and 500
    or private.research_is_blank(p_input->>'reason') or p_input->>'reason' ~ '[[:cntrl:]]') then
    raise exception 'Invalid Research reason' using errcode = '22023';
  end if;
end;
$$;

create or replace function private.research_is_public(a public.articles)
returns boolean language sql stable security invoker set search_path = '' as $$
  select coalesce(a.status = 'PUBLISHED' and a.published_at <= statement_timestamp()
    and (a.scheduled_at is null or a.scheduled_at <= statement_timestamp())
    and a.published_revision = a.revision and a.public_author_id = a.author_id
    and char_length(a.title) between 1 and 200 and not private.research_is_blank(a.title)
    and a.category is not null and char_length(a.tldr) between 1 and 1200
    and not private.research_is_blank(a.tldr)
    and not private.research_is_blank(a.disclosure) and char_length(a.disclosure) <= 2000
    and private.research_body_valid(a.body_blocks)
    and exists (select 1 from jsonb_array_elements(a.body_blocks->'sections') s
      cross join lateral jsonb_array_elements(s->'blocks') b
      where b->>'type'='paragraph' and not private.research_is_blank(b->>'text'))
    and exists (select 1 from public.research_authors y where y.profile_id=a.public_author_id
      and char_length(y.display_name) between 1 and 160 and not private.research_is_blank(y.display_name)
      and (y.title is null or (char_length(y.title) between 1 and 160 and not private.research_is_blank(y.title))))
    and exists (select 1 from public.article_sources s where s.article_id=a.id and s.retired_at is null)
    and not exists (select 1 from public.article_sources s where s.article_id=a.id and s.retired_at is null
      and (char_length(s.title) not between 1 and 240 or char_length(s.publisher) not between 1 and 160
        or private.research_is_blank(s.title) or private.research_is_blank(s.publisher)
        or not private.research_source_url_valid(s.url)
        or (s.published_on is not null and not private.research_source_date_valid(s.published_on::text))
        or (s.accessed_on is not null and not private.research_source_date_valid(s.accessed_on::text))))
    and private.research_timestamp_valid(a.published_at)
    and private.research_timestamp_valid(a.updated_at)
    and private.research_available(), false);
$$;

create or replace function private.research_publishable(a public.articles)
returns void language plpgsql volatile security invoker set search_path = '' as $$
begin
  perform 1 from public.research_authors where profile_id=a.public_author_id for update;
  if not exists (select 1 from public.research_authors y where y.profile_id=a.public_author_id
      and char_length(y.display_name) between 1 and 160
      and not private.research_is_blank(y.display_name)
      and (y.title is null or (char_length(y.title) between 1 and 160 and not private.research_is_blank(y.title))))
    or char_length(a.title) not between 1 and 200 or private.research_is_blank(a.title)
    or a.category is null or a.author_id is null or a.public_author_id is distinct from a.author_id
    or private.research_is_blank(a.tldr) or a.disclosure is null or private.research_is_blank(a.disclosure)
    or not private.research_body_valid(a.body_blocks)
    or not exists (select 1 from jsonb_array_elements(a.body_blocks->'sections') s
      cross join lateral jsonb_array_elements(s->'blocks') b
      where b->>'type'='paragraph' and not private.research_is_blank(b->>'text'))
    or not exists (select 1 from public.article_sources where article_id=a.id and retired_at is null)
    or exists (select 1 from public.article_sources where article_id=a.id and retired_at is null
      and (char_length(title) not between 1 and 240 or char_length(publisher) not between 1 and 160
        or private.research_is_blank(title) or private.research_is_blank(publisher)
        or not private.research_source_url_valid(url)
        or (published_on is not null and not private.research_source_date_valid(published_on::text))
        or (accessed_on is not null and not private.research_source_date_valid(accessed_on::text)))) then
    raise exception 'Research is incomplete for publication' using errcode='23514';
  end if;
  perform 1 from public.feature_flags where key in ('research_enabled','maintenance_mode') order by key for share;
  if not private.research_available() then raise exception 'Research publication disabled' using errcode='55000'; end if;
  if exists (select 1 from public.article_related_research r join public.articles t on t.id=r.related_article_id
    where r.article_id=a.id and not private.research_is_public(t)) then
    raise exception 'Related Research is not published' using errcode='23514';
  end if;
end;
$$;

alter table public.article_sources
  add constraint article_sources_research_date_contract check (
    (published_on is null or published_on between date '0001-01-01' and date '9999-12-31')
    and (accessed_on is null or accessed_on between date '0001-01-01' and date '9999-12-31')
  );

alter table public.articles
  add constraint articles_research_timestamp_contract check (
    private.research_timestamp_valid(updated_at)
    and (published_at is null or private.research_timestamp_valid(published_at))
    and (scheduled_at is null or private.research_timestamp_valid(scheduled_at))
  );

revoke all on function private.research_is_blank(text), private.research_has_whitespace(text),
  private.research_source_date_valid(text), private.research_source_url_valid(text),
  private.research_timestamp_valid(timestamptz) from public, anon, authenticated, service_role;

commit;
