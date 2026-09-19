# Product Roadmap

## Phase 0 — Specification

Documentation, architecture, design direction, security boundaries, and roadmap. No implementation beyond the existing foundation.

## Phase 1 — Foundation

Core application architecture, environments, design primitives, admin shell planning, feature-flag foundation, and logging/testing foundations.

Architecture planning is documented in [PHASE1_PLAN.md](PHASE1_PLAN.md); Gates 1–11 are complete and Phase 1 Foundation is COMPLETE. The known Turbopack process-binding issue remains a non-blocking `pnpm check` environment limitation because the required Webpack production build passes. Providers are locked to Supabase PostgreSQL/Auth/Storage and Vercel, with pnpm and the existing Next.js foundation. Phase 1 includes authentication, authorization/RLS, audit foundations, shared design primitives, and a protected read-only Admin shell before operational mutations are exposed.

Recommended implementation gates, each separately validated:

1. Project conventions and validation tooling — COMPLETE. Added Vitest/jsdom/Testing Library foundation and passed lint, typecheck, smoke test, build and `pnpm check`.
2. Supabase local architecture — COMPLETE. Added the project-local Supabase CLI and generated the default `supabase/config.toml`; local Docker/Supabase runtime validation passed during Gate 11.
3. Environment configuration — COMPLETE. Added `.env.example`, Node `24.x` engine pin, environment isolation documentation, and verified ignored real env files.
4. Database foundation with default-deny protection — COMPLETE. Added the reviewed migration history, 17 application tables, structural pgTAP coverage, and clean local replay validation.
5. Authentication foundation — COMPLETE. Added cookie-based Supabase SSR clients, verified-claims session refresh, private login/logout, and a minimal protected `/admin` shell; authentication does not grant authorization.
6. Authorization/RLS foundation — COMPLETE. Added live membership resolution, scoped grants/policies, and application authorization helpers.
7. Feature flag foundation — COMPLETE. Added typed server-side reads and conservative defaults; no mutations.
8. Audit logging foundation — COMPLETE. Added append-only trusted writer foundation; no product mutations.
9. Shared design primitives — COMPLETE. Added the dark visual foundation and development-only laboratory.
10. Protected admin shell foundation — COMPLETE. Added role-aware protected navigation, read-only status overview, and placeholders only.
11. Foundation validation — COMPLETE. Frozen-lockfile install, local replay, full pgTAP, application tests, lint, typecheck, route smoke checks and the required Webpack production build passed. `pnpm check` reaches only the known Turbopack process-binding limitation.

Gate dependencies and acceptance evidence are specified in the plan. The Phase 1 shell provides protected navigation/access states; full operational domain dashboards remain Phase 5. No public website design or Radar implementation belongs to these foundation gates.

## Phase 2 — Public Website

Homepage, navigation, footer, Network, Methodology, Disclosures, and Work With Us.

Gate 12 — Public application shell — COMPLETE. Added the reusable public route-group shell, responsive header and mobile navigation, footer link groups, global metadata, and structural placeholders for the Phase 2 public routes. The full homepage content build remains a later gate.

Gate 13 — Real homepage — IMPLEMENTED. Added the first production-quality homepage composition with truthful Radar and Research framing, commercial/editorial separation, network distribution context, methodology disclosures, and a provider-free alerts proposition. Radar, Research, partner records, newsletter submission, and other backend workflows remain deferred to their own gates.

Gate 14 — Methodology and Disclosures — IMPLEMENTED. Added static public trust pages explaining the Radar pipeline, evidence states, AI assistance, human review, status and freshness principles, limitations, commercial independence, content classifications, risk, and user responsibility. No backend or security architecture was changed.

Gate 15 — Network and Work With Us — IMPLEMENTED. Added static media-network and commercial pathway pages with confirmed channel types, service and engagement descriptions, sponsor-quality boundaries, disclosure treatment, factual metadata, and a non-functional inquiry state. No backend, contact, booking, payment, or CRM functionality was added.

Gate 16 — Partners and Advertise — IMPLEMENTED. Added static Featured Partners and advertising inventory pages with an honest no-partner state, commercial independence boundaries, conceptual placement/formats, planned reporting language, sponsor-quality standards, feature-flag-aware availability wording, and factual metadata. No partner records, pricing, campaign backend, forms, payments, analytics, or remote integrations were added.

Gate 17 — Public Research experience — IMPLEMENTED. Added the Research landing page, confirmed category rail, typed article presentation contract, empty production library, not-found article route, development-only neutral preview, publication-style renderer, classifications/disclosures, sources and related-content architecture, factual metadata, safe Article JSON-LD generation, and Research/Radar boundary language. No published research, CMS, backend, database, or publishing workflow was added.

Gate 18A — Research CMS architecture/security planning — COMPLETE. Approved the article evolution, public byline, source/relationship, publication, authorization and atomic-audit contracts in [RESEARCH_CMS_PLAN.md](RESEARCH_CMS_PLAN.md).

Gate 18B — Research database/authorization foundation — COMPLETE. Added two migrations for bounded structured content, independent AI classification, public authors, ordered sources, related Research/canonical tokens, revision-controlled publication, narrow public projections, staff RLS and six atomic audited mutation RPCs. No custom PostgreSQL reader role was created. Clean local replay and all **499/499** database tests pass, including **358/358** Research checks; separate-session concurrency/legacy upgrade checks **13/13**. Lint/typecheck, **50/50** application tests and Webpack build pass. The single `pnpm check` run reaches only the known Turbopack sandbox limitation.

Gate 18C — Public Research database integration — IMPLEMENTED. Added the server-only publishable-key reader, strict DTO mapping, request-time landing/article reads through the Gate 18B public projections, truthful feature-flag/error/not-found behavior, safe structured-body rendering, and focused route/reader tests. No production Research content was seeded, no remote project was used; Admin CMS/preview UI and Server Actions were implemented in Gate 18D, while rich-text/media handling and automatic scheduling remain deferred.

Gate 18D — Operational Admin Research CMS — IMPLEMENTED. Added the RLS-filtered Admin Research list, new-draft/editor/preview routes, explicit draft and lifecycle controls, closed structured block editor, Key Facts, sources, related Research/tokens, public byline/classification/disclosure/SEO fields, and thin Server Action adapters over the named Gate 18B audited RPCs. Preview is authenticated, noindex, visibly unpublished, and omits Article JSON-LD. No secret-key user operation, direct table mutation, media upload, autosave, automatic scheduler, migration change, or remote integration was added. Gate 18E remains separately gated.

Gate 18F1 — Research corrective integrity fixes — COMPLETE. Corrected the historical classification-trust, Key Facts preservation, and disclosure-synchronization findings while retaining named audited RPCs and the existing Research security boundaries.

Gate 18F2 — Research public-contract correction — COMPLETE. Aligned Admin validation, database save/publication validation, public DTO mapping, and rendering for source/byline bounds, structured IDs/labels, relationship cardinality, and nullable canonical token labels. Added one additive migration and regression coverage without changing RLS, grants, role semantics, lifecycle behavior, or audit architecture. Complete local pgTAP and application validation passed; the final Gate 18E4 audit is recorded below.

Gate 18F4 — Research final public-contract correction — COMPLETE. Added one explicit cross-layer contract for Unicode blankness, supported HTTP(S)/DNS-or-IPv4 source URLs, AD-only source dates, and public timestamp bounds; aligned Admin validation, direct RPC/publication checks, and the public DTO reader; added the final URL/date/whitespace corpus without changing RLS, grants, RBAC, lifecycle, audit, or Radar architecture.

Gate 18F3 — Research public-contract alignment — COMPLETE. Added shared Unicode code-point length semantics, raw-value and whitespace validation alignment, structured identifier protections, direct-RPC publication checks, and reader support for legitimate nullable/unbounded canonical token display metadata. Added additive migration and boundary regressions without changing RLS, grants, RBAC, audit, lifecycle, or Radar architecture. Webpack build and complete database/application validations pass; default `pnpm check` remains limited by the known local Turbopack sandbox process-binding error.

Gate 18E4 — Final Research completion audit — PASSED WITH NON-BLOCKING FINDINGS. H1, M1, M2, and M3 are fixed; no Critical, High, or Medium findings remain. Research is COMPLETE. A dedicated mounted Editorial → Partner disclosure-synchronization test may be added later; the shared reconciliation path is already validated and this is not a completion blocker. Radar remains separately gated.

## Phase 3 — Research

Content model, articles, categories, authors, sources, related content, SEO, structured data, and disclosures.

## Phase 4 — Commercial

Partners, sponsors, ad inventory, campaigns, creatives, scheduling, impressions/clicks, leads, and commercial forms.

## Phase 5 — Admin

Operational controls for content, partners, advertising, leads, settings, navigation, feature flags, analytics, and roles.

## Phase 6 — Radar UI

Radar listing and token views, statuses, scores, evidence states, sources, methodology, and demo data.

## Phase 7 — Radar Backend

Market/on-chain ingestion, deterministic screening, risk filtering, deep analysis, persistence, review queue, human approval, and public presentation. Automatic publishing remains OFF initially.

Gate 19A — Radar implementation architecture and safety plan — COMPLETE. Added the scoped Radar architecture, data model, provider boundaries, freshness/evidence semantics, public-read contract, review/audit model, adversarial test matrices, and deferred decisions in [RADAR_IMPLEMENTATION_PLAN.md](RADAR_IMPLEMENTATION_PLAN.md). No Radar runtime, database, provider, or AI implementation was started.

Gate 19B — Public Radar UX — IMPLEMENTED. Added the truthful flag-aware `/radar` explanation page, development-only `/radar-preview` list and synthetic detail preview, reusable Radar evidence/status/score/freshness presentation, and [RADAR_UI.md](RADAR_UI.md). No live Radar records, provider integrations, database changes, migrations, workers, Admin review queue, or execution functionality were added.

Gate 19C — Radar database/event/evidence/security foundation — COMPLETE and approved after final Astra sign-off. The original, F1, F2 and F3 foundations remain additive and preserve canonical tokens, Research migrations, RLS/grants and Radar history. Gate 19C-F4 adds upgrade-safe authoritative-source validation, canonical post-lock publication authorization/time checks, and work-row lease revalidation; it also corrects the lock-wait fixtures. Validation covers the legacy contract **75/75**, F1 **54/54**, F2 **51/51**, F3 **45/45**, F4 **21/21**, corrected F3 lock-wait concurrency **9/9**, Radar worker concurrency **5/5**, F2 publication concurrency **6/6**, Research concurrency **13/13**, full database tests **849/849**, and the disposable F4 upgrade/lease-race checks. No provider, Fast Lane, Deep Lane, worker, automatic publisher, Admin Radar UI or execution capability was started. Gate 19D remains separately gated.

Gate 19D Batch 1 — provider-neutral Fast Lane foundation — IMPLEMENTED. Added typed provider contracts, exact-decimal normalization, explicit UNKNOWN/UNAVAILABLE/UNSUPPORTED/STALE semantics, fixture adapters, canonical hashing, RPC-backed ingestion/work orchestration, deterministic screening, and lease-safe processing primitives. No production provider, threshold policy, score formula, scheduler, public integration, AI, Admin operations or execution capability was selected or added.

Gate 19E — Radar Admin operations and public projection integration — IMPLEMENTED. Admin review and processing requests use existing authenticated reads and audited RPCs; the public route reads only the published, policy-eligible projection with explicit empty/unavailable states. No service key, direct browser table write, manual score/evidence edit, or fixture fallback was added.

Gate 19F compatible foundation — IMPLEMENTED. Added provider-neutral Deep Lane request/output validation, sealed evidence references, explicit `AI_INFERENCE` provenance, bounded retry classification, and a test-only fixture adapter. Real AI/provider selection and production scoring contribution remain deferred.

Gate 19G-F1 — Radar processing integration hardening — IMPLEMENTED. Added the additive database-authoritative input-finalization and fenced manifest contract, prevented claims before finalized input assembly, aligned ingestion with the sealed database fingerprint, preserved explicit provider failure/missingness and exact numeric transport, and bound Admin operation keys to actor/action/target/payload/intent. Existing RLS, grants, audit, lease, pause and no-execution boundaries remain unchanged. Production provider, scoring and freshness policy decisions remain deferred.

Gate 19G-F2 — durable Deep Lane orchestration — IMPLEMENTED. Added durable
logical requests, fenced invocation attempts, deterministic provider
idempotency keys, immutable structured completion receipts, bounded explicit
retry, and truthful `UNCERTAIN` recovery for the crash window after an
external invocation but before local completion. Duplicate local delivery
cannot invoke a second valid attempt, and completion is bound to the exact
sealed manifest and trusted adapter/provider/model identity. The fixture is
test-only; no production AI vendor, scoring or freshness decision was made,
and no trading/execution capability exists.

Gate 19G-F3 — Deep Lane integrity correction — IMPLEMENTED. PostgreSQL is the
authoritative source for request/output hashes; completed receipts replay
without a live lease; reservation and completion reject leases that expire
while waiting on locked rows; and recovery rejects mismatched
work/request/attempt identities before mutation. Focused database coverage is
25/25, application coverage is 116/116, and the disposable separate-session
Deep Lane harness is 7/7. No production AI provider, scoring/freshness policy,
or trading/execution capability was selected or activated.

Gate 19G-F4 — Deep Lane receipt replay context binding — IMPLEMENTED. The
existing authoritative reservation response is reconciled against the full
application request context before replay or adapter invocation. Completed
receipts remain lease-free to replay, while conflicting work, token, version,
manifest, task/method/schema or trusted provider/model context is rejected
without a new attempt. No migration, production AI provider or
trading/execution capability was added.

Gate 19G — software-foundation sign-off after `9ee3a1b` — APPROVED WITH NON-BLOCKING FINDINGS. The final focused audit closed Deep Lane receipt/context misbinding, verified real local application/RPC replay and conflicting identities, confirmed concurrent completed replay without extra invocations, and independently passed the clean database suite (891/891 across 38 files after 23 migrations) and Deep Lane concurrency (7/7). This is software approval, not production intelligence or launch approval. The committed RPC test's feature-flag/audit cleanup remains a non-blocking test-isolation note; the sign-off used disposable databases.

Production Radar Intelligence Design — requirements baseline COMPLETE, pending product/methodology review. [RADAR_PRODUCTION_INTELLIGENCE.md](RADAR_PRODUCTION_INTELLIGENCE.md) defines 80 candidate signals, a proposed 30-signal minimum set, 31 vendor-neutral capability requirements, evidence/freshness/conflict principles, a conditional Solana-first evaluation recommendation and a point-in-time empirical validation plan. Next: review these requirements and evaluate provider capabilities; providers, AI models, scoring weights/formulas/thresholds, freshness durations and production activation remain unapproved. No integration or implementation changed in this planning phase.

## Phase 8 — Production Readiness

Security and authorization review, rate limiting, monitoring, backups, access controls, performance, SEO, accessibility, and deployment review.

This is a readiness review of controls introduced with their features, not a deferral of basic security until Phase 8. Authentication/RLS, audit requirements and environment isolation are validated during Phase 1; production recovery must be verified before storing production data. Error-monitoring provider selection remains TBD until this planning phase.

Initial MVP excludes custody, trading execution, portfolio management, guaranteed recommendations, sponsor-controlled rankings/scores/risk, undisclosed advertising, and pay-to-rank organic content.
Gates 6B–10 are implemented in the local project as the authorization/RLS, feature-flag read, audit foundation, design-primitives, and protected Admin shell foundations. Gate 11 validation is complete; Phase 1 Foundation may be marked COMPLETE. Phase 2 remains separately gated.
