# Universal Token Analyzer security

Analyzer data is private internal intelligence. There is no anonymous route,
public API, public page, or browser database access. Only Owner/Admin roles may
open the internal console or change the audited master switch. Feature flags
fail closed and never grant permission.

Named SECURITY DEFINER operations use the existing authenticated session for
role checks and pinned empty search paths for private persistence. Analyzer
tables remain RLS-enabled with no raw `anon`, `authenticated`, or browser
grants. The master toggle uses a SECURITY DEFINER function with fully-qualified
objects, authenticated-only execution, Owner/Admin validation, and atomic
audit insertion. Database failures are not represented as an ordinary
disabled flag.

External content is untrusted and prompt-injection resistant by boundary:
strict URL scheme/host validation, DNS private-range rejection including
IPv4-mapped IPv6 and reserved IPv4 ranges, bounded redirects/time/bytes/content
types, no forwarded cookies, and sanitized bounded excerpts. Provider errors are
sanitized and secrets never enter records, citations, model context, logs, or
client bundles.

Evidence freshness is policy-based: a timestamp alone is not fresh; missing
policy, missing timestamps, unavailable observations, or excessive future skew
produce `UNKNOWN`, while an explicit stale observation remains `STALE`.
Structured claims must bind to the referenced evidence ID, source, field,
evidence class, identity, and exact value. Mismatched numeric or identity
content is rejected rather than accepted through keyword matching.

Analyzer persistence is database-authoritative. PostgreSQL recomputes the
manifest hash, validates the inactive-methodology/disabled-AI contract, and
reconciles the stable identity before storing a result. Delivery retries replay
an existing receipt; fresh analysis and explicit reanalysis create new
versions only through their explicit operation contracts. Exact position-sizing
arithmetic carries rational values until final output rounding and reports
below-precision nonzero results as unavailable.

The Analyzer preserves the Radar commercial firewall and watch-only boundary.
It cannot custody wallets or create, sign, submit, or route transactions.
Provider collectors, AI calls, AI budgets, and public Analyzer access remain
NOT YET ACTIVE.
