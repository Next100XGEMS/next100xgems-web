# Radar Implementation Architecture and Safety Plan — Gate 19A

Status: Gate 19C and Gate 19C-F4 corrective hardening complete and approved, 2026-09-19. Gate 19D Batch 1, the compatible Gate 19F foundation, Gate 19G-F1 and Gate 19G-F2 are implemented; Gate 19G-F2 is the current corrective batch. This document records the approved architecture and remaining implementation boundary for Gates 19D–19G. Branch: `feat/radar`.

Gate 19D Batch 1 is implemented as a provider-neutral foundation. Production
provider selection, empirical thresholds, score methodology and deployment
remain unapproved and are not invented here.

The compatible Deep Lane foundation is provider-neutral as well: it seals an
evidence manifest, validates bounded structured inference output against that
manifest, records provider/model/schema identity when supplied, preserves
`AI_INFERENCE`/`INFERENCE` origin, and classifies bounded retryable failures.
The fixture adapter is test-only. No AI provider, model, production Deep Lane
method, score contribution, or publication authority is configured.

Source of truth reviewed: `AGENTS.md`, [RADAR_SPEC.md](RADAR_SPEC.md), [PROJECT_SPEC.md](PROJECT_SPEC.md), [ARCHITECTURE.md](ARCHITECTURE.md), [DATABASE.md](DATABASE.md), [AUTHORIZATION_PLAN.md](AUTHORIZATION_PLAN.md), [AUDIT_LOGGING.md](AUDIT_LOGGING.md), [FEATURE_FLAGS.md](FEATURE_FLAGS.md), [SECURITY.md](SECURITY.md), and [ROADMAP.md](ROADMAP.md). Schema statements below describe migration source, not an inspection of live database contents. Research is complete; only its established narrow-projection and atomic audited-mutation principles are relevant here. Its content architecture is not copied.

## 1. Product and safety boundary

Radar is a WATCH/intelligence publishing system. It may discover, filter, evaluate, score, classify, explain, queue for review, publish approved intelligence, and maintain freshness. It must never hold wallets or private keys, sign/build/submit transactions, perform on-chain RPC writes, move funds, buy/sell automatically, execute trades, or route orders. No component or interface for these capabilities is proposed.

The product flow is:

`market/on-chain observations → discovery → deterministic Fast Lane → filter → asynchronous Deep Lane when required → human review → publication → freshness/refresh`

Automatic discovery and analysis must be capable of being enabled. Initial public automation permission is OFF; human review is mandatory. Automated processing capability is not permission to publish. Emergency pause is an independent operational safety control. No wording, score, or confidence label may imply guaranteed returns, a buying recommendation, or probability of investment success.

## 2. Current schema and presentation assessment

The physical foundation is `supabase/migrations/20260906000003_radar_foundation.sql`. Subsequent Gate 6 authorization and predicate-correction migrations determine current grants and staff visibility.

### Canonical `public.tokens`

- Columns: `id uuid` primary key; required `chain text`, `contract_address text`; stored generated `contract_address_key text`; nullable `symbol text`, `name text`; required `created_at`, `updated_at timestamptz`, defaulting to `now()`.
- Chain identifiers use the namespaced regex `^[a-z0-9-]{3,8}:[A-Za-z0-9_-]{1,32}$`. Addresses are nonempty and contain no whitespace. EVM identifiers additionally require a positive decimal `eip155` chain ID and a 40-hex-character address prefixed by `0x`.
- `contract_address_key` lowercases EVM addresses only; other namespaces preserve case. `tokens_chain_contract_key` uniquely constrains `(chain, contract_address_key)`. The primary/unique constraints supply identity indexes. An update trigger maintains `updated_at`.
- This is the existing shared identity registry, also referenced by Research. Nullable/unbounded display labels are not identity. Existing narrow Research identity options must remain compatible. There is no complete validator for every non-EVM chain.

### Immutable `public.radar_analyses`

- Columns: `id uuid` primary key; `token_id uuid` required, references `tokens(id)` with delete restricted; positive required `version integer`; required `status text` restricted to `EARLY`, `TRENDING`, `HIGH_RISK`, `REJECTED`; nullable `score numeric`; required object-shaped `deterministic_data jsonb` and `ai_inference jsonb`, both default `{}`; nullable `risk_summary text`; required `analyzed_at`, `data_as_of`, `created_at timestamptz`. Analysis/creation timestamps default to `now()`.
- `radar_analyses_token_version_key` uniquely constrains `(token_id, version)`. `radar_analyses_freshness_check` requires `data_as_of <= analyzed_at`. Score is nullable or nonnegative and less than numeric Infinity; no score formula, scale, or upper display bound is defined.
- `radar_analyses_status_analyzed_idx` indexes `(status, analyzed_at DESC)`. Triggers reject UPDATE, DELETE, and TRUNCATE. These are completed analytical snapshots, not mutable job records.

### Mutable `public.radar_reviews`

- Columns: `id uuid` primary key; required unique `analysis_id uuid`, references analyses with delete restricted; required `state text`, default `PENDING`, restricted to `PENDING`, `APPROVED`, `PUBLISHED`, `REJECTED`, `HIDDEN`; nullable `reviewed_by uuid` referencing profiles with delete restricted; nullable `reviewed_at`, `published_at timestamptz`; required `editorial_note text`, default empty; required `created_at`, `updated_at timestamptz`, default `now()`.
- Reviewer/time must be paired. APPROVED/PUBLISHED/REJECTED require both. PUBLISHED requires publication time; non-null publication time is permitted only in PUBLISHED/HIDDEN, with reviewer metadata and `published_at >= reviewed_at`.
- Indexes: primary/unique constraints, `radar_reviews_reviewed_by_idx`, and `radar_reviews_state_published_idx(state, published_at DESC)`. Triggers preserve `analysis_id` and maintain `updated_at`.
- These constraints check metadata consistency, not lawful transitions, permission, freshness, or publishability. The existing `editorial_note` is internal; it is not permission to expose it publicly.

### Existing access and application surfaces

All three tables have RLS enabled. Authenticated callers have explicit SELECT-column grants for the existing columns, filtered by live ACTIVE roles: Owner/Admin/Radar Reviewer/Analyst can read tokens and analyses; Owner/Admin/Radar Reviewer can read reviews. No anonymous raw read or ordinary API-role raw INSERT/UPDATE/DELETE is granted, including to service-role callers on these tables. Immutable guards supplement, not replace, ACLs. Gate 6's corrected role-conflict predicate remains unchanged.

The application currently defines `radar.read.analysis` and `radar.read.review`, not Radar mutation permissions. `/radar` is a public placeholder; `/admin/radar` is a permission-gated placeholder. The homepage presents the conceptual workflow/evidence states and availability-aware wording, not a live token feed. Its current flag helper uses an isolated server secret; future normal Radar reads must not depend on that helper.

Exact gaps: no discovery/event identity, observation contract, durable jobs/leases, deterministic screen contract, evidence validation, methodology/version manifest, provider boundary, explicit numeric bounds, operational freshness policy, revision-controlled moderation operations, atomic publication checks/audit, system-worker trust path, emergency processing pause, or public Radar list/detail projection. Existing timestamps allow more values than a bounded public date contract should. JSON object checks alone do not validate evidence or scores. There is no single-current-publication constraint per token. There is no safe public-note/disclosure field or publishable DTO contract.

## 3. Recommended final domain model

Retain the three existing tables and introduce only the following justified storage domains through later additive migrations. Names below are proposed, not existing tables.

| Domain | Recommended storage and invariant |
|---|---|
| Canonical identity | Existing `tokens`; no second asset registry and no human identity rewrite path. |
| Meaningful events | New `radar_events`: immutable token-linked event envelopes; kind, identity-version, source/trigger key, payload hash, occurrence/observation/receipt times, causal event/request reference, and a bounded sanitized receipt. Unique scoped event identity. Includes lifecycle receipts, not a mandatory event-sourcing framework. |
| Provider observations | New `radar_observations`: immutable normalized capability bundles; token/event references, provider/adapter/version, outcome, observation/receipt times, chain context, typed bounded values, provenance and content hash. One coherent observation bundle per source/capability/context, not a table per metric. |
| Work and analysis runs | New `radar_work_items`: durable kind/scope, event/token references where applicable, method/input versions, state, attempt, lease/fence, next-attempt time, dedup key, request provenance, checkpoint and result references. Mutable execution bookkeeping; sealed analytical inputs and completed receipts cannot be rewritten. Global discovery work has a validated chain/provider scope rather than a fake token. |
| Frozen run inputs | New `radar_work_inputs`: small association table `(work_item_id, observation_id)` with FKs. It enables observation reuse for recalculation and proves exactly which immutable inputs a run consumed. Insert only during collection; seal membership before evaluation. No change after sealing, including on retry. |
| Screening/evidence/score | Screen outcome and reasons belong to the sealed run result; a completed analytical result belongs to existing `radar_analyses`. Extend snapshots with run/event references and method/evidence/input versions, component breakdown, score timestamp and freshness policy. Preserve existing `score`, `status`, `deterministic_data`, `ai_inference`; give the JSON envelopes closed, bounded schemas. No redundant score or per-evidence table initially. |
| Review/publication | Existing `radar_reviews`, extended with revision, approval binding, separately named public note/disclosure and a frozen public presentation snapshot. Existing `editorial_note` stays private. Add a constrained token reference to support one PUBLISHED review per token; review `(analysis_id, token_id)` references analysis `(id, token_id)` through a supporting unique constraint, preventing mismatching identities. |
| Decision history | Existing append-only `audit_logs` plus domain event receipts. No duplicate general review-history table. The mutable review is current state, not the sole historical record. |
| Method/provider definitions | Versioned, reviewed deployment artifacts with content hashes and retained historical manifests. No runtime-editable formula/provider catalogue table initially. Provider identity in observations references an allowlisted adapter version. |
| Public presentation | Named list/detail projection functions plus strict server-only DTO mapping, not writable public mirror tables. |

The four new tables have separate reasons: events deduplicate causation, observations preserve source facts, work items recover processing, and input associations preserve relational provenance. Do not add generic queues, scoring tables, or provider administration beyond these needs without evidence. Structural references use FKs and restrictive deletion. Cross-token input membership and state-dependent immutability require database validation in addition to FKs.

Keep independent state axes:

| Axis | Values/meaning |
|---|---|
| Work progress | QUEUED, RUNNING, RETRY_WAIT, SUCCEEDED, FAILED, CANCELLED. DISCOVERED/SCREENED/ANALYZING are derived stage labels, not analytical verdicts. |
| Deterministic screening | PASS, REJECT, INCOMPLETE. Required unavailable evidence produces INCOMPLETE, not PASS. |
| Analytical classification | Existing EARLY, TRENDING, HIGH_RISK, REJECTED; system calculated under a versioned policy. Never default unknown input to EARLY. |
| Review/publication | Existing PENDING, APPROVED, PUBLISHED, REJECTED, HIDDEN; READY_FOR_REVIEW is a derived eligible PENDING record. |
| Freshness | FRESH, STALE, EXPIRED, UNKNOWN, derived from source time and policy independently of classification. |

An INCOMPLETE/failed run need not create an analysis. An explanatory analytical REJECTED snapshot may be retained privately. Review rejection and analytical rejection are different facts; neither is public in the initial product. Public labels may show EARLY, TRENDING, HIGH RISK only for eligible published snapshots.

## 4. Event identity, deduplication and restart semantics

Canonical token identity remains `(chain, contract_address_key)`; upsert returns the existing UUID. Never deduplicate by ticker/name, indiscriminately lowercase non-EVM identifiers, or invent a placeholder contract for a native asset. Supporting another identity form requires an explicit approved extension.

| Event/action | Identity and replay behavior |
|---|---|
| Discovery | Versioned key over provider/capability, canonical token, event kind and stable source event identity, including chain block/hash/log context where relevant. Same delivery returns the existing event/receipt. |
| Rediscovery/signal update | New source event/revision or a versioned material-signal fingerprint with stable source observation window. Preserve meaningful later events without another token row. A restarted poll uses the same checkpoint/window, not the current wall clock as a new key. |
| Analysis/reanalysis/recalculation request | Token + operation + caller request ID, bound to actor, payload hash and method/input context. Same key with different payload is a conflict, not an overwrite. Scheduled requests use stable scope/slot and policy versions. |
| Analysis completion | One accepted completion per work item and sealed input/method manifest. Lease generation must match; retry returns the same result. Changed inputs/method create a new work item. |
| Review/publication | Unique action request key, review ID and expected revision; the event receipt, mutation and audit append commit together. Duplicate delivery returns the original outcome without another transition or audit event. |

Use canonical serialization and a versioned strong hash for fingerprints; store the bounded identity components and payload hash for investigation. A reused provider event ID with different content is quarantined as a source inconsistency unless its contract explicitly supplies a new revision. Provider observations from independent sources remain distinct evidence; do not erase disagreements through global deduplication. Equivalent sealed input hashes may suppress redundant analysis work, not source provenance.

Enforce uniqueness in PostgreSQL, not just process memory. Receipt lookup precedes retry transition checks after live caller authorization; a key is not a bearer permission. Retain dedup tombstones/receipts at least through the defined replay horizon before any future retention process. Never delete referenced historical inputs. Reorg/correction creates a new invalidation event, not an edit to old evidence. At-least-once delivery is expected; exactly-once external execution is not claimed.

## 5. Fast Lane architecture

Fast Lane is non-AI and deterministic. Acquisition normalizes provider data into immutable observations; screening evaluates a sealed input set against a pinned method and explicit evaluation time. The evaluator performs no network calls, reads no changing global defaults mid-run, and produces the same result from identical inputs/version/time.

Potential capabilities include age, liquidity, market capitalization, volume, holder/wallet concentration, activity, token-authority/contract risks and chain-specific signals. None becomes a required metric until a chosen provider can supply its definition, units, precision, timestamps and limitations. Market cap and fully diluted valuation, or liquidity and volume, are not interchangeable.

Output: PASS/REJECT/INCOMPLETE, machine-readable reason codes, available/unknown inputs, deterministic evidence, risk flags, component eligibility, evaluation timestamp and method/input hashes. Known hard exclusion produces REJECT; missing mandatory capability produces INCOMPLETE. Nonmandatory gaps remain visible and follow the approved missingness policy. No fabricated score is needed to record screening failure.

Acquisition has bounded timeouts and quotas; evaluation has a bounded input size and measured latency budget to set after real provider benchmarking. Do not promise a fixed millisecond target now. Filtering queues Deep Lane only if required by that method; a separately validated Fast-only method may reach human review without AI. Neither path automatically publishes.

## 6. Deep Lane architecture and AI safety

Deep Lane is a separate asynchronous work kind consuming a sealed Fast Lane/evidence manifest. It may add narrative, social/context synthesis, source comparisons or explanations of deterministic patterns. Its delay/failure must not block discovery or Fast Lane processing for other tokens. A completed combined result is a new immutable analysis version, never a patch to a previously published score.

Queued/running/retry/failure states belong to work items. Retry transient failures with bounded attempts; malformed output or unsupported citations fails validation rather than being accepted after coercion. If a method requires Deep Lane, its failure leaves publication ineligible. A Fast-only method is not an implicit fallback for a failed combined method.

Retain provider/model identity and revision when supplied, adapter version, prompt-template version/hash, input evidence IDs/hashes, generation parameters where relevant, output-schema version, analyzed time and validation result. An opaque provider model version is explicitly recorded as such; do not claim deterministic replay of model generation. Preserve accepted outputs so their use remains explainable.

Treat all model output as untrusted: closed structured schema, size/string limits, evidence-reference validation, unsupported factual assertions rejected or clearly labeled inference, safe text rendering and no HTML/code execution. Input text may contain prompt injection; it cannot grant tools, select system instructions or alter workflow. No model access to credentials, application mutations, arbitrary URLs, or publication decisions. Raw prompts/private context do not enter public DTOs or audit payloads. AI INFERENCE cannot become VERIFIED DATA or override an authoritative risk/UNKNOWN condition. The AI provider/model and any numerical Deep Lane contribution remain deferred.

### Gate 19G-F2 durable orchestration

Deep Lane requests are durable records rather than transport-only calls. The
canonical request identity binds the work item, reserved analysis version,
task, method/schema, exact sealed input/evidence manifests, output schema and
trusted adapter/provider/model identity. Each invocation is a durable attempt
with a bounded attempt number, lease/fence and pause-generation binding. A
deterministic provider idempotency key is reserved before invoking the
adapter; duplicate delivery while an attempt is valid does not invoke the
adapter again, and a completed request replays its durable receipt.

Completion revalidates current work authority, lease, fence, pause generation
and immutable manifest before persisting structured output. A retryable failure
can be retried only by an explicit bounded new attempt. A crash after an
external call but before receipt persistence is represented as `UNCERTAIN`
unless the adapter/provider can safely reuse the same idempotency key. This is
durable local orchestration and truthful recovery behavior, not an exactly-once
claim about an external model API. The only adapter currently used is a
deterministic test fixture; no production AI vendor or model is selected.

## 7. Evidence model

Each immutable evidence item carries a stable ID within its versioned analysis, type/label, discriminated value or bounded summary, unit/decimals if numeric, origin (`DETERMINISTIC` or `INFERENCE`), source authority class, provider/adapter/version, observation reference, observed/received/evaluated times as applicable, freshness policy/result, analysis/evidence versions, and supporting references. Store confidence only with a named interpretation/context and method; it is not a return probability.

| State | Required interpretation |
|---|---|
| VERIFIED DATA | Validated observation attributable to a stated source and verification procedure at a stated time/block; does not mean all token properties are safe. A provider assertion is not automatically verified. |
| STRONG SIGNAL | Reproducible derived relationship/heuristic with input references, rule version and limitations; not an established fact about future performance. |
| AI INFERENCE | Model-assisted interpretation, separately sourced/versioned, with explicit uncertainty; never relabeled by a reviewer. |
| UNKNOWN | Missing/unsupported/failed/conflicting/unusable observation, null value and explicit reason; not zero, false, absence of risk, or hidden UI omission. |

Public evidence is an allowlisted subset frozen at approval/publication; internal traces and failure diagnostics stay private. Freshness can degrade without changing the original evidence label/value. Validate item count, code-point lengths, finite date range, URL grammar and numeric strings consistently across database, DTO and rendering boundaries before publication.

## 8. Score and analysis versioning

Keep existing `radar_analyses.version` as the monotonically allocated token analysis version. Reserve the version on an analysis-producing work item when it is enqueued under a token lock, using unique `(token_id, reserved_analysis_version)` work-item identity; never use an unlocked `MAX(version)+1`. Completed analyses copy that reserved version, so a slow old run cannot obtain a newer version just by finishing later. Failed/cancelled work may leave version gaps; no placeholder analysis is required. This ordering is separate from the global pause generation and per-attempt lease fence. Link exactly one accepted result to its run. Analysis version, score method version, classifier/filter version, evidence schema version, provider observation/adapter version and DTO schema version are distinct.

An analysis contains nullable score, `scoring_method_version`, retained method content hash, calculation time, sealed input hash, typed component breakdown, coverage/unknowns and explicit optional Deep Lane contribution provenance. Range, weights, aggregation, rounding, classification thresholds and score display scale are TBD. Do not assume 0–100 merely because a score exists. An incomplete snapshot can remain scoreless/private; public publication requires a validated score snapshot under an empirically approved method.

Only the trusted calculation path can create analytical outputs. No user role, including Owner/Admin, may supply a score, component override, analytical status, risk rewrite or manufactured new analysis INSERT. Recalculation submits a request, not output. Historical method artifacts and input bundles must be retained; a hash without recoverable content is insufficient for explanation. Display comparisons across incompatible methodology versions separately. Never silently normalize historical scores to a new formula.

Gate 19C defines database validation of accepted method/schema identifiers; Gate 19D supplies an empirically approved manifest/hash through a reviewed additive allowlist change. Worker artifacts and SQL validation must agree on that manifest and its eligibility/range/evidence contract. No browser-editable method, arbitrary worker-supplied method name, or extra runtime formula table is needed. Retired methods remain explainable; whether they remain publicly eligible is an explicit reviewed policy, not silent recomputation.

## 9. Freshness strategy

Define source `observed_at`, platform `received_at`, screen `evaluated_at`, snapshot `analyzed_at`, review `reviewed_at`, public `published_at`, successful-source-refresh `last_refreshed_at`, and method-derived `stale_after`/hard `expires_at`. Preserve existing `data_as_of` as a conservative summary of required input observation times, not last page render time. Metrics retain their own timestamps and age windows.

Reject non-finite/out-of-contract dates and implausibly future observations under a versioned clock-skew allowance. Enforce causal ordering where semantically required; a historical replay has explicit evaluation time and is never misrepresented as fresh production evidence. A successful network request with old source data does not refresh evidence. Failed attempts do not move `last_refreshed_at`.

Freshness thresholds vary by capability/chain/method and remain TBD. Until a policy is approved, the analysis is ineligible for publication. Public projection computes freshness using database time on every read, so delayed stale-marking jobs cannot serve indefinitely fresh-looking data.

Initial contract: fresh approved snapshots show score/as-of time; policy-permitted stale snapshots are prominently STALE, display only a historical as-of score, and leave fresh/trending ordering. Hard-expired, critical-invalidated, or unknown-policy snapshots are suppressed. A method can disallow even the soft-stale interval. Staleness does not rewrite analytical status or improve rank. Refresh/reanalysis creates a new snapshot requiring fresh approval; an already published result is not replaced automatically. Authoritative critical invalidation may only reduce exposure through an audited safety-hide operation. Reappearance always requires the normal human workflow.

## 10. Provider abstraction and ingestion security

Small capability interfaces: discovery, market observations, chain-state observations, contract/token-authority risk, and optional social context. One adapter may implement several, but unsupported capabilities must be explicit. No mega-interface or provider-specific payload in components/domain logic.

Normalized envelopes carry canonical identity, provider/source identity, adapter/schema version, capability, supported/unsupported status, source observation time, received time, observation outcome, exact value/units, chain/block/finality context where applicable, and safe trace reference/hash. Provider configuration and credentials remain server-only, never in observation rows, URLs, logs or DTOs.

Validate external responses before persistence: bounded schemas/depth/payloads, identity reconciliation, units and precision, impossible ranges, timestamps, safe text and source URLs. The worker must not fetch arbitrary URLs supplied by users, tokens, sources or AI: outbound destinations are adapter allowlisted with redirect/private-network protections. Public source links are display references, not instructions for server retrieval. Preserve sanitized normalized data rather than indiscriminately storing raw credential-bearing responses.

Authority policy is metric-specific. Finalized chain state controls matching contract/authority facts over stale indexers; block/finality and reorg uncertainty remain explicit. Aggregated volume/liquidity may require a market provider/indexer and cannot be invented from an RPC call. Compare only like definitions/windows/units. Classify provenance as chain-authoritative, indexer-derived, market-provider, or inference; never silently pick the most favorable value.

## 11. Provider failure and UNKNOWN semantics

| Condition | Required behavior |
|---|---|
| Unavailable/timeout | Record sanitized failure; bounded retry; required inputs remain UNKNOWN and publication blocked. |
| Rate limited | Respect retry window, bounded backoff/jitter and capability budget; no zero-value replacement. |
| Partial response | Keep valid fields with provenance; explicitly mark missing fields; never inflate coverage denominator by excluding failed metrics. |
| Unsupported chain/metric | Permanent unsupported outcome, no futile retries and no invented identifier/metric. |
| Stale source | Preserve observation time; unusable for required fresh evidence; refresh attempt is not proof of freshness. |
| Conflicting providers | Retain both; apply documented authority/window policy or unresolved-conflict UNKNOWN. Do not average unlike metrics or select a safer result. |
| Invalid numeric/identity/time | Reject/quarantine, record bounded reason, no analysis eligibility from invalid data. |

Removing evidence or failing a provider must not increase confidence, improve safety classification, or increase a comparable score through weight renormalization. Enforce this as a property of the eventual methodology and tests. Last-known-good data may remain only as explicitly aged historical evidence under the freshness policy, never as fresh replacement data. A legitimately reported zero is valid only when supported by provenance; UNKNOWN is a separate outcome.

## 12. Exact arithmetic strategy

Use PostgreSQL `numeric` for exact decimal quantities, and integral raw units plus explicit token decimals where appropriate. Large raw chain integers may exceed PostgreSQL bigint and require bounded integral numeric. Currency/quote unit, time window and scale accompany values. Reject NaN/Infinity, oversized inputs, impossible negative values, inconsistent scales and invalid denominators before calculation. Per-metric precision/scale and score rounding are policy decisions, not implicit casts.

Transport authoritative amounts as validated decimal/integer strings; use TypeScript branded contracts and BigInt for integral arithmetic or a later justified decimal implementation for fractional arithmetic. Do not parse authoritative JSON amounts into JS Number and then attempt to recover precision. Database projections must serialize these values as text, including JSON component values. Presentation formatting is separate; rounding/truncation is labeled and cannot feed back into calculation. Require cross-language golden cases and explicit rounding boundaries. PostgreSQL distinguishes exact numeric from inexact floating types and supports special numeric values that require deliberate validation: [PostgreSQL numeric types](https://www.postgresql.org/docs/17/datatype-numeric.html).

## 13. Public Radar contract

`/radar` and `/radar/[token]` share a versioned public DTO contract. Use the canonical token UUID as the initial route identifier, not a ticker or lowercased arbitrary-chain address. Unknown/unpublished/hidden IDs have the same not-found behavior. Human-friendly routing can be a later compatible alias, not a second identity.

List item: token UUID/chain/address, nullable safe display labels, approved analytical classification, score decimal string with method/version and calculation time, analysis version, published/as-of/freshness timestamps, explicit freshness state, bounded summary/reason for appearance, selected evidence/metrics with units and UNKNOWN states, and disclosure. Detail extends it with allowlisted evidence, component explanations, risk context, safe source provenance/URLs, methodology reference, explicitly public editorial note and relevant metrics. No field is required solely because a hypothetical provider might supply it.

No private `editorial_note`, reviewer identity, moderation reason/history, internal event/job IDs, provider credentials, raw response, prompt, private model context or administrative metadata. Public HIGH RISK is a reviewed classification; REJECTED is internal only. No endpoint for enumerating rejected records. Public historical analysis versions are deferred; internal history remains available to authorized roles.

List ordering is publication recency with a stable tie-break initially, not an invented investment ranking. Any later analytical ranking needs a versioned independent policy and empirical approval; sponsored placements never enter that ordering. Bounded pagination/filter allowlists and contract limits must be identical in SQL and the mapper. Validate source link/date/string contracts against direct RPC output, metadata and mounted rendering, not only a form validator.

## 14. Public-read architecture

Recommend two narrow SQL projection functions for list and canonical-token detail, callable with the public publishable key/anonymous role and by signed-in callers on the same public terms. They explicitly join a PUBLISHED review to its bound immutable eligible analysis, check current Radar/maintenance/emergency flags, critical invalidation, method eligibility and freshness, then select only the approved public fields. Raw table SELECT stays closed to anonymous callers; authenticated staff reads do not power public routes.

If definer functions are necessary to read closed tables, use fully qualified objects, fixed empty search path, no dynamic SQL, narrow return types, explicit EXECUTE ACLs and identical internal predicates across list/detail/count/metadata. Revoke default PUBLIC execution in the creating migration. Definer privilege requires explicit filtering; it does not magically apply caller RLS. See [Supabase database-function security guidance](https://supabase.com/docs/guides/database/functions).

Server-only public readers use only local/environment-appropriate public URL and publishable key, never `SUPABASE_SECRET_KEY`. Do not call the existing secret-backed general flag reader on these paths: evaluate availability inside the projections and expose only an availability outcome if needed, never flag rows/configuration. This is a Radar boundary requirement, not a claim that all existing homepage code is secret-free.

Disabled returns an unavailable/empty list outcome; detail remains non-disclosing. Database failure has a truthful unavailable state, never fixture fallback or unpublished content. Use request-time reads and no persistent full-route/data/CDN caching initially, including metadata; test relevant Next.js behavior when implemented. Flag changes/hides suppress subsequent reads without waiting for a worker. Already delivered client content cannot be recalled; clients must revalidate on navigation/refresh and must not retain an offline public cache. Cursor tampering cannot widen filters or expose hidden rows/counts.

## 15. Feature flags and emergency pause

| Control | Meaning and failure default |
|---|---|
| Existing `radar_enabled` | Public capability/exposure only; false/missing/invalid means no public Radar. Does not itself stop internal analysis. |
| Existing `radar_auto_publish` | Permission for future automation only; false/missing/invalid means forbidden. Initial gates implement no automatic-publishing caller at all, so setting it true alone cannot publish anything. |
| Existing `maintenance_mode` | Restricts public operation; missing/invalid means restricted. Authorized recovery remains possible. |
| Proposed `radar_emergency_paused` | Separate justified internal safety control: stops discovery/analysis dispatch and result acceptance/publication, and suppresses public reads. Missing/malformed state means paused. Seed paused for rollout; authorized operator explicitly resumes after validation. |

Use the existing flag store for the new pause flag and a validated monotonically increasing operational generation in its configuration, not another general flags system. Change pause/resume and generation atomically through a narrow Owner/Admin audited operation. Work claims pin the generation; completion/publication locks and rechecks current control state. Pausing then resuming cannot legitimize old in-flight work with a prior generation. Audit failure rolls back control changes.

Discovery/analysis schedules may be explicitly enabled in reviewed worker deployment configuration. Initial deployments are inert until provider/method readiness; capability ON does not mean automatic launch. Do not add redundant UI flags for every work kind.

Pause blocks new collection/evaluation/model calls, claims, analytical result acceptance and publish. In-flight requests may already have been sent; cancel best-effort, discard unaccepted outputs and do not claim instantaneous external cancellation. Permit inspection, hide, cancellation, audit and authorized recovery; block new analysis/recalculation requests while paused. SQL public-read enforcement does not rely on UI checks. Resume requeues deliberate current-generation work, not automatic publication. Later automated publication would still require explicit human approval of the exact snapshot and every normal policy check; relaxing human review is a separate product decision outside these gates.

## 16. Admin review and publication transactions

The queue shows identity, deterministic signals, separately labeled inference, immutable score/components, risks, UNKNOWN/provider outcomes, evidence/source times, prior analysis history and review state. Analysts see analytical history, not private review notes. UI score/status/evidence controls are read-only; direct RPC enforcement is mandatory.

Preserve the conservative Gate 6 transition contract: PENDING → APPROVED or REJECTED; APPROVED → PUBLISHED or REJECTED; PUBLISHED → HIDDEN; HIDDEN → PENDING with publication metadata cleared and fresh review required. REJECTED is terminal for that review; request a new analysis to reconsider. No direct PENDING/HIDDEN/REJECTED → PUBLISHED shortcut. Add an explicit approval action so Publish cannot silently skip approval.

All user operations derive verified subject and live ACTIVE effective roles, validate typed fields/action allowlists, lock in a consistent control → token → review/work order, compare expected revision, validate state/policy, mutate and append required audit/event receipt in one transaction. Recheck live authority after lock waits; concurrency tests must define the authorization linearization point relative to profile/role revocation rather than relying on a cached pre-lock decision. No browser-supplied actor, score or authoritative timestamps.

| Operation | Required behavior |
|---|---|
| Approve | Bind reviewer approval to analysis ID/version, sealed evidence/input/method hashes, current public-note/disclosure revision and eligibility. Capture immutable approved public presentation. |
| Publish | Require current authorized caller, valid approval binding, complete scored snapshot, required evidence, acceptable classification, current freshness/method policy and enabled/unpaused/nonmaintenance controls. Require approver still ACTIVE and holding review authority at publication. Atomically publish + audit. |
| Reject | Authorized PENDING/APPROVED review only; bounded internal reason, unchanged analytical fields, required audit. A published item is hidden rather than rewritten as rejected. |
| Hide | Authorized PUBLISHED review only; suppress public reads immediately, preserve immutable analysis and historical receipt, append audit. |
| Add/update note | Private editorial note remains private and auditable. Separately named public note/disclosure is part of approval, not a route to rewriting facts. Changes to approved public text invalidate approval through a controlled return to review; under the conservative transition graph, reject/reanalyze or hide→pending as applicable. Do not silently rewrite a published snapshot. |
| Request reanalysis/recalculation | Authorized request with reason/idempotency key and validated target/method eligibility; enqueue, do not accept output. See section 20. |

One PUBLISHED review per token is enforced by a partial unique index on the constrained review token reference. Publication locks the token, compares the candidate's enqueue-reserved analysis version against the last published version (including hidden publication receipts), and atomically hides any superseded publication with a linked audit receipt. An older version cannot replace a newer publication just because its worker finished later. New analysis completion alone does not replace/hide a valid public item. Re-publication of the same last-published hidden snapshot requires fresh approval and eligibility; historical publication times remain recoverable from audit/events even when current moderation metadata is cleared. The immutable publication event retains bounded approved public text/disclosure plus analysis references so later moderation does not erase what was exposed; it does not duplicate private provider payloads. Required audit failure rolls back replacement as well as publication.

## 17. Radar permission matrix

Existing read permissions remain; proposed mutation capabilities are narrow future additions, not grants created by this plan.

| Effective role | Public published data | Private analysis | Private reviews/notes | Approve/publish/reject/hide; notes | Request reanalysis/recalculation | Emergency control |
|---|---|---|---|---|---|---|
| Owner | Yes, public rules | Yes | Yes | Yes | Yes | Yes |
| Admin | Yes, public rules | Yes | Yes | Yes | Yes | Yes |
| Radar Reviewer | Yes, public rules | Yes | Yes | Yes | Yes | No |
| Analyst | Yes, public rules | Yes | No | No | Yes, bounded requests only | No |
| Editor | Yes, public rules | No | No | No | No | No |
| Ad Manager | Yes, public rules | No | No | No | No | No |
| Viewer | Yes, public rules | No | No | No | No | No |
| Authenticated no-role / inactive / anon | Public contract only | No | No | No | No | No |

Viewer retains existing general read-only Admin entry semantics, not new private Radar rights. No-role identities have no Admin access. Authentication alone does not confer Radar privileges. Existing `research_token_options` identity access for Editor is not private Radar access.

Use Gate 6's corrected current-role resolver and deny anonymous Auth sessions as staff. Preserve its explicit conflict rule: Ad Manager combined with Editor, Radar Reviewer or Analyst yields no effective roles, including when Owner/Admin is also assigned. Other valid unions retain existing semantics; do not change the role helper to impose a new global conflict policy. Owner/Admin oversight never includes manual analytical writes. Requests are rate-limited/deduplicated to prevent an Analyst from exhausting worker capacity. No human role can create observations, fabricated analysis versions or arbitrary worker jobs.

## 18. Commercial trust boundary

Commercial tables may reference canonical tokens or display clearly disclosed placements beside Radar, but cannot write analyses, observations, methods, evidence, classification, score components, risk or organic ordering. No campaign/partner field is an input to the scoring/filter/classifier pipeline; no trigger, RPC or worker message derived from payment influences it. Commercial APIs cannot call Radar system operations.

Enforce raw-DML denial even for Owner/Admin user sessions, operation-specific EXECUTE ACLs, immutable analytical snapshots, separate commercial query paths and no paid ranking fields in public Radar DTOs. A reference change cannot relabel a token or cascade updates into analytical history. Read-only partner references do not create priority review/analysis privileges.

Human moderation still has discretion; database controls cannot prove absence of personal conflicts. Require disclosed conflicts, review governance and audit of publication/hide decisions, especially Owner/Admin cross-domain oversight. Public notes cannot conceal required risk/disclosure or claim evidence changed. Sponsorship must never supply a score override disguised as editorial text.

## 19. Audit and trusted SYSTEM actors

Reuse existing append-only `audit_logs` and restricted `public.write_audit_event`. It supports USER with actor UUID and SYSTEM with null actor UUID. Its generic writer accepts trusted arguments; Radar domain operations must derive identity rather than trusting input. The current TypeScript audit helper is user-oriented and a separate HTTP call is not an atomic mutation contract.

User Radar RPCs run with the caller's authenticated session, derive `auth.uid()` and live roles, enforce authority/state and call the existing writer internally in the same SQL transaction. Recommended human actions: `radar.reviewed` (approval), `radar.published`, `radar.rejected`, `radar.hidden`, `radar.reanalysis_requested`, `radar.score_recalculation_requested`, `radar.editorial_note_updated`. Use existing `feature_flag.updated` for pause/resume. Add a small system vocabulary for accepted run completion/failure and evidence invalidation, rather than one audit event per fetched metric.

System workers use an isolated server-only Radar gateway. Recommend service-role EXECUTE only on named scheduled-enqueue, claim/renew, observation, complete/fail/cancel and invalidate operations, with raw Radar DML still revoked. These operations are not executable by PUBLIC/anon/authenticated; they derive SYSTEM from the trusted database execution role, never a request body or fake Auth user. They validate allowlisted work kinds, target/input/method bindings, current lease/generation, immutable outputs and control state before mutation + audit. Accepted system observations/calculation results are still schema-validated; a human-facing endpoint never proxies arbitrary payloads into this gateway.

This credential is trusted infrastructure, not cryptographic proof of correct analysis or per-worker isolation. Compromise of the service key or database owner is outside protection supplied by ordinary user RLS and requires containment/rotation/operational controls. Keep the gateway out of public/user request modules; a dedicated constrained database worker principal can be evaluated later if deployment supports it, without pretending it exists today.

Audit snapshots contain narrow prior/resulting state, revision, domain UUIDs, method/input hashes and bounded reason codes. Do not log credentials, headers, JWTs, full provider payloads, private prompts or raw query-string URLs. Construct allowlisted SQL payloads directly; do not assume the TypeScript redactor runs inside an RPC. Ordinary audit UPDATE/DELETE/TRUNCATE remains denied. Required append failure aborts the operation; technical logs cannot substitute for the audit record.

## 20. Reanalysis and score recalculation

Reanalysis creates a request event/work item with parent analysis, reason, caller, requested supported method and idempotency identity. It collects current observations and produces a new immutable version with its own pending review. A user cannot choose arbitrary inputs, provider endpoints or score targets.

Recalculation reuses a sealed historical input manifest with an approved method version, records parent score/method and creates a new analysis version. It cannot pretend old observations are refreshed; if publication requires newer inputs, run reanalysis instead. Analyst requests are bounded and visible to reviewers; they do not publish or change private notes.

Retries return the same request/completion. A genuinely new input/method/request creates a distinct run. Preserve original score, components, timestamps and methodology. Existing public intelligence is unchanged until an eligible replacement is explicitly reviewed and published, except safety suppression under the invalidation/freshness policies.

## 21. Background-job model

Use the existing PostgreSQL-backed modular monolith with durable work records and domain handlers. The eventual scheduler only requests due work/starts handlers; it is not the authority for publication, identity or freshness. No Kafka, microservices, Redis queue, or distributed transaction is required by this plan.

Work kinds cover scheduled discovery, observation collection, deterministic screen/calculation, optional Deep Lane, and refresh/recalculation. Source checkpoints are bounded work metadata, advanced with committed observations/events so restart does not skip uncommitted discoveries. Future scheduled cycles use stable scope/slot keys. Stale reads are protected synchronously in SQL; optional sweeps can request refresh or audit safety hides.

Claim due work in a short transaction using row locks/`SKIP LOCKED`, then commit before provider/model IO. PostgreSQL documents this locking option as suitable for queue consumers, not a general consistent-view mechanism: [PostgreSQL SELECT locking](https://www.postgresql.org/docs/17/sql-select.html). Store a lease deadline, incrementing attempt/fence and pinned pause generation. Complete atomically only with current unexpired ownership/generation and unchanged sealed inputs. Old workers cannot finish after lease recovery. Reclaimed attempts must not append a second accepted result/version.

Bound timeout, attempts, retry delay, concurrent work per capability and queue growth; distinguish retryable failure from permanent invalid/unsupported input. Cancellation and terminal failure are observable, with sanitized causes; no infinite retries or durable success in process memory alone. External calls may repeat after crashes; their immutable receipts/results deduplicate on acceptance. Do not hold transaction locks during IO. Production schedule/cadence/provider remains TBD.

## 22. Local fixtures and testing strategy

Gate 19B may use explicitly controlled, labeled development-only fixtures conforming to the proposed public DTO. Production routes return truthful disabled/empty/unavailable states until real projections are integrated. No production fixture fallback, public demo query override, or synthetic published token seed. Verify fixture modules cannot enter production runtime/bundles or metadata.

Use recorded normalized, sanitized observations and deterministic adapters for discovery replay, provider failure, time travel, exact arithmetic, reorgs and model-output validation. No paid/live API is needed for test correctness. Generated identities/data are clearly synthetic and never mistaken for a provider endorsement. Fixtures contain no keys/passwords/private responses.

Database tests use isolated personas/transactions/backends consistent with Gate 6 testing, not context-sensitive identity switching assumptions. Roll back fixture records and verify cleanup; use separate local connections for concurrency cases. Any destructive reset later needs the explicit environment/backup approval applicable to that gate. Gate 19A runs no database commands and changes no data.

## 23. Empirical scoring validation

Before trusting public scores: define measurable intelligence-quality questions and independently reviewed labels; assemble representative, legally usable historical observations with point-in-time provenance, including missing/delisted/failed cases. Avoid survivor bias and look-ahead by separating time windows and withholding future observations from replay. Provider corrections/reorgs are part of the corpus.

Measure signal distributions, coverage/availability by chain/provider, false positives/false negatives, classification agreement, stability under small input changes, sensitivity to missingness/staleness, and performance across time/regimes. Test the invariant that missing data cannot improve apparent safety/confidence. Analyze drift and score comparability between versions; confidence labels need their own interpretation/calibration.

Choose formula/weights/ranges, required evidence, thresholds and freshness limits only after these results. Record data/corpus version, exact method artifact, limitations, holdout results and approval criteria. Compare in nonpublic shadow mode before activation; retain a rollback method and suppress incompatible comparisons. No optimization for hypothetical profits, automated-trade backtests or execution-performance targets. If adequate data/provider coverage or approval criteria are unavailable, public scored publishing stays blocked, even if UX/security tests pass.

## 24. Methodology and public-transparency handoff

A later implementation gate updates `/methodology` from the approved empirical method, not invented weights. It must explain input categories and authority, evidence labels, deterministic vs AI roles, score/version principles and component meanings, human approval, as-of/freshness semantics, UNKNOWN/provider limitations, rejection/publication policy, sponsorship independence, and watch-only/no-guarantee limitations.

Each public detail links to its method version with enough retained context to explain historical results. Do not describe all sources as real-time or all observations as chain-verified. Model-assisted output stays explicitly labeled. Gate 19A does not change existing trust pages or design tokens.

## 25. Future database adversarial test matrix

| Area | Required ALLOW/DENY and integrity checks |
|---|---|
| Canonical identity | Same EVM address in different case deduplicates; different chains remain distinct; non-EVM case preserved; bad namespace/address rejected; Research identity references unchanged. |
| Events/restarts | Duplicate discovery/update/request returns one receipt; new meaningful event retained; changed payload under same key rejected; independent provider provenance retained; restart checkpoint does not lose/duplicate accepted events. |
| Observations | Invalid numeric/scale/unit/date/identity rejected; zero distinguished from UNKNOWN; timeout/unsupported/conflict/stale outcomes cannot become safe values; cross-token inputs denied. |
| Jobs/concurrency | Two workers cannot accept two completions; expired lease/fence rejected; pause→resume rejects old generation; frozen inputs cannot change; concurrent analysis versions unique; retry cannot overwrite completion. |
| Raw privileges | Anon/authenticated/service gateway raw DML stays denied; user fabricated analysis INSERT, score UPDATE and evidence tampering denied; immutable DELETE/TRUNCATE denied. |
| Role isolation | Every existing role, no-role, inactive/anonymous Auth identity and conflicting unions tested; Reviewer moderation allowed but manual score denied; Analyst requests allowed but private notes/publication denied; Ad Manager analytic/request access denied. |
| Public projections | Anonymous published-only list/detail; PENDING/APPROVED/REJECTED/HIDDEN, analytical REJECTED, expired and invalidated records absent; direct ID/cursor/filter/count/metadata cannot leak; no secret-key dependency. |
| Flags/pause | Disabled/missing/malformed control state fails closed; auto-publish default false; true flag alone creates no publication; pause blocks dispatch/acceptance/publish/public reads while hide/recovery works. |
| Publication | Wrong/stale revision, missing score/evidence, inactive approver, unapproved method, expired inputs and illicit transitions rejected; valid approval/publish succeeds; late old version cannot supersede newer; single public token row under concurrent publication. |
| Audit/receipts | Required audit failure rolls back approve/publish/replacement/hide/note/request/pause and system acceptance; duplicate request adds no second audit; actor spoofing denied; no raw audit mutation/read widening. |
| Reanalysis/recalculation | New version and review created; old score/evidence/review history unchanged; recalculation retains old observation time; failed reanalysis leaves prior public snapshot unchanged unless independently invalidated. |
| Commercial | Campaign/partner/reference actions cannot affect scores/evidence/classification/risk/order; no commercial RPC route into worker or review privilege; identity references cannot mutate registry. |
| Contract and replay | SQL/TypeScript agree on Unicode, null labels, bounds, URLs/dates and numeric strings; additive upgrade leaves legacy snapshots intact/private; complete existing foundation/Research/Radar tests remain green. |

Separate-connection races are required for lease recovery, token version allocation, double publication, pause versus completion and audit failure during replacement. A single-backend pgTAP test alone does not prove concurrency safety. Test direct RPC/table access, not only application paths.

## 26. Future application test matrix

| Surface | Required checks |
|---|---|
| Public list/detail | Honest empty/disabled/unavailable/not-found states; fixture/dev-only isolation; published-only DTO mapping; no private fields in HTML, RSC payloads, metadata or JSON-LD. |
| Evidence/score | Correct evidence/status labels; AI distinct from verified facts; null/UNKNOWN distinct from zero; exact large/fractional values; method/as-of/context visible; no unsupported score-scale assumptions. |
| Freshness | Frozen-clock boundary tests; stale score explicitly historical and out of fresh ordering; hard expiry suppresses; navigation/metadata do not use stale cached publication after hide/pause. |
| Admin | Role-filtered queue; analytical vs review visibility; score/evidence/status read-only; explicit approve/publish; stale-form revision conflict; reject/hide/reanalysis/recalculation and double-submit behavior. |
| Boundaries | Cookie-based user operations cannot pass arbitrary actor/score/input fields; provider/system gateway never imported by client/public reader; public Radar works without a secret key; server actions recheck authorization. |
| Provider/AI | Timeout/rate-limit/partial/conflict/unsupported and malformed outputs; no fabricated zeros, unsafe URL fetch or prompt-driven action; deterministic replay; failed required Deep Lane blocks readiness. |
| Trust/UX | Public note/disclosure synchronization and risk visibility; separate sponsor placement; no buy/sell language, execution controls, returns promises or public hidden reasoning. |
| Cross-layer | Mounted public/admin tests plus database-to-reader-to-renderer corpus; request isolation; production fixture exclusion; approved design primitives, responsive/accessibility sanity checks. |

Each implementation gate runs relevant database/application suites, lint, typecheck, Webpack production build and diff checks. The known local Turbopack sandbox issue is reported separately, not used to redesign architecture. Gate 19A is documentation only; it requires document/scope/diff validation, not runtime tests or destructive replay.

## 27. Additive migration strategy

Historical migrations remain untouched. Gate 19C should introduce schema/constraints first, then narrow operations/ACLs/projections with adversarial tests before connecting callers. New tables start RLS-enabled/default-deny and functions have explicit execution revocations. Existing authenticated column grants do not automatically widen to newly added sensitive columns.

Preserve token identity and Research relationships, analysis immutability/version uniqueness, review-target immutability, existing role semantics and audit ACLs. Legacy snapshots must not gain fabricated provenance or become publishable by a default: additive nullable provenance is acceptable for history, but new writer/publication functions require the full versioned contract. Do not UPDATE immutable analyses to invent a method. Legacy public-ineligible records remain internal.

Before adding the single-PUBLISHED-token constraint, inspect existing review state for conflicts in an approved environment. Do not arbitrarily delete/hide history to make migration succeed; ambiguous legacy publications require an explicit audited remediation decision. Any review token backfill is deterministic from its immutable analysis FK, never user input. Constraint/index naming and exact field bounds are finalized in Gate 19C's contract tests, without changing the invariants here.

Test both clean replay and legacy-data upgrade in approved disposable local databases; backup before destructive operations where required. No production bootstrap, fixture seeds, remote schema change or automatic cleanup belongs to this plan. Permission/freshness/public DTO contracts must be validated in direct database calls as well as forms before opening reads.

## 28. Proposed implementation gate sequence

| Gate | Scope and dependency/exit requirement |
|---|---|
| 19B — public UX | Controlled development-only `/radar` and token-detail presentation using this provisional DTO and approved design primitives; production honest disabled/empty. No provider, scoring or database mutation. Human visual approval and fixture isolation required. |
| 19C — database contracts | Add event/observation/work/input foundation, analysis provenance, revisioned review/publication RPCs, ACL/RLS, atomic audits, emergency state and list/detail projections. Finalize shared bounds with tests; connect public reader only after projections pass. No real provider/live score or automatic publication. |
| 19D — provider and Fast Lane | First explicitly selected capability/chain adapters, normalized ingestion, durable workers and deterministic evaluator; run with fixtures then approved nonpublic observations. Complete empirical Fast-only method validation before its public eligibility. Provider selection and adequate validation data are explicit prerequisites, not invented deliverables. |
| 19E — Admin review | Permission-scoped queue and audited actions over Gate 19C operations, immutable score/evidence presentation, stale/conflict/pause behavior. End-to-end publication uses only validated method outputs; otherwise remain nonpublic. |
| 19F — optional Deep Lane | First confirm model/provider/data-use decision, then asynchronous validated inference if approved. Revalidate any combined score method empirically. If provider remains TBD, deliver contracts/mocks only and record integration as deferred; do not claim a live AI feature. Fast-only capability does not depend on this integration. |
| 19G — end-to-end security/readiness | Full database, concurrency, provider-failure, publication/public-reader, commercial isolation and application audit; confirm empirical methodology, fixture exclusion, freshness/pause/recovery and source transparency. Human acceptance before any launch. Unresolved provider/scoring prerequisites block public launch, not a reason to fabricate inputs. |

Keep each gate independently reviewable and stop after its requested scope. The user's Gate 19 sequence is a scoped Radar workstream; this document does not rewrite the broader historical phase taxonomy in ROADMAP.md. Gate 19G-F1 does not select a production provider, scoring policy or freshness threshold, and does not add execution capability.

## 29. Risks, assumptions and final adversarial review

Highest risks are publication-time authorization/concurrency, pause/cache consistency, false safety from incomplete provider coverage, precision drift, reproducibility of sealed inputs/methods, and public/private contract divergence. Existing groundwork is a useful boundary, not a running Radar backend. Public release assumes an empirically approved method and supported provider capabilities; neither is selected now.

| Challenge | Required safeguard / residual limitation |
|---|---|
| Duplicate token/event identity | Canonical shared key + independently versioned event keys + payload-conflict rejection; provider IDs alone are insufficient. |
| Non-idempotent workers | Unique requests/results, frozen relational inputs, leases/fences and atomic receipts/checkpoints; external IO can repeat but acceptance cannot. |
| Missing data/failure creates safety | Explicit UNKNOWN/INCOMPLETE and monotonic missingness tests; method approval blocked if coverage cannot support conclusions. |
| Float precision loss | Exact storage and string transport/calculation boundaries; formatting never authoritative. |
| AI masquerades as fact | Separate inference origin, reference/schema validation, no actor/tools/publish authority; hallucination risk is disclosed, not solved by a confidence number. |
| Sponsor/manual score influence | No human analysis INSERT/DML, no commercial analytical inputs, separate placement ordering and audited moderation; human conflict governance remains necessary. |
| Stale intelligence | Read-time freshness/expiry and source-based refresh, new review for replacements; already delivered browser content cannot be recalled. |
| Unpublished/private leakage | Narrow database predicates, public-field allowlist, secret-free public reader, metadata/cache parity and adversarial direct RPC tests. |
| History overwritten | Immutable observations/analysis, sealed input manifest, new versions for recalculation, review/audit receipts retained. |
| Unaudited publication | Single transaction with current authority/approval/flags/eligibility, audit and replacement; failure injection must prove rollback. |
| Accidental automatic publishing | No initial auto-publisher, false flag default, mandatory human approval and emergency generation checks. |
| Execution scope creep | WATCH-only interfaces, no custody/signers/transaction or trade capabilities, no execution UI or provider write methods. |
| Unnecessary distributed complexity | PostgreSQL durable work + modular domain handlers; scheduler/AI choices stay swappable and gated. |

No claim is made that database RLS constrains a compromised database owner or authenticates the correctness of a trusted worker's calculation. Retention, recovery, source licensing, budget/rate limits and operational monitoring need explicit decisions before sustained ingestion; they do not justify additional platforms now. Reviewers can assess intelligence, not certify investment safety.

## 31. Gate 19C implementation record

Gate 19C's original foundation is implemented by the additive
`20260910000001_radar_database_foundation.sql` migration and documented in
[RADAR_DATABASE.md](RADAR_DATABASE.md). It adds the event, observation, work,
frozen-input and evidence domains; extends immutable analysis and revisioned
review records; adds audited human operations, a trusted service-role-only
system boundary, emergency pause, role-filtered RLS and narrow public
projections. Gate 19C-F1 is a separate additive corrective migration. Gate
19C-F2 adds typed human approval inputs, approved method/freshness registries,
derived and frozen public snapshots, safe source references, evidence freeze
after approval, and lock-time authorization/revision/pause/flag revalidation.
Gate 19C-F3 adds the final typed nested-data boundary, effective approver
conflict validation, durable evidence freeze, finite timestamp constraints,
post-lock wall-clock deadlines, and read-time policy withdrawal checks. The
original, F1, and F2 migrations remain untouched. Gate 19C-F4 is a new
additive correction for upgrade-safe authoritative-source validation, canonical
publication lock ordering, post-lock authorization/time checks, and work-row
lease revalidation. It also corrects the lock-wait fixtures so tests begin
with valid authority and cross deadlines only while blocked. No provider,
worker, automatic publisher or Gate 19D capability is included.

Gate 19G-F1 is a narrowly scoped additive processing correction. Input-bearing
work is assembled in an explicit OPEN state and finalized through a
service-role-only transaction that locks the work row, computes the existing
database fingerprint, and returns the ordered sealed observation manifest.
Claims require finalized inputs; a fenced worker can retrieve only the
DB-authoritative manifest for its active lease and pause generation. The
application ingestion path consumes that manifest instead of maintaining a
second fingerprint algorithm. Provider failures are sanitized into bounded
codes, receipt time is excluded from observation identity, provider scope and
provenance are reconciled before persistence, and exact decimal values remain
string/database-numeric data. Admin operation request keys bind verified actor,
action, target, payload and explicit operation intent. The migration is
additive; existing RLS, grants, audit, lease and emergency-pause boundaries
remain in force.

`contract-v1` is a schema-contract identifier used to validate persistence and
publication wiring; it is not an empirically approved score formula. No real
provider, Fast Lane evaluator, Deep Lane model, background worker or automatic
publisher was started. Gate 19G-F1 adds only the trusted finalization and
manifest contract; production provider and scoring decisions remain deferred.
Gate 19G-F2 adds only the durable Deep Lane request, attempt, completion and
recovery contract described above; it does not activate production AI or
change the approved Fast Lane, scoring, freshness or public Radar policy.

## 30. Intentionally deferred decisions

- Exact market, discovery, on-chain, contract-risk and social providers; licensing/retention rights, supported capabilities and chain coverage.
- AI provider/model, model identity guarantees, data-use/privacy policy and whether a particular methodology uses Deep Lane at all.
- Final scoring formula, components/weights/range/rounding, classification/filter rules, missingness policy and empirical publication thresholds.
- Production scheduler/job host, throughput budgets, refresh cadence, retry budgets, observation retention and operational monitoring provider.
- Exact source clock-skew/finality allowances, soft/hard stale thresholds and public stale-display eligibility per method.
- Public historical-version browsing, advanced organic ranking, additional asset identifier forms and provider administration UI.
- Any future automatic-publication caller or change to mandatory human review; flag availability is not approval for either.

These decisions are not filled with invented defaults. Until their relevant prerequisite is approved, that capability stays unsupported, nonpublic or disabled. Gate 19A created only this plan; later gates remain separately scoped and no gate after the current Gate 19C corrective work has started.
