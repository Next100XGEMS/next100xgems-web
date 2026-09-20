# Universal Token Analyzer architecture

Status: internal foundation only. `token_analyzer_enabled` and
`token_analyzer_public_enabled` default to `false`; no public Analyzer route,
navigation item, publication path, trading path, or production scheduler exists.

## Boundary

The Analyzer is a private intelligence workflow:

`input → resolver → canonical identity → selective evidence → immutable manifest → deterministic report → optional validated interpretation`

It reuses Radar's provider-neutral observations, Solana lifecycle and holder
infrastructure, exact values, provenance, and evidence classifications. It
does not duplicate a public Radar projection or change Radar publication.

## Storage

The additive Analyzer migrations store requests, resolutions, immutable
evidence manifests, versioned analyses, provider events, cost usage, and model
call telemetry. Tables have RLS enabled and no browser-role grants. Named
authenticated server operations are the only application access path; the
hardening gateway performs state reads and run persistence transactionally.

An analysis version never mutates a completed manifest. Reanalysis creates a
new analysis version. The database is the authoritative source for the
canonical manifest hash and trusted persisted identity; the application may
perform a local self-check but never supplies the database's final hash as an
authority. Delivery retries reuse the same durable receipt, while fresh
analysis and explicit reanalysis are separate operations (explicit
reanalysis requires a reason). Concurrent submissions serialize on the
fingerprint boundary, so identical application requests create one version and
the remaining calls replay it.

The trusted write boundary enforces methodology-inactive results and disabled
AI, validates resolution/manifest/result identity, and rejects forged hashes,
scores, AI receipts, or conflicting request context. A feature-off transition
serializes against the mutation boundary; a request cannot commit a new
analysis after the disable operation has acquired the feature-row lock.

Provider collection, AI network execution, model budgets, and public Analyzer
access remain intentionally NOT YET ACTIVE.

## Deterministic live intelligence (internal only)

The development connector adds a server-only selective provider layer behind
the existing reservation and immutable-manifest boundary. Supported live input
paths are Solana mint, EVM contract, and accepted DEX/chart URLs; initial live
chains are Solana, Ethereum, Base, and BNB.

Solana authority is ordered as Helius/Solana RPC and Pump/PumpSwap state for
chain facts, Birdeye for primary market observations, DEX Screener for fallback
and comparison, and optional GMGN context that remains provider-derived. EVM
chain facts use Alchemy read-only calls, with DEX Screener as market context.
CoinGecko is capability-advertised for selective verification but is not called
on every routine analysis. Unsupported or unconfigured capabilities are
reported explicitly rather than silently substituted.

Provider requests are server-only, time-bounded, sanitized, and recorded as
bounded usage telemetry. A 429 or transient 5xx is retried at most once with
backoff; non-retryable failures are recorded and do not become verified facts.
No live connector calls AI, writes credentials, changes Radar authority,
publishes a record, or calculates a score.

## Deterministic live intelligence (internal only)

The development connector adds a server-only selective provider layer behind
the existing reservation and immutable-manifest boundary. Supported live input
paths are Solana mint, EVM contract, and accepted DEX/chart URLs; initial live
chains are Solana, Ethereum, Base, and BNB.

Solana authority is ordered as Helius/Solana RPC and Pump/PumpSwap state for
chain facts, Birdeye for primary market observations, DEX Screener for fallback
and comparison, and optional GMGN context that remains provider-derived. EVM
chain facts use Alchemy read-only calls, with DEX Screener as market context.
CoinGecko is capability-advertised for selective verification but is not called
on every routine analysis. Unsupported or unconfigured capabilities are
reported explicitly rather than silently substituted.

Provider requests are server-only, time-bounded, sanitized, and recorded as
bounded usage telemetry. A 429 or transient 5xx is retried at most once with
backoff; non-retryable failures are recorded and do not become verified facts.
No live connector calls AI, writes credentials, changes Radar authority,
publishes a record, or calculates a score.

## Sealed delivery contract

Routine calls reserve before collecting evidence. PostgreSQL canonicalizes the
request and joins calls by authenticated operator, canonical input/resolution,
the inactive configuration/version registry, and the existing five-minute
request reuse window. The window starts at reservation (not a wall-clock bucket
boundary). This is transport deduplication, not a claim that evidence is fresh.
Expired routine intents create a new reservation. Explicit fresh analysis uses
a caller-retained UUID intent; explicit reanalysis uses a new UUID and a reason
and references an existing delivery's exact manifest.

Reservations are append-only. Only the new reservation holder receives its
completion capability. Joiners poll the key-only receipt operation for at most
30 seconds. An interrupted owner does not authorize another collector to take
over; callers may retry the receipt, or start an explicit fresh intent. Routine
reservation expiry bounds abandoned work to the existing five-minute window.
Completion must occur before reservation expiry and while the master flag is on.

Completion accepts only a key, owner capability, and draft evidence manifest.
It accepts no caller result, operation, score, analysis version, or receipt hash.
PostgreSQL validates the whole manifest against the reserved canonical context
and derives the report, manifest revision/hash, and analysis version. No
positive causal explanation or risk derivation is registered in this inactive
foundation: those result sections remain UNKNOWN. Typed claims and trades must
pass the shared strict schema/field/provenance policy; unsupported derivations
are rejected rather than persisted as prose. Retry accepts only a delivery key.

The version and evidence policy is in `persistence-policy.json`, embedded
verbatim in migration 27 and checked for parity by tests. Internal evidence IDs
are never semantic provenance references. Positive evidence requires an explicit
AVAILABLE state, canonical token/entity identity, typed semantic source reference,
eligible provenance, exact field/value, and an allowed evidence classification.
Positive claim display text is the deterministic rendering of that typed fact;
arbitrary causal prose cannot be labelled supported through an unrelated fact.
Trades additionally require a typed transaction reference, wallet/token identity,
exact amount and observation timestamp. Missingness is derived against the shared
field registry, not accepted as a caller-selected confidence denominator.

Migration 27 retains historical manifest bytes/hashes and derives legacy revision
from the manifest row. One canonical delivery key is stored in both the analysis
link and delivery record; historical/latest lookup round-trips through that key.
Repository-local inspection found no remote deployment evidence; this is not an
assertion about uninspected infrastructure.

Local regressions (no provider calls):

- `pnpm exec vitest run tests/token-analyzer*.test.ts`
- `RUN_LOCAL_ANALYZER_INTEGRATION=1 pnpm exec vitest run tests/token-analyzer-concurrency.integration.test.ts`
- `node supabase/tests/scripts/token-analyzer-populated-upgrade.mjs`
- `node supabase/tests/scripts/token-analyzer-db-suite.mjs`
- `node supabase/tests/scripts/token-analyzer-db-suite.mjs --existing-overlay`

The overlap test uses the actual `runAnalyzer` flow and separate PostgreSQL
sessions, observing blocked sessions before releasing the reservation lock.
Authentication is injected for this test; it is not a live Auth/PostgREST test.
The upgrade test verifies full old-row content and both receipt-key round trips.
The existing-development suite applies the repaired schema inside each rollback
test transaction only; it does not advance that database's migration history or
leave Analyzer enabled. No permanent test bypass is installed.

## Security

Admin actions re-check authenticated identity and Owner/Admin role at the
operation boundary. The master switch is a database function that performs the
flag mutation and audit insert atomically. Public access is a separate prepared
flag and remains disabled; it is not an authorization mechanism.

External URLs are untrusted. The server-only URL safety helper accepts only
HTTP(S), rejects credentials/private/link-local/metadata destinations, bounds
redirects, time, response bytes, and content types, and never forwards cookies
or internal headers.

No wallet custody, private key, signing, transaction construction, submission,
swap, buy, sell, order routing, or automated execution is present.
