# Phase 1 — Gate 6B: Authorization and RLS Implementation

Status: Gate 6B complete. Gate 6C security audit passed with non-blocking findings. Gate 6D addressed session refresh and redirect hardening. Gates 7–10 are implemented. Gate 18B now adds the Research-only extension in section 19; other operational mutations remain deferred. The Gate 6 historical matrices below are unchanged except where that extension explicitly adds Research capabilities.

Reviewed project sources: `AGENTS.md`, [ARCHITECTURE.md](ARCHITECTURE.md), [SECURITY.md](SECURITY.md), [DATABASE.md](DATABASE.md), [ADMIN_SPEC.md](ADMIN_SPEC.md), [PHASE1_PLAN.md](PHASE1_PLAN.md), and [DECISIONS.md](DECISIONS.md). The schema inventory below comes from the three existing migrations: `20260906000001_core_foundation.sql`, `20260906000002_content_commercial_foundation.sql`, and `20260906000003_radar_foundation.sql`. Gate 5 source was inspected for authentication, session refresh, redirects and logout. Current Supabase/PostgreSQL guidance and the installed Next.js Proxy convention were checked where relevant.

The migrations establish 17 application tables with RLS enabled, a private role resolver, 16 authenticated SELECT policies, explicit column grants and no API-role mutation grants. `audit_logs` remains closed. The `/admin` page now requires live active membership and renders no-role denial.

## 1. Authorization principles

- Deny unless the current database state explicitly permits an operation. Missing identity, missing profile, missing role, unknown permission, suspended/archived status, invalid role combination or a failed authorization lookup must not grant access.
- Authentication establishes identity. Application membership permits entry. A named permission and resource condition permit an operation. These are separate decisions.
- Owner is an application role, not a PostgreSQL owner, superuser, credential custodian or RLS bypass. No application role can override immutable analysis, audit integrity or commercial independence.
- Server checks and database enforcement must agree. A direct Data API request must be no more powerful than an application request with the same session.
- Retain the existing `profiles`, `roles` and `user_roles` model. Do not create a permissions table, per-user permission overrides, tenant model or custom JWT authorization system in Gate 6B.
- No routine privileged mutations before the required audit system. The Phase 1 plan explicitly defers those writes until Gate 8. Therefore Gate 6B enables membership checks and the scoped reads below; all direct application INSERT, UPDATE and DELETE remain denied. Future capabilities in section 3 are design intent, not grants to activate now.
- Public data access remains closed in Gate 6B. A later publication gate must add an explicit, tested public contract.

## 2. Source of truth

Use the current assignment chain `auth.uid()` → `public.profiles.id` → `public.user_roles.user_id` → `public.roles.id`. A profile must exist and have `status = 'ACTIVE'`; at least one recognized role assignment must exist. An Auth account alone, an ACTIVE profile alone or an author reference does not make a staff member.

Recognized keys are exactly `owner`, `admin`, `editor`, `radar_reviewer`, `ad_manager`, `analyst`, `viewer`. They are application records, not PostgreSQL login roles. Resolve keys through the protected role catalogue, never through display names, a browser-provided UUID or editable metadata. Unknown keys contribute no permissions.

Supabase verifies the session token before the database request receives its identity context. The server uses `getClaims()` to validate identity, then queries live membership using the same request-scoped cookie client and publishable key. No custom JWT role claim, `raw_user_meta_data`, email, request header, UI state or submitted actor ID participates in membership. `getClaims()` verifies the token; it does not query application roles. [Supabase SSR identity guidance](https://supabase.com/docs/guides/auth/server-side/creating-a-client).

Role removal and profile suspension take effect for the next database statement/request after the change commits, even with the same unexpired JWT. Request-local reuse is acceptable for rendering; persistent permission caches, client claims and cross-user caches are not. An already-running statement uses its database snapshot and is not retroactively cancelled. Future privileged transactions must recheck authority within the transaction and coordinate with revocation, not rely on an earlier page check. PostgreSQL documents the concurrency limits of policies that consult other records. [PostgreSQL row security](https://www.postgresql.org/docs/17/ddl-rowsecurity.html).

Application suspension is the immediate staff-revocation control. Provider logout, Auth bans and stolen access-token revocation have different semantics: a signed JWT can remain usable until expiry. Gate 6B must not claim that `getClaims()` or removing a refresh token provides instant session revocation. Stronger provider-session checks for later sensitive operations remain a separate decision. [Supabase session lifetime and sign-out](https://supabase.com/docs/guides/auth/sessions).

## 3. Application role matrix

All entries require ACTIVE membership. `Read` below means the exact rows in section 7, not unrestricted access to every column or domain. Future writes require a separately implemented operation, fresh authorization, validation and the audit gate; none are granted by Gate 6B.

| Role | Gate 6B reads | Proposed later operational capabilities | Explicit exclusions |
|---|---|---|---|
| Owner | Staff directory/roles, configuration, editorial, commercial, leads and internal Radar | Full application administration through approved operations; only role allowed to manage membership, account status, ownership transfer and security administration; editorial/commercial management and Radar moderation | No infrastructure privilege through the app; no manual scores, rewritten analyses, altered audit history or unaudited mutations |
| Admin | Same domain reads as Owner, except raw audit data remains closed for both | Broad editorial, commercial, lead, operational settings/flags and Radar moderation operations | No assigning/removing roles, creating another Admin/Owner, changing staff security status, ownership transfer or disabling security policy |
| Editor | Own profile; all article states/classifications | Create/edit editorial content, schedule/publish/archive articles with disclosure validation | No sponsor, campaign, lead, role, flag or internal Radar administration |
| Radar Reviewer | Own profile; token registry, analysis snapshots and review notes/states | Review, approve, reject, publish, hide and annotate through controlled moderation operations; request reanalysis later | No manual score/risk/evidence changes, new fabricated analysis snapshots, commercial administration or trading |
| Ad Manager | Own profile; all partners, sponsors, ad inventory, campaigns, creatives, assignments and leads | Manage those commercial records and inquiry lifecycle | No editorial classification/conclusions, internal Radar, membership, security or global flag administration |
| Analyst | Own profile; own DRAFT articles, eligible PUBLISHED articles; token registry and raw analysis snapshots | Create/edit own research drafts and request system reanalysis later | No editing another author, changing author/classification, publishing, review-state changes, review notes, scores or commercial/lead access |
| Viewer | Own profile; eligible PUBLISHED articles and active eligible partners | None beyond the future optional own-display-name operation | No drafts, scheduled content, raw Radar, reviewer notes, campaign administration, leads, configuration, staff directory, assignments or audit logs |

All seven roles may enter `/admin` under section 4. Viewer is a deliberately restricted reader, not a universal SELECT role. No role receives raw `audit_logs` access in Gate 6B.

Multiple assignments produce the union of their named capabilities, subject to global denials and the following proposed separation-of-duties rule: `ad_manager` must not coexist with `editor`, `radar_reviewer` or `analyst`. An existing conflicting combination fails closed to no effective roles and no `/admin` entry, even if it also includes Owner/Admin. This catches unsafe infrastructure assignments as well as later management mistakes. `editor + analyst`, `radar_reviewer + analyst`, and `viewer + editor` are permitted; `owner + admin` is permitted. Viewer does not subtract another valid role's rights.

Owner/Admin intentionally span operational domains. That oversight does not guarantee an individual has no commercial conflict of interest. Record and review such conflicts before publication workflows launch; absolute analytical write prohibitions apply to them as well. The combination rule is a proposal to adopt with Gate 6B, not an existing constraint.

### Permission catalogue for Gate 6B

Use one small server-owned mapping, with exhaustive tests against the SQL matrix. Permission names identify operations; no numeric role ranking, implicit role inheritance or generic `isAdmin` shortcut.

| Permission | Roles and resource limit |
|---|---|
| `admin.enter` | Any effective role |
| `profile.read.self` | Any effective role, own ID only |
| `identity.read.directory` | Owner, Admin; profiles, role definitions and assignments |
| `configuration.read` | Owner, Admin; flags and settings |
| `research.read.all` | Owner, Admin, Editor |
| `research.read.own_draft` | Analyst; `author_id` equals verified actor and status DRAFT |
| `research.read.published` | Analyst, Viewer; article eligibility predicate in section 7 |
| `partners.read.all` | Owner, Admin, Ad Manager |
| `partners.read.active` | Viewer; partner eligibility predicate in section 7 |
| `commercial.read` | Owner, Admin, Ad Manager; the five advertising/sponsor tables in section 7 |
| `leads.read` | Owner, Admin, Ad Manager |
| `radar.read.analysis` | Owner, Admin, Radar Reviewer, Analyst; tokens and analyses |
| `radar.read.review` | Owner, Admin, Radar Reviewer |

No write permission is executable in Gate 6B, including an Owner permission. Future operations get new explicit permission entries only when their guarded/audited database path is implemented. Do not create placeholder mutation RPCs or UI controls.

## 4. `/admin` access rules and server helpers

Proposed server-only helpers, kept beside the existing auth utilities rather than scaffolding the entire future architecture:

1. `requireIdentity()` creates/reuses a request-scoped user client, calls `getClaims()`, rejects errors or a missing valid subject, and returns the verified identity plus that client. A shape check such as the existing `hasVerifiedClaims()` cannot verify an arbitrary object by itself.
2. `getAuthorizationContext()` uses that client to call the self-only RPC in section 5; validates its response shape, known roles and returned subject against the verified identity; derives permissions from the fixed server catalogue. No target user ID or roles arrive from the browser. Database errors are authorization failures, not empty successful lookups to replace with defaults.
3. `requireAdminAccess()` requires nonempty effective roles. Every protected page/data entry point uses it; a layout may also use it for shell rendering. A layout or Proxy is never the sole check.
4. `requirePermission(operation, resource)` checks the live context, an allowlisted operation and its row constraints. A resource ID is untrusted input; authoritative state comes from a scoped database read. Every future sensitive Server Action and Route Handler calls this independently, then the database checks again when it reads or mutates.

Unauthenticated page request: redirect to `/login` with a validated internal return target. Authenticated but no effective membership: render a minimal access-denied response with no admin content and a sign-out option; do not send the user through an automatic login/admin redirect loop. An HTTP/API boundary returns 401 for absent/invalid identity, 403 for absent permission and a generic 503 for authorization infrastructure failure. Page error UI must likewise disclose no data; Gate 6B must verify actual HTTP status and rendered output separately if streaming is involved.

Private output and authorization results must not enter shared/CDN caches. Refresh/redirect responses must retain all required session cookies and appropriate private/no-store behavior. Proxy refreshes authentication and may assist navigation; the page guard and direct database RLS independently protect data if Proxy is skipped. Missing public configuration must fail closed with a generic unavailable state.

Gate 6B acceptance must also cover the Gate 5 issues in section 17: correct Proxy discovery and cookie refresh, canonical internal redirects and explicit logout failure handling. These are prerequisites to validating the boundary, not permission to expand into a dashboard.

## 5. Database authorization helper design

### Minimal helper and self-context RPC

Propose two functions only:

| Function | Contract | Privilege mode |
|---|---|---|
| `private.current_app_roles()` | No arguments; returns a sorted, distinct `text[]` of recognized keys for the current subject only, after ACTIVE-profile and combination checks; returns an empty array when ineligible | `STABLE`, `SECURITY DEFINER`, fixed `search_path = ''` |
| `public.get_my_authorization()` | No arguments; returns exactly one row containing current `user_id` and `role_keys` from the private helper; never enumerates other users | `STABLE`, `SECURITY INVOKER`, fixed `search_path = ''` |

The helper must use only static reads of `public.profiles`, `public.user_roles` and `public.roles`, filtered by `(select auth.uid())`. Do not read role claims. Reject a trusted Auth anonymous-session marker if present; anonymous sign-in is not a staff identity. Apply the role-combination check after collecting recognized keys. The incompatible-role rule is `role_keys @> ARRAY['ad_manager'] AND role_keys && ARRAY['editor', 'radar_reviewer', 'analyst']`: Ad Manager must be present together with an incompatible editorial/analytical role. A missing subject/profile/assignment, non-ACTIVE profile or conflicting combination returns the empty array, never NULL or a default Viewer assignment. The corrective migration exists because the original implementation used `&&` for each branch and incorrectly treated every single Analyst, Editor or Radar Reviewer role as conflicting.

Do not add `has_role`, `has_any_role` and `is_admin_level` as three separate policy engines. Array membership/overlap against this one helper suffices. An Owner-specific operation must check `owner` explicitly, not a combined Owner/Admin predicate. Future helpers, if justified, must preserve the current-subject-only contract.

### Why definer privileges are necessary

Role-based SELECT policies on `profiles`, `roles` and `user_roles` would recurse if their membership lookup itself had to pass the same policies. The private definer performs only that small identity lookup with the trusted migration/table owner's privileges. It cannot query a caller-selected subject, table or SQL fragment.

Use the existing trusted `postgres` migration owner, after confirming ownership of the three lookup tables in the Gate 6B local catalogue. Do not transfer ownership to `authenticated`, create an application superuser or add a generic privileged web client. This deliberately trusts a very small, reviewed function body executing under a powerful owner. `SECURITY DEFINER` alone does not guarantee RLS bypass: verify the owner's effective privileges and FORCE RLS state. Do not blindly force RLS on lookup tables or change the function owner and assume recursion remains solved. PostgreSQL distinguishes ordinary owner bypass from superuser/BYPASSRLS behavior. [PostgreSQL row security ownership rules](https://www.postgresql.org/docs/17/ddl-rowsecurity.html).

Schema-qualify every referenced relation/function and use trusted built-ins; no dynamic SQL, custom SQL execution, caller-controlled search path, writes or exception messages containing protected rows. Do not mark the helper IMMUTABLE or LEAKPROOF. Create the functions, revoke default EXECUTE, and apply their explicit ACLs in the same future migration transaction. [PostgreSQL definer function safety](https://www.postgresql.org/docs/17/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY).

### Exact function/schema exposure

- `private` is not a Data API exposed schema or an extra search-path schema. For this dedicated schema, revoke all schema privileges from `PUBLIC`, `anon`, `authenticated` and `service_role`, then grant back only `USAGE` to `authenticated`. If an existing schema with this name contains unrelated objects, inspect its ownership/consumers before changing its ACLs. Prevent untrusted CREATE in `public` as well; do not alter Supabase-managed extension schemas broadly.
- Revoke EXECUTE on both new functions from `PUBLIC`, `anon`, `authenticated`, and `service_role`, then grant EXECUTE on these exact signatures only to `authenticated`. Grant only the necessary `USAGE` on `private` to `authenticated`; confirm existing necessary `public` usage without granting CREATE.
- Policies require permission to execute the helper. A caller with SQL access and that EXECUTE grant could call it directly; the guarantee is current-subject-only output, not that EXECUTE somehow becomes policy-only. Keeping `private` unexposed prevents a direct PostgREST RPC endpoint for it.
- The public invoker facade is intentionally callable by any authenticated identity, including one without staff membership. Such a caller learns only its own subject and empty roles. Do not make its membership check depend on calling itself.
- Keep the existing trigger helpers' EXECUTE revocations. No public definer RPC, arbitrary-UUID role lookup, assignment RPC, service-role grant or role-management function is added.
- Inspect actual ACLs, including inherited `PUBLIC` privileges and per-owner defaults. Gate 4's schema-scoped default changes must not be assumed to remove global function defaults. Explicit revocation on each new function is mandatory; review and tighten defaults for the migration owner without affecting unrelated managed objects.

These exposure choices use Supabase's separation of invoker/definer behavior and function EXECUTE permissions. [Supabase database functions](https://supabase.com/docs/guides/database/functions).

### Performance and correctness

Use `(select private.current_app_roles())` for the row-independent role array and `(select auth.uid())` for the actor; the scalar subquery can avoid recalculating the same value for every row. It is statement-local reuse, not a permission cache across requests. Do not apply this shortcut to a helper whose answer depends on each resource row. [Supabase RLS helper/performance guidance](https://supabase.com/docs/guides/database/postgres/row-level-security).

The existing profile primary key, `user_roles(user_id, role_id)` unique index, role primary key and unique role key already serve this lookup. Existing article author/publication and partner activation indexes serve the proposed state predicates. Add no new index by assumption. Gate 6B should inspect representative EXPLAIN plans under the client role and existing indexes; a sequential scan on tiny test data alone is not a defect. No joins to review tables are needed for Gate 6B policies.

## 6. Per-table grant matrix

This is the exact Gate 6B target. All table names below are in `public`. `S` means SELECT limited to the explicit current column list below and further restricted by section 7. `—` means no privilege. App-role names inside an authenticated session do not change its PostgreSQL grant identity: database grants apply to `authenticated`; RLS chooses its allowed rows.

| Application table | anon SELECT | authenticated SELECT | authenticated INSERT | authenticated UPDATE | authenticated DELETE | Privileged/server-only path |
|---|---|---|---|---|---|---|
| `profiles` | — | S | — | — | — | Controlled infrastructure bootstrap only; later audited provisioning/status operations |
| `roles` | — | S | — | — | — | Reviewed migrations define the catalogue; no runtime catalogue editor |
| `user_roles` | — | S | — | — | — | Controlled bootstrap/recovery; later Owner-only audited assignments |
| `feature_flags` | — | S | — | — | — | Later typed, audited configuration operations |
| `site_settings` | — | S | — | — | — | Later typed, audited configuration operations |
| `audit_logs` | — | — | — | — | — | No web path; later trusted transactional writer and sanitized audit reader |
| `articles` | — | S | — | — | — | Later validated/audited editorial operations |
| `partners` | — | S | — | — | — | Later validated/audited commercial operations |
| `sponsors` | — | S | — | — | — | Later validated/audited commercial operations |
| `ad_placements` | — | S | — | — | — | Later validated/audited inventory operations |
| `ad_campaigns` | — | S | — | — | — | Later validated/audited campaign operations |
| `ad_creatives` | — | S | — | — | — | Later validated/audited creative operations |
| `ad_campaign_placements` | — | S | — | — | — | Later validated/audited serving-assignment operations |
| `leads` | — | S | — | — | — | Later protected intake and audited staff operations |
| `tokens` | — | S | — | — | — | Later narrowly scoped registry ingestion; no current writer |
| `radar_analyses` | — | S | — | — | — | Later trusted analysis INSERT only; no current writer |
| `radar_reviews` | — | S | — | — | — | Later audited moderation operation; no current writer |

For every table, `anon` also has no INSERT/UPDATE/DELETE. Retain no table grants for `PUBLIC` or `service_role`; infrastructure ownership is outside those API grants. The last column names future responsibilities, not authorization to introduce those privileged clients now. Ordinary server queries use the user's client and the same RLS as direct requests.

Also withhold TRUNCATE, REFERENCES, TRIGGER, MAINTAIN and grant options where supported. No app role receives sequence, DDL, ownership or role-administration privileges. Inspect both table and column ACLs; removing a table grant is not proof that no pre-existing column grant remains. Supabase explains that row policies and column privileges protect different aspects of access. [Column-level privileges](https://supabase.com/docs/guides/database/postgres/column-level-security).

Use column-level SELECT grants with these explicit lists, so a later sensitive column is not exposed automatically:

| Table | SELECT column allowlist |
|---|---|
| `profiles` | `id, display_name, status, created_at, updated_at` |
| `roles` | `id, key, name, created_at, updated_at` |
| `user_roles` | `id, user_id, role_id, created_at` |
| `feature_flags` | `id, key, enabled, configuration, updated_by, created_at, updated_at` |
| `site_settings` | `id, singleton, site_name, site_description, updated_by, created_at, updated_at` |
| `articles` | `id, title, slug, author_id, status, classification, tldr, body_markdown, seo_title, seo_description, disclosure, scheduled_at, published_at, created_at, updated_at` |
| `partners` | `id, name, slug, logo_reference, description, website_url, x_url, telegram_url, active, disclosure, starts_at, ends_at, created_at, updated_at` |
| `sponsors` | `id, name, website_url, created_at, updated_at` |
| `ad_placements` | `id, code, name, enabled, desktop_enabled, mobile_enabled, sponsored_label, created_at, updated_at` |
| `ad_campaigns` | `id, sponsor_id, name, status, starts_at, ends_at, created_at, updated_at` |
| `ad_creatives` | `id, campaign_id, headline, body, media_reference, cta, destination_url, enabled, created_at, updated_at` |
| `ad_campaign_placements` | `id, campaign_id, placement_id, creative_id, enabled, created_at, updated_at` |
| `leads` | `id, project_name, contact_name, contact_method, contact_value, website_url, interested_service, budget_note, launch_date, notes, status, created_at, updated_at` |
| `tokens` | `id, chain, contract_address, contract_address_key, symbol, name, created_at, updated_at` |
| `radar_analyses` | `id, token_id, version, status, score, deterministic_data, ai_inference, risk_summary, analyzed_at, data_as_of, created_at` |
| `radar_reviews` | `id, analysis_id, state, reviewed_by, reviewed_at, editorial_note, published_at, created_at, updated_at` |

Select only fields needed by each server operation; do not serialize full database rows to a page. These grants intentionally permit internal JSON evidence only to the internal-reader role sets. They never establish a safe public projection. PostgreSQL supports explicit per-column SELECT while table grants would cover every column. [PostgreSQL GRANT](https://www.postgresql.org/docs/17/sql-grant.html).

## 7. Per-table RLS policy matrix

Define the following notation for exact policy predicates; it does not imply more database helper functions:

- `R` = `(select private.current_app_roles())`.
- `Member` = `cardinality(R) > 0`.
- `O`, `A`, `E`, `Rr`, `M`, `N`, `V` mean the presence in R of Owner, Admin, Editor, Radar Reviewer, Ad Manager, Analyst and Viewer, respectively.
- `Self` = row `id = (select auth.uid())` for profiles.
- `ArticlePublished` = `status = 'PUBLISHED' AND published_at IS NOT NULL AND published_at <= statement_timestamp() AND (scheduled_at IS NULL OR scheduled_at <= statement_timestamp())`.
- `PartnerActive` = `active IS TRUE AND (starts_at IS NULL OR starts_at <= statement_timestamp()) AND (ends_at IS NULL OR ends_at > statement_timestamp())`.

Every allowed read below uses one named `FOR SELECT TO authenticated USING (...)` policy on that table, named `<table>_staff_select` (for example, `profiles_staff_select`). There are exactly 16 such policies; `audit_logs` has none. Parenthesize OR branches exactly as specified. Every role predicate inherits the ACTIVE-profile/recognized-role/combination rules through R. A viewer-facing internal read of an eligible record does not override missing public publication controls or expose it to anon.

| Table | SELECT USING predicate / applicable roles | Row-state interpretation | INSERT / UPDATE / DELETE policies |
|---|---|---|---|
| `profiles` | `O OR A OR (Member AND Self)` | Owner/Admin can inspect all target account states; other active members only their own row | None / none / none |
| `roles` | `O OR A` | Catalogue readable to Owner/Admin only; other members get their own keys via RPC | None / none / none |
| `user_roles` | `O OR A` | Directory assignments readable to Owner/Admin only, including assignments of suspended targets | None / none / none |
| `feature_flags` | `O OR A` | All flags for operators; configuration remains private | None / none / none |
| `site_settings` | `O OR A` | Singleton if present; absence does not create a row or grant fallback access | None / none / none |
| `audit_logs` | No SELECT policy | All rows closed to API identities, including Owner/Admin | None / none / none |
| `articles` | `O OR A OR E OR (N AND author_id = (select auth.uid()) AND status = 'DRAFT') OR ((N OR V) AND ArticlePublished)` | Editor may read drafts/scheduled/archived; Analyst reads own drafts and eligible published rows; Viewer only eligible published rows | None / none / none |
| `partners` | `O OR A OR M OR (V AND PartnerActive)` | Commercial operators see inactive/future/expired partners; Viewer only active eligible rows | None / none / none |
| `sponsors` | `O OR A OR M` | All sponsor records remain commercial administration | None / none / none |
| `ad_placements` | `O OR A OR M` | Includes disabled inventory; no public ad-serving implication | None / none / none |
| `ad_campaigns` | `O OR A OR M` | All campaign states privately readable to these operators | None / none / none |
| `ad_creatives` | `O OR A OR M` | Enabled or disabled; media/destination content is not trusted for rendering | None / none / none |
| `ad_campaign_placements` | `O OR A OR M` | Enabled or disabled; same commercial scope as its parent records | None / none / none |
| `leads` | `O OR A OR M` | All inquiry states; includes contacts/notes, so no general Viewer/Editor/Analyst access | None / none / none |
| `tokens` | `O OR A OR Rr OR N` | Internal registry, including tokens with no reviewed analysis | None / none / none |
| `radar_analyses` | `O OR A OR Rr OR N` | All analytical states, including REJECTED, for internal investigation only | None / none / none |
| `radar_reviews` | `O OR A OR Rr` | All review states and internal notes; Analyst does not read reviewer notes | None / none / none |

No policy targets anon. No `FOR ALL`, unconditional `USING (true)`, catch-all authenticated policy or generic Owner write bypass. The absence of mutation policies is intentional default denial, reinforced by missing mutation grants; redundant permissive false policies add no capability. Do not keep an older broad policy alongside these rules: permissive policies combine with OR. [PostgreSQL policy combination](https://www.postgresql.org/docs/17/ddl-rowsecurity.html).

All 17 tables retain RLS. The same restrictions apply to REST, GraphQL, RPC dependencies, embedded relationship queries and any future subscriptions, not just explicit application queries. Do not enable Realtime publications as part of Gate 6B.

When a future audited mutation is introduced, design SELECT visibility, INSERT WITH CHECK, UPDATE USING and WITH CHECK, permitted columns and transition checks together. An UPDATE policy alone cannot compare every old/new protected field or guarantee an honest actor. Keep direct DML closed where a controlled transactional function is necessary.

## 8. Public/private publication rules

Gate 6B grants anon nothing on all 17 tables. A no-role authenticated user also obtains no application rows. Tests must show even a PUBLISHED or active row remains unavailable to these callers. This satisfies the request to avoid speculative public policies; it is not a missing public allow policy.

Later publication prerequisites, to be activated only with explicit projection/grant tests:

| Content | Required eligibility | Fields to withhold |
|---|---|---|
| Research/articles | ArticlePublished; Research enabled; maintenance explicitly off; required disclosure for non-editorial classification; validated content | Draft/scheduled/archived bodies, unpublished changes and internal identity data not needed for public attribution |
| Partners | PartnerActive; Featured Partners enabled; maintenance explicitly off; commercial disclosure present | Inactive/future/expired relationships and internal operational metadata |
| Radar output | A review for that exact immutable analysis with `state = 'PUBLISHED'`; valid reviewer/time metadata; `published_at <= now`; analysis status is EARLY, TRENDING or HIGH_RISK, never REJECTED; Radar enabled, maintenance off, emergency pause explicitly off; reviewed freshness policy satisfied | Raw evidence JSON, AI payloads, reviewer identity/notes, unreviewed/rejected/hidden analyses and undisclosed internal metadata |
| Advertising | Later reviewed serving projection; active in-window campaign, enabled placement/device/creative/assignment, advertising enabled, maintenance off and visible Sponsored label | Sponsor/campaign administration, disabled inventory, private plans and all lead information |

No fallback to the latest unreviewed analysis if a published snapshot is absent or hidden. Token discovery alone is not a public record. No `state = 'APPROVED'` public shortcut. The existing schema permits some combinations requiring additional future workflow checks, such as a PUBLISHED review attached to a REJECTED analysis; metadata CHECK constraints alone do not establish publication safety.

Prefer a separately reviewed publication projection for mixed internal/public records. No new projection table or view is proposed for implementation now. If a later view uses `security_invoker = true`, its caller also needs appropriate underlying privileges and RLS; do not grant broad raw-table access just to make the view work. A projection that cannot preserve field restrictions that way remains closed pending a dedicated design. `security_barrier` alone is not an RLS fix, and materialized results need their own access and freshness rules. [PostgreSQL view security](https://www.postgresql.org/docs/17/sql-createview.html).

Future public reads must enforce flags, time and moderation at the data boundary as well as invalidate application/CDN caches. Missing or unreadable controls deny publication. No public access is enabled before Gate 7 supplies effective flag semantics and the product phase supplies content safety, public fields and freshness rules.

## 9. Privilege-escalation protections

- Gate 6B grants no direct INSERT/UPDATE/DELETE on profiles, roles or assignments and exposes no assignment/provisioning RPC. Owner is denied direct DML too. An Editor, Admin or arbitrary authenticated caller cannot assign any role by changing a profile or submitting a join row.
- The seven role definitions are migration-controlled. Do not permit changing a role key/name to turn an existing assignment into Owner.
- Later membership operations are Owner-only; Admin does not manage even non-Owner assignments under this proposal. Reject self-promotion, Owner removal without another active Owner and assignments to missing/ineligible targets. A role transfer must never silently emerge from an ordinary profile edit.
- All future role/status operations must validate the target separately, derive the actor from trusted context, enforce combination rules, serialize concurrent ownership changes and append audit evidence atomically. The caller never supplies a trusted `actor_id`.
- No editable field may control grant logic, function ownership, RLS, schema exposure or permission mapping. Feature flags and site settings are content/configuration, not authorization policy.
- UUIDs and foreign keys identify records but are not permissions. Do not let submitted author IDs, reviewer IDs or `updated_by` fields impersonate another person. Future attribution choices must be distinguished from the actor performing a mutation.
- No mutation endpoint may accept arbitrary SQL, table/column names, a Supabase key or trusted JWT claims from request input. PostgreSQL request-context setters are test/infrastructure mechanisms; never expose an RPC that sets `request.jwt.claims` or changes database roles.
- Revocation cannot restore earlier permissions through an OR branch, a Viewer fallback, a stale application cache or an elevated client retry.

## 10. Radar security boundaries

The canonical records are `tokens`, immutable `radar_analyses` and mutable `radar_reviews`. Score/risk/evidence and reviewer notes are physically separated. No application role, including Owner/Admin/Radar Reviewer/Analyst, gets INSERT, UPDATE or DELETE on `radar_analyses`. Blocking UPDATE alone is insufficient: allowing arbitrary INSERT would let a user fabricate a new scored snapshot.

Retain the analysis UPDATE/DELETE/TRUNCATE guards, unique `(token_id, version)`, token identity rules and `radar_reviews.analysis_id` immutability. Ordinary token-identity edits could relabel an existing analysis, so humans must not receive unrestricted registry UPDATE either. System-managed IDs, timestamps and analytical status are not editable reviewer fields.

The later controlled moderation operation may accept the analysis/review identifier, intended action and editorial note. It derives reviewer identity/time, locks the review, checks the prior state and live permission, verifies the analysis is eligible, applies publication controls and writes an audit event atomically. It must not accept score, risk, version, token identity or evidence payloads.

Proposed later transitions: PENDING → APPROVED or REJECTED; APPROVED → PUBLISHED or REJECTED; PUBLISHED → HIDDEN; HIDDEN → PENDING for a fresh review with publication metadata cleared. REJECTED is terminal for that review under this conservative default; reanalysis creates a new immutable snapshot and pending review. No direct PENDING → PUBLISHED or hidden/rejected → published shortcut. Publication requires an explicit action; `radar_auto_publish` remains OFF. These operations and state machinery are deferred beyond Gate 6B, and more elaborate reconsideration needs a later decision.

Future trusted analysis insertion is a separately secured system operation, not a privilege attached to the Analyst role or a generic secret-key RPC. Infrastructure superusers can alter triggers; application RLS does not constrain them.

No wallet custody, private keys, signers, transaction submission, trading execution, automatic buying/selling or fund movement exists in this authorization design.

## 11. Commercial/editorial separation

Ad Manager authority is confined to `partners`, `sponsors`, `ad_placements`, `ad_campaigns`, `ad_creatives`, `ad_campaign_placements` and `leads`. Editor authority is confined to research plus its own account. Radar Reviewer's domain is review/moderation, not scoring. Cross-domain read scopes are explicit in section 7; none imply write permission.

The inspected commercial tables contain no analytical score/risk columns and no FK into articles or Radar. Preserve that boundary. A later commercial association may reference a public identifier but must never invoke an analytical update via cascade, trigger, view, RPC or background job. Campaign payment/activation and partner status cannot change research classification, organic ranking or risk calculations.

The campaign/creative composite foreign key prevents cross-campaign creative selection; it is not a staff authorization mechanism. Commercial access is site-wide for the specified staff roles because the actual schema has no sponsor-user membership or tenant ownership table. Do not invent sponsor self-service accounts or per-client isolation claims.

Apply the mixed-role rule in section 3 in both application and SQL checks. Owner/Admin oversight still needs independent editorial procedures and audited publication. The database cannot detect whether a human's motive was sponsorship, so do not claim technical enforcement proves editorial independence by itself.

## 12. Profile access rules

An active assigned member may read its own existing profile. Owner/Admin may read the directory, including other users' suspended/archived profiles. A no-role Auth account receives no profile rows, even if an infrastructure-created profile happens to exist. Other members cannot enumerate the directory just because articles reference authors.

Gate 6B allows no profile edits. A later self-service operation may change only `display_name` on the caller's own active profile after validation and the required audit path. It must not change `id`, `status`, `created_at`, role assignments or security metadata; `updated_at` remains database-managed. Do not add an automatic public profile-creation flow to solve a missing membership lookup.

No roles/passwords/tokens are added to profiles. An Auth metadata edit is not a profile-status or membership update. Suspension is a global deny regardless of how many role assignments remain. Owner-only future status changes must prevent suspending the last active Owner.

## 13. Audit-log access rules

Keep `audit_logs` entirely closed to anon/authenticated/service-role API clients in Gate 6B, including application Owner. The existing prior/resulting state and metadata JSON may contain private lead or role information, so broad read-only access is still a confidentiality risk.

Gate 8 defines a trusted insert path that derives the actor, accepts only validated/sanitized event payloads and commits with the related change. It must not accept a browser assertion about who performed an action. No update/delete/truncate grant, mutation policy or history-edit RPC is permitted. Retain the current immutability triggers and restricted identity references.

Propose Owner access to a sanitized audit reader later. Admin access to a limited operational subset requires a concrete field/redaction decision; no default all-history access. Audit retention, export, event schema, external Auth reconciliation and infrastructure break-glass evidence remain Gate 8/operations decisions. The existing table is not proof that current actions are audited.

## 14. Owner bootstrap strategy

Design only; execute nothing in Gate 6A. Do not create a bootstrap URL, Server Action, public RPC, first-login-wins rule, hardcoded email allowlist, migration with a personal UUID or credentials in seed files.

For eventual initialization, an explicitly authorized infrastructure operator must verify the environment and the intended pre-existing Auth user's UUID through the trusted local/hosted operator surface. Email can help the operator identify a person, but it never grants application authority. For Gate 6B testing, use synthetic local identities; do not reuse Gate 5's successful-login account as an Owner automatically.

In a controlled database transaction, serialize bootstrap against concurrent bootstrap/ownership changes; assert there is no existing active Owner and exactly one `owner` role definition; confirm the target Auth UUID and eligible profile state; create the intended ACTIVE profile only if absent; insert its Owner assignment only if absent; commit and read back the exact result. Abort on an existing conflicting profile or unexpected owner, rather than reactivate/promote implicitly. Do not delete users or reset existing data to satisfy the precondition.

Gate 6B local fixtures can use the existing trusted database test connection inside a rollback transaction. Persistent first-Owner provisioning outside tests is an explicitly controlled infrastructure operation with an operator record; before real operational use, require the Gate 8 audit/reconciliation mechanism. No privileged web client is needed for the Gate 6B membership/read design.

Later ownership transfer must verify the current Owner's fresh authority, add/confirm the replacement before removal, preserve at least one ACTIVE Owner, and serialize all role/status operations affecting that invariant. Locking one actor row alone is insufficient when two Owners concurrently remove each other. Adopt a single transaction-scoped ownership lock shared by every such operation, recheck the count under that lock and audit the result. Ordinary application roles still cannot directly write assignments. Lost-Owner recovery uses documented infrastructure break-glass access, never a public fallback. MFA/re-authentication and dual-control policy remain prerequisites to production ownership operations.

## 15. Adversarial test matrix

This is a test plan for Gate 6B, not an executed security suite. Use local Supabase only, the existing CLI/pgTAP and existing application test tools. Bootstrap synthetic fixtures as the trusted test connection, then exercise queries as actual `anon`/`authenticated` roles with isolated identities. Reset role/request context between assertions and roll back fixtures. Do not use `postgres` or a bypassing service key to prove ordinary RLS works.

### Principal cases: ALLOW and DENY

| Principal | Required ALLOW evidence | Required DENY evidence |
|---|---|---|
| anon | Public placeholder/login routes only | `/admin`; SELECT on every application table including published articles/active partners; every application mutation; new helper/RPC execution |
| Authenticated, no profile | Self-context RPC returns own ID and empty roles | `/admin`; all application rows; all mutations; all role assignment attempts |
| Authenticated, ACTIVE profile but no role | Self-context RPC succeeds with empty roles | Same denials as no profile; no automatic Viewer/Admin |
| Viewer | `/admin`; own profile; eligible published article; eligible active partner | Every write; other profiles, drafts, scheduled/future/archived articles, campaign admin, leads, raw Radar, notes, config, assignments, audit |
| Analyst | `/admin`; own profile and own draft; eligible published research; tokens/analyses | Other authors' drafts, own scheduled/archived rows, publication, classification/author changes, commercial/leads, reviewer notes/state and analytical mutations |
| Editor | `/admin`; own profile; article reads in every state | Commercial/lead/internal Radar data and all writes in Gate 6B, including ostensibly legitimate editorial updates |
| Radar Reviewer | `/admin`; own profile; tokens, analyses, pending/rejected review records and notes | Analytical INSERT/UPDATE/DELETE, manual score/risk changes, token relabeling, commercial/lead reads, direct moderation writes |
| Ad Manager | `/admin`; own profile; all commercial tables and leads | Independent articles, internal Radar/notes, flags/roles/audit; fabricated scored snapshots and cross-domain writes |
| Admin | `/admin`; authorized domain reads, directory and configuration | Any role assignment/removal; self-promotion or Owner suspension; raw audit; every direct mutation, including scores |
| Owner | `/admin`; authorized domain reads, directory and configuration | Direct assignment/status DML, raw audit, analytical mutations, trigger/DDL/RLS changes and all unaudited writes |

For each allowed SELECT, assert actual expected IDs/values, not merely that the query did not throw. For denied SELECT with a grant but no matching policy, expect zero rows; when no grant exists, expect an authorization error. For writes, assert both rejection and unchanged rows. Test table/column/function ACLs separately from row visibility.

### Attack and state coverage

| Case | Expected result / invariant |
|---|---|
| Revoked last role using the same unexpired JWT | Next request denies `/admin`; next SQL statement returns no protected rows; self RPC returns empty roles |
| ACTIVE → SUSPENDED or ARCHIVED using same JWT | Global deny, including own profile and any Owner/Admin override |
| No profile, unknown-only role key, malformed RPC response, lookup timeout or missing environment | Fail closed; no default role, stale cached context or secret-key retry |
| Modify raw user metadata/email; submit role/actor IDs or fake trusted headers | No new permission; reject forged/invalid JWT at the API boundary |
| `viewer + editor`, `editor + analyst`, `radar_reviewer + analyst` | Union of explicitly allowed reads; still no writes or unrelated data |
| `ad_manager + editor`, `ad_manager + radar_reviewer`, `ad_manager + analyst`, including an extra Owner assignment | Empty effective roles and denied entry; no partial OR branch bypass |
| Caller requests another user's authorization via RPC arguments | Signature has no subject argument; cannot enumerate another user's roles |
| Direct private RPC request or forged schema-selection header | Private schema not exposed; no alternate endpoint bypass |
| Direct SQL helper call under authenticated test role | Only caller's effective roles; no recursive policy failure, foreign subject or mutation |
| Shadow tables/functions via search path or temporary names | Static fully qualified helper resolves only trusted objects |
| Helper owner/EXECUTE/default grants inspection | No PUBLIC/anon/service-role execute; expected trusted owner, empty search path, no dynamic SQL or privileged mutation function |
| Escalate via profiles, roles, user_roles, INSERT…ON CONFLICT, bulk updates, views or RPC | Denied, including Owner's direct requests; target rows unchanged |
| Spoof `updated_by`, `reviewed_by`, `author_id`, audit `actor_id`, UUIDs or timestamps | All direct writes denied; future operations must derive/validate attribution |
| Analyst guesses another draft's UUID; joins or embeds through foreign keys | No unauthorized row or related profile/contact/role data |
| Viewer requests article marked PUBLISHED with a future publication/schedule time | No row; test equality at the allowed time and NULL/invalid metadata fixtures where constraints permit |
| Viewer requests inactive, not-yet-active or expired partner | No row; test NULL open bounds and exclusive end boundary |
| anon/no-role asks for pending/approved/rejected/hidden Radar, including a token with no review | No rows or authorization error, even if the token is known |
| Change score by INSERTing a newer analysis, or relabel its token | Denied for every application role and API service role; retain immutable-history tests |
| Read leads/audit through joins, GraphQL or function dependencies | No expansion beyond the table matrix; no raw audit access at all |
| TRUNCATE/DDL/trigger disablement/SET ROLE/SQL-execution RPC | No application grants or exposed function permitting these operations |
| Private result caching across two users or after revocation | No shared response; next operation evaluates live authority |
| Skip Proxy or invoke a Server Action/Route Handler directly | Each data/operation boundary independently rejects missing identity/membership/permission |
| Expired/tampered session; refresh cookies; logout success/failure | Verified identity required, correct cookie propagation; no false logout success claim or stale protected view |
| External return URL, `//host`, slash-backslash, encoded controls/separators and unexpected path | Remain within the exact approved internal return target; no external redirect or loop |

Publication allow tests are deliberately split by activation stage: Gate 6B tests anon denial even for eligible records; internal Viewer tests prove eligible versus ineligible states. When a public contract is later added, require positive anon tests on the explicit public fields and negative tests for every draft, schedule, flag, freshness, review and hidden-field case in section 8. Do not add an anon grant just to make a speculative positive test pass.

Future mutation activation must add positive role-specific cases as well as denial tests: Editor editing/publishing through the audited operation; Analyst editing only its own draft; Ad Manager managing only commercial data; Radar Reviewer following allowed transitions; Owner managing roles with last-Owner/concurrency checks. Those positive mutation cases are intentionally deferred, not claimed as Gate 6B coverage.

Update the Gate 4 test expectations intentionally when Gate 6B adds read policies/grants: zero policies and zero SELECT privileges will no longer be universal invariants. Preserve table inventory, constraints, immutability, denial of writes and all new exact ACL/row assertions. A successful application smoke test is not a substitute for direct RLS tests.

## 16. Implementation order for Gate 6B

1. Re-read this proposal and the operating contract. Confirm the role matrix, mixed-role default, all-public-closed decision and audit-before-write boundary. Reconcile only relevant planning docs when Gate 6B is assigned; no Gate 6A changes to them.
2. Resolve the identified authentication-boundary issues in a narrow prerequisite change: approved return target, discovered Proxy placement and refresh-cookie integration, logout error handling. Keep the minimal routes and user-scoped client.
3. Inspect the local catalogue and Data API exposure without a remote link: existing objects, helper ownership, inherited/default/table/column/function grants and RLS flags. Do not rewrite Gate 4 migrations or grant access to Supabase-managed tables broadly.
4. Create one reviewed additive authorization migration for the private helper, self-only invoker facade, explicit ACLs and SELECT policies from sections 5–7. Apply restrictions atomically. Preserve all direct write denials and immutable guards. Do not create domain tables, public content policies or business mutation RPCs.
5. Add the server identity/context/admin/operation helpers and guard `/admin` and its protected data entry points. Keep browser role displays advisory. Add exact denial states and no shared authorization cache. Do not build domain UI.
6. Add the adversarial local SQL/API and application guard tests, adjusting the old baseline assertions explicitly. Verify the SQL and application role/permission matrices agree for every principal and allowed combination. Use synthetic fixtures with rollback and no persistent bootstrap credentials.
7. Run the relevant local Supabase replay/tests only after checking that any requested reset targets disposable local state; a clean replay must not destroy existing developer data without authorization. Run lint, strict types, auth tests and a production build. Apply the known Turbopack fallback policy once if that environment error recurs; report the Webpack distinction without an architecture workaround.
8. Inspect the final diff, ACLs, policies and test evidence. Confirm no public exposure or unaudited mutation was added, report remaining security decisions and stop at Gate 6B. Gate 7/8/product work requires its own task.

## 17. Risks, assumptions and final security challenge

### Findings from the inspected implementation

| Priority | Finding and evidence | Implication / required disposition |
|---|---|---|
| High | `src/app/admin/page.tsx:11` checks `getClaims()` and subject presence only; it never queries profile status or assignments | Every valid Auth identity can currently render the minimal shell. This is a Gate 5 limitation, not evidence of a database leak. Gate 6B must require live application membership before any administrative data |
| High | `src/lib/auth/redirects.ts:2` accepts a slash followed by a backslash. A read-only URL parser check confirmed that this passes the guard and resolves to an external origin | The claimed safe-return-path boundary is incomplete. Use an exact `/admin` return allowlist initially; validate any future expansion. No browser credential exfiltration was demonstrated by this review |
| Medium | Project-root `proxy.ts` is outside `src/`, while the app is `src/app`. Installed Next.js docs say Proxy belongs alongside app/pages and specifically inside `src` when using it | Session-refresh discovery is not established by the code location. Verify and correct it before relying on expiry/refresh tests; this review did not run a build or assert runtime Proxy execution |
| Medium | `src/app/admin/logout-button.tsx:14` ignores the returned sign-out error and navigates unconditionally | Failure can look like successful logout while a session remains. Handle/test provider failures and cookie clearing before declaring the boundary complete |
| High if grants are widened | `radar_analyses` is immutable after insertion, but INSERT supplies score/evidence; `radar_reviews` constraints check metadata, not actor authority or analysis eligibility | Never grant ordinary insert of analyses or unrestricted moderation UPDATE. A fabricated new version bypasses an UPDATE-only score defense |
| High if grants are widened | `profiles.status`, role keys/assignments, `updated_by`, reviewer identity and audit actor fields are ordinary stored fields without complete trusted mutation workflows | The schema alone is not an escalation/attribution defense. Keep DML denied until controlled operations and audit exist |
| Confidentiality risk | Leads contain contacts/notes; audit and analysis JSON have no public field contract; review notes are private | Avoid broad authenticated/Viewer SELECT and public views over these records |

The Next.js location finding is grounded in `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` and `src-folder.md`. The current browser client reads only the two public Supabase environment variables; no privileged application client was found in the inspected auth boundary. No authentication fix is applied in Gate 6A.

### Challenge results

- **Self-assignment/Owner escalation:** proposed direct role/profile/catalogue DML and all assignment RPCs remain absent. Admin is intentionally unable to manage membership. Bootstrap stays outside public application paths.
- **RLS recursion/definer misuse:** one current-subject lookup breaks the membership cycle under its verified owner; no arbitrary subject, SQL or privileged writer. Private placement alone is not EXECUTE security. Ownership/ACL/catalogue tests are required before acceptance.
- **Leaked drafts, leads or audit logs:** every table has an explicit row predicate or no access. Viewer publication predicates handle dates. Leads are confined to commercial operators; audit is entirely closed. No raw-table public read or definer view is created.
- **Stale JWT authorization:** membership/status is read live. Existing tokens do not preserve revoked application roles; provider session termination remains a distinct risk with a stated snapshot/expiry limit.
- **Sponsor influence/manual scores:** no app DML on analytical snapshots or token identity; mixed domain roles are handled explicitly; commercial tables create no indirect analytical write path. Human conflicts under Owner/Admin oversight still need governance.
- **Client-only enforcement/overbroad grants:** server guards are independent of Proxy and browser state; the same identity must pass database grants and RLS. SELECT is column-allowlisted; mutation and extra object privileges stay revoked.
- **Public views bypassing RLS:** no Gate 6B public view. Any later view/projection requires checks on caller privileges, underlying policies and field exposure; a view name is not a security boundary.

### Assumptions and unresolved decisions

This design assumes one internal staff workspace; no tenant/sponsor account model exists in the reviewed schema. All seven keys are migration-controlled. ACTIVE status and the selected combination rule define eligibility. Existing local runtime state and provider signup settings remain environment-specific; local database ACLs were validated by the Gate 11 pgTAP suite, and no persistent synthetic test users are retained.

The proposed matrix is concrete for Gate 6B. Product acceptance is still needed for the restrictive Viewer/Analyst scope and mixed-role rule when that implementation is assigned. In the absence of a requested change, Gate 6B should implement these defaults rather than broaden them silently.

Remaining decisions do not require granting speculative access: production first-Owner identity/operator approval; MFA/re-authentication and recovery/dual control; provider-level sign-up/ban/session revocation policy; sanitized audit read scope and retention; exact public projection fields and author attribution; Radar freshness thresholds, reconsideration rules and conflict-of-interest review; future operation-specific column/transition contracts. Keep each related capability closed until decided and tested.

Gate 6B runtime validation completed with clean migration replay, isolated authorization tests, foundation tests, application checks and a production build. The corrective migration and regression coverage are implementation evidence. Gate 6C completed the adversarial review with non-blocking findings. Gate 6D moved the Next.js Proxy into `src/proxy.ts`, hardened internal redirect canonicalization, and added session/logout regression coverage.

## 18. Deliberately deferred items

- Gate 6B implementation itself: authorization functions/policies/grants, server guards, adversarial tests and narrow authentication prerequisite fixes.
- All routine write grants and mutation RPCs, including self-profile changes, editorial publication, campaigns, lead updates, role changes, status changes, Radar review and score ingestion. These require the audit foundation and their specific product workflows.
- Public Data API access, publication projections/views, public Radar, flag enforcement, content serving, media/storage policy and subscriptions.
- Production bootstrap execution, invitations, public registration, recovery/MFA interfaces, privileged app clients, custom role JWT claims, permission overrides, organization/tenant models and remote Supabase operations.
- Gate 7 flag reads and Gate 8 audit foundation are implemented; flag mutation, audit reads, the final operational dashboard and later product phases remain deferred. Wallets, custody, signers, trading execution and automated buying/selling remain out of scope entirely.

Gate 6A created this document. Gate 6B is complete, Gate 6C passed with non-blocking findings, and Gate 6D is complete. Gates 7–10 are implemented in the local project; operational flag mutation, audit reads, product workflows and full domain dashboards remain deferred.

## 20. Gate 19C Radar database authorization

The additive Radar migration preserves Gate 6's live ACTIVE-role resolver and
adds no role keys. Owner/Admin may approve, publish, reject, hide and update
private editorial notes; Owner/Admin alone controls the emergency pause.
Radar Reviewer may perform the moderation actions but not the emergency
control. Analyst may request reanalysis or score recalculation without
supplying output. Editor, Ad Manager, Viewer, no-role and inactive identities
have no private Radar mutation authority.

Raw DML remains denied for all browser roles, including Owner/Admin. The new
Radar tables expose only role-filtered authenticated reads. Human actions use
revision-checked audited RPCs that derive `auth.uid()` and recheck authority;
system ingestion/result functions are `SECURITY DEFINER` with empty search
path and EXECUTE only for `service_role`. Anonymous callers receive only the
two narrow published Radar projection functions. Commercial tables have no
Radar analytical write path. Gate 19C-F3 also revalidates historical
approvers through the same effective-role conflict semantics used by the live
authorization architecture; an Ad Manager conflict cannot publish Radar. See
[RADAR_DATABASE.md](RADAR_DATABASE.md) for the table and function contract.

Gate 19C-F4 keeps those production authorization semantics unchanged while
moving the final publication authorization/approver checks after every
mutable blocking lock. It validates the authoritative analysis source for
legacy publication safety, so historical unsafe JSON cannot cross the public
boundary. Work renewal and failure recheck the service fence after locking
the work row and taking a fresh wall-clock reading. The F4 upgrade and
lock-wait tests model separate request sessions; they do not weaken RLS,
grants or role resolution.

## 19. Gate 18B — Research-specific authorization extension

The corrected `private.current_app_roles()`, existing article staff SELECT policy, profile/role model and all non-Research policies remain unchanged. The new functions resolve live ACTIVE roles from that helper; email/user metadata/JWT role labels are not application authority. Each mutation locks/rechecks the actor, permitted resource and expected revision, then appends its required audit in the same database transaction.

| Capability | Enforced roles / restriction |
|---|---|
| Create and edit | Owner/Admin/Editor; Analyst only own EDITORIAL DRAFT |
| Schedule, reschedule, unschedule, publish, archive, restore | Owner/Admin/Editor; exact approved state machine |
| Classification change | Owner/Admin; DRAFT before first publication; only transitions into SPONSORED/PARTNER, never paid → Editorial |
| Author assignment/public byline management | Owner/Admin; explicit validated profile references; frozen post-publication attribution |
| Viewer, Ad Manager, Radar Reviewer | No Research mutation authority |
| Missing/no-role/inactive/conflicting identity | No private Research or mutation access |

Raw API DML remains denied even for application Owner. Eight new article column SELECT grants and four child SELECT policies mirror existing staff scope. Analyst still reads own paid drafts under the unchanged Gate 6 read rule but cannot mutate them. Public author overlay reads never imply private profile-directory access. The token picker exposes only bounded identity fields to Owner/Admin/Editor/Analyst; Editor's raw token RLS remains unchanged.

Two public definer RPCs deliberately return only eligible published DTOs to anon/authenticated, including no-role users viewing intentionally public information. This does not grant Admin/private membership. They use the existing trusted migration owner with explicit SQL predicates/output, not a custom reader role or automatic owner-RLS filtering. They never return account UUIDs, private profiles, audit fields or concurrency metadata.

PUBLIC/anon/service-role EXECUTE is revoked from the six mutation RPCs and token picker; authenticated receives exact-signature EXECUTE. All new private helpers are closed to API roles. Public projections alone grant EXECUTE to anon/authenticated. No general SQL/RLS-bypass utility, role-management RPC, raw write policy, public preview token or Realtime publication was introduced.

Database permission enforcement is implemented now; the TypeScript catalogue and Server Action guards remain untouched until application integration. Full signatures and test commands are in [RESEARCH_CMS_PLAN.md](RESEARCH_CMS_PLAN.md). Research pgTAP **358/358** and the full suite **499/499** pass; separate-session tests prove stale-write denial, revocation/suspension, flag ordering, classification/publication ordering and byline freeze.
