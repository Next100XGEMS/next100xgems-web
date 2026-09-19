# Next100XGems Radar Specification

Current implementation note: Gate 19D Batch 1 provides provider-neutral
normalization and deterministic Fast Lane plumbing. Gate 19G-F1 requires
input-bearing work to be finalized by a trusted server transaction before
claim, exposes only the fenced database manifest to the worker, and preserves
explicit provider missingness and exact numeric transport. No production
provider, scoring policy, trading or execution path is defined here. Gate
19G-F2 adds durable Deep Lane request/attempt/completion orchestration using
the same work, lease, fence and pause authority; it does not select or activate
a production AI provider.

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
