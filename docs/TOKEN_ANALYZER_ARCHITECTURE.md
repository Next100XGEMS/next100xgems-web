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

The additive Analyzer migration stores requests, resolutions, immutable
evidence manifests, versioned analyses, provider events, cost usage, and model
call telemetry. Tables have RLS enabled and no browser-role grants. Named
server operations are the only application access path.

An analysis version never mutates a completed manifest. Reanalysis creates a
new analysis version. Stable request fingerprints permit deterministic evidence
reuse inside an approved freshness window once provider collection is attached.

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
