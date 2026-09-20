# Universal Token Analyzer security

Analyzer data is private internal intelligence. There is no anonymous route,
public API, public page, or browser database access. Only Owner/Admin roles may
open the internal console or change the audited master switch. Feature flags
fail closed and never grant permission.

Server-only operations use the existing authenticated session for role checks
and the isolated secret-key boundary for private persistence. Analyzer tables
remain RLS-enabled with no `anon`, `authenticated`, or browser grants. The
master toggle uses a SECURITY DEFINER function with an empty search path,
fully-qualified objects, authenticated-only execution, Owner/Admin validation,
and atomic audit insertion.

External content is untrusted and prompt-injection resistant by boundary:
strict URL scheme/host validation, DNS private-range rejection, bounded
redirects/time/bytes/content types, no forwarded cookies, and sanitized bounded
excerpts. Provider errors are sanitized and secrets never enter records,
citations, model context, logs, or client bundles.

The Analyzer preserves the Radar commercial firewall and watch-only boundary.
It cannot custody wallets or create, sign, submit, or route transactions.
