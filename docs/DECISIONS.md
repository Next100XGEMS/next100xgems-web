# Decision Log

| Decision | Status | Rationale | Affected Area |
|---|---|---|---|
| Product is a Crypto Intelligence + Crypto Media platform | LOCKED | Establishes the product boundary and language | Project, public website |
| Radar is intelligence/watch-only, not trading execution | LOCKED | Protects users and preserves clear scope | Radar, security |
| Deterministic data is separate from AI inference | LOCKED | Makes evidence and uncertainty legible | Radar, research |
| Automatic public Radar publishing is off by default | LOCKED | Requires human review before publication | Radar, admin |
| Radar Score is system-calculated and not manually editable | LOCKED | Prevents arbitrary or commercial score changes | Radar, admin |
| Sponsorship cannot affect Radar or editorial conclusions | LOCKED | Preserves commercial and editorial independence | Advertising, partners, research, Radar |
| Public ads must be labeled Sponsored | LOCKED | Ensures transparent commercial UX | Advertising |
| Phase 0 is documentation-only | LOCKED | Prevents premature implementation and scope growth | Repository |
| Next.js, App Router, TypeScript, Tailwind, pnpm, `src/`, ESLint, strict TS | LOCKED | Existing foundation is confirmed | Technical foundation |
| Supabase PostgreSQL | LOCKED | Phase 1 database selection; supersedes Phase 0 TBD | Database |
| Supabase Auth | LOCKED | Identity provider; application permissions remain separately enforced | Authentication |
| Supabase Storage | LOCKED | Selected file/media storage provider | Media |
| Vercel | LOCKED | Selected deployment platform; project details still TBD | Deployment |
| Modular monolith and domain ownership in PHASE1_PLAN.md | LOCKED | Separate responsibilities inside one Next.js app | Architecture |
| Supabase SDK/SSR clients and CLI migrations; no ORM initially | LOCKED | Minimal integration with typed access and reviewed SQL | Database, authentication |
| Server-verified permissions plus PostgreSQL RLS and grants | LOCKED | Protect both application operations and direct database access | Authorization |
| Isolated elevated server-only access | LOCKED | Secret/service-role credentials bypass RLS and require explicit guards | Security |
| Supabase/PostgreSQL-backed flags; no third-party flag service initially | LOCKED | Operational controls under project ownership | Flags, admin |
| Global → section/placement → resource hierarchy; safe failure defaults | LOCKED | Child flags cannot override disabled parents or grant permissions | Flags, publication |
| Manual-review policy and emergency Radar pause override publication controls | LOCKED | Auto-publish flag alone cannot change initial publication policy | Radar, admin |
| Separate LOCAL, PREVIEW/STAGING and PRODUCTION data/configuration | LOCKED | Prevent preview use of production data or credentials | Environments |
| Branch → PR → validation → preview → review → production | LOCKED | Review the validated preview before production release | Delivery |
| Distinct technical logs, product analytics, admin audit and sponsor metrics | LOCKED | Separate diagnostics, accountability and commercial measurement | Logging |
| Atomic required audit for database changes; reconciliation for external Auth actions | LOCKED | Prevent unaudited or falsely reported privileged changes | Audit |
| Vitest, Supabase CLI/pgTAP; selective Testing Library; later Playwright | LOCKED | Chosen test strategy; tooling installed only at relevant gates | Validation |
| Phase 1 architecture task is documentation only | LOCKED | No implementation gate is started by this plan | Repository |
| Gate 1 validation tooling uses Vitest, React plugin, jsdom, Testing Library DOM/React and vite-tsconfig-paths | LOCKED | Minimal synchronous React/jsdom smoke coverage with existing TypeScript aliases | Validation |
| Gate 2 uses the official project-local `supabase` CLI package and default local configuration | LOCKED | Reproducible CLI commands without a global install; Docker-dependent runtime is deferred until available | Local development |
| Gate 3 pins Node `24.x`, keeps pnpm, and uses `.env.example` with strict environment isolation | LOCKED | Reproducible runtime expectations without committing values or connecting services | Environments |
| Gate 3 uses Supabase publishable/secret key naming | LOCKED | Browser-safe `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is distinct from server-only `SUPABASE_SECRET_KEY` | Secrets, security |
| Gate 4 database foundation uses three reviewed SQL migrations and 17 application tables | LOCKED | Covers identity/roles, flags/settings/audit, editorial/commercial records, leads, and Radar token/analysis/review state without app clients or product workflows | Database |
| Gate 4 enables RLS and revokes API-role table grants with zero policies | LOCKED | Establishes default-deny direct access while authorization policies and authenticated workflows remain deferred to Gates 5–6 | Database, security |
| Gate 4 validates schema structure with local reset/replay and pgTAP | LOCKED | Prevents accidental drift and verifies invariants without creating remote resources or seed data | Validation |
| Gate 5 uses `@supabase/ssr` browser/server clients with Next.js `proxy.ts` session refresh | LOCKED | Follows the current cookie-based SSR approach and keeps normal server access publishable-key scoped | Authentication |
| Gate 5 protects `/admin` with verified Supabase claims, not `getSession()` or client state | LOCKED | Prevents an unverified cookie, stale session object, email string or hidden link from proving identity | Authentication, security |
| Gate 5 authentication does not grant authorization | LOCKED | Login establishes identity only; roles, permissions and final RLS remain Gate 6 work | Authentication, authorization |
| Gate 6B uses live database membership | LOCKED | Active profile plus recognized `user_roles` membership controls effective roles; conflicting commercial/editorial combinations fail closed | Authorization, RLS |
| Gate 6B remains read-only for application identities | LOCKED | Authenticated scoped SELECT only; no application writes, audit-log reads, public policies or Gate 7 behavior | Security, database |
| Vercel Preview/Staging and Production remain separate deployment environments | LOCKED | Prevents preview credentials/data from being reused in production | Deployment |
| Analytics provider | TBD | PostHog is only a candidate; decide in analytics/commercial phase | Analytics |
| Email, newsletter and booking providers | TBD | Future domain needs determine selection | Communication, leads |
| Market-data and on-chain providers | TBD | Radar backend planning is later | Radar |
| AI providers/models | TBD | No selection is made in Phase 1 | Radar, research |
| Payment provider | TBD | Select only if payments are later required | Commercial |
| Error-monitoring provider | TBD | Decide during production-readiness planning | Operations |
| Exact role matrix, staff sign-in/provisioning/recovery/MFA policy | TBD | Resolve required permissions and identity controls at Gates 5–6 | Security |
| Schemas, detailed RLS, bucket/upload rules | TBD | Architecture does not implement schemas or storage policy | Database, media |
| Regions, accounts/plans, CI/release automation, domains and redirect configuration | TBD | Provider choices do not settle operating details | Environments |
| Audit retention/recovery targets, design primitives, future cache freshness | TBD | Resolve at the relevant gate before dependent features ship | Operations, UI |
| Full domain features and operational admin dashboards | DEFERRED | Follow Phases 2–7; Phase 1 delivers foundations and a shell only | Roadmap |
| Microservices and potential Radar workers | DEFERRED | Future measured workload may justify separation; none planned initially | Architecture |
| Trading, custody, wallet execution, fund movement | OUT OF SCOPE | Not part of the product | Security, Radar |
