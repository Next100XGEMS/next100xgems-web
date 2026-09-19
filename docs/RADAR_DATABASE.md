# Radar Database Foundation — Gate 19C

Status: Gate 19C and Gate 19C-F1 through F4 are complete and approved on `feat/radar`, 2026-09-19. This is the persistent
watch/intelligence foundation only. Gate 19D remains responsible for selected
providers, Fast Lane evaluation and workers. No live provider, score formula,
AI model, automatic publication, wallet, trading or execution feature exists.

## Domain inventory

The existing `public.tokens` registry remains the only canonical token
identity. Radar adds:

- `radar_events`: immutable normalized event envelopes with versioned event
  keys and database uniqueness.
- `radar_observations`: immutable provider/capability observations with exact
  numeric values, state, provenance and content hashes.
- `radar_work_items`: durable future-processing state, request idempotency,
  attempts, leases, pause generations, screening results and result links.
- `radar_work_inputs`: append-only associations from a work item to the exact
  immutable observations it evaluated.
- `radar_evidence`: immutable, versioned evidence attached to an analysis.
- Existing `radar_analyses`: extended with run, method, input, freshness,
  component, provenance and supersession fields. Its existing immutable guard
  makes each completed analysis an immutable score snapshot.
- Existing `radar_reviews`: extended with token binding, revision, approval
  binding and frozen public presentation fields.

All new domain tables use restrictive foreign keys and RLS. Historical
analysis/review rows remain compatible; legacy review inserts may omit the
derived token reference, which is filled from the immutable analysis target.

## Events, observations and arithmetic

Event identity is `(event_key_version, event_key)`, enforced by PostgreSQL.
The stored fingerprint is derived from the canonical normalized event request,
not trusted caller hash alone. Repeated system insertion returns the existing
event only for the same canonical request; changed payload/provider/token data
conflicts explicitly. Token references use the canonical UUID,
never symbol or display-name matching.

Observations retain provider, adapter, capability, metric, observation/receipt
times, provenance, content hash and optional safe trace reference. Their
`data_state` is one of `AVAILABLE`, `UNKNOWN`, `UNAVAILABLE`, `UNSUPPORTED` or
`STALE`. `AVAILABLE` requires a normalized value; all other states may not
silently provide one. Missingness therefore cannot become numeric zero.
Provenance is a bounded scalar allowlist; arbitrary credential-shaped keys or
nested provider payloads do not belong in observation rows.

Authoritative decimal values use PostgreSQL `numeric`; raw integral units and
decimal places are separate fields. NaN and infinities are rejected. No
formatted currency strings, floating-point score scale, score weights or
rounding formula are invented here. Public projections serialize numeric
values as text.

## Work, leases and frozen inputs

Work kinds are `DISCOVERY`, `OBSERVATION`, `SCREENING`, `DEEP_ANALYSIS`,
`REFRESH`, `REANALYSIS` and `RECALCULATION`. States are bounded to
`QUEUED`, `RUNNING`, `RETRY_WAIT`, `SUCCEEDED`, `FAILED` and `CANCELLED`.
Request keys are unique. Analysis-producing work reserves a token analysis
version under a token row lock, so concurrent enqueue operations cannot use an
unlocked `MAX(version)+1`.

Named system functions create/claim/renew/fail work, attach observations and
complete screening. Claims carry worker, lease token, lease generation and
pause generation. Claiming seals the exact input membership before evaluation;
expired leases are recoverable and an old fence cannot renew, complete, fail or
overwrite a recovered attempt. Downstream analysis/evidence results must carry
the accepted fence and exact sealed input hash.

System completion/failure receipts append narrow `SYSTEM` audit records in the
same transaction. No worker, scheduler or provider call is implemented.

## Screening, analysis and evidence

Screening stores only `PASS`, `REJECT` or `INCOMPLETE`, with reasons,
evaluation time and frozen input hash. No screening thresholds or formula are
present.

Analysis history remains append-only and versioned per token. Reanalysis and
score-recalculation requests create durable work items; they do not accept a
browser-supplied result or score and do not mutate prior history. The trusted
system result function currently accepts the Gate 19C contract methodology
identifier `contract-v1` as a schema contract; this is not an approved
investment score methodology and Gate 19D must supply any empirically approved
method artifact before launch.

Evidence classifications are `VERIFIED_DATA`, `STRONG_SIGNAL`, `AI_INFERENCE`
and `UNKNOWN`, with a separate deterministic/inference origin. AI inference
must carry inference origin and immutable history prevents relabeling it as
verified data. Unknown evidence retains an explicit reason. Public evidence is
an explicit allowlisted flag, not a raw-table projection.

## Review, publication and freshness

Human operations are narrow authenticated RPCs: `radar_approve_review`,
`radar_publish_review`, `radar_reject_review`, `radar_hide_review`,
`radar_update_editorial_note`, `radar_request_reanalysis`,
`radar_request_score_recalculation` and `radar_set_emergency_pause`.

Each derives `auth.uid()`, requires an ACTIVE profile and current effective
Radar role, locks the target, checks expected revision/state and appends the
required audit event before commit. Duplicate action/request keys are
idempotent; stale revisions fail. Publication requires an approved binding to
the exact analysis version, method/input hashes, public presentation,
disclosure, public evidence, enabled Radar, maintenance OFF, emergency pause
OFF, and a non-expired explicit freshness policy. One published review per
token is enforced by a partial unique index; a newer publication hides the
older one without rewriting its analysis or publication time.

`expires_at` and `freshness_policy_version` are first-class fields. No universal
stale-after threshold is invented. Unknown or missing emergency state fails
closed. `radar_auto_publish` is not consulted as an action path; setting it
true cannot publish anything. Gate 19C-F1 adds strict emergency-control
validation: missing, malformed or paused control state blocks Radar ingestion,
work, result and publication operations. Pause generation changes fence old
in-flight work, and repeated pause requests audit the actual previous state.

## Roles, RLS and trusted system boundary

Owner and Admin may moderate and control the emergency pause. Radar Reviewer
may moderate but not control the pause. Analyst may request reanalysis or
recalculation but cannot moderate. Editor, Ad Manager, Viewer, no-role and
inactive identities have no private Radar mutation path. Raw table INSERT,
UPDATE, DELETE and TRUNCATE remain denied to browser roles, including Owner.

New Radar tables are private and expose only role-filtered authenticated reads.
System functions are `SECURITY DEFINER`, use `search_path = ''`, static
schema-qualified SQL and have EXECUTE only for `service_role`. Anonymous and
authenticated callers cannot execute ingestion, work, evidence or analysis
system functions. No caller-supplied actor identity is accepted.

Commercial tables have no analytical write path. No partner, sponsor, campaign
or ad-manager operation can change Radar score, evidence, risk,
classification, methodology, ranking or organic state.

## Public projections

`get_public_radar_list(limit, before)` and
`get_public_radar_detail(token_id)` are narrow `SECURITY DEFINER` projections
available to `anon` and `authenticated` with the publishable key. They apply
the same enabled/maintenance/emergency/publication/freshness predicates and
return only canonical token identity, approved classification, exact score
text, method/version, timestamps, frozen public presentation, disclosure and
allowlisted evidence.

They do not expose raw analyses, reviewer identity, private editorial notes,
work/event IDs, provider errors/secrets, prompts, model context or audit
metadata. Hidden, rejected, pending, approved, expired and unpublished rows
are non-disclosing. The public Radar UI is not connected in Gate 19C.

## Gate 19C-F1, Gate 19C-F2, Gate 19C-F3 and Gate 19C-F4 hardening

The additive corrective migrations
`20260911000001_radar_gate19c_f1_hardening.sql` and its qualified event replay
follow-up add canonical human request receipts bound to actor/action/target/
payload, version allocation above persisted and reserved versions, exact frozen
input copying for score recalculation, a service-role-only fenced
`radar_system_mark_analysis_ready_for_review` path, explicit NULL concurrency
rejection, the observation state/value matrix, and a bounded provenance
allowlist. Gate 19C-F2 adds approved methodology/freshness registries, typed
human approval inputs, system-derived public presentation, frozen metrics and
evidence snapshots, safe source references, evidence freeze after approval,
and lock-time revalidation of publisher, approver, review, pause and feature
flag state.

Gate 19C-F3 adds a typed public analytical-text boundary that rejects nested
JSON before coercion, reuses effective-role conflict semantics for historical
approvers, records a durable evidence-freeze marker, rejects infinite
publication-relevant timestamps, evaluates lease/publication deadlines with
post-lock wall time, and rechecks current methodology/freshness approval on
public reads. The evidence race is serialized by the immutable analysis lock
and freeze row; withdrawal hides public output without deleting history.

Gate 19C-F4 is a new additive migration that preserves the original, F1, F2
and F3 history while making the upgrade boundary safe. Public analytical
projections validate authoritative typed source JSON, so unsafe pre-F3
approvals and publications remain stored but cannot publish or appear in
anonymous list/detail reads; valid legacy string publications remain visible.
Publication locks token, candidate, current publication, registry and control
rows before the final actor/approver/eligibility/time checks, using a fresh
`clock_timestamp()` after the lock phase. Renewal and failure lock the work
row before checking the wall clock and pause/lease fences.

Approval requires an approved method and freshness policy, a current ACTIVE
approver role, a sealed nonempty PASS work result, a finite eligible score and
publicly eligible analysis. Publication reads only a frozen 17-key snapshot;
it rechecks all bindings after locks and never projects live analytical JSON,
private context, or mutable evidence.

## Validation and Gate 19D handoff

The original Gate 19C migration and F1/F2/F3 migrations remain unchanged. The
legacy Radar contract covers 75 assertions, F1 covers 54, F2 covers 51, F3
covers 45, and F4 covers 21; the complete database suite covers 849 tests.
Corrected F3 lock-wait checks pass 9/9, the Research concurrency suite passes
13/13, and the disposable F4 upgrade/lease-race checks pass. Gate 19D remains
separately gated.

Gate 19D must choose and validate real provider capabilities, empirical
methodology/range/freshness policy, Fast Lane rules, durable worker handlers
and provider failure behavior. Deep Lane AI, automatic publication, Admin
review UI, public reader integration and any execution capability remain
outside Gate 19C.

## Gate 19D Batch 1 — provider-neutral Fast Lane foundation

Batch 1 adds typed provider capability and observation contracts, exact decimal
normalization, explicit provider failure states, fixture adapters, canonical
hashing, RPC-backed ingestion/work orchestration, deterministic versioned
screening and retry-safe lease primitives. It does not choose a production
provider, threshold policy or score formula. Screening returns only `PASS`,
`REJECT` or `INCOMPLETE` with deterministic evidence; immutable analysis
evidence remains gated by an approved scoring methodology. No browser path,
scheduler, automatic publication or trading capability was added.
