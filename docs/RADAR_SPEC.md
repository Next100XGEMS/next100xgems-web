# Next100XGems Radar Specification

Current implementation note: Gate 19D Batch 1 provides provider-neutral
normalization and deterministic Fast Lane plumbing. Gate 19G-F1 requires
input-bearing work to be finalized by a trusted server transaction before
claim, exposes only the fenced database manifest to the worker, and preserves
explicit provider missingness and exact numeric transport. No production
provider, scoring policy, trading or execution path is defined here. Gate
19G-F2 adds durable Deep Lane request/attempt/completion orchestration using
the same work, lease, fence and pause authority; Gate 19G-F3 closes the
application/database hash, replay, post-lock lease and recovery-identity gaps
through one additive correction. No production AI provider is selected or
activated.

## Purpose

Next100XGems Radar discovers, filters, analyzes, and presents crypto market activity, opportunities, signals, and risks. It is an intelligence and publishing workflow, not a trading system.

## Conceptual pipeline

Market data/token discovery → deterministic screening → liquidity, market cap, holders, contract risk, volume, age, trading activity, wallet concentration, and relevant on-chain signals → pass/reject → deeper analysis → persistence → human review queue → public Radar.

Deterministic evidence and AI inference must remain separate. Evidence states may include VERIFIED DATA, STRONG SIGNAL, AI INFERENCE, and UNKNOWN. Potential statuses are EARLY, TRENDING, HIGH RISK, and REJECTED.

## Future token page

Eventually support token identity, chain, contract address, status, system-calculated Radar Score, freshness timestamp, market and on-chain metrics, holder concentration, momentum, social/narrative analysis, risks, reasons for appearance, sources, methodology, disclosure, and disclaimer.

## Integrity rules

Radar must not promise 100x returns, guarantee performance, automatically recommend buying, execute trades, or allow sponsors to influence scores, rankings, risk assessments, trending status, or research conclusions. Automatic discovery and analysis may be enabled; automatic public publishing remains OFF initially and manual review remains ON.

Include an emergency pause switch in the future admin system. Out of scope: wallet connection for execution, private keys, signers, RPC writes, transaction building/submission, automated buying/selling, and fund movement.

## Deep Lane durability contract

Deep Lane uses a canonical durable logical request bound to the work item,
reserved analysis version, task, method/schema version, exact sealed input and
evidence manifests, output schema, and trusted adapter/provider/model identity.
Transport timestamps and process-local random values do not define request
identity. A durable attempt is reserved before the fixture/future adapter is
called and carries its attempt identity, deterministic external idempotency
key, worker lease/fence and pause generation. Concurrent duplicate delivery
reuses the in-progress state or completed receipt instead of invoking a second
local attempt.

Successful structured output is accepted only after current authority and
manifest bindings are revalidated, then is stored as an immutable completion
receipt with an output hash. Retryable failures require a deliberate bounded
new attempt. If an adapter may have executed but local completion is unknown,
the request enters `UNCERTAIN`; it is not blindly retried unless the adapter
supports safe reuse of the same external idempotency key. These guarantees
prevent local duplicate invocation but do not claim exactly-once execution of
an external provider that lacks idempotency support. Model output remains AI
inference and cannot become verified data or directly change publication.

Gate 19G-F3 makes PostgreSQL the authoritative source for both logical
request and validated output hashes. The application receives the request hash
from reservation and sends no independently serialized output hash to the
completion RPC; the database canonicalizes the validated JSON once. Completed
receipts are replayed before live lease checks, while new invocations still
require current authority. Reservation and completion use advancing
`clock_timestamp()` after their row locks, so a lease that expires while a
caller waits is rejected. Recovery locks and validates the work/request/attempt
relationship before mutation. These corrections preserve explicit
`UNCERTAIN` handling when external execution cannot be proven and do not claim
external exactly-once execution without provider idempotency support.

Gate 19G-F4 adds the final application reconciliation boundary. The gateway
returns the authoritative request context already exposed by the reservation
contract, and the application compares it with the caller's work, token,
analysis version, frozen manifest, task/method/schema, evidence and trusted
provider/model context before either replaying a receipt or invoking an
adapter. Completed replay does not require a live lease, but every meaningful
identity field must match; conflicts are bounded application errors and do
not create attempts or invoke the adapter.
