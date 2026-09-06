# Security and Trust Boundaries

## Authorization

Authentication and authorization must be server-side. Every sensitive action conceptually follows: identify the actor → authenticate → check role → check permission → execute → audit log. Client-side checks and hiding `/admin` are insufficient.

Sensitive actions require audit logging. Secrets remain server-side, including the Supabase secret key, payment/API secrets, database credentials and production infrastructure credentials. Wallet private keys are excluded entirely; the product does not accept, store or use them.

The preferred Supabase key model uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for browser-safe values, plus `SUPABASE_URL` and `SUPABASE_SECRET_KEY` for explicitly server-only infrastructure. The secret key bypasses RLS and must be isolated behind named, authorized operations. Do not use legacy service-role or anonymous-key names as the preferred architecture.

## Phase 1 enforcement architecture

Gate 5 established Supabase Auth verified identity and cookie-based SSR session plumbing. Gate 6B adds live database-backed membership, server authorization helpers, 16 scoped authenticated SELECT policies and explicit column grants. Gate 7 adds server-only typed feature-flag reads with conservative defaults; it does not add mutations or public raw-table access. Gate 8 adds an append-only audit writer foundation without activating product mutations. Gate 9 adds shared design primitives and a development-only laboratory; Gate 10 adds the protected read-only Admin shell. Login alone grants no role, database access or privileged action; browser writes and direct `audit_logs` access remain closed. Every future privileged operation must still check identity, permission, input and resource state independently.

Ordinary server database clients carry the user's session and preserve PostgreSQL RLS. Enable RLS with explicit least-privilege grants before exposing tables, and test direct API access as well as app paths. Anonymous access is limited to intentionally public, eligible fields/records. Protected role records must not be self-editable, and role revocation must not depend only on stale token claims.

Supabase elevated secret/service-role credentials bypass RLS. Keep them in an isolated `server-only` module used only by named, authorized and audited operations; never in `NEXT_PUBLIC_` variables, props, client imports, logs or general-purpose database clients. Migration credentials belong to release tooling rather than routine web runtime. Protect views/functions and column ownership as well as rows. See the [Phase 1 plan](PHASE1_PLAN.md) for the application/RLS/elevated-access responsibility split and provider references.

## Radar and commercial independence

Sponsored content and Featured Partners must not affect Radar rankings, scores, risk assessments, organic trending status, or independent research conclusions. Public commercial content must be disclosed.

Enforce this separation in domain operation contracts and database grants/controlled mutations. Commercial records may reference public research or Radar data but cannot write protected analytical fields or organic classification. Owner/Admin status does not permit manual Radar score changes. Infrastructure administrators remain technically privileged and require restricted, accountable access.

## Flags, publication and audit

Availability is evaluated on the server using global → section/placement → resource state. Lower-level settings cannot override a disabled parent. Flags never grant authorization or disable audit requirements. Missing/unreadable availability state fails closed; maintenance failures preserve an authorized recovery path. Public reads, direct database access and cached output must respect moderation and effective controls.

Radar follows Discovery → Analysis → Review → Publication. Auto-publish stays OFF initially; even a true flag cannot bypass the initial manual-review policy. The emergency pause overrides Radar controls and stops discovery, analysis and publication while suppressing public Radar. Its normal state is OFF. Methodology and a separately reviewed policy are required before any future automatic publishing.

Audit events record the verified actor, action, affected resource, sanitized prior/resulting state, timestamp and outcome. Ordinary app users cannot forge, edit or delete them. Database mutations and their required audit events commit atomically; audit failure prevents the mutation. External Auth operations require recorded intent/outcome and reconciliation because they do not share a database transaction. Avoid tokens, secrets and unnecessary personal data in logs. No routine privileged management writes are exposed before their audit foundation.

## Trading boundary

The system is WATCH/intelligence-only. Never add custody, private keys, signers, RPC writes, transaction building/submission, automated buying/selling, portfolio execution, or fund movement.

## Operational posture

Plan for LOCAL → PREVIEW/STAGING → PRODUCTION and reviewed production changes. Local uses synthetic data; staging and production use separate Supabase projects and credentials. Vercel preview deployments must not receive production data or secrets. Public environment values are build-sensitive; production releases must use production configuration.

Phase 1 establishes authentication, authorization/RLS, flags and audit foundations. Gate 5 does not implement final authorization or RLS policies. Phase 8 performs the broader security, rate limiting, monitoring, backup, access-control, performance, SEO, accessibility and deployment review; it is not permission to defer enforcement on earlier protected features. Verify recovery before storing production data.
