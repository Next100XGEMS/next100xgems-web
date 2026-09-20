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
