begin;

-- Gate 18B explicitly uses existing Supabase roles, not a custom reader role.
-- Public definer projections deliberately bypass owner RLS: exact predicates
-- and output columns below are the public boundary. Raw anon access stays shut.
create function private.research_available()
returns boolean language sql stable security invoker set search_path = '' as $$
  select exists (select 1 from public.feature_flags where key = 'research_enabled'
    and enabled and (configuration is null or jsonb_typeof(configuration) = 'object'))
    and exists (select 1 from public.feature_flags where key = 'maintenance_mode'
    and not enabled and (configuration is null or jsonb_typeof(configuration) = 'object'));
$$;

create function private.research_is_public(a public.articles)
returns boolean language sql stable security invoker set search_path = '' as $$
  select coalesce(a.status = 'PUBLISHED' and a.published_at <= statement_timestamp()
    and (a.scheduled_at is null or a.scheduled_at <= statement_timestamp())
    and a.published_revision = a.revision and a.public_author_id = a.author_id
    and a.category is not null and length(btrim(a.disclosure)) > 0
    and private.research_available(), false);
$$;

create function public.read_public_research_page(
  p_category text default null, p_cursor jsonb default null, p_limit integer default 20
)
returns table (id uuid, slug text, title text, dek text, category text,
  classification text, ai_assisted boolean, tldr text, author jsonb,
  published_at timestamptz, updated_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare cursor_time timestamptz; cursor_id uuid;
begin
  if p_limit is null or p_limit not between 1 and 50 or
    (p_category is not null and p_category not in ('MARKET','MEMECOINS','ALTCOINS','DEEP_DIVES')) then
    raise exception 'Invalid Research page arguments' using errcode = '22023';
  end if;
  if p_cursor is not null then
    if jsonb_typeof(p_cursor) <> 'object'
      or jsonb_typeof(p_cursor->'published_at') is distinct from 'string'
      or jsonb_typeof(p_cursor->'id') is distinct from 'string'
      or p_cursor - array['published_at','id']::text[] <> '{}'::jsonb then
      raise exception 'Invalid Research cursor' using errcode = '22023';
    end if;
    cursor_time := (p_cursor->>'published_at')::timestamptz;
    cursor_id := (p_cursor->>'id')::uuid;
    if not isfinite(cursor_time) then raise exception 'Invalid Research cursor' using errcode = '22023'; end if;
  end if;
  return query select a.id, a.slug, a.title, a.dek, a.category, a.classification,
    a.ai_assisted, a.tldr, jsonb_build_object('display_name', y.display_name, 'title', y.title),
    a.published_at, a.updated_at
  from public.articles a join public.research_authors y on y.profile_id = a.public_author_id
  where private.research_is_public(a)
    and (p_category is null or a.category = p_category)
    and (p_cursor is null or (a.published_at, a.id) < (cursor_time, cursor_id))
  order by a.published_at desc, a.id desc limit p_limit;
end;
$$;

create function public.read_public_research_article(p_slug text)
returns table (id uuid, slug text, title text, dek text, category text,
  classification text, ai_assisted boolean, tldr text, key_facts jsonb, body_blocks jsonb,
  disclosure text, seo_title text, seo_description text, author jsonb, sources jsonb,
  related_research jsonb, related_tokens jsonb, published_at timestamptz, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select a.id, a.slug, a.title, a.dek, a.category, a.classification, a.ai_assisted,
    a.tldr, a.key_facts, a.body_blocks, a.disclosure, a.seo_title, a.seo_description,
    jsonb_build_object('display_name', y.display_name, 'title', y.title),
    coalesce((select jsonb_agg(jsonb_build_object('title', s.title, 'publisher', s.publisher,
      'url', s.url, 'published_on', s.published_on, 'accessed_on', s.accessed_on) order by s.position)
      from public.article_sources s where s.article_id = a.id and s.retired_at is null), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('title', t.title, 'slug', t.slug, 'category', t.category) order by r.position)
      from public.article_related_research r join public.articles t on t.id = r.related_article_id
      where r.article_id = a.id and private.research_is_public(t)), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('symbol', t.symbol, 'name', t.name,
      'chain', t.chain, 'contract_address', t.contract_address) order by r.position)
      from public.article_tokens r join public.tokens t on t.id = r.token_id
      where r.article_id = a.id), '[]'::jsonb),
    a.published_at, a.updated_at
  from public.articles a join public.research_authors y on y.profile_id = a.public_author_id
  where a.slug = p_slug and length(p_slug) <= 160
    and p_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and private.research_is_public(a);
$$;

-- These helpers have no API EXECUTE. Only named authenticated RPCs call them.
create function private.research_actor_roles()
returns text[] language plpgsql volatile security invoker set search_path = '' as $$
declare r text[];
begin
  perform 1 from public.profiles p where p.id = auth.uid() for update;
  if not found then raise exception 'Research permission denied' using errcode = '42501'; end if;
  perform 1 from public.user_roles u where u.user_id = auth.uid() order by u.id for share;
  perform 1 from public.roles r join public.user_roles u on u.role_id = r.id
    where u.user_id = auth.uid() order by r.id for share of r;
  select private.current_app_roles() into r;
  if cardinality(r) = 0 then raise exception 'Research permission denied' using errcode = '42501'; end if;
  return r;
end;
$$;

create function private.research_require(r text[], p_permission text)
returns void language plpgsql immutable security invoker set search_path = '' as $$
begin
  if coalesce(case
    when p_permission in ('create','edit') then r && array['owner','admin','editor','analyst']
    when p_permission in ('schedule','publish','archive','restore') then r && array['owner','admin','editor']
    when p_permission in ('classification.change','author.assign','author.manage') then r && array['owner','admin']
    else false end, false) then return; end if;
  raise exception 'Research permission denied' using errcode = '42501';
end;
$$;

create function private.research_locked_article(p_id uuid, p_revision bigint, r text[])
returns public.articles language plpgsql volatile security invoker set search_path = '' as $$
declare a public.articles;
begin
  select * into a from public.articles where id = p_id for update;
  -- Legacy DRAFT author_id may be NULL: SQL UNKNOWN is denial, not permission.
  if not found or (r && array['owner','admin','editor']
    or (r @> array['analyst'] and a.author_id = auth.uid() and a.status = 'DRAFT')) is not true then
    raise exception 'Research unavailable' using errcode = '42501';
  end if;
  if p_revision is null or p_revision < 1 or a.revision <> p_revision then
    raise exception 'Research revision conflict' using errcode = '40001';
  end if;
  return a;
end;
$$;

create function private.research_input_valid(p_input jsonb, p_create boolean)
returns void language plpgsql immutable security invoker set search_path = '' as $$
declare keys text[] := array['title','slug','dek','category','ai_assisted','tldr','body_blocks',
  'key_facts','disclosure','seo_title','seo_description','sources','related_research','related_tokens','reason'];
  k text;
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
  if p_input ? 'reason' and (length(btrim(p_input->>'reason')) not between 1 and 500
    or p_input->>'reason' ~ '[[:cntrl:]]') then
    raise exception 'Invalid Research reason' using errcode = '22023';
  end if;
end;
$$;

create function private.research_reason(p_reason text)
returns void language plpgsql immutable security invoker set search_path = '' as $$
begin
  if p_reason is null or length(btrim(p_reason)) not between 1 and 500 or p_reason ~ '[[:cntrl:]]' then
    raise exception 'Research reason required' using errcode = '22023';
  end if;
end;
$$;

create function private.research_snapshot(a public.articles)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('status', a.status, 'classification', a.classification,
    'ai_assisted', a.ai_assisted, 'author_id', a.author_id, 'public_author_id', a.public_author_id,
    'revision', a.revision, 'scheduled_at', a.scheduled_at, 'published_at', a.published_at,
    'source_ids', coalesce((select jsonb_agg(s.id order by s.position) from public.article_sources s
      where s.article_id = a.id and s.retired_at is null), '[]'::jsonb),
    'related_article_ids', coalesce((select jsonb_agg(r.related_article_id order by r.position)
      from public.article_related_research r where r.article_id = a.id), '[]'::jsonb),
    'related_token_ids', coalesce((select jsonb_agg(r.token_id order by r.position)
      from public.article_tokens r where r.article_id = a.id), '[]'::jsonb));
$$;

create function private.research_receipt(a public.articles, p_action text, p_before jsonb, p_meta jsonb)
returns jsonb language plpgsql volatile security invoker set search_path = '' as $$
declare event_id uuid;
begin
  event_id := public.write_audit_event('USER', auth.uid(), p_action, 'article', a.id,
    p_before, private.research_snapshot(a), jsonb_build_object('schema_version', 1) || p_meta);
  return jsonb_build_object('article_id', a.id, 'revision', a.revision, 'status', a.status, 'audit_id', event_id);
end;
$$;

create function private.research_children(a public.articles, p_input jsonb, r text[])
returns void language plpgsql volatile security invoker set search_path = '' as $$
declare item jsonb; n integer; target uuid; old_source public.article_sources;
  active_ids uuid[]; seen_ids uuid[] := array[]::uuid[]; k text;
begin
  -- Caller already holds the parent lock and has checked editable ownership.
  if p_input ? 'sources' then
    select coalesce(array_agg(id), array[]::uuid[]) into active_ids
      from public.article_sources where article_id = a.id and retired_at is null;
    update public.article_sources set retired_at = statement_timestamp() where article_id = a.id and retired_at is null;
    n := 0;
    for item in select value from jsonb_array_elements(p_input->'sources') loop
      if jsonb_typeof(item) <> 'object'
        or item - array['id','title','publisher','url','published_on','accessed_on']::text[] <> '{}'::jsonb
        or jsonb_typeof(item->'title') is distinct from 'string'
        or jsonb_typeof(item->'publisher') is distinct from 'string'
        or jsonb_typeof(item->'url') is distinct from 'string' then
        raise exception 'Invalid Research source' using errcode = '22023';
      end if;
      foreach k in array array['id','published_on','accessed_on'] loop
        if item ? k and item->k <> 'null'::jsonb and jsonb_typeof(item->k) <> 'string' then
          raise exception 'Invalid Research source field' using errcode = '22023';
        end if;
      end loop;
      target := (item->>'id')::uuid;
      if target is not null then
        if not target = any(active_ids) or target = any(seen_ids) then
          raise exception 'Research source unavailable or duplicate' using errcode = '22023';
        end if;
        seen_ids := array_append(seen_ids, target);
        select * into old_source from public.article_sources where id = target and article_id = a.id;
        if a.published_at is not null and
          (old_source.title, old_source.publisher, old_source.url, old_source.published_on, old_source.accessed_on)
          is distinct from (item->>'title', item->>'publisher', item->>'url',
            (item->>'published_on')::date, (item->>'accessed_on')::date) then
          target := null; -- retain the historical row and append its correction
        end if;
      end if;
      if target is null then
        insert into public.article_sources(article_id,title,publisher,url,published_on,accessed_on,position)
        values (a.id,item->>'title',item->>'publisher',item->>'url',
          (item->>'published_on')::date,(item->>'accessed_on')::date,n);
      else
        update public.article_sources set title=item->>'title',publisher=item->>'publisher',url=item->>'url',
          published_on=(item->>'published_on')::date,accessed_on=(item->>'accessed_on')::date,
          position=n,retired_at=null where id=target and article_id=a.id;
      end if;
      n := n + 1;
    end loop;
  end if;
  if p_input ? 'related_research' then
    delete from public.article_related_research where article_id=a.id;
    n := 0;
    for item in select value from jsonb_array_elements(p_input->'related_research') loop
      if jsonb_typeof(item) <> 'string' then raise exception 'Invalid Research reference' using errcode='22023'; end if;
      target := (item #>> '{}')::uuid;
      if target = a.id or not exists (select 1 from public.articles t where t.id=target and
        (r && array['owner','admin','editor'] or (r @> array['analyst'] and
          ((t.author_id=auth.uid() and t.status='DRAFT') or (t.status='PUBLISHED'
            and t.published_at <= statement_timestamp() and (t.scheduled_at is null or t.scheduled_at <= statement_timestamp())))))) then
        raise exception 'Research reference unavailable' using errcode='22023';
      end if;
      insert into public.article_related_research(article_id,related_article_id,position) values(a.id,target,n);
      n := n + 1;
    end loop;
  end if;
  if p_input ? 'related_tokens' then
    delete from public.article_tokens where article_id=a.id;
    n := 0;
    for item in select value from jsonb_array_elements(p_input->'related_tokens') loop
      if jsonb_typeof(item) <> 'string' then raise exception 'Invalid token reference' using errcode='22023'; end if;
      target := (item #>> '{}')::uuid;
      if not exists (select 1 from public.tokens where id=target) then
        raise exception 'Token reference unavailable' using errcode='22023';
      end if;
      insert into public.article_tokens(article_id,token_id,position) values(a.id,target,n);
      n := n + 1;
    end loop;
  end if;
end;
$$;

create function private.research_publishable(a public.articles)
returns void language plpgsql volatile security invoker set search_path = '' as $$
begin
  perform 1 from public.research_authors where profile_id=a.public_author_id for update;
  if not found or a.category is null or a.author_id is null or a.public_author_id is distinct from a.author_id
    or length(btrim(a.tldr)) = 0 or a.disclosure is null or length(btrim(a.disclosure)) = 0
    or not exists (select 1 from jsonb_array_elements(a.body_blocks->'sections') s
      cross join lateral jsonb_array_elements(s->'blocks') b
      where b->>'type'='paragraph' and length(btrim(b->>'text')) > 0)
    or not exists (select 1 from public.article_sources where article_id=a.id and retired_at is null) then
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

create function public.create_research_draft(p_input jsonb)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare r text[]; a public.articles; author_uuid uuid; public_uuid uuid; class text;
begin
  r := private.research_actor_roles();
  perform private.research_require(r, 'create');
  perform private.research_input_valid(p_input, true);
  author_uuid := coalesce((p_input->>'author_id')::uuid, auth.uid());
  class := coalesce(p_input->>'classification', 'EDITORIAL');
  if author_uuid <> auth.uid() then perform private.research_require(r, 'author.assign'); end if;
  if not r && array['owner','admin','editor'] and class <> 'EDITORIAL' then
    raise exception 'Research permission denied' using errcode='42501';
  end if;
  if not exists (select 1 from public.profiles where id=author_uuid) then
    raise exception 'Research author unavailable' using errcode='22023';
  end if;
  select profile_id into public_uuid from public.research_authors where profile_id=author_uuid;
  insert into public.articles(title,slug,author_id,public_author_id,classification,dek,category,
    ai_assisted,tldr,body_blocks,key_facts,disclosure,seo_title,seo_description)
  values (p_input->>'title',p_input->>'slug',author_uuid,public_uuid,class,p_input->>'dek',p_input->>'category',
    coalesce((p_input->>'ai_assisted')::boolean,false),coalesce(p_input->>'tldr',''),
    coalesce(p_input->'body_blocks','{"version":1,"sections":[]}'::jsonb),
    coalesce(p_input->'key_facts','[]'::jsonb),p_input->>'disclosure',p_input->>'seo_title',p_input->>'seo_description')
  returning * into a;
  perform private.research_children(a,p_input,r);
  return private.research_receipt(a,'article.created',null,'{}'::jsonb);
exception when unique_violation then
  raise exception 'Research slug or relationship unavailable' using errcode='23505';
end;
$$;

create function public.save_research_draft(p_article_id uuid, p_expected_revision bigint, p_input jsonb)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare r text[]; a public.articles; before_state jsonb; changed jsonb;
begin
  r := private.research_actor_roles();
  perform private.research_require(r,'edit');
  a := private.research_locked_article(p_article_id,p_expected_revision,r);
  if not r && array['owner','admin','editor'] and a.classification <> 'EDITORIAL' then
    raise exception 'Research permission denied' using errcode='42501';
  end if;
  if a.status <> 'DRAFT' then raise exception 'Research must be DRAFT to edit' using errcode='55000'; end if;
  perform private.research_input_valid(p_input,false);
  if a.published_at is not null and p_input ? 'slug' and p_input->>'slug' is distinct from a.slug then
    raise exception 'Published Research slug is immutable' using errcode='55000';
  end if;
  if a.ai_assisted and p_input->'ai_assisted' = 'false'::jsonb then
    perform private.research_reason(p_input->>'reason');
  end if;
  before_state := private.research_snapshot(a);
  select coalesce(jsonb_agg(k order by k),'[]'::jsonb) into changed from jsonb_object_keys(p_input) k where k <> 'reason';
  update public.articles set
    title=case when p_input ? 'title' then p_input->>'title' else title end,
    slug=case when p_input ? 'slug' then p_input->>'slug' else slug end,
    dek=case when p_input ? 'dek' then p_input->>'dek' else dek end,
    category=case when p_input ? 'category' then p_input->>'category' else category end,
    ai_assisted=case when p_input ? 'ai_assisted' then (p_input->>'ai_assisted')::boolean else ai_assisted end,
    tldr=case when p_input ? 'tldr' then p_input->>'tldr' else tldr end,
    body_blocks=case when p_input ? 'body_blocks' then p_input->'body_blocks' else body_blocks end,
    key_facts=case when p_input ? 'key_facts' then p_input->'key_facts' else key_facts end,
    disclosure=case when p_input ? 'disclosure' then p_input->>'disclosure' else disclosure end,
    seo_title=case when p_input ? 'seo_title' then p_input->>'seo_title' else seo_title end,
    seo_description=case when p_input ? 'seo_description' then p_input->>'seo_description' else seo_description end,
    public_author_id=(select profile_id from public.research_authors where profile_id=a.author_id),
    revision=revision+1
  where id=a.id returning * into a;
  perform private.research_children(a,p_input,r);
  return private.research_receipt(a,'article.updated',before_state,
    jsonb_build_object('changed_fields',changed,'reason',p_input->>'reason'));
exception when unique_violation then
  raise exception 'Research slug or relationship unavailable' using errcode='23505';
end;
$$;

create function public.transition_research_article(
  p_article_id uuid, p_expected_revision bigint, p_action text,
  p_scheduled_at timestamptz default null, p_reason text default null
)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare r text[]; a public.articles; before_state jsonb; next_state text; event_name text; time_now timestamptz;
begin
  r := private.research_actor_roles();
  perform private.research_require(r,case when p_action in ('schedule','reschedule','unschedule') then 'schedule' else p_action end);
  a := private.research_locked_article(p_article_id,p_expected_revision,r);
  before_state := private.research_snapshot(a);
  time_now := clock_timestamp();
  if p_action not in ('schedule','reschedule') and p_scheduled_at is not null then
    raise exception 'Unexpected schedule argument' using errcode='22023';
  end if;
  if p_reason is not null then perform private.research_reason(p_reason); end if;
  case p_action
    when 'schedule','reschedule' then
      if (p_action='schedule' and a.status <> 'DRAFT') or (p_action='reschedule' and a.status <> 'SCHEDULED') then
        raise exception 'Invalid Research transition' using errcode='55000';
      end if;
      if p_scheduled_at is null or not isfinite(p_scheduled_at) or p_scheduled_at <= time_now then
        raise exception 'Research schedule must be finite and future' using errcode='22023';
      end if;
      perform private.research_publishable(a);
      next_state := 'SCHEDULED'; a.scheduled_at := p_scheduled_at; event_name := 'article.scheduled';
    when 'unschedule' then
      if a.status <> 'SCHEDULED' then raise exception 'Invalid Research transition' using errcode='55000'; end if;
      perform private.research_reason(p_reason);
      next_state := 'DRAFT'; a.scheduled_at := null; event_name := 'article.unscheduled';
    when 'publish' then
      if a.status not in ('DRAFT','SCHEDULED') or (a.status='SCHEDULED' and a.scheduled_at > time_now) then
        raise exception 'Invalid or not-yet-due Research publication' using errcode='55000';
      end if;
      perform private.research_publishable(a);
      next_state := 'PUBLISHED'; a.published_at := coalesce(a.published_at,clock_timestamp()); event_name := 'article.published';
    when 'archive' then
      if a.status not in ('DRAFT','SCHEDULED','PUBLISHED') then raise exception 'Invalid Research transition' using errcode='55000'; end if;
      perform private.research_reason(p_reason);
      next_state := 'ARCHIVED'; event_name := 'article.archived';
    when 'restore' then
      if a.status <> 'ARCHIVED' then raise exception 'Invalid Research transition' using errcode='55000'; end if;
      perform private.research_reason(p_reason);
      next_state := 'DRAFT'; a.scheduled_at := null; event_name := 'article.restored';
    else raise exception 'Invalid Research transition' using errcode='55000';
  end case;
  update public.articles set status=next_state,scheduled_at=a.scheduled_at,published_at=a.published_at,
    revision=revision+1,published_revision=case when next_state='PUBLISHED' then revision+1 else null end
    where id=a.id returning * into a;
  return private.research_receipt(a,event_name,before_state,jsonb_build_object('reason',p_reason));
end;
$$;

create function public.change_research_classification(
  p_article_id uuid,p_expected_revision bigint,p_classification text,p_disclosure text,p_reason text
)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare r text[]; a public.articles; before_state jsonb; old_disclosure text;
begin
  r := private.research_actor_roles(); perform private.research_require(r,'classification.change');
  a := private.research_locked_article(p_article_id,p_expected_revision,r);
  if a.status <> 'DRAFT' or a.published_at is not null then
    raise exception 'Research classification is not editable' using errcode='55000';
  end if;
  if p_classification is null or p_classification not in ('SPONSORED','PARTNER') or p_classification=a.classification then
    raise exception 'Research classification transition denied' using errcode='42501';
  end if;
  perform private.research_reason(p_reason);
  before_state := private.research_snapshot(a); old_disclosure := a.disclosure;
  update public.articles set classification=p_classification,disclosure=p_disclosure,revision=revision+1
    where id=a.id returning * into a;
  return private.research_receipt(a,'article.classification_changed',before_state,
    jsonb_build_object('reason',p_reason,'previous_disclosure',old_disclosure,'resulting_disclosure',a.disclosure));
end;
$$;

create function public.assign_research_author(p_article_id uuid,p_expected_revision bigint,p_author_id uuid,p_reason text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare r text[]; a public.articles; before_state jsonb; public_uuid uuid;
begin
  r := private.research_actor_roles(); perform private.research_require(r,'author.assign');
  a := private.research_locked_article(p_article_id,p_expected_revision,r);
  if a.status <> 'DRAFT' or a.published_at is not null then raise exception 'Research author is not editable' using errcode='55000'; end if;
  perform private.research_reason(p_reason);
  if p_author_id is null or not exists (select 1 from public.profiles where id=p_author_id) then
    raise exception 'Research author unavailable' using errcode='22023';
  end if;
  perform 1 from public.research_authors where profile_id in (a.public_author_id,p_author_id) order by profile_id for update;
  select profile_id into public_uuid from public.research_authors where profile_id=p_author_id;
  before_state := private.research_snapshot(a);
  update public.articles set author_id=p_author_id,public_author_id=public_uuid,revision=revision+1
    where id=a.id returning * into a;
  return private.research_receipt(a,'article.author_changed',before_state,jsonb_build_object('reason',p_reason));
end;
$$;

create function public.save_research_author(p_profile_id uuid,p_display_name text,p_title text default null)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare r text[]; old_author public.research_authors; new_author public.research_authors; event_id uuid;
begin
  r := private.research_actor_roles(); perform private.research_require(r,'author.manage');
  if p_profile_id is null or not exists (select 1 from public.profiles where id=p_profile_id) then
    raise exception 'Research author unavailable' using errcode='22023';
  end if;
  select * into old_author from public.research_authors where profile_id=p_profile_id for update;
  -- No article lock after this byline lock: publication locks article -> byline.
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

create function public.research_token_options(p_search text default '',p_limit integer default 20)
returns table(id uuid,chain text,contract_address text,symbol text,name text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.current_app_roles() && array['owner','admin','editor','analyst'] then
    raise exception 'Research permission denied' using errcode='42501';
  end if;
  if p_search is null or length(p_search)>200 or p_limit is null or p_limit not between 1 and 50 then
    raise exception 'Invalid token search' using errcode='22023';
  end if;
  return query select t.id,t.chain,t.contract_address,t.symbol,t.name from public.tokens t
    where p_search='' or t.contract_address=p_search
      or strpos(lower(coalesce(t.symbol,'')),lower(p_search))>0 or strpos(lower(coalesce(t.name,'')),lower(p_search))>0
    order by t.id limit p_limit;
end;
$$;

grant select(dek,category,ai_assisted,public_author_id,body_blocks,key_facts,revision,published_revision)
  on public.articles to authenticated;
grant select(profile_id,display_name,title) on public.research_authors to authenticated;
grant select(id,article_id,title,publisher,url,published_on,accessed_on,position,retired_at)
  on public.article_sources to authenticated;
grant select(article_id,related_article_id,position) on public.article_related_research to authenticated;
grant select(article_id,token_id,position) on public.article_tokens to authenticated;

create policy article_sources_staff_select on public.article_sources for select to authenticated using (
  exists(select 1 from public.articles a where a.id=article_id)
  and (retired_at is null or (select private.current_app_roles()) && array['owner','admin','editor']));
create policy article_related_research_staff_select on public.article_related_research for select to authenticated using (
  exists(select 1 from public.articles a where a.id=article_id)
  and exists(select 1 from public.articles a where a.id=related_article_id));
create policy article_tokens_staff_select on public.article_tokens for select to authenticated using (
  exists(select 1 from public.articles a where a.id=article_id));
create policy research_authors_staff_select on public.research_authors for select to authenticated using (
  (select private.current_app_roles()) && array['owner','admin','editor']
  or ((select private.current_app_roles()) @> array['analyst'] and profile_id=(select auth.uid()))
  or ((select private.current_app_roles()) && array['analyst','viewer'] and exists (
    select 1 from public.articles a where a.public_author_id=profile_id and a.status='PUBLISHED'
      and a.published_at <= statement_timestamp() and (a.scheduled_at is null or a.scheduled_at <= statement_timestamp()))));

revoke all on function private.research_available(), private.research_is_public(public.articles),
  private.research_actor_roles(),private.research_require(text[],text),
  private.research_locked_article(uuid,bigint,text[]),private.research_input_valid(jsonb,boolean),
  private.research_reason(text),private.research_snapshot(public.articles),
  private.research_receipt(public.articles,text,jsonb,jsonb),private.research_children(public.articles,jsonb,text[]),
  private.research_publishable(public.articles) from public,anon,authenticated,service_role;

revoke all on function public.read_public_research_page(text,jsonb,integer),public.read_public_research_article(text),
  public.create_research_draft(jsonb),public.save_research_draft(uuid,bigint,jsonb),
  public.transition_research_article(uuid,bigint,text,timestamptz,text),
  public.change_research_classification(uuid,bigint,text,text,text),
  public.assign_research_author(uuid,bigint,uuid,text),public.save_research_author(uuid,text,text),
  public.research_token_options(text,integer) from public,anon,authenticated,service_role;
grant execute on function public.read_public_research_page(text,jsonb,integer),public.read_public_research_article(text) to anon,authenticated;
grant execute on function public.create_research_draft(jsonb),public.save_research_draft(uuid,bigint,jsonb),
  public.transition_research_article(uuid,bigint,text,timestamptz,text),
  public.change_research_classification(uuid,bigint,text,text,text),
  public.assign_research_author(uuid,bigint,uuid,text),public.save_research_author(uuid,text,text),
  public.research_token_options(text,integer) to authenticated;

commit;
