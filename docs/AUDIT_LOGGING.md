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

## Gate 18B Research integration

Research now implements the transaction strategy above inside six named database RPCs: `create_research_draft`, `save_research_draft`, `transition_research_article`, `change_research_classification`, `assign_research_author` and `save_research_author`. Each derives the actor from `auth.uid()`, verifies live ACTIVE roles/resource scope, locks and validates, writes, then calls the existing `public.write_audit_event` internally under the trusted migration owner. The writer's API ACL and append-only triggers are unchanged; authenticated callers cannot append arbitrary audit events.

Actions are `article.created`, `article.updated`, `article.scheduled` (including reschedule), `article.unscheduled`, `article.published`, `article.archived`, `article.restored`, `article.classification_changed`, `article.author_changed` and `research_author.updated`. Article snapshots contain state/classification/AI, validated author references, revision/schedule/first-publication context and source/relationship IDs, not complete content. Metadata contains a schema version, changed-field names, bounded reasons, or relevant disclosure changes. Byline events capture explicitly public name/title before and after.

No full article body, TL;DR, Key Facts, source URLs/query strings, private profile values, request/session data or credentials are logged. Canonical token relationship UUIDs are domain references, not authentication tokens. The SQL functions construct the narrow payload themselves; the TypeScript redactor is not part of a direct RPC call. The application action union/writer remains unchanged because no Server Action integration is included.

Any required audit failure aborts parent, child, source-retirement, state, revision and byline changes. Tests inject an audit INSERT failure in a rollback-only fixture and prove all six operation families leave exact prior state and no false success record. Ordinary audit UPDATE/DELETE/TRUNCATE and direct API reads/writes remain denied.

Validation: existing audit **19/19**, Research audit/authorization/lifecycle coverage included in Research **358/358**, full database suite **499/499**. No audit viewer, retention job, general elevated application client or external two-request transaction was added.

## Gate 19C Radar integration

Radar human moderation and request operations append the existing
`public.write_audit_event` record inside the same security-definer database
transaction as the state change. Actions are `radar.reviewed`,
`radar.published`, `radar.rejected`, `radar.hidden`,
`radar.editorial_note_updated`, `radar.reanalysis_requested`,
`radar.score_recalculation_requested` and `feature_flag.updated` for the
emergency control. Stale revisions, unauthorized actors and audit failure
prevent the mutation; duplicate action/request keys do not append duplicate
history.

Trusted system completion/failure receipts use `actor_kind = SYSTEM` with no
Auth user and are reachable only through named `service_role` functions. They
record narrow state/method/input hashes, never provider payloads, prompts,
credentials or hidden reasoning. No worker or automatic publisher exists.

Gate 19C-F1 extends these Radar receipts with accepted lease/pause fences and
sealed-input hashes, and records the actual prior emergency-control state on
pause/resume events. Human reanalysis/recalculation receipts bind actor,
operation, target and canonical request payload; conflicting replay keys fail
instead of returning an unrelated work item. Audit records remain append-only.

Gate 19C-F2 keeps publication mutations audited while binding approval and
publication to approved method/freshness registries, sealed PASS inputs,
derived/frozen public snapshots and safe evidence references. Publisher,
approver, revision, feature-flag and emergency-pause state are revalidated
after locking; evidence cannot be appended after approval/publication.

Gate 19C-F3 preserves those atomic audit boundaries while adding durable
evidence freeze history, finite publication timestamps, post-lock wall-clock
deadline checks, and public-read suppression after methodology/freshness
withdrawal. Audit failure still rolls back the publication mutation and its
snapshot.

Gate 19C-F4 preserves the same audit transaction boundary while correcting
upgrade-safe publication validation and canonical lock ordering. Unsafe
historical approvals/publications remain recorded but cannot be published or
read publicly; valid legacy string publications remain auditable. Worker lease
renewal/failure checks occur after the work-row lock and a fresh wall-clock
read, so expired authority cannot create a false success or failure receipt.
