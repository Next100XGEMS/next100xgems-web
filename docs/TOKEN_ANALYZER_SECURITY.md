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
strict URL scheme/host validation, DNS private-range rejection, bounded
redirects/time/bytes/content types, no forwarded cookies, and sanitized bounded
excerpts. Provider errors are sanitized and secrets never enter records,
citations, model context, logs, or client bundles.

The Analyzer preserves the Radar commercial firewall and watch-only boundary.
It cannot custody wallets or create, sign, submit, or route transactions.
Provider collectors, AI calls, AI budgets, and public Analyzer access remain
NOT YET ACTIVE.
