# Database Foundation — Gate 4

## 1. Design principles and scope

The local Supabase PostgreSQL foundation uses three ordered SQL migrations under `supabase/migrations/`. Each migration is transactional and includes access restrictions before commit. This gate creates tables, constraints, indexes, timestamp/immutability triggers and structural tests. It does not create clients, login flows, ingestion, scoring, final authorization policies, public queries or admin interfaces.

All entity identifiers are UUIDs. `profiles.id` is the existing `auth.users.id`, not a second identity generator. Other primary keys default to `gen_random_uuid()`. Timestamps use `timestamptz`; a prospective launch date uses `date`. Mutable records have database-maintained `updated_at`; immutable history and role assignments have `created_at` only.

Lifecycle values use text columns with CHECK constraints, allowing explicit changes through migrations without introducing numerous PostgreSQL enum types. Generated TypeScript database types describe the SQL shape; CHECK-constrained text still requires domain validation when application code is introduced.

## 2. Table inventory and intended access categories

Every table below currently has RLS enabled, zero policies, and no table privileges for `PUBLIC`, `anon`, `authenticated`, or the Supabase `service_role` database role. The last name is a PostgreSQL role, not a recommendation to use legacy API-key naming. No public candidate is exposed in Gate 4, including records marked published or active.

| Table | Purpose | Future access classification |
|---|---|---|
| `profiles` | Application display name and account status, linked to Supabase Auth | Authenticated-only candidate: own permitted fields; staff administration separately guarded |
| `roles` | Seven normalized application role definitions | Admin/privileged only |
| `user_roles` | Unique user-to-role assignments | Admin/privileged only |
| `feature_flags` | Named availability controls, optional object configuration, updater | Admin/privileged only; a deliberately filtered subset may later become a public-readable candidate |
| `site_settings` | One typed site-name/description record | Admin/privileged only; selected presentation fields may later be public-readable |
| `audit_logs` | Append-oriented privileged-action evidence | Internal/server-only |
| `articles` | Draft/scheduled/published/archived Markdown research and classification | Public-readable candidate for approved published projections; drafts/private fields stay privileged |
| `partners` | Paid relationship profile, disclosure and activation window | Public-readable candidate for active, eligible profiles |
| `sponsors` | Commercial sponsor identity | Admin/privileged only; selected sponsor identity can be projected with an eligible ad |
| `ad_placements` | Inventory code, availability, device targeting and mandatory label | Admin/privileged only |
| `ad_campaigns` | Sponsor-owned campaign lifecycle and schedule | Admin/privileged only |
| `ad_creatives` | Campaign-owned copy, media placeholder, CTA and destination | Admin/privileged only; approved serving fields can later be projected |
| `ad_campaign_placements` | One selected creative per campaign/placement | Admin/privileged only |
| `leads` | Project/contact details and commercial inquiry lifecycle | Admin/privileged only |
| `tokens` | Canonical chain/contract identity | Public-readable candidate only with approved public Radar context |
| `radar_analyses` | Immutable versioned analytical snapshots, score, evidence and risk | Internal/server-only raw record; a published, filtered analysis projection is a public-readable candidate |
| `radar_reviews` | Reviewer metadata, notes and publication/moderation state | Admin/privileged only; reviewer notes are never implicitly public |

The categories above are Gate 6 planning inputs, not active grants. Table-level access alone cannot protect mixed public/private fields; future projections and column permissions must be reviewed alongside RLS.

## 3. Relationships and deletion behavior

- `auth.users` → `profiles` is one-to-one. No password, token, credential or secret is copied into application profiles. No profile-creation Auth trigger or account provisioning flow is installed.
- `profiles` ↔ `roles` uses `user_roles`, unique on `(user_id, role_id)`.
- Profile references identify article authors, configuration updaters, audit actors and Radar reviewers.
- `sponsors` → `ad_campaigns` → `ad_creatives` models commercial ownership. Campaigns and placements are linked through `ad_campaign_placements`.
- A composite foreign key from `(campaign_id, creative_id)` to `ad_creatives(campaign_id, id)` prevents associating another campaign's creative. A campaign/placement pair has one selected creative initially; rotation and A/B testing are deferred.
- `tokens` → `radar_analyses` is one-to-many. Each analysis has at most one `radar_reviews` record. Application/audit workflows can later maintain moderation history without rewriting analysis snapshots.

Foreign keys use `ON DELETE RESTRICT` except the purely dependent `user_roles.user_id` link, which cascades assignment removal if its profile is deliberately deleted. Auth-user deletion is restricted while a profile exists. Referenced authors/reviewers/audit actors are retained; future offboarding should archive or pseudonymize them under a reviewed retention policy. Campaigns, creatives and token history cannot disappear through a parent cascade.

`audit_logs.resource_id` is a UUID without a resource foreign key, paired with `resource_type`. This intentionally supports multiple resource domains and preserves events after resource deletion. Its tradeoff is that the future trusted audit writer must validate resource identity. `actor_id` is nullable for system actions and uses RESTRICT when present; neither actor nor resource deletion silently removes history.

## 4. Important constraints and content representations

Unique keys cover article/partner slugs, role keys/names, feature flag keys, ad placement codes, user-role pairs, campaign-placement pairs, analysis versions per token, and one review per analysis. Slugs are lowercase hyphenated values. Inventory codes follow the supplied two-letter/two-digit pattern (for example `HP-01`); a later format extension requires a migration.

Profiles support ACTIVE/SUSPENDED/ARCHIVED. Articles support DRAFT/SCHEDULED/PUBLISHED/ARCHIVED and EDITORIAL/SPONSORED/PARTNER/AI_ASSISTED. Scheduled/published articles require an author and the relevant timestamp. Non-editorial classifications require a nonblank disclosure; partners always require their commercial disclosure. Article content is initially `body_markdown`, with dedicated TL;DR, SEO title and SEO description fields. This avoids locking a rich-text editor or JSON document format; future rendering must handle untrusted content safely.

Campaigns support DRAFT/SCHEDULED/ACTIVE/PAUSED/COMPLETED/CANCELLED, with complete dates required for scheduled/active states and end dates strictly after start dates. Partner end dates also require a valid start. Placements/creatives/assignments default disabled; mobile placements default off. Every placement has a non-null `sponsored_label` constrained to exactly `Sponsored`. A future renderer must display that label; the schema alone does not render disclosures. Creative destinations require an HTTP(S) shape; robust URL and creative safety review remains later work.

Leads support NEW/CONTACTED/NEGOTIATING/WON/LOST. Contact method is EMAIL/TELEGRAM/X/OTHER; contact values and a single initial service-interest field are required. Budget is a note rather than an invented currency/pricing system. No booking, payment or tracking records are created.

### Typed site settings and safe reference defaults

`site_settings` is a constrained singleton with named `site_name` and `site_description` columns and an optional updater. No settings row is seeded. This intentionally requires a migration for new settings, avoiding an unbounded miscellaneous JSON store. Flags retain optional JSON object configuration for later per-flag settings, but unknown fields must never become policy or secret storage. Gate 7 defines and implements typed per-key validation and server-side effective-state evaluation.

Migrations insert only the seven requested role definitions and eight environment-independent flag defaults. No users, role assignments or business content are seeded. All availability flags and `radar_auto_publish` are OFF; `maintenance_mode` is ON. Gate 7 reads these flags through a server-only typed module; the Gate 10 Admin shell displays them read-only, while no public page or domain workflow consumes them yet. These conservative database defaults do not change the placeholder homepage.

### Canonical token identity

`tokens.id` is the stable internal identity. `chain` uses a namespaced identifier, distinguishing networks rather than ambiguous display labels. `contract_address_key` is generated: EVM (`eip155`) addresses are normalized to lowercase for uniqueness, while other chain addresses retain their case. The unique `(chain, contract_address_key)` constraint implements chain/contract identity without conflating distinct case-sensitive addresses. EVM chain IDs use canonical positive decimal notation and EVM addresses require 40 hexadecimal digits after `0x`.

No universal address-validation rules are invented for other chains. Their canonical namespace/network identifiers and address validation must be settled before ingestion is implemented. Symbol/name are optional discovery metadata and are not identities. A registry row represents discovery; an analysis row represents a completed analytical snapshot. No discovery queue or ingestion job exists.

## 5. Indexing strategy

Primary/unique constraints already create their lookup indexes; no duplicate slug indexes are added. Additional indexes cover foreign-key lookups not already served by the leading columns of those indexes, article publication, active partner dates, campaign state/dates, lead status/creation, analysis status/time, review state/publication, and audit actor/resource history. No JSON GIN, full-text, speculative analytics or partitioning indexes are added.

## 6. Radar/commercial trust boundary

Commercial tables contain no analytical score, ranking, risk or editorial-conclusion columns, nor foreign keys into articles or Radar. A future displayed association may reference public identifiers without granting analytical write authority. No application role has been mapped to database privileges, and even the API's elevated database role has no table grants for these foundations.

`radar_analyses` holds status (EARLY/TRENDING/HIGH_RISK/REJECTED), a positive integer snapshot version, optional finite nonnegative numeric score, analytical time, evidence freshness (`data_as_of`), separate deterministic-data and AI-inference JSON objects, and risk summary. JSON payload contracts and the scoring methodology/scale remain TBD; no artificial 0–100 scale or calculation is locked. Null score means unknown, not zero. Freshness cannot be later than analysis time.

UPDATE, DELETE and TRUNCATE are rejected for analysis snapshots by ordinary enabled triggers, including ordinary table-owner statements. Corrections/reanalysis create a new version; reviewers edit only `radar_reviews`, which has no score or risk field. A review's analysis reference cannot be changed, preventing reassignment of published approval to an unreviewed snapshot. Moderation defaults to PENDING and supports APPROVED/PUBLISHED/REJECTED/HIDDEN. Approval, publication and rejection require reviewer identity/time; publishing also requires a valid publication time. Hiding may preserve prior publication metadata.

This foundation can represent discovery → analysis → pending review → publish/reject. Gate 6B now enforces scoped reads and denies application writes, while authorized audited transitions, public projections, feature flags and freshness remain later work. No automatic publisher or manual score-edit API exists. `radar_auto_publish` stays OFF. Infrastructure superusers remain outside application administration.

## 7. Audit foundation

`audit_logs` contains an explicit `actor_kind` (`USER` or `SYSTEM`), optional actor UUID for system events, action, resource type/UUID, optional prior/resulting JSON objects, metadata and `created_at`. There is no `updated_at` on immutable evidence. UPDATE/DELETE/TRUNCATE guards prevent ordinary history mutation. Gate 8 adds a service-role-only trusted writer function and a server-only sanitized application writer; no browser insert grant or direct audit read exists. Product mutations still have no audit integration, so the presence of this table is not proof that all actions are audited.

## 8. Migration and local validation workflow

Only use the existing project-local CLI. Supabase local runtime requires Docker; the current macOS execution environment requires approved access to its socket. Node and Docker must be discoverable on PATH. Never change socket permissions or use remote connection flags for local validation.

```text
pnpm supabase:start
pnpm supabase db reset --local --no-seed
pnpm supabase test db --local
pnpm supabase:stop
pnpm check
```

Local reset deletes local database data. Use it only on disposable development state after checking the target; it must never receive `--linked`, `--project-ref` or a remote `--db-url`. `--no-seed` skips the absent optional `seed.sql`; required role/flag definitions are deliberately in migrations, so they still replay. No business seed file is needed. Once a migration has been shared/applied outside this initial gate, fix forward in a new migration instead of rewriting history. Production application is a separate reviewed workflow, never a side effect of app startup or build.

The database test file uses pgTAP through the Supabase CLI and rolls back every fixture, including synthetic Auth identities. It checks exact table inventory, UUID/timestamp conventions, uniqueness, flags, grants/RLS, FK ownership, immutable history, review metadata and baseline denial. It does not implement or test the final role permission matrix.

## 9. RLS preparation

Table-level RLS and explicit grant revocations ship in each migration. Migration-owner default table/sequence privileges are also tightened; explicit function EXECUTE revocations protect the three trigger helpers. These security-invoker functions use an empty search path; no SECURITY DEFINER or public mutation RPC is added. Future migrations must still inspect every new object's grants rather than assuming default privileges protect objects created by other owners.

The API can bypass application code, so Gate 6B implements server checks, operation/column grants and row policies together. Authenticated roles receive only the scoped SELECT columns; anon, service-role API grants, application writes and `audit_logs` access remain absent. No generic elevated write path is granted here. [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security) and [PostgreSQL privileges](https://www.postgresql.org/docs/17/ddl-priv.html) explain the two enforcement layers.

## 10. Intentionally deferred work

Auth profile provisioning; future domain-specific permissions/RLS and mutation workflows; public views; flag mutation operations; audit retention workflows; role-aware admin operations; categories/tags/authors-as-a-separate-system; media tables/buckets/uploads; impression/click events and sponsor analytics; bookings/payments; ingestion queues; wallets; score algorithms; AI payload contracts; Radar publish/moderation procedures; production migrations and remote setup. Trading, custody, signing, transaction submission and automated buying/selling remain out of scope entirely.
