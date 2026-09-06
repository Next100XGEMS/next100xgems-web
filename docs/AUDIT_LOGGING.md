# Audit Logging — Gate 8

## Purpose and threat model

Audit logging records security and administrative events for future privileged operations. It is separate from technical application logs, product analytics, and sponsor campaign analytics. The threat model includes browser clients, anonymous callers, authenticated users, compromised application paths, accidental logging of secrets, and attempts to rewrite historical evidence.

## Table model

`public.audit_logs` stores a UUID primary key, explicit `actor_kind` (`USER` or `SYSTEM`), an optional actor UUID for system events, namespaced action, resource/domain type, resource UUID, optional previous and resulting state snapshots, metadata, and `created_at`. User events require an actor UUID; system events require a null actor UUID. The existing actor foreign key remains restrictive for user identities. The existing indexes support actor/time and resource/time lookup.

## Actor trust model

User actors come from the verified Supabase subject and live active application membership returned by the existing authorization helper. The audit writer does not accept an actor ID from event input. Future mutation handlers must perform their own permission/resource checks before writing an audit event. The database writer accepts `USER` and `SYSTEM` actor kinds only through the isolated trusted server path; no fake Supabase user is created for system work.

## Server-only writer

`src/lib/audit/server.ts` exposes `writeAuditEvent(event)`. It obtains the trusted user actor through `requireAdminAccess()`, validates the resource UUID and typed action/resource vocabulary, sanitizes snapshots and metadata, then calls the narrow `public.write_audit_event` function through an isolated lazy Supabase secret-key client. The client is not exported and is not a general elevated database utility.

## Append-only protection

The existing database triggers reject UPDATE, DELETE, and TRUNCATE on audit history. API roles retain no direct audit table grants. The new database writer function is executable only by `service_role` and performs INSERT only. Migrations or the database owner remain the controlled maintenance bypass for schema recovery; ordinary application code has no history rewrite path.

## Action naming

Actions use a deliberate namespaced convention such as `feature_flag.updated`, `article.published`, `radar.reviewed`, `radar.published`, `partner.updated`, `campaign.updated`, and `role.assigned`. Gate 8 defines a small vocabulary foundation. Future domain gates must add action names deliberately rather than accepting arbitrary browser strings.

## State snapshots and redaction

Callers should pass narrow, relevant state objects rather than complete database rows. The writer recursively redacts common password, secret, token, authorization, API-key, private-key, cookie, and database-password field names. It rejects unsupported values, non-finite numbers, cycles, and excessively deep snapshots. Passwords, session/refresh tokens, Supabase keys, private keys, API secrets, database passwords, payment secrets, and raw authorization headers must never be logged.

## Failure semantics

The writer returns a receipt only after the database append succeeds. Missing privileged configuration, authorization failure, malformed snapshots, or database failure raises an error and does not claim success. Future security-critical mutations must treat required audit failure as mutation failure. Gate 8 does not create fake cross-request transactions or product mutations.

## Future transaction strategy

Each sensitive mutation must eventually persist its state change and required audit event in one trusted transaction or narrow database operation where atomicity matters. A separate HTTP call is not an atomic transaction. The mutation gate must derive actor identity, enforce permission and resource state, sanitize before persistence, and roll back or fail closed when required audit insertion fails.

## Read access

Direct browser reads and public reads remain closed. Gate 8 does not build an audit viewer. A later server-mediated reader may be restricted to Owner/Admin and may require redaction or field-level decisions before exposing history.

## System actors

The table can represent trusted `SYSTEM` events without inventing an Auth user. No system worker or automation is implemented in Gate 8. Any future system writer must use a separate controlled server path and preserve the same append-only and redaction rules.

## Future integration contract

Future privileged operations should follow: verify identity → require active membership → require operation permission → validate input/resource state → create a narrow sanitized event → perform mutation and required audit append atomically → return success only after both complete. Browser input never chooses the actor. Audit records are evidence of the operation, not an authorization mechanism.

## Deferred functionality

Gate 8 does not implement feature-flag mutation, article publishing, role management, Radar review/publication, commercial operations, an audit UI, audit export/retention jobs, analytics, system workers, or Gate 9 design primitives.
