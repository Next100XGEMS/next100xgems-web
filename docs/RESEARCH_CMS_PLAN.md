# Research CMS architecture and security plan — Gate 18A

Status: planning only. This document proposes Gate 18 implementation; it does not enable publication, database access, mutations, or a CMS. Inspected on 2026-09-07 on `feat/research-public`, following Gate 17 commit `bd5a721`. Only this document is created by Gate 18A.

## 1. Evidence and existing schema assessment

Read: `AGENTS.md`, `RESEARCH.md`, `DATABASE.md`, `AUTHORIZATION_PLAN.md`, `AUDIT_LOGGING.md`, `ADMIN_SPEC.md`, `SECURITY.md`, `PROJECT_SPEC.md`, and `ROADMAP.md`. Implementation evidence takes precedence over historical descriptions of earlier gates in those documents.

Relevant inspected implementation:

- `supabase/migrations/20260906000002_content_commercial_foundation.sql`: article definition, indexes, RLS and timestamp trigger.
- `20260906000001_core_foundation.sql`: profiles, role assignments, timestamps and append-only audit table; `20260906000003_radar_foundation.sql`: canonical token definition only.
- `20260906000004_authorization.sql` and `20260906000005_authorization_predicate_fix.sql`: current grants, policies and corrected membership resolver.
- `20260906000006_audit_logging.sql` and `src/lib/audit/server.ts`: trusted audit append contract.
- `src/lib/auth/authorization.ts`, `src/lib/supabase/server.ts`, `src/lib/feature-flags/server.ts`, and the Admin Research placeholder/access/navigation components.
- `src/components/research/research-content.ts`, `research-article.tsx`, Research public routes, the development preview, root metadata and existing Research tests.

This is a migration/source assessment, not a live database catalogue attestation. No database connection, CLI reset, credential read, remote project access or runtime mutation was performed. Gate 18B must compare the local catalogue and actual existing content to this baseline before applying changes.

### Current `public.articles` columns

| Column | PostgreSQL type / nullability | Current default or constraint |
|---|---|---|
| `id` | `uuid NOT NULL` | Primary key; `gen_random_uuid()` |
| `title` | `text NOT NULL` | `length(btrim(title)) > 0` |
| `slug` | `text NOT NULL` | Unique; `^[a-z0-9]+(-[a-z0-9]+)*$` |
| `author_id` | nullable `uuid` | FK to `public.profiles(id)`, `ON DELETE RESTRICT` |
| `status` | `text NOT NULL` | Default `DRAFT`; DRAFT / SCHEDULED / PUBLISHED / ARCHIVED |
| `classification` | `text NOT NULL` | Default `EDITORIAL`; EDITORIAL / SPONSORED / PARTNER / AI_ASSISTED |
| `tldr` | `text NOT NULL` | Default empty string |
| `body_markdown` | `text NOT NULL` | Default empty string |
| `seo_title` | nullable `text` | No content/length validation |
| `seo_description` | nullable `text` | No content/length validation |
| `disclosure` | nullable `text` | Nonblank for every classification other than EDITORIAL |
| `scheduled_at` | nullable `timestamptz` | Required when SCHEDULED |
| `published_at` | nullable `timestamptz` | Required when PUBLISHED |
| `created_at` | `timestamptz NOT NULL` | Default `now()` |
| `updated_at` | `timestamptz NOT NULL` | Default `now()`; `set_updated_at` trigger sets `statement_timestamp()` on UPDATE |

`articles_disclosure_check` enforces the non-editorial disclosure requirement. `articles_publication_check` requires the relevant timestamp and an author for SCHEDULED/PUBLISHED; it does not validate article completeness, transitions, permissions, scheduling execution, or audit insertion. There is no editorial note column today.

Indexes: primary key index `articles_pkey`, unique slug index `articles_slug_key`, `articles_author_id_idx(author_id)`, and `articles_status_published_idx(status, published_at DESC)`. Do not duplicate these.

RLS is enabled. The one current article policy is `articles_staff_select`, SELECT for `authenticated`:

- Owner/Admin/Editor: all article rows.
- Analyst: own DRAFT (`author_id = auth.uid()`) and eligible PUBLISHED rows.
- Viewer: eligible PUBLISHED rows.
- Radar Reviewer, Ad Manager, authenticated no-role users, suspended/archived profiles and conflicting role combinations: no article rows under their sole/effective roles.

Current internal published eligibility is PUBLISHED with `published_at <= statement_timestamp()` and `scheduled_at IS NULL OR scheduled_at <= statement_timestamp()`. It does not enforce feature flags or a reviewed-content version.

`authenticated` has column SELECT on exactly the 16 columns listed above. There are no API-role article DML privileges or mutation policies. `PUBLIC`, `anon` and `service_role` have no article table grants. Audit function EXECUTE is a separate grant, not article access. Current access classification: private staff content with a restricted internal published reader; not an active anonymous publication contract.

### Gaps against Gate 17

Missing: category, dek, independent AI indicator, structured body, Key Facts, ordered sources, related article/token relationships, intentionally public author data, concurrency version, validated-publication marker, transition enforcement, public projections, CMS operation permissions, transactional audited writes and scheduling semantics. Media remains an optional presentation reference only.

Gate 17's production collection is an empty array. Its routes neither read articles nor publish records. Its `ResearchArticle` requires a real publication timestamp, so it cannot be reused unchanged as a draft DTO. The renderer currently emits JSON-LD even with `previewLabel`, supports paragraphs/pull quotes rather than ordered blocks, treats unknown evidence as CONTEXT, and accepts related-token hrefs without the source-link protocol guard. These are integration requirements before real CMS data is rendered, not evidence of a present unpublished-data leak.

## 2. Proposed final data model

Keep `public.articles` as the aggregate root. Add four small relational tables; do not add another article database model, generic CMS framework, category database, tenant system or permissions table. Existing scalar columns remain scalar.

### Article evolution

| Proposed addition/change | Type and rule | Purpose |
|---|---|---|
| `dek` | nullable text, max 500 characters | Optional subtitle |
| `category` | nullable text while DRAFT/ARCHIVED; CHECK in MARKET / MEMECOINS / ALTCOINS / DEEP_DIVES | Fixed, migration-controlled keys mapped to the four approved display labels |
| `ai_assisted` | boolean NOT NULL, default false | Independent of primary classification |
| `classification` | retain text; replace CHECK to allow only EDITORIAL / SPONSORED / PARTNER after reviewed legacy reconciliation | Prevent conflating production method with compensation |
| `public_author_id` | nullable UUID FK to `research_authors(profile_id)`, RESTRICT; when present must equal non-null `author_id` | Public byline without replacing existing ownership semantics |
| `body_blocks` | JSONB NOT NULL, versioned empty document default; exact bounded schema below | Constrained reading content |
| `key_facts` | JSONB NOT NULL, default `[]`; exact bounded schema below | Short ordered observations |
| `revision` | bigint NOT NULL, default 1, CHECK > 0 | Optimistic concurrency; server/database managed |
| `published_revision` | nullable bigint | Set only by publication after full validation; PUBLISHED requires equality to `revision` |

Retain `author_id` as the private, accountable author UUID and Analyst ownership predicate. Drafts can have `author_id` without a prepared public byline; publication requires both matching references. `public_author_id` is not another person ID: it references the same profile UUID in a public-display overlay. Do not expose either account UUID in public author output.

Retain `scheduled_at`; use it for the requested `scheduled_for` concept without introducing a second scheduling column. Retain publication/creation/update timestamps and SEO columns. No automatic conversion of private `profiles.display_name` into a public byline.

Retain `body_markdown` as legacy storage with its existing default. New CMS writes cannot set it; public projections never include or render it. Explicitly migrate any real legacy body through reviewed conversion before publication; an empty `body_blocks` must not cause a fallback to Markdown/HTML. Removal of the old column is a later compatibility decision, not a historical migration edit.

Final relational tables:

| Table | Main fields and keys | Integrity / lifecycle |
|---|---|---|
| `research_authors` | `profile_id uuid PK/FK profiles(id)`, `display_name text NOT NULL`, `title text NULL`, `created_at`, `updated_at` | Public identity overlay; RESTRICT references; contains no email/status/roles; mutable by a narrow Owner/Admin operation under section 8 |
| `article_sources` | `id uuid PK`, `article_id uuid FK`, `title text`, `publisher text`, `url text`, `published_on date NULL`, `accessed_on date NULL`, `position integer`, `retired_at timestamptz NULL`, `created_at`, `updated_at` | Article FK RESTRICT; active ordering unique per article; retired rows excluded from public/normal editor views |
| `article_related_research` | `article_id uuid`, `related_article_id uuid`, `position integer`, `created_at` | Composite PK; both FKs RESTRICT; self-reference denied; `(article_id, position)` unique |
| `article_tokens` | `article_id uuid`, `token_id uuid`, `position integer`, `created_at` | Composite PK; FKs to articles/tokens RESTRICT; `(article_id, position)` unique |

Use existing UUID/timestamptz conventions and timestamp triggers on new mutable tables. Add reverse-FK indexes on `article_related_research(related_article_id)` and `article_tokens(token_id)`, `articles(public_author_id)` for byline dependencies, an article/source lookup index, and a partial scheduling index on `scheduled_at, id` for SCHEDULED rows. Active source order uniqueness is partial on `(article_id, position) WHERE retired_at IS NULL`. Existing article indexes serve author and publication lookups. No JSON GIN or full-text index is justified yet.

No private editorial notes or review workflow are added. If later required, put them behind separate restricted storage/projections instead of adding fields to a public DTO. No seeds of articles, authors, dates, sources, partners or tokens.

## 3. Article body representation

| Option | Assessment for this project |
|---|---|
| Markdown | Existing column is useful legacy storage, but structured callouts/embeds would need custom syntax, a parser and strict handling of raw HTML/URLs. It does not naturally match the approved structured renderer. |
| Constrained JSON blocks | Recommended. Bounded typed sections and block variants map to React elements, support a simple form editor and can be validated in PostgreSQL and TypeScript. |
| Sanitized HTML | Requires a maintained sanitizer, an HTML allowlist and careful treatment of attributes/URLs. Unnecessary executable-markup surface for this phase. |
| Plain text only | Safe but cannot preserve heading, quote, callout and data-placeholder structure without ad hoc conventions. |

`body_blocks` version 1 is an object with exactly `version: 1` and `sections`. Each section contains a stable document-local `id`, plain-text `heading`, and ordered `blocks`. Block discriminants:

- `paragraph`: `text`.
- `quote`: `text`, optional supplied plain-text `attribution`.
- `callout`: `label`, `text`; no arbitrary CSS or evidence badge selected through markup.
- `data_placeholder`: `label`, `description`; no script, iframe, query, provider URL or renderer name. This marks unavailable data explicitly, not a fabricated chart.

Section headings provide the heading architecture. Do not allow a content editor to inject H1, raw tags, JSX, MDX, scripts, CSS, arbitrary component names, event handlers or HTML blocks. Body strings are always React text. Unknown keys/types fail validation rather than being forwarded to components.

Later extend Gate 17's section contract to accept these ordered blocks and render a closed switch while preserving its reading measure, hierarchy and primitives. Do not flatten callouts/quotes into paragraphs or maintain two competing content renderers. Legacy test fixtures may be adapted once to the new contract in the application integration gate. No rich-text/editor dependency is needed for the first CMS.

## 4. Sources model

Normalize sources: article ownership, stable identifiers, order, retirement and URL constraints materially benefit from a relational table. Dates are optional `date` values because a source's publication day is often known without a precise instant. Map them to the existing source presentation fields; never manufacture midnight timestamps as claimed source precision.

Each active source requires title, publisher, a validated absolute HTTP(S) URL and non-negative position. Enforce aggregate count/order under the locked article transaction. Application validation uses a URL parser; the database additionally enforces the supported lexical subset and field limits. Explicitly reject unsafe protocols, userinfo, control characters, whitespace, backslashes, protocol-relative URLs and an empty host. No URL is fetched, resolved, scraped or unfurled by this gate; therefore a URL does not authorize server network access. Future fetching needs its own SSRF policy.

The renderer keeps `noopener noreferrer` and a clear new-tab label. Use wrapping for long text/links. An invalid stored source must fail the public DTO validation, not become an active unsafe link.

All source writes go through the article save transaction in DRAFT. Once `published_at` is non-null, existing source rows are retained: a correction retires the old row and appends its replacement; removal retires it. No hard-delete source operation exists. Active sources alone participate in publication validation and public output. Retired sources remain limited to Owner/Admin/Editor history access. Source identity/retirement changes are included in the article audit event; no cascading article deletion can erase them.

## 5. Key Facts model

Store a small ordered JSON array on the article: `{label, detail, evidence?}`. The array position is the order. No independent fact IDs or table are needed without cross-article queries/reuse.

`detail` can hold a text value with its context; do not add a universal numeric unit system. Evidence, when provided, uses VERIFIED_DATA / STRONG_SIGNAL / AI_INFERENCE / UNKNOWN and maps explicitly to existing presentation keys. Unclassified facts have no badge; UNKNOWN must remain visibly unknown rather than silently become verified. AI_INFERENCE is not evidence of payment. Selecting a badge is a claim requiring editorial review, not a database certification. No automatic verification flag is inferred from the existence of a source URL.

## 6. Related Research

Use directional curation: A may recommend B as additional reading without creating B → A. The composite key prevents duplicates, a CHECK denies A → A, and an order constraint prevents ambiguous ordering. Both FKs use RESTRICT.

The editor selects only references it is allowed to read. At publish/schedule validation, related targets must be currently eligible published Research. If a target is later archived/disabled, dynamically omit it from public related output without exposing its title, slug, ID, count or absence reason. Parent publication alone never grants access to the target. A stale target can be removed during the next draft edit; it need not force the parent offline.

Relationship removal is permitted only inside an authorized DRAFT save and its audit event. It removes the association, not either article or its sources/audit history. No automatically symmetric links, graph engine or recommendation model.

## 7. Related Tokens

Reuse `public.tokens.id`; never copy symbol/chain/contract identity into article JSON or make a parallel token registry. The existing canonical key is `(chain, contract_address_key)` with EVM case normalization and chain-specific identity rules.

A curated relationship allows public display only of `symbol`, `name`, `chain`, and `contract_address` for tokens attached to an eligible published article. It grants no access to other registry entries, Radar analyses, scores, review notes or risk data. This is a narrow new Research reference use of the registry, not implementation of Radar publication.

Editor currently lacks token-registry SELECT. Add a named authenticated `research_token_options` projection for Owner/Admin/Editor/Analyst with only identity fields, bounded search by symbol/name/exact identity and a small result limit. Do not broaden `tokens_staff_select` for Editor or permit token creation/relabeling through Research. Analyst must still own the edited DRAFT. Validate the selected token exists; never upsert it from a submitted symbol.

This picker is a separate narrow trusted-definer read RPC: verified ACTIVE roles checked inside SQL, fixed columns/static query/empty search path, maximum 50 results, no private Radar joins, and EXECUTE for authenticated only after revoking defaults. A caller cannot choose the table or fields. Its registry identity search is an explicit staff capability, not the public projection reader's permission.

The public renderer shows contextual identity, no price target, buy/sell control or endorsement. Omit a token route link until an actual permitted public token route exists. Do not accept arbitrary hrefs from CMS input. Symbol/name can be null in the canonical registry: either render the real chain/contract identity with optional labels, or omit a display module that cannot be represented safely; never invent a symbol. Extend the presentation type accordingly in 18C.

## 8. Authors and private identity

Keep the existing Auth → profile → role model. `research_authors` is a byline overlay keyed by the existing profile UUID, not an authentication or guest-author system. Only name and optional title are intended for public use. Name publication must be explicitly configured, not derived from Auth email or private metadata.

Owner/Admin can prepare a byline for an existing legitimate profile through an audited `research.author.manage` operation. No user, profile status or role assignment is created or changed by it. Editor gets a bounded byline picker with UUID/display name/title only, not a directory query on profiles. Analyst can use only its own byline; a missing byline does not block saving an own draft but blocks scheduling/publication until configured.

Author attribution and mutation actor are separate: an Editor can save another author's permitted draft, while the audit actor remains the actual Editor. Changing the accountable author is a separate Owner/Admin-only pre-publication operation that updates both article references consistently; Analyst cannot use this to claim or surrender arbitrary ownership. All FK and row checks occur before persistence.

To avoid silently rewriting published bylines across articles, a byline's public fields become read-only once referenced by any article with non-null `published_at`. Initial preparation and correction before first publication remain possible. Later historical byline corrections/pseudonymization require a separately reviewed audited procedure; do not delete an account to erase attribution. Public attribution does not require the historic author's profile to stay ACTIVE. Profile suspension denies their access but does not itself withdraw otherwise eligible published work.

## 9. Classification and commercial trust rules

Primary classification is exactly EDITORIAL, SPONSORED or PARTNER. `ai_assisted` is independent. The DTO adapter uses an exhaustive uppercase-database to lowercase-presentation mapping; unknown classification fails closed, never defaults to Editorial.

- Owner/Admin/Editor may create accurately classified drafts of all three primary kinds. Analyst creates EDITORIAL own drafts only and cannot edit Sponsored/Partner content.
- Ordinary save cannot change classification. Before first publication, an Owner/Admin-only `research.classification.change` operation can move EDITORIAL → SPONSORED/PARTNER or SPONSORED ↔ PARTNER, with nonblank reason and updated disclosure. A paid article cannot become EDITORIAL through this CMS. A genuinely separate independent article must be separately authored and reviewed.
- Once first published, classification and slug are immutable through the CMS, including after archival/restoration. Classification corrections affecting published history need a later explicit correction policy; archive the misleading record immediately if necessary.
- SPONSORED/PARTNER require a nonblank specific relationship disclosure even in DRAFT. Scheduling/publication requires a nonblank disclosure for every classification, plus an explicit AI-assistance explanation when the indicator is true.
- Changing or removing the AI indicator is allowed only during an authorized DRAFT save, requires a reason when previously true, and is included explicitly in the audit diff. It cannot alter the primary classification.
- Ad Manager gets no Research mutation or unpublished-read permission, including for Sponsored/Partner articles. Commercial management permissions never imply content authority. Mixed-role rejection remains exactly Gate 6's corrected rule, including its behavior when Owner/Admin is also assigned.

No advertising, payment or partner-state trigger updates article content/classification. Human review of claims remains necessary; schema checks cannot establish the truth of an article or the independence of a writer's judgment.

## 10. Publication state machine

There is one mutable article version in Gate 18. Published and scheduled content is read-only. Changes require returning to DRAFT through explicit transitions; this avoids leaking work in progress through the current public row. Concurrent live/staged editions and full revision history are deferred.

| From | Action | To | Required checks |
|---|---|---|---|
| No record | Create | DRAFT | Create permission; valid draft; server UUID/actor attribution |
| DRAFT | Save | DRAFT | Edit scope, expected revision, content validation |
| DRAFT | Schedule | SCHEDULED | Schedule permission, publication-complete content, future schedule |
| SCHEDULED | Reschedule | SCHEDULED | Schedule permission, expected revision, valid future time; content unchanged |
| SCHEDULED | Unschedule | DRAFT | Schedule permission; clear `scheduled_at` |
| DRAFT | Publish now | PUBLISHED | Publish permission; full validation; actual database time |
| SCHEDULED | Publish due | PUBLISHED | Publish permission; `scheduled_at <= database time`; full revalidation |
| DRAFT / SCHEDULED / PUBLISHED | Archive | ARCHIVED | Archive permission; immediately non-public |
| ARCHIVED | Restore for editing | DRAFT | Restore permission; clear schedule/publication marker |

All other transitions are denied. No direct PUBLISHED → DRAFT, ARCHIVED → PUBLISHED or same-state publication shortcut. To correct published content: Archive → Restore → Edit → Publish. The Admin UI must explain that the article is offline during this process. Analyst cannot publish, schedule, archive, restore or unschedule under its sole role.

Timestamp semantics:

- `published_at` is the actual first publication time, set by the database, never backdated or supplied by the browser. It remains historical evidence after archival/restoration and is preserved on republication. Audit events capture each later publication time.
- `scheduled_at` is the planned earliest manual publication instant. Set/reschedule only in the scheduling operation. Clear on unschedule and restore; archival may retain it as historical context. Retain a due schedule on publication so existing time eligibility remains coherent.
- `updated_at` is database-managed for each aggregate change, including sources/relations/lifecycle. Public `dateModified` describes the last saved/published aggregate modification, not a private note edit. No private-note writes exist here.
- `revision` increments for every successful aggregate mutation. `published_revision` is set to the resulting revision only after validated publication and cleared on withdrawal. Require a non-null equal marker when PUBLISHED; clients cannot submit either generated value.

No automatic scheduled publisher, cron, queue or worker exists in Gate 18. A past-due SCHEDULED row stays private indefinitely until an authorized person selects Publish. Show “Due — awaiting publication” in Admin; never use time alone as a public-state substitute.

Scheduling/publishing requires Research enabled and maintenance explicitly off; saving/withdrawing remains allowed during outages/maintenance for authorized staff. Disabling availability suppresses published output without rewriting lifecycle. Re-enabling may expose already-published eligible rows, never scheduled ones.

## 11. Public read architecture and exact boundary

Recommend B: a server-mediated presentation API backed by narrow database RPC projections. Avoid a Supabase secret-key article reader. Next.js uses a stateless publishable-key client without staff cookies for public Research and receives public DTOs only. The database projection is also safe when called directly or from an authenticated session.

Why not raw anon SELECT plus an application filter? Public articles mix private account IDs, legacy content and operational fields; child token/byline access also needs careful scoping. Keep raw anon table access closed and make the returned field list explicit. An invoker view would still require underlying grants; it does not inherently solve that boundary.

### Database enforcement without an owner-bypass read

Create one narrow database role, `research_public_reader`: NOLOGIN, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOREPLICATION, NOBYPASSRLS, no membership in application/service roles. It owns only the two read projection functions, never tables. No app/API/authenticator role may inherit or SET ROLE to it. This role is justified specifically to keep RLS active inside the public projections while withholding raw tables from anon; it is not a new application identity system. Verify role creation/ownership support locally before acceptance.

Proposed public functions: `read_public_research_page(category, cursor, limit)` and `read_public_research_article(slug)`. They are read-only/STABLE, SECURITY DEFINER under that restricted reader, with empty search path, `row_security=on`, explicit columns and static SQL. Revoke inherited PUBLIC/default EXECUTE then grant exact signatures to anon/authenticated. Do not grant raw tables or read RPCs to the API `service_role` as a convenience. Direct authenticated calls deliberately get the same public-only data, regardless of staff permission.

Give the reader column SELECT only where required for publication predicates and returned fields. RLS article eligibility is:

1. Status exactly PUBLISHED.
2. Non-null `published_at <= statement_timestamp()` and absent/due `scheduled_at`.
3. Non-null `published_revision = revision`, established by the controlled publish operation.
4. `research_enabled` explicitly true and `maintenance_mode` explicitly false, with valid configuration and expected rows.

A tiny private STABLE definer boolean helper may inspect only those two protected flags, matching Gate 7 safe defaults/configuration validity. Give EXECUTE only to the projection role and trusted CMS implementation as needed; no public access to flag rows/configuration or generic flag writer. Missing/malformed values deny serving. Predicate checks also remain inside the projection SQL as defense against later policy mistakes.

Publication-time validation enforces complete byline, valid category/body/sources and required disclosure. The article row predicate must not depend on child RLS policies: children depend on eligible parent articles, not the reverse, preventing policy recursion. The public adapter validates required fields again and refuses malformed output rather than showing partial misleading content.

### Public grants and projections

| Resource | Anonymous raw access | Projection reader RLS / output |
|---|---|---|
| Articles | None | Eligible published only; return id/slug/title/dek/category/classification/AI, TL;DR/Key Facts/blocks/disclosure/SEO and public timestamps |
| Sources | None | Active source rows with eligible parent; no retired rows or operational timestamps |
| Related articles | None | Both parent and target must be eligible; return only target title/slug/category |
| Article-token links | None | Eligible parent required; used to constrain canonical identity output |
| Canonical tokens | None | Only identities referenced by an eligible parent; no entire registry enumeration |
| Public bylines | None | Only bylines attached to eligible parent; return display name/title, never profile UUID |
| Profiles/Auth/roles/audit | None | No reader grant, no joins through these objects |

`articles` eligibility has no byline/source/token joins; source/link/byline policies may consult eligible articles, and token policy may consult eligible article-token links. Ensure this dependency graph remains acyclic. Public related target filtering uses the same eligible article policy, not the broad staff policy.

A list response contains only summary fields, not all article bodies. A detail response aggregates children in one database statement/snapshot; no parent-public/child-draft race across separate HTTP reads. Sorting is deterministic by publication time then ID, category is allowlisted, maximum page size 50 and cursor is validated. Errors return no data, not a privileged fallback. Unknown/unavailable articles return not-found with no hidden-state distinction.

Keep existing authenticated staff RLS scoped separately; no-role users still receive no raw/private Research rows. Since published information is intentionally public, any identity can obtain that limited public projection; this is not Admin membership or a private-read grant. Test this distinction explicitly.

### Authenticated child reads

Grant explicit SELECT columns only on the new staff-readable tables; never `SELECT *` grants or DML. Reuse the current article staff predicate for parent visibility, without letting parent access reveal an inaccessible related target.

| Table | Proposed authenticated SELECT policy |
|---|---|
| `article_sources` | Active rows whose parent is staff-readable; retired rows only for Owner/Admin/Editor with parent access |
| `article_related_research` | Parent AND target must both be staff-readable; no hidden-target UUID leakage |
| `article_tokens` | Parent must be staff-readable; identity details come from the scoped token picker, not broader token-table grants |
| `research_authors` | Owner/Admin/Editor may read configured public bylines; Analyst may read self or bylines on internally eligible published articles; Viewer only the latter; other/no effective roles denied |

For bylines expose only `profile_id, display_name, title` to authenticated staff. The UUID is an internal form reference and never enters the public DTO. The Editor picker reads this public-display overlay under RLS, not the private profile directory. For other child tables grant only the explicitly listed content/reference/order/retirement fields needed by forms; creation/update timestamps are not required. Article SELECT grants expand explicitly for the added CMS fields, preserving existing Gate 6 row scope. Public-reader policies target only `research_public_reader`, so broad staff policies cannot OR into public serving.

### Freshness and caching

Gate 18C must replace the current static empty routes with request-time public reads and `no-store` behavior, including metadata and any homepage Research consumption. Do not use build-time publication snapshots, ISR/shared data caches or a staff-cookie client on public routes. Metadata and body may share only one request-local public result; Admin preview has a separate read function/cache namespace. Archive/flag changes suppress subsequent requests after commit; already-delivered public material cannot be recalled. Later persistent caching needs an explicit withdrawal bound and invalidation design.

## 12. Admin permission matrix

All entries below require live ACTIVE membership and the existing mixed-role rule. Existing roles remain unchanged. These are proposed new capabilities, not permissions already present in `Permission` today.

| Operation | Owner | Admin | Editor | Analyst | Ad Manager | Radar Reviewer | Viewer |
|---|---|---|---|---|---|---|---|
| Private Research read | All | All | All | Own DRAFT + eligible PUBLISHED | No | No | Eligible PUBLISHED only |
| Create | Any classification | Any | Any | Own EDITORIAL DRAFT | No | No | No |
| Edit content | DRAFT only | DRAFT only | DRAFT only | Own EDITORIAL DRAFT only | No | No | No |
| Schedule/reschedule/unschedule | Yes | Yes | Yes | No | No | No | No |
| Publish/re-publish | Yes | Yes | Yes | No | No | No | No |
| Archive / restore to DRAFT | Yes | Yes | Yes | No | No | No | No |
| Change classification | Restricted section 9 | Same | No | No | No | No | No |
| Reassign author | Before first publish | Same | No | No | No | No | No |
| Prepare public byline | Section 8 | Section 8 | No | No | No | No | No |
| Preview unpublished | All allowed states | Same | Same | Own DRAFT only | No | No | No |
| Hard-delete article/source | No | No | No | No | No | No | No |

Keep `research.read.all`, `research.read.own_draft`, `research.read.published`. Add explicit permissions `research.create`, `research.edit`, `research.schedule`, `research.publish`, `research.archive`, `research.restore`, `research.classification.change`, `research.author.assign`, `research.author.manage`. The first two carry the Analyst ownership/classification restriction in both application and SQL. Permission membership alone never authorizes a submitted ID.

Editor editing correctly classified paid content fits editorial management; Ad Manager's commercial access does not confer it. Owner/Admin may span domains but still cannot relabel paid material Editorial or bypass validation/audit. A permitted role union expands only the named operations; an incompatible union yields no effective roles, including with Owner present.

No hard-delete permission, per-user overrides, generic `isAdmin` writer or UI-based enforcement. Read-only Viewer views have no mutation controls and direct requests still deny every write.

## 13. Server mutation architecture

Later Server Actions live behind named Research domain functions in the existing modular monolith. Each call independently uses verified identity → current ACTIVE membership → named permission → input/resource validation → one user-session RPC → confirmed receipt. Layout and Proxy checks are supplementary. The browser never selects an actor, SQL, table name, audit action or arbitrary patch field.

Proposed RPC surface, implemented only in 18B:

- `create_research_draft`: bounded core input, content/sources/related references; derives actor and forces DRAFT. Analyst author/classification are forced to self/EDITORIAL.
- `save_research_draft`: article ID, expected revision, bounded allowed content fields and child edits. Status/classification/author/generated timestamps are excluded.
- `transition_research_article`: article ID, expected revision, exact action enum (`schedule`, `reschedule`, `unschedule`, `publish`, `archive`, `restore`), schedule/reason only when relevant. Closed switch, not an arbitrary state setter.
- `change_research_classification`, `assign_research_author`, `save_research_author`: narrow exceptional operations with separate permissions/reasons and the pre-publication/byline restrictions above.

Creation defaults the accountable author to the actor. Editor and Analyst cannot submit another author at creation; Owner/Admin may select an existing author only with the same `research.author.assign` validation used for reassignment. A missing public byline stays null until prepared; no automatic account-name publication. Article-level exceptional mutations require the expected article revision just like ordinary saves.

Mutation functions use PL/pgSQL VOLATILE, SECURITY DEFINER owned by the trusted migration owner, empty search path and static schema-qualified SQL. Revoke PUBLIC/anon/service-role EXECUTE and grant authenticated only on these exact entry points. Their owner can bypass table RLS: explicitly acknowledge this boundary and enforce actor, role, resource, field and state rules inside every function. Do not describe the definer write itself as protected automatically by RLS.

All raw API-role INSERT/UPDATE/DELETE/TRUNCATE and column writes remain revoked. All tables retain RLS; no broad FOR ALL or Owner write policy. The narrow functions are the sole ordinary write path. Internal validation/audit helper functions stay private with explicit ACLs; no dynamic SQL, caller-controlled search paths, context setters or direct audit append RPC for authenticated users.

Use real user-session JWT context, `auth.uid()` and corrected `private.current_app_roles()`; never a secret-key HTTP call that loses the user context or an actor UUID supplied as trusted input. The existing STABLE role helper and scalar-subquery policy patterns remain unchanged.

## 14. Transaction, concurrency and audit strategy

Each RPC performs one PostgreSQL transaction: lock/recheck → validate → write aggregate → append audit → return receipt. Call the existing `public.write_audit_event(...)` from inside the trusted database function as its owner, with database-constructed actor/action/state metadata. Its existing service-role-only API ACL does not need to be widened. Do not invoke the TypeScript `writeAuditEvent()` after a separate article HTTP mutation and claim atomicity.

No exception branch may swallow an audit failure and return success. Any child write, constraint or audit error aborts the full transaction. Receipt includes article ID, resulting revision/state and audit event ID(s) only after commit. The application reports database/network ambiguity honestly and refetches authorized state before retrying. No blind automatic create retries; retry-safe job infrastructure is deferred.

Concurrency rules:

1. Lock the acting profile `FOR UPDATE`, then its current assignment rows and relevant role rows `FOR SHARE` in stable key order; re-resolve live roles in a fresh SQL statement after acquiring locks. The profile lock also blocks concurrent FK-backed assignment insertion, while assignment locks prevent concurrent removal. Shared role locks avoid serializing every writer with the same role. Treat any absent/suspended/conflicting identity as denied. Revocation before the locks wins; revocation waiting behind an already-authorized transaction takes effect for the next operation. Test this with separate sessions, not synthetic identity switches in one statement.
2. Lock the target article `FOR UPDATE` before checking its state/revision or editing any child. Every child mutation must acquire that parent lock. Check `expected_revision` under lock and reject conflicts; do not overwrite newer saves.
3. Author assignment/publication lock the article then involved byline rows in sorted UUID order. Byline-only management locks its byline row and then, in a fresh statement, checks that no referencing article has ever been published; it must not acquire article row locks while holding the byline lock. Thus first publication and byline edits serialize on the same byline row without an inverse lock order or an unbounded lock of every attributed article. Publication rereads/validates the byline after locking. Concurrent first-time byline creation is resolved by its unique profile key. Deadlocks fail the whole transaction and are never interpreted as success.
4. Publication/scheduling reads and shares locks on the two availability flag rows, validates related targets and canonical identities, then revalidates the aggregate. Missing rows deny. Flag changes and publication are serially ordered; flags still govern every subsequent public read.
5. No cross-resource unbounded mutation batch. Bound references and use deterministic locking where multiple articles are touched. After any successful child change, bump the parent revision and `updated_at` in the same transaction.

The audit writer currently accepts arbitrary nonblank action strings and object JSON at the SQL layer; its TypeScript union/redactor is not a database allowlist. CMS functions must construct a fixed minimal payload themselves. Do not rely on the TypeScript redactor when the RPC is called directly.

## 15. Audit event contract

Use the existing `article.*` vocabulary (`article.updated`, `article.published`) rather than introducing duplicate `research.*` events for the same domain. `resource_type = 'article'`; public author changes use proposed `research_author` resource type and profile UUID. Expand the application union only when the operations are implemented.

| Event | When | Minimal specific evidence |
|---|---|---|
| `article.created` | Successful DRAFT creation | Actor, ID, initial state/classification/author, revision |
| `article.updated` | DRAFT save, including source/reference changes | Prior/next revision; changed field names; source/relationship IDs/counts changed; AI flag before/after and removal reason |
| `article.scheduled` | Schedule/reschedule | Prior/next status and schedule instant |
| `article.unscheduled` | SCHEDULED → DRAFT | Prior schedule, next DRAFT, reason |
| `article.published` | Manual publication | Prior/next status; actual event time; first publication time; validated resulting revision/classification |
| `article.archived` | Withdrawal | Prior/next status, reason; preserved first publication time |
| `article.restored` | ARCHIVED → DRAFT | Prior/next state, cleared schedule/marker, reason |
| `article.classification_changed` | Dedicated permitted classification operation | Old/new classification and relationship disclosure, mandatory reason |
| `article.author_changed` | Dedicated author assignment | Old/new byline references; reason; no email/account metadata |
| `research_author.updated` | Public byline preparation/correction | Before/after public name/title; operation subtype create/update |

Every event includes `actor_kind='USER'`, `actor_id` derived from `auth.uid()`, resource UUID, previous/resulting narrow objects, metadata schema version and database creation time. Never accept client-provided complete snapshots, action names or timestamps. A combined operation must write every required event or none.

Do not log complete article bodies, TL;DR, full Key Facts, tokens/keys, request headers, private account data or source URL query strings. Classification disclosure is public-intended text but still length-bounded and validated; include only the relevant before/after text for that operation. Source history resides in retained source rows; audit captures identities/retirement and changed fields rather than copying full URLs. Ordinary draft text edits are not a version-history backup. Failed validation produces no success event; separate sanitized operational failure logging can be added later without pretending a rolled-back audit row persisted.

## 16. Validation rules

Proposed initial bounds are deliberate application/DB limits, not claims about editorial policy. Enforce matching TypeScript schemas and immutable PostgreSQL validators/constraints. Gate 18B tests SQL directly; TypeScript-only validation is insufficient for directly callable RPCs.

| Field | Save validation | Additional schedule/publication validation |
|---|---|---|
| Title | Trimmed, 1–200 characters; no controls | Required |
| Slug | 1–160 lowercase ASCII letters/digits separated by single hyphens; global unique across ALL states | Immutable after first publication; no percent/slash/dot/backslash/space/query/fragment/control/path traversal |
| Category | Null or one confirmed key | Required; map only to Market/Memecoins/Altcoins/Deep Dives |
| Classification | Exact enum, no save-field mutation | Paid relationship disclosure required; never infer Editorial from unknown/legacy AI |
| AI | Strict boolean, not truthy strings/numbers | Visible indicator and nonblank explanation in disclosure if true |
| Byline | Optional in draft; existing authorized matching references only | Accountable author and prepared public byline required; no invented fallback |
| TL;DR | Plain text, at most 1,200 characters; empty allowed in DRAFT | Nonblank |
| Key Facts | 0–12 exact-shape entries, ordered; label 1–120, detail 1–1,000; optional known evidence enum | Optional; all supplied entries valid, no automatic verified claim |
| Body | Version 1 only; 0–40 sections, 1–50 blocks per section, max 250 blocks total; unique short section IDs; heading <=160, text <=10,000, callout label <=120; total JSON <=256 KiB | At least one section and meaningful paragraph; no only-placeholder publication |
| Sources | 0–50 active rows; title 1–300, publisher 1–200, URL <=2,048; date validity; positions 0–49 unique | At least one active source; no test/example fixtures or unresolved source placeholders approved for publication |
| Disclosure | <=2,000; paid classes require nonblank even in draft | Required for all; truthful relationship/AI context reviewed by publisher |
| SEO | Optional title <=200 and description <=320; plain text | Fallback to actual article title/dek/TL;DR; no keyword stuffing or invented data |
| Schedule | RFC3339 with explicit offset in request, stored timestamptz; reject non-finite values | Schedule/reschedule strictly future at database operation; publish scheduled only when due |
| Related articles | 0–12 unique valid IDs; no self; readable to editor | Targets currently eligible; public projection re-filters later withdrawals |
| Related tokens | 0–12 distinct existing canonical UUIDs | No new token storage or assumed live Radar route |
| Concurrency | Article UUID and positive exact expected revision for edits/transitions | Stale version fails, no implicit merge |

Reject unknown object keys recursively, oversized arrays, invalid Unicode/control payloads, unsafe URLs and client writes to generated fields. No freeform style/HTML attributes. PostgreSQL JSON type tests must distinguish missing, JSON null and boolean/numeric/string values. Validate JSON object keys before casting to avoid permissive coercion.

Database URL validation should deliberately support a small well-defined absolute HTTP(S) subset with authority, optional port and bounded path/query/fragment, explicitly excluding credentials, control escapes and malformed authority. Require parity cases with the application parser; a bare `^https?://` check is insufficient. Internationalized domains may be parser-normalized to ASCII; unsupported forms fail with an actionable field error. URL validity is not proof of source authenticity. No remote source fetching belongs to this implementation.

Unique slug constraint handles concurrent collisions across drafts and public articles. Return a generic “slug unavailable” without disclosing the conflicting row/title/author. Unauthorized article IDs receive a generic unavailable response, never a validation message containing another draft. Do not let FK errors become a lookup endpoint for protected records.

## 17. SEO and structured-data integration

Reuse `generateResearchArticleMetadata()` and the safe JSON-LD serializer. One server adapter maps a validated public aggregate to `ResearchArticle` and supplies real publication/byline values. Convert status and classification explicitly, preserve optional dates, and keep the database state out of public article props unless intentionally required.

Create a separate draft/editor DTO in the application integration gate; it has nullable publication fields, status and revision. Do not invent `publishedAt` to satisfy the current public type. The shared reading component must support preview mode that omits publication claims when never published and completely omits Article JSON-LD.

The current renderer emits JSON-LD unconditionally and the metadata helper assumes a Person author. Gate 18C must make JSON-LD conditional on a verified public result and explicit published mode, never only a decorative preview label. Byline overlay is limited to real individual contributors for this phase; institutional/guest bylines need a later explicit author-kind extension, not a fictional Person.

Root metadata currently has no `metadataBase` or canonical site domain. Keep canonical path generation; do not derive an origin from arbitrary request Host headers or invent a production URL. Absolute canonical/OG/mainEntityOfPage assembly requires an explicitly configured trusted site origin before production launch. If absent, omit absolute properties rather than publish localhost/preview-host canonical URLs. This is a deployment configuration decision, not a second SEO system.

Missing/private articles return notFound before article metadata or JSON-LD is constructed. Landing empty state emits no Article schema. Source/body text remains escaped; JSON-LD continues escaping `<` (and the existing `>`/`&`) with injection regression tests. Public `datePublished` uses first actual publication and `dateModified` uses aggregate modification, never scheduled time.

## 18. Unpublished preview

Use `/admin/research/[id]/preview` inside the existing authenticated Admin boundary. Every route/data read rechecks permitted Research row access: Owner/Admin/Editor may preview DRAFT/SCHEDULED/ARCHIVED; Analyst only own DRAFT. Viewer/Ad Manager/Radar Reviewer/no-role users cannot preview unpublished content. UUID obscurity is not the authorization mechanism; guessed IDs are denied without state/title leakage.

Use the user-session RLS-backed Admin read, not the public slug route or a secret-key fallback. No preview tokens, public preview flag, share URL or unauthenticated draft-mode cookie. Admin pages and metadata must be dynamic/private/no-store with `noindex,nofollow` and `X-Robots-Tag`; no indexing, sitemap entry, public related links, canonical article tag or Article JSON-LD. Ensure denied responses and RSC payloads cannot carry the draft. The preview action reads the last saved revision; it does not publish or autosave.

Show a text status banner, preview revision, and the real byline only when set. Published dates are absent for never-published drafts; past publication dates on restored drafts are labeled historical, not a current publication claim. The development fixture `/research-preview` stays separate, unlinked publicly and unavailable in production; do not turn it into the Admin preview data source.

## 19. Admin CMS information architecture

Reuse the existing Research nav permission gate and Admin shell. Proposed routes:

- `/admin/research`: Drafts, Scheduled, Published, Archived tabs, bounded pagination, title/category/classification/byline/status/update columns. Tabs/counts are scoped by RLS; Analyst sees only its allowed records, Viewer only eligible published rows. No counts of inaccessible records.
- `/admin/research/new`: permitted draft creation.
- `/admin/research/[id]`: role/state-scoped reading and editing.
- `/admin/research/[id]/preview`: authenticated saved-revision preview.

Editor layout groups: core title/slug/dek/category; byline; primary classification and disclosure/AI; TL;DR; ordered Key Facts; simple section/block controls; Sources; related Research/token selectors; SEO; lifecycle actions. Use plain labeled inputs and add/reorder/remove controls, not a mandatory rich-text framework.

Show Save Draft only in editable DRAFT state. Schedule accepts explicit timezone and shows the resulting instant. Due articles show “Awaiting manual publication.” Publish confirms category, byline, disclosure and reviewed content; it is an ordinary authorized action, not a new multi-person approval bureaucracy. Archive warns of withdrawal; Restore prepares a draft. Display concurrency conflicts with a reload/review path. Published content and Scheduled content are read-only with clear next actions. Classification and byline management remain separate privileged actions, never quietly part of Save.

No Admin role/user editor, guest-author onboarding, analytics dashboard, upload dialog, CMS plugin framework or broad site search is part of these routes.

## 20. Media and uploads

Defer featured-image uploads and external embed execution. Supabase Storage remains the chosen provider, but no bucket policies, image MIME/size validation, SVG handling, signed URLs, optimizer origins or retention policy are implemented for Research. Adding those now would create a second security workstream.

Keep the existing optional featured-image presentation reference unused. The CMS does not accept arbitrary remote image URLs as a shortcut. Later media work must define allowed formats/limits, reject executable content, validate actual file content, enforce authenticated upload ownership and published read rules, and test image optimization/fetching boundaries before activation.

## 21. Deletion and recovery

No article hard-delete endpoint, permission, DML grant or RPC. ARCHIVED is non-public, retained and recoverable only to DRAFT. Audit events and first-publication timestamp survive withdrawal/restoration; slugs remain reserved permanently in this phase. Authors with published attribution remain retained under section 8.

FKs remain RESTRICT: deleting a parent cannot erase sources, token links, related articles or byline references. Source retirement preserves previously published source rows. Explicit removal of a relationship is audited and cannot delete its target. No source/author hard-delete path is exposed.

Infrastructure break-glass deletion is outside the CMS and needs a separately authorized retention/backup procedure. Audit is evidence, not a full content backup: version restoration, published revision snapshots, recycle-bin TTLs and automatic retention purges are deferred. Do not claim old body text can be reconstructed from changed-field audit summaries.

## 22. Database/RLS adversarial test matrix — Gate 18B

Use existing local Supabase/pgTAP, isolated persona test transactions and controlled fixtures. Reuse the corrected role helper without changing volatility or scalar-subquery semantics. Prove visibility with actual returned IDs/values and denial with both errors/empty sets and unchanged state. Test raw tables, projection RPCs and mutation RPCs separately.

| Case | Required evidence |
|---|---|
| Anon/public reads | Eligible published summary/detail succeeds through projection; raw articles/profiles/tokens/audit remain denied |
| Draft/Scheduled/Archived | Neither parent nor sources/byline/related data leak; SCHEDULED remains hidden before AND after due time without publication |
| Future/invalid published state | Future publication/schedule, absent or stale marker, invalid flags/configuration denied; no fallback |
| No-role authenticated identity | No Admin/private/raw rows or writes; intentional published projection only |
| Suspended/missing/conflicting membership | Every privileged operation denied, including Owner combined with conflicting roles |
| Viewer | Only eligible internal published reads; every direct and RPC write denied |
| Analyst | Can create/save own EDITORIAL DRAFT; other users' drafts denied; own commercial DRAFT read remains permitted by Gate 6 but its mutation is denied; author/classification changes and lifecycle operations denied |
| Editor | Intended draft writes and schedule/publish/archive/restore succeed with audit; no byline identity administration/classification change or cross-domain writes |
| Ad Manager / Radar Reviewer | No unpublished article reads or CMS mutations; commercial role cannot edit even Sponsored content |
| Owner/Admin | Allowed named CMS operations work; paid→Editorial, frozen classification/slug, raw DML, unaudited writes and hard-delete remain denied |
| Actor forgery | Submitted actor/status/revision timestamps/audit names/JWT user-metadata fields cannot impersonate authority; strict input allowlist |
| Transitions | Test every allowed edge and deny every omitted edge; Scheduled past due never automatically changes; content cannot change while Scheduled/Published |
| Completeness | Missing byline/category/TL;DR/sources/disclosure; placeholder-only body and malformed JSON cannot publish/schedule |
| Slugs | Empty, traversal, encoded separators, unsafe characters, case ambiguity and overlength denied; collision across states and concurrent create/update yields one winner |
| URLs/content | javascript/data/file/protocol-relative/userinfo/control/backslash/malformed-host URLs rejected; script payload is text; unknown blocks/keys and oversized JSON denied |
| Relationships | Duplicate/self/dangling related references rejected; deleted or archived targets never leak through parent; canonical token identity preserved |
| Byline privacy | No Auth email/status/role/account UUID in public output; unavailable byline blocks publication; author suspension revokes access without erasing historic attribution |
| Sources | Retirement/replacement only in editable draft; no retired source through public joins; active ordering unique; parent delete cannot cascade history |
| Atomic audit failure | Force audit insert failure in rollback-only test setup; assert parent, children, state, revision and history remain unchanged; no success receipt |
| Audit append integrity | Successful mutation writes exact actor/action/resource; fixed payload excludes body/secrets; no authenticated append/alter/delete/TRUNCATE or audit-only forgery path |
| Concurrent access | Two editors same revision: one succeeds; save-vs-publish, child-vs-archive and classification-vs-publish serialize; revocation and flag changes tested in separate backends |
| Projection security | Function owner is restricted non-table owner; no API SET ROLE/membership; exact ACLs; no broad SELECT, wildcard fields, default PUBLIC EXECUTE, search-path shadowing or RLS recursion |
| Direct interfaces | REST/RPC and applicable GraphQL/embedded reads cannot exceed the same visibility; no accidental Realtime publication |

Preserve existing foundation/authorization/audit coverage, adapting expected new tables/permissions only where this plan intentionally changes them. Existing anon-denial tests must distinguish denied raw tables from the newly permitted public projection. Test SQL function ACLs including inherited PUBLIC privileges, not only policy counts.

## 23. Application test matrix — later 18C/18D

| Area | Required coverage |
|---|---|
| Public landing/detail | Real eligible repository rows render; empty remains honest; unknown/draft/scheduled/archived/disabled => no public article or related data |
| Classification | Editorial/Sponsored/Partner exact labels; AI independent; unknown classification rejected; prominent paid disclosure in header and detail |
| Adapter | Category mapping, nullable token labels, source dates, ordered blocks/Key Facts, safe related hrefs; missing/incomplete DB values fail closed |
| Metadata/JSON-LD | Supplied DB values only; same publication filter as body; no fabricated author/date/domain; malicious `</script>` safely escaped; no Article schema on empty/private/preview pages |
| Admin lists | Role/state-scoped tabs/counts; Viewer no writes; Analyst own drafts; Ad Manager denied; no authorization through nav visibility alone |
| Create/save | Field/size/URL validation; unknown fields rejected; child save atomic; stale revision conflict; no false success on connection or audit failure |
| Lifecycle | Authorized schedule/manual publish/archive/restore; due does not auto-publish; protected-field/classification/author tampering denied through direct actions |
| Preview | Authenticated row permission on direct URL and RSC request; real draft dates absent; noindex/no-store/no Article JSON-LD; development fixture 404 in production |
| Cache isolation | Public response never uses staff reads; revoked access/archival/flags take effect on next request; no cross-user preview caching; metadata cannot leak cached draft |
| Rendering | 375/768/1440 actual browser viewports; long sources/contracts/title wrapping; keyboard block/source reordering; one H1; meaningful labels and focus |

Later implementation validation includes lint, strict typecheck, focused/full application tests, deterministic Webpack production build and diff checks. Run `pnpm check` once when an implementation gate requests it; keep the documented Turbopack sandbox failure separate. Gate 18A has no runtime changes and does not run this implementation suite.

## 24. Migration sequence and compatibility

Add two new ordered transactional migrations after the existing six. Do not edit Gate 4, Gate 6, its corrective migration, or Gate 8 history. Proposed suffixes describe purpose; assign actual next timestamps when Gate 18B is authorized.

### Migration A — Research schema evolution (closed access)

Add article fields, four tables, checks/validators/FKs/indexes and new-object RLS with no API grants. Preserve existing identity/author relationships and Markdown data. Replace classification CHECK only after legacy reconciliation can meet the final constraint. Never backfill a publication marker automatically; do not seed or automatically publish anything.

Preflight must count/classify any actual legacy rows locally, without dumping content/credentials. Gate 17's empty array does not prove the database is empty. If nonempty, plan reviewed conversion for category/byline/body and explicit AI_ASSISTED primary-classification resolution; do not default it to Editorial or overwrite status/content. If mapping cannot be proven, abort the migration before changes and obtain content-specific direction. Record approved conversions separately and keep original Markdown. Schema constraints that would hide or invalidate real published data cannot be applied silently.

An existing PUBLISHED row cannot both retain a null marker and satisfy the new publication invariant. Such rows are a specific preflight blocker: obtain explicit approval for their complete content reconciliation and validated marker before applying that constraint in the same transaction. Do not quietly demote, archive or leave them hidden to make replay pass. The initial migration path may proceed on verified empty data; a populated upgrade is a separately reviewed branch of the same additive migration strategy, not permission to discard records.

Rows classified AI_ASSISTED require `ai_assisted=true` AND an explicitly reviewed EDITORIAL/SPONSORED/PARTNER value. Preserve disclosure; do not remove paid provenance to satisfy the new CHECK. Transaction rollback must leave legacy state intact if any mapping fails.

### Migration B — Research publication, authorization and atomic operations

Install restricted projection role/functions, private eligibility/validation helpers, narrow staff/public-reader RLS, exact column/EXECUTE grants, lifecycle/field guards, and transactionally audited mutation functions. Keep raw API writes revoked. New authenticated column grants must be explicit; retain Gate 6 article ownership/read rules and add child policies mirroring the parent. Gate 8 writer ACL/immutability remains unchanged. No role catalogue, Auth, Radar or advertising architecture is redesigned.

Migration B must enforce the same protections for a direct RPC as an application caller: actor validation, content checks, state/revision rules, protected fields, publication gating, relationship validation and audit. New child tables cannot ship temporarily accessible before their policies. Migration commit is the exposure boundary.

### Replay and rollback

Before reset, verify a disposable LOCAL target and preserve any existing local data unless reset is explicitly authorized. No `--linked`, remote URLs or production credentials. Replay historical + A + B on a disposable local database, run foundation/security/Research SQL suites and direct API tests. Also test upgrade from a populated synthetic Gate 17 schema, including legacy AI rows and migration failure rollback.

Roles are cluster-scoped: local replay must inspect an existing same-name projection role's attributes/ownership and safely converge only the intended role, never drop an unrelated role. Verify no API membership and all expected ACLs after replay.

After applied/shared migrations, fix forward. Emergency disablement removes serving/RPC execution or uses the existing availability controls through authorized infrastructure; never drop article/source/audit data as a rollback shortcut. A snapshot/restore procedure is required before any later real data conversion.

## 25. Gate 18B implementation sequence

1. Reconfirm assigned scope, clean/known worktree, migration history, PostgreSQL 17 catalogue/owners/ACLs, local data presence and whether reset is authorized. No remote target.
2. Lock legacy-data mapping or establish empty database evidence. Confirm restricted projection-role support locally before relying on it.
3. Implement Migration A plus structural/invalid-input tests; maintain closed exposure.
4. Implement the exact permission/transition/content validation, restricted public projection and explicit object ACLs in Migration B.
5. Implement named aggregate mutations and nested existing audit append within the same transaction; include revision/actor/flag/parent locking, source retention and protected-field guards.
6. Add isolated persona pgTAP, direct API and separate-session concurrency tests. Prove audit rollback, no raw DML, no-profile leakage, public filtering and classification denials before application integration.
7. Validate clean local replay and populated synthetic upgrade; inspect final ACLs and scope. Report SQL pass counts and stop at 18B. Admin pages/Server Actions/public real-data integration belong to separately authorized 18C/18D work.

Later 18C integrates typed DTOs/public renderer/metadata and preview behavior; later 18D provides the Admin form/lifecycle UI. These labels are proposed sequencing only, not authorization to begin them.

## 26. Risks, assumptions and final adversarial review

| Risk | Design disposition / remaining limit |
|---|---|
| Draft or due-scheduled leakage | Exact PUBLISHED+time+revision+flag predicate; independent child/target filtering; no automatic scheduler; no public staff client |
| Paid content masquerading as Editorial | No paid→Editorial CMS transition; frozen post-publication classification; exact mapper and visible disclosure; human truthfulness still needs review |
| Ad Manager escalation | Existing role scope/mixed-role checks retained; no Research writes or private reads from commercial permission |
| Unauthorized publishing | Named publish permission and fresh SQL actor/resource/transition checks; raw DML unavailable |
| Audit bypass or partial commit | Nested Gate 8 append within same DB transaction; fixed SQL payload, rollback on failure; no HTTP two-step |
| Definer privilege misuse | Restricted RLS reader role for public reads; powerful mutation owner explicitly trusted only behind static narrow RPCs and exact ACLs |
| Profile/byline disclosure | Public overlay plus matching references; no Auth/profile join or UUID in public DTO; no automatic private-name copy |
| HTML/script/URL injection | Closed text blocks, bounded exact shape, source protocol/authority checks, internally generated related links, safe JSON-LD escaping |
| Slug collisions/path abuse | Strict ASCII regex, bounded slug, DB-wide uniqueness, generic collision error, immutable post-publication slug |
| Preview indexing/bypass | Separate authorized Admin read, private/no-store/noindex, no structured Article data or public preview token; existing fixture stays dev-only |
| Published edit leakage | Published/Scheduled content immutable until explicit withdrawal/unschedule; no live autosave |
| Source/history loss | No article/source hard delete or cascades; source retirement retains prior rows; audit summaries are not full-body recovery |
| Stale authorization/cache | Defined lock/revocation boundary; no persistent public/private caches initially; received public content cannot be recalled |
| Overengineering | One article root, four justified relation/identity tables, two bounded content JSON fields, one constrained reading renderer; no CMS framework or job system |

Assumptions and decisions needing later confirmation:

- This plan chooses manual due publishing, offline editing of published articles, no hard deletes, restricted classification changes, profile-linked individual bylines and deferred uploads as the safe Phase 2 defaults. Implementation can follow these defaults when authorized; no new product choice is required merely to write this plan.
- Actual legacy database contents and managed-role privileges were not inspected live. Nonempty data requires explicit reconciliation before a constraint change; there is no authorization here to migrate, quarantine, unpublish or reset it.
- The trusted production canonical origin is not configured in the inspected root metadata. It must be provided before production SEO integration; no URL is invented.
- Numeric editorial limits can be tuned before implementation if real articles require it. Unknown rich-media, institutional authors, post-publication byline corrections and concurrent published/draft revisions remain unsupported rather than receiving unsafe fallback behavior.
- There is no demonstrated operational leak today: the current public Research adapter returns an empty collection and raw anonymous table access is closed. Actual database contents were not inspected. The findings identify activation hazards to resolve before connecting CMS data, not a claim that an exploitation test was run.

Technical references checked for this plan: PostgreSQL documents that table owners normally bypass RLS, ordinary roles need grants and policies, and permissive policies combine with OR ([row security](https://www.postgresql.org/docs/17/ddl-rowsecurity.html)). Function execution identity/search path and default EXECUTE must be explicitly controlled ([CREATE FUNCTION](https://www.postgresql.org/docs/17/sql-createfunction.html)). NOLOGIN is not a substitute for denying role membership/SET privileges ([CREATE ROLE](https://www.postgresql.org/docs/17/sql-createrole.html)). Row locks define transaction ordering and require consistent acquisition order ([locking](https://www.postgresql.org/docs/17/explicit-locking.html)). A PostgREST request executes in a database transaction; separate requests do not form one atomic mutation ([transactions](https://docs.postgrest.org/en/v12/references/transactions.html)). Installed Next.js guides `data-security.md` and `json-ld.md` support minimal server DTOs and escaping serialized structured data. These references inform the proposed design; the project's local ACL and integration tests remain required implementation evidence.

## 27. Intentionally deferred functionality

No automatic scheduled worker, CMS/rich-text dependency, Markdown/HTML renderer, media upload/storage policy, chart execution, source fetching, guest/organization author system, public profile directory, public preview tokens, comments, revisions/diff/restore history, bulk publishing, full-text search, analytics, paywalls, advertiser editing, Radar backend, trading/wallet features, or remote deployment.

Gate 18A ends with this document. Gate 18B, application code, package files, migrations, database state and the roadmap remain unchanged by this planning task.
