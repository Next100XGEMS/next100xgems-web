# Phase 1 Technical Architecture

Status: architecture locked as described below. Gates 1–11 — validation tooling, local Supabase development, environment/secrets foundation, database foundation, authentication, authorization/RLS, the database-backed feature-flag read foundation, the append-only audit logging foundation, the shared design-primitives foundation, the protected Admin shell foundation, and final foundation validation — are complete. Phase 1 Foundation is COMPLETE. Read alongside [ARCHITECTURE.md](ARCHITECTURE.md), [SECURITY.md](SECURITY.md), and [DECISIONS.md](DECISIONS.md). Product scope remains NEXT100XGEMS, a premium Crypto Intelligence + Crypto Media platform.

## 1. Phase 1 objectives

Establish a small, typed modular monolith with explicit ownership of public presentation, private administration, identity, permissions, persistence, flags, settings, and auditing. Later research, commercial, partner, Radar, and lead/booking features must fit these boundaries without requiring separate services.

Validate each foundation before building dependent features. Give future operators clear controls and explanations through the admin UI while keeping credentials, migrations, permissions enforcement, and system invariants outside editable content. Phase 1 prepares these capabilities; it does not deliver the later product domains.

## 2. Locked provider choices

| Area | Decision | Phase 1 scope |
|---|---|---|
| Framework | Existing Next.js App Router, TypeScript, Tailwind CSS, `src/`, ESLint, strict TypeScript | Preserve the existing foundation |
| Package manager | pnpm | Preserve lockfile; reproducible installs during implementation |
| Database | Supabase PostgreSQL | Local architecture and foundation only |
| Identity | Supabase Auth | Staff authentication foundation |
| Media | Supabase Storage | Define access boundary; upload features come with their domains |
| Deployment | Vercel | LOCAL, PREVIEW/STAGING, PRODUCTION separation |
| Feature flags | Supabase/PostgreSQL | No third-party flag service initially |
| Application shape | Modular monolith | One Next.js application; no separate domain services |

All unspecified providers remain TBD. No service accounts, remote projects, infrastructure, or dependencies are created by this plan.

## 3. System and module boundaries

| Owner | Responsibility | Boundary |
|---|---|---|
| Public application | Route composition, public reads, metadata, navigation | Receives explicitly public data; never raw admin records |
| Admin application area | Private route composition and operator workflows | Invokes domain operations; does not own authorization policy |
| Authentication | Supabase session lifecycle and verified actor identity | Does not equate a valid login with staff permission |
| Authorization | Granular action/resource checks using protected role assignments | Deny by default; no role decisions supplied by the browser |
| Database access | Request-scoped clients, generated database types, narrowly scoped elevated client | No generic unrestricted CRUD API |
| Feature flags | Effective availability and emergency controls | Enforces global → section/placement → resource hierarchy |
| Settings/configuration | Typed operational settings and deployment configuration | Content settings never contain credentials or executable policy |
| Audit | Trusted record of privileged state changes | Append-only to application actors; separate from analytics |
| Research | Article content, classification, sources, publication and editorial conclusions | Commercial workflows cannot modify independent fields |
| Commercial | Advertising inventory, sponsors, campaigns, creatives, schedules, campaign measurement | No write authority over analytical data or editorial classification |
| Partners | Partnership lifecycle, profiles and disclosures | A paid relationship is not an editorial endorsement |
| Radar | Evidence, system scores, analysis, review and publication | Only approved system analysis writes scores; humans moderate |
| Leads/bookings | Inquiry lifecycle and booking intent | Private contact data; booking provider remains TBD |

App routes compose domains. Domains call shared server infrastructure; shared infrastructure must not depend on product domains. Cross-domain reads use named operations with narrow return types. A campaign may reference a partner or a public article identifier; this reference grants no right to update the referenced record. Avoid mutual module dependencies, event buses, repository frameworks, and empty abstraction layers.

## 4. Proposed `src/` structure

The following is a future ownership map, not a scaffold to create wholesale. Add each directory only when its gate or product phase needs it. Bracketed route names are provisional URLs from the product spec.

```text
src/
  app/
    layout.tsx
    globals.css
    (public)/
      page.tsx
      radar/                 # eventually listing and [token]
      research/              # eventually listing and [slug]
      partners/              # eventually listing and [slug]
      advertise/
      work-with-us/
      network/
      methodology/
      disclosures/
    (auth)/                  # staff sign-in/callback routes; exact paths TBD
    admin/                   # protected shell, then domain management areas
    api/                     # only actual HTTP integration needs
  domains/
    research/
    commercial/
    partners/
    radar/
    leads-bookings/
  components/
    ui/                      # small shared visual primitives only
  server/
    auth/                    # verified session and identity
    permissions/             # action/resource authorization
    db/                      # user, public and isolated privileged clients/types
    feature-flags/           # effective state evaluation
    settings/                # validated operational settings
    audit/                   # trusted event persistence
    logging/                 # structured technical logs
    storage/                 # authorized media operations
  config/                    # explicit public/server environment contracts
```

Inside a domain, use a small set of purpose-named files: types, validation, public queries, server operations, and local UI when needed. Mark server files explicitly and keep browser-safe types separate. Start flat; split into subfolders only when size warrants it. Validation lives with the input/domain it validates, not in a universal utilities directory. Tests live beside deterministic logic; integration and E2E suites live in root `tests/`. Future Supabase configuration, migrations, seeds and database tests live in root `supabase/`.

The eventual route-group move must preserve a single `/` homepage. It is not part of this planning change. Shared UI holds reusable presentation only; domain forms and domain-specific displays remain in their domain. No UI library is selected here.

## 5. Server/client rules

| Surface | Rule |
|---|---|
| Server Components | Default for reads and rendering. Call server queries directly, return minimal public or authorized data, and perform no mutations during rendering. |
| Client Components | Use for interaction/browser APIs. Receive explicit serializable data; never import server modules or database credentials. |
| Server Actions | Treat as externally reachable mutation entry points. Verify actor, permission, input, resource state and flags on every invocation. |
| Route Handlers | Use for actual HTTP consumers, auth callbacks or later integrations. Apply the same guards; do not duplicate every internal query as an API. |
| Database and privileged access | Live in modules guarded with `server-only`. A `use server` directive alone is not a substitute for credential isolation and authorization. |
| Browser-safe data | Explicit field selection; no private notes, lead contacts, internal evidence, credentials or raw database-row spreads. |

Do not share authenticated results across users through persistent caches. Permission checks occur at the operation/data boundary even when a layout has already checked access. Any public cache must contain only published public fields and respect moderation and flag invalidation. Use the supported Next.js Proxy/session-refresh mechanism only for session transport and navigation convenience; it is never the sole security guard. These boundaries follow the [Next.js authentication guidance](https://nextjs.org/docs/app/guides/authentication).

## 6. Database access architecture

Plan `@supabase/supabase-js` with `@supabase/ssr` for the future application integration. Use Supabase-generated TypeScript database types and domain-specific queries. Do not add an ORM, separate API service, or database access framework initially.

Use three distinct access contexts:

- Public reads use the publishable key with anonymous authority and explicit public projections.
- Staff operations use a request-scoped Supabase client carrying the verified user's session, preserving RLS. Being server-side does not justify elevated credentials.
- Exceptional privileged operations use a separate server-only client with a Supabase secret key or legacy service-role credential. Allow only named, justified operations; never export this client to UI, route composition, or unrestricted domain callers.

Ordinary domain database reads/writes go through the application server. Browser Supabase use is limited initially to Auth where necessary. Direct Supabase API requests are still possible, so database grants, RLS, constrained functions, and field protection must secure access independently of the app.

Critical multi-record transitions and their database audit event should commit together through a narrow PostgreSQL transactional function where necessary; separate SDK calls are not an atomic transaction. Define functions and schemas only in a later implementation gate. Use ordinary caller privileges where possible; any privilege-elevating function needs explicit permission checks, restricted execution grants, a fixed safe search path, and review.

Storage access follows the same identity boundary. Private files require authorized access; only deliberately public assets belong in public buckets. Published assets may be public, but drafts and confidential uploads must not become public merely because their URLs are known. Bucket design, upload validation and signed-URL expiry are settled when media features are implemented.

## 7. Authentication architecture

Use Supabase Auth with cookie-based SSR integration. The auth module establishes a verified identity using the SDK's supported verification method; never authorize from unverified session contents alone. Server Components read identity; supported writable server boundaries handle cookie updates, including session refresh via Proxy when needed. Confirm the installed-version integration at the authentication gate. See [Supabase SSR client guidance](https://supabase.com/docs/guides/auth/server-side/creating-a-client).

Staff membership is separate from an Auth account. No public user-account product is added in Phase 1. Gate 5 settles private email/password sign-in, verified claims, cookie session refresh, safe redirects and logout. Roles come from protected application records and must not be self-assigned through editable profile metadata. Staff invitations, first-Owner provisioning, recovery and MFA policy remain explicit later decisions. Redirect destinations must be validated against approved environment URLs.

## 8. Authorization and RLS strategy

Plan Owner, Admin, Editor, Radar Reviewer, Ad Manager, Analyst, and Viewer. Do not infer permissions from role ordering or implement the final permission matrix here. Architecture uses granular action/resource checks, such as permission to publish a particular article, rather than scattered `isAdmin` checks. Roles map to permissions through protected policy; membership can be revoked without relying on long-lived role claims in a token. Ordinary admin content controls cannot rewrite this enforcement policy.

| Enforcement layer | Responsibility |
|---|---|
| Application authorization | Verified actor; action/resource permission; validated fields; business invariants; allowed transition; effective flags. |
| PostgreSQL grants and RLS | Restrict reachable tables, operations and rows even when the application is bypassed. Anonymous reads cover only eligible public records. |
| Privileged server-only operations | Explicit checks plus a narrowly scoped operation when RLS bypass is unavoidable; always auditable. RLS cannot protect a bypassing credential. |

Enable RLS and least-privilege grants together when exposing tables. Test views and functions for unintended elevated access. Row policies alone do not express field ownership: use restricted column grants, separated records, and controlled mutation functions as appropriate to prevent commercial roles editing analytical fields. Exact tables, policies and role grants are Gate 4/6 work. The platform mechanisms are described in [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security).

Owner/Admin privileges do not permit manual Radar score editing or commercial influence. Infrastructure owners can technically alter a database; application boundaries cannot eliminate that authority. Restrict infrastructure access and keep those exceptional operations accountable.

## 9. Feature flag architecture

Store operational flags in Supabase/PostgreSQL and evaluate them on the server through one shared module. A typed catalogue defines known keys, safe defaults and meaning; database values provide operational overrides. Feature flags control availability, not permissions. Unknown flags do not enable functionality.

| Conceptual flag | Behavior |
|---|---|
| `radar_enabled` | Public Radar availability; does not grant publishing rights |
| `research_enabled` | Public research availability |
| `advertising_enabled` | Master paid-ad serving control |
| `featured_partners_enabled` | Featured Partner display availability |
| `booking_enabled` | Booking entry points and submission availability |
| `newsletter_enabled` | Newsletter entry points and submission availability |
| `maintenance_mode` | Restricts normal public availability; authorized recovery/admin access remains possible |
| `radar_auto_publish` | OFF initially; setting it true cannot bypass the initial mandatory-review policy |

Effective eligibility requires every applicable level to allow it: global system → section/placement → individual content/campaign state. A lower-level ON never overrides an upper-level OFF. Dates, publication approval and user permissions remain independent requirements. Featured Partners have their own control; paid ad placements within partner areas also obey the advertising master switch.

Automatic discovery, automatic analysis, mandatory manual review and emergency Radar pause are separate conceptual controls. Their exact stored keys remain TBD for Radar planning. Discovery/analysis are ON-capable; this does not mean jobs run in Phase 1. Emergency pause is OFF normally; when active it takes precedence and blocks discovery, analysis and publication and suppresses public Radar. Recovery controls remain accessible to authorized staff.

Initially read effective controls fresh per request/operation, with request-local reuse only. Disabled/missing/unreadable availability flags default to unavailable; auto-publish defaults OFF. A settings read failure must never enable public publication, ads or submissions. Treat unavailable maintenance state as restricted public operation, with an authorized recovery path. Existing cached pages, API reads, direct database reads and future background jobs must not provide bypasses: gate public data reads and recheck publish eligibility transactionally. A later cache design requires a documented stale-state bound and kill-switch tests before adoption.

Settings hold typed, validated content configuration (navigation, section copy, links and later ordering). Flags hold availability. Secrets and role policy belong to neither editable system. The future admin UI should explain effective state, which parent control disables a feature, and why an action is unavailable; record who changed it and offer auditable corrective edits where appropriate.

## 10. Environment strategy

| Environment | Application and data isolation |
|---|---|
| LOCAL | Local Next.js and Supabase CLI stack; synthetic fixtures and local Auth/Storage. Requires a compatible container runtime, to be checked at Gate 2. |
| PREVIEW/STAGING | Vercel previews use a dedicated nonproduction Supabase project with synthetic data. A stable staging URL can support auth callback validation. |
| PRODUCTION | Vercel production uses a separate production Supabase project, Auth configuration, Storage and credentials. |

Initially share one nonproduction Supabase project across trusted previews, serializing schema-changing preview validation. A preview deployment is not an isolated database. Per-branch Supabase databases may be considered later if conflicts justify their cost. Untrusted PRs must not receive privileged secrets. Never point previews at production or copy production personal data into fixtures.

Proposed variable names (no values):

| Variable | Exposure and scope |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser-safe project endpoint; different per environment |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe application key; never an authorization substitute |
| `APP_ENV` | Server-only validated value: local, staging or production |
| `APP_ORIGIN` | Server configuration for trusted redirects; not copied blindly from request input |
| `SUPABASE_URL` | Server-only project URL for privileged server infrastructure |
| `SUPABASE_SECRET_KEY` | Server-only elevated key; never expose to the browser; use only through named guarded operations |
| `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_ID` | Deployment/migration tooling only; keep out of the ordinary application runtime |

Publishable and elevated keys have different powers; Supabase secret keys bypass RLS and must never enter browser bundles. See [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys). The preferred project naming is `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for browser-safe access and `SUPABASE_SECRET_KEY` for privileged server-only access.

During implementation add an `.env.example` containing names/placeholders only; keep actual local values in ignored `.env.local`. Scope hosted variables separately in Vercel and validate them in server/public config modules. Never prefix a secret with `NEXT_PUBLIC_`, spread environment objects into props, or log tokens. Public values compiled into a preview build must be rebuilt with production values before production release; do not promote a staging-configured artifact unchanged. [Vercel documents environment scopes](https://vercel.com/docs/environment-variables).

## 11. Migration strategy

Use the Supabase CLI and version-controlled SQL migrations; no tables or SQL are created by this plan. Each future migration includes required grants, RLS, constraints and policy tests before exposure. Rebuild a clean local database from migrations with synthetic seeds, then validate staging before production. Generate database TypeScript types from the migrated schema and review changes with the migration.

After a migration is shared/applied, add a new correction instead of rewriting its history. Keep production dashboard schema edits outside normal workflow; reconcile any emergency change back into migrations. Apply remote migrations through one controlled release step, never from Vercel build hooks or application startup. Review target project identity before any remote application. [Supabase migration guidance](https://supabase.com/docs/guides/local-development/database-migrations) supplies the tooling workflow.

Prefer compatible additive changes so the currently deployed app and the next version can coexist. Destructive changes need a separate reviewed release and recovery plan. Application rollback does not undo a database migration; choose tested forward fixes or database recovery deliberately. Backup/restore capability must be verified before handling production data even though the broader readiness review occurs in Phase 8.

## 12. Logging and audit strategy

| Record type | Purpose | Initial direction |
|---|---|---|
| Technical application logs | Errors, timings, diagnostic context | Structured console output collected by the host; small logging module, no logging provider dependency |
| Product analytics | Audience behavior and product usage | Provider TBD; no event collection in Phase 1 |
| Security/admin audit | Trusted accountability for privileged actions | PostgreSQL-backed audit events protected from ordinary edits/deletes |
| Sponsor campaign analytics | Impressions, clicks, unique views, CTR and commercial reports | Later commercial domain; definitions/verification and provider TBD |

Plan audit events for role assignments, settings/flags, article state/classification, campaign/partner state and later Radar hide/reject/flag/reanalysis/publication actions. Record verified actor, action, resource/type, relevant sanitized prior/resulting state, server timestamp, outcome, and request correlation identifier. Do not store secrets, full session payloads, or unnecessary contact data.

For database mutations, audit persistence and the change must commit atomically; failure to record required audit data aborts the change. The database-controlled audit path derives actor identity from trusted context and must also cover direct authorized API/RPC mutation paths. Application actors cannot forge audit entries through arbitrary inserts. Auth-provider administrative operations cannot share a PostgreSQL transaction: restrict them to a named wrapper, record intent/outcome and reconcile uncertain outcomes before reporting success. Document and test that path when introduced. Retention, export access and recovery procedures remain TBD.

## 13. Testing strategy

Recommend these exact tools for later gates; no installations now:

| Tool | When and why |
|---|---|
| Existing ESLint and TypeScript; Next.js production build | Gate 1 onward: lint, strict type validation, build verification |
| `vitest` | Fast deterministic permission, flag, validation and transition tests; server integration assertions |
| Supabase CLI with `pgTAP` / `supabase test db` | Real database grants, RLS, function and atomic-audit tests |
| `@testing-library/react`, `@testing-library/dom`, `@testing-library/jest-dom`, `jsdom`, `@vitejs/plugin-react` | Add only when an interactive component has behavior worth testing |
| `@playwright/test` | Critical authenticated browser flows once Gate 10 provides a shell; later publication and campaign flows |

Use Vitest for pure logic and selected components; validate async Server Component behavior through integration/E2E where supported, rather than relying on unsupported unit rendering. See [Next.js Vitest](https://nextjs.org/docs/app/guides/testing/vitest) and [Playwright](https://nextjs.org/docs/app/guides/testing/playwright) guidance. Resolve compatible stable tool versions when implementing each gate; this plan does not pin unverified package versions.

Prioritize deny tests as well as success paths: anonymous/member/staff separation; missing permissions; direct action and direct Supabase access; cross-resource edits; stale/revoked membership; parent flags overriding children; missing flags; unpublished/private data; audit failure rolling back a mutation; and elevated-client import leakage. Later domain phases add campaign dates/state, sponsor isolation, Radar score immutability, review approval and emergency pause tests before those features can ship. Do not build those domains merely to test them in Phase 1.

Use local disposable data for integration tests. Cover each invariant at the cheapest reliable layer; avoid duplicate snapshots, trivial component tests, coverage quotas, or test suites against production.

## 14. Deployment workflow

Branch → Pull Request → validation → preview deployment → review → production.

Validation includes frozen-lockfile installation during implementation, lint, type checking, relevant tests and a production build. CI provider and repository branch/protection details remain TBD. Vercel preview builds must use staging configuration and pass critical smoke checks. Repository merge/release policy must enforce review before production; do not depend on a human remembering to check a preview after production already deployed.

Production migration is a controlled step after review and before code depending on it, with compatibility for the old app. Build production using production-scoped configuration, deploy, verify, and use the documented recovery path if checks fail. No schema migration runs automatically for every preview. Exact release automation is settled at environment/deployment gates. [Vercel environments](https://vercel.com/docs/deployments/environments) describe the platform separation; this ordering is the project release policy.

## 15. Security boundaries

Radar preserves Discovery → Analysis → Review → Publication. System scoring is separate from editorial notes/moderation; no human-facing score edit operation exists. Automatic public publishing remains OFF, and methodology/transparency plus an explicit future policy review are prerequisites to considering any automatic publishing. A flag alone cannot change that policy. No Radar implementation begins in Phase 1.

Research owns organic classification and independent conclusions. Commercial and partner operations can request/link disclosed placements but cannot modify protected research or Radar fields, even when composed on the same page. Enforce this in operation contracts and database privileges, not just folder names. Admin privilege does not override this product rule.

The platform and separate token intelligence system remain WATCH/intelligence-only. There are no private keys, wallet signers, transaction submission, automated buying/selling, custody, fund movement, or execution infrastructure in this architecture.

Validate untrusted input at server entry points; do not allow payload mass assignment. Require trusted redirect targets and protected auth callbacks. Prevent session data from entering public caches. Future rich-content rendering and uploads need validation before their product phase ships. No feature flag can grant a missing permission or disable audit requirements.

## 16. Recommended implementation gates

Each gate is a separately reviewable task with explicit changed files, tests and an acceptance result. If a gate exposes an unresolved choice needed for safe implementation, resolve and record that choice before building dependent work. Gates 1–11 are complete; the known Turbopack process-binding limitation remains an environment note for `pnpm check`.

| Gate | Scope and dependency | Evidence required before proceeding |
|---|---|---|
| 1 — Conventions and validation tooling | COMPLETE. Existing foundation conventions plus Vitest/jsdom/Testing Library setup | Lint, strict types, build, smoke test and combined `pnpm check` passed |
| 2 — Supabase local architecture | COMPLETE. Project-local Supabase CLI and default local config initialized; the local Docker/Supabase runtime was validated during Gate 11 | CLI `2.116.0` version/init validated; `supabase/config.toml`, runtime startup and ignore rules reviewed; no remote/production dependency |
| 3 — Environment configuration | COMPLETE. `.env.example`, Node engine pin and environment/secrets documentation added; no runtime env abstraction | `.env.example` is trackable, real env files remain ignored, no secret-like values found, package remains valid; no remote target configured |
| 4 — Database foundation | COMPLETE. Depends on 3; minimal identity/role, content/commercial, and Radar registry foundations with reviewed migrations | Three foundation migrations; 17 application tables; RLS enabled; app-role grants initially revoked; 75 structural pgTAP tests passed |
| 6B — Authorization and RLS | COMPLETE. Depends on 5 and 6A; additive role resolver, scoped grants/policies and server boundary | 16 authenticated SELECT policies, explicit column grants, no application writes or audit-log reads, full authorization pgTAP coverage, `/admin` membership gate |
| 5 — Authentication foundation | COMPLETE. Depends on 4; private email/password sign-in, cookie sessions, verified claims, logout and a minimal protected shell | Local Auth user/password login; SSR cookie round-trip with `getClaims`; unauthenticated `/admin` redirect; authenticated `/admin` entry; logout cookie clearing; no role authority granted |
| 6 — Authorization/RLS foundation | Depends on 5; agree only required initial permissions and enforce operation guards/RLS | Positive/negative app and direct database tests; revocation; no self-escalation; controlled first-Owner process |
| 7 — Feature flag foundation | Depends on 6; typed catalogue, read/evaluation path and safe defaults | Hierarchy, failure defaults, recovery access and no stale-state bypass tested; no unaudited management writes enabled |
| 8 — Audit logging foundation | Depends on 6–7; trusted audit persistence and transactional mutation pattern | Mutation/audit atomicity, protected audit records, sanitized evidence; only now expose routine privileged configuration writes |
| 9 — Shared design primitives | COMPLETE. Depends on 1 and completed foundation gates; minimal accessible primitives plus a development-only visual laboratory | Typed primitives, dark token foundation, disclosure/status semantics, responsive laboratory checks; no public page redesign or full design system buildout |
| 10 — Admin shell foundation | COMPLETE. Depends on 5–9; protected navigation/layout, role-aware visibility, read-only status and access states only | Authorized entry, denied direct routes/actions, mobile navigation, read-only feature flags and recovery access; no full domain management dashboards |
| 11 — Foundation validation | COMPLETE. Depends on all prior gates | Frozen-lockfile install, local runtime/replay, pgTAP, application tests, lint, typecheck, route smoke checks and the required Webpack production build passed; `pnpm check` reaches only the known Turbopack process-binding limitation |

This retains the requested ordering. Gate 4 introduces default-deny protection before any usable data surface; Gate 6 adds granular permitted behavior. Routine privileged mutations wait for Gate 8, so the order does not introduce unaudited admin writes. Bootstrap/test fixtures stay local and do not become production management paths. Gate 9 has no reason to introduce a UI component library without a separately justified need.

## 17. Explicit non-goals

Gates 1–10 added validation tooling, local Supabase configuration, environment documentation, the reviewed database foundation, authentication, authorization/RLS, feature-flag reads, append-only audit infrastructure, shared design primitives, and a protected read-only Admin shell. Gate 10 does not add role authority, mutation controls, product dashboards, or remote resources. No production credentials or later-gate functionality were created. Gate 11 validation completed the foundation review; Phase 1 Foundation is COMPLETE. The known Turbopack sandbox limitation remains non-blocking because the required Webpack production build passes.

Phase 1 implementation excludes full public pages, Research CMS workflows, commercial campaigns, partner management, booking/newsletter integration, analytics collection, payment checkout, Radar ingestion/analysis/review implementation, and the Phase 5 operational dashboard. It also excludes premature microservices, a separate backend API product, and a third-party feature flag platform.

## 18. Risks and assumptions

- Existing docs describe product intent, not implemented controls. Every security claim here is a requirement awaiting gate verification.
- One shared staging database is economical but previews can conflict; serialize incompatible schema work until branch isolation is justified.
- Supabase elevated credentials bypass RLS. Isolation and tests reduce application exposure; they do not constrain an infrastructure administrator with those credentials.
- Stale roles, public caches and direct database requests can bypass naive UI checks. Require current permission evaluation, protected projections and gate tests.
- Critical changes require atomic audit records; external Auth changes need explicit reconciliation, not a false atomicity claim.
- Vercel web requests are not a decided home for long-running Radar ingestion. Future workload/hosting limits may justify workers in Phase 7; no worker provider or separate service is chosen now.
- Provider account access, regions, budgets and domain ownership have not been verified. Choosing providers does not provision them; the local container runtime has been validated.
- Future admin controls must expose understandable effective states and safe operations. Developers still own schema releases, secret rotation and policy changes; a beginner owner should not need raw SQL for ordinary content operations.

## 19. Genuine remaining TBDs

Analytics (PostHog is only a candidate), email, newsletter, booking, payments if needed, market-data, on-chain data, AI providers/models, and error monitoring remain TBD. Error-monitoring selection waits until production-readiness planning; technical logs do not require locking it now.

Also TBD at the relevant gate/phase: initial staff login/invitation/recovery/MFA and production Owner bootstrap policy; future domain schemas and operation-specific RLS/mutation policies; media buckets and upload rules; provider region/account/plan details; CI/release automation and trusted preview policy; production branch/domain/redirect configuration; audit retention and recovery objectives; later cache freshness limits; Radar control key names and scoring methodology; commercial measurement definitions. These are not reasons to invent additional features or start implementation now.
