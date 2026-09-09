begin;

-- Gate 18F3: align the stored/public Research contract with the TypeScript
-- reader. PostgreSQL char_length(text) counts Unicode code points, so all
-- bounded values below use char_length and validate the raw stored value.
create or replace function private.research_body_valid(p_body jsonb)
returns boolean language plpgsql immutable security invoker set search_path = '' as $$
declare
  s jsonb; b jsonb; total integer := 0; section_id text; block_id text;
  section_ids text[] := array[]::text[]; block_ids text[] := array[]::text[];
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
    section_id := s->>'id';
    if char_length(section_id) not between 1 and 80
      or section_id ~ '^[[:space:]]*$' or section_id ~ '[[:space:][:cntrl:]]'
      or char_length(s->>'heading') > 160 or s->>'heading' ~ '^[[:space:]]*$'
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
          or block_id ~ '^[[:space:]]*$' or block_id ~ '[[:space:][:cntrl:]]'
          or block_id = any(block_ids) then return false; end if;
        block_ids := array_append(block_ids, block_id);
      end if;
      if b->>'type' <> 'data_placeholder' and
        (jsonb_typeof(b->'text') is distinct from 'string' or char_length(b->>'text') > 10000) then return false; end if;
      if b->>'type' = 'quote' and b ? 'attribution' and
        (jsonb_typeof(b->'attribution') is distinct from 'string' or char_length(b->>'attribution') > 240) then return false; end if;
      if b->>'type' = 'callout' and
        (jsonb_typeof(b->'label') is distinct from 'string' or char_length(b->>'label') not between 1 and 120
          or b->>'label' ~ '^[[:space:]]*$') then return false; end if;
      if b->>'type' = 'data_placeholder' and
        (jsonb_typeof(b->'label') is distinct from 'string' or char_length(b->>'label') not between 1 and 160
          or b->>'label' ~ '^[[:space:]]*$'
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
  if p_facts is null or jsonb_typeof(p_facts) <> 'array' or octet_length(p_facts::text) > 16384 then return false; end if;
  if jsonb_array_length(p_facts) > 12 then return false; end if;
  for f in select value from jsonb_array_elements(p_facts) loop
    if jsonb_typeof(f) <> 'object' or jsonb_typeof(f->'label') is distinct from 'string'
      or jsonb_typeof(f->'detail') is distinct from 'string'
      or char_length(f->>'label') not between 1 and 120
      or char_length(f->>'detail') not between 1 and 1000
      or f->>'label' ~ '^[[:space:]]*$' or f->>'detail' ~ '^[[:space:]]*$' then return false; end if;
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
        or item->>'title' ~ '^[[:space:]]*$'
        or item->>'publisher' ~ '^[[:space:]]*$' then
        raise exception 'Invalid Research source' using errcode = '22023';
      end if;
    end loop;
  end if;
  if p_input ? 'reason' and (char_length(p_input->>'reason') not between 1 and 500
    or p_input->>'reason' ~ '^[[:space:]]*$' or p_input->>'reason' ~ '[[:cntrl:]]') then
    raise exception 'Invalid Research reason' using errcode = '22023';
  end if;
end;
$$;

create or replace function private.research_publishable(a public.articles)
returns void language plpgsql volatile security invoker set search_path = '' as $$
begin
  perform 1 from public.research_authors where profile_id=a.public_author_id for update;
  if not exists (select 1 from public.research_authors y where y.profile_id=a.public_author_id
      and char_length(y.display_name) between 1 and 160
      and y.display_name !~ '^[[:space:]]*$'
      and (y.title is null or (char_length(y.title) between 1 and 160 and y.title !~ '^[[:space:]]*$')))
    or a.category is null or a.author_id is null or a.public_author_id is distinct from a.author_id
    or a.tldr ~ '^[[:space:]]*$' or a.disclosure is null or a.disclosure ~ '^[[:space:]]*$'
    or not private.research_body_valid(a.body_blocks)
    or not exists (select 1 from jsonb_array_elements(a.body_blocks->'sections') s
      cross join lateral jsonb_array_elements(s->'blocks') b
      where b->>'type'='paragraph' and b->>'text' !~ '^[[:space:]]*$')
    or not exists (select 1 from public.article_sources where article_id=a.id and retired_at is null)
    or exists (select 1 from public.article_sources where article_id=a.id and retired_at is null
      and (char_length(title) not between 1 and 240 or char_length(publisher) not between 1 and 160
        or title ~ '^[[:space:]]*$' or publisher ~ '^[[:space:]]*$')) then
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

create or replace function public.save_research_author(p_profile_id uuid,p_display_name text,p_title text default null)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare r text[]; old_author public.research_authors; new_author public.research_authors; event_id uuid;
begin
  r := private.research_actor_roles(); perform private.research_require(r,'author.manage');
  if p_profile_id is null or not exists (select 1 from public.profiles where id=p_profile_id) then
    raise exception 'Research author unavailable' using errcode='22023';
  end if;
  if p_display_name is null or char_length(p_display_name) not between 1 and 160
    or p_display_name ~ '^[[:space:]]*$' or p_display_name ~ '[[:cntrl:]]'
    or (p_title is not null and (char_length(p_title) not between 1 and 160
      or p_title ~ '^[[:space:]]*$' or p_title ~ '[[:cntrl:]]')) then
    raise exception 'Research author fields exceed the public contract' using errcode='22023';
  end if;
  select * into old_author from public.research_authors where profile_id=p_profile_id for update;
  if exists (select 1 from public.articles where public_author_id=p_profile_id and published_at is not null) then
    raise exception 'Published Research byline is immutable' using errcode='55000';
  end if;
  if old_author.profile_id is null then
    insert into public.research_authors(profile_id,display_name,title) values(p_profile_id,p_display_name,p_title) returning * into new_author;
  else
    update public.research_authors set display_name=p_display_name,title=p_title where profile_id=p_profile_id returning * into new_author;
  end if;
  event_id := public.write_audit_event('USER',auth.uid(),'research_author.updated','research_author',p_profile_id,
    case when old_author.profile_id is null then null else jsonb_build_object('display_name',old_author.display_name,'title',old_author.title) end,
    jsonb_build_object('display_name',new_author.display_name,'title',new_author.title),
    jsonb_build_object('schema_version',1,'operation',case when old_author.profile_id is null then 'create' else 'update' end));
  return jsonb_build_object('profile_id',p_profile_id,'audit_id',event_id);
end;
$$;

commit;
