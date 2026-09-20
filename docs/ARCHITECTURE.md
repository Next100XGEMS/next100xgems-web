# Architecture Principles

## Current foundation

The repository foundation is locked as Next.js, App Router, TypeScript, Tailwind CSS, pnpm, `src/`, ESLint, and strict TypeScript. It remains intentionally minimal.

## Future system shape

Use a modular, typed, server-first architecture where appropriate. Keep public content, admin operations, commercial systems, and Radar intelligence as explicit boundaries. Avoid premature microservices and unnecessary abstraction.

The locked application shape is a modular monolith deployed as one Next.js application. Module ownership and the proposed future `src/` structure are defined in [PHASE1_PLAN.md](PHASE1_PLAN.md). Routes compose public/admin experiences; research, commercial, partners, Radar, and leads/bookings own domain operations. Shared server modules own authentication, permissions, database clients, flags, settings, audit, logging, and storage access. Create modules only when their implementation gate or product phase needs them.

Use Server Components by default and Client Components for interaction. Server Actions and Route Handlers verify identity, permissions, input and state at the operation boundary. Domain database access is server-only, using the caller's Supabase session and RLS for ordinary staff operations. Elevated access is isolated to justified server-only operations. No ORM, separate backend service, or third-party flag platform is planned initially.

## Radar separation

The conceptual flow is market/token discovery → deterministic screening → deeper analysis → persistence → human review → public Radar. Deterministic data must remain distinguishable from AI inference. Automatic public publishing is off by default and manual review is required.

## Universal Token Analyzer boundary

The private Universal Token Analyzer is a server-first internal extension of
the Radar intelligence boundary. It resolves bounded token/URL inputs into an
immutable evidence manifest and a deterministic report; optional AI is a
disabled, model-neutral explanation layer. Its additive private tables have no
browser grants, and its `token_analyzer_enabled` /
`token_analyzer_public_enabled` flags fail closed. The Admin console is not a
public route and cannot publish, trade, sign, or submit transactions. See
[TOKEN_ANALYZER_ARCHITECTURE.md](TOKEN_ANALYZER_ARCHITECTURE.md).

## Conceptual domains

Potential domains include users, roles, articles, tokens, Radar events, Radar analysis, partners, sponsors, campaigns, ad slots, creatives, impressions, clicks, leads, settings, feature flags, and audit logs. Gate 4 defines only the initial database foundation for these boundaries; detailed authorization policies, storage rules, and later product schemas remain deferred.

## Providers and deployment

Locked: Supabase PostgreSQL for the database, Supabase Auth for identity, Supabase Storage for media, Vercel for deployment, and PostgreSQL-backed feature flags. The existing framework and pnpm remain unchanged. These choices supersede the Phase 0 provider TBDs; nothing has been provisioned or integrated by this planning task.

Analytics (PostHog is only a candidate), email, newsletter, booking, market-data, on-chain-data, AI, payments if needed, and error-monitoring providers remain TBD. Deployment details such as region, project configuration, domains and CI/release automation remain TBD despite the Vercel provider decision.

Use LOCAL → PREVIEW/STAGING → PRODUCTION, with local Supabase and separate staging/production Supabase projects. Initial trusted previews share staging data; they must never use production credentials. Use Supabase CLI migrations, reviewed SQL and generated database types during implementation.

The intended production flow is branch → pull request → validation → preview deployment → review → production. Migration application is a controlled release step, never an automatic application build side effect.

## Operational controls

Server-evaluated flags follow global system → section/placement → individual content/campaign state. Missing or unreadable availability controls fail closed. Flags do not grant permissions. Emergency Radar pause takes precedence; automatic public publishing remains OFF and review remains mandatory. Phase 1 introduces the shared flag foundation, not Radar jobs or publishing features.

Separate technical logs, product analytics, security/admin audit, and sponsor campaign measurement. Routine privileged writes must not ship before their required audit path. Read [PHASE1_PLAN.md](PHASE1_PLAN.md) for validation gates, exact recommended test tools and unresolved implementation decisions.
