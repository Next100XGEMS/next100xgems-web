# Radar Historical Corpus Specification

Status: development/shadow specification, 2026-09-20. No production
methodology, score, threshold, AI provider or public activation is authorized.

## Objective

Build a reproducible Solana corpus of at least 300 tokens, preferably 500 when
free/read-only access permits, for structural signal validation. The corpus is
not a list of winners and must retain inconvenient, incomplete and conflicting
cases. The current 108-token acceptance cohort is a discovery sample, not yet
a balanced historical outcome corpus.

## Selection rules

Selection is frozen once the manifest is created. The source manifest must
record selection time, source, chain/mint identity, selection reason and the
coverage limitations. The target mix must include very new and active Pump
curves; near-graduation, graduated and failed-to-graduate launches;
dead/inactive launches and activity collapses; high-volume failures and
liquidity collapses; concentrated and broadly distributed launches; creator
exits and creator-retained positions where objectively observed; sustained
activity and provider-disagreement cases; and incomplete or unavailable-data
cases.

No category may be removed because it makes a future method look worse. A
missing or censored case is retained with `DATA_INCOMPLETE` or coverage
metadata, not converted into a negative outcome.

## Point-in-time manifest

Each sample supports frozen input manifests at `T+5M`, `T+15M`, `T+30M`,
`T+1H`, `T+6H`, and `T+24H`. Every cutoff stores the cutoff timestamp, exact
input-manifest hash, source timestamps/slots and coverage. Only information
available at or before that cutoff may enter a feature input. Future
observations are labels only and must not enter the earlier manifest.

The implementation rejects duplicate IDs, empty selection reasons, missing
cutoff hashes and unsafe labels. The next methodology phase must split
chronologically into `TRAIN`, `VALIDATION` and locked `HOLDOUT`, group
near-duplicate launches to reduce leakage, and freeze signal definitions before
holdout inspection.

## Objective label taxonomy

| Label | Objective definition required before assignment |
|---|---|
| `GRADUATED` | Official lifecycle event or authoritative state confirms migration/completion. |
| `FAILED_TO_GRADUATE` | Observation window closes without graduation under a declared coverage rule. |
| `SURVIVED_24H` / `SURVIVED_7D` | Token remains observable with declared minimum data/liquidity coverage at the horizon. |
| `LIQUIDITY_COLLAPSE` | Measured reserve/depth loss against an approved baseline with source and window evidence. |
| `ACTIVITY_COLLAPSE` | Measured transaction/participant activity loss against a frozen baseline. |
| `SUSTAINED_ACTIVITY` | Activity remains present across declared consecutive observation windows. |
| `CREATOR_EXIT_EVENT` | Directly observed attributed creator transfer/sale/withdrawal event; transfer alone is not automatically a sale. |
| `HIGH_CONCENTRATION` | Exact concentration exceeds a later approved structural definition; no threshold is selected here. |
| `CONCENTRATION_IMPROVED` / `CONCENTRATION_WORSENED` | Aligned holder snapshots show a signed change under the same exclusion policy. |
| `PROVIDER_DISAGREEMENT` | Equivalent observations receive a documented conflict taxonomy and remain unresolved or explained. |
| `DATA_INCOMPLETE` | Required point-in-time inputs are unavailable, stale, unsupported or conflicting. |

The corpus rejects `GOOD_TOKEN`, `BAD_TOKEN`, `WINNER`, `BUY` and `SCAM` as
unbounded investment or intent claims. Ambiguous labels remain ambiguous.

## Evidence and prospective collection

Creator/event and PumpSwap linkage require official program/event references,
signature, slot and timestamp. Holder snapshots must retain token, slot,
timestamp, source, commitment, raw top-N balances, exclusions, concentration,
coverage and decoder version. LP history requires pool identity, quote asset,
reserves/positions, event references and source time. Provider-derived labels
remain attributed and cannot become `VERIFIED_DATA` solely by assertion.

The Radar-owned prospective strategy is to capture a sparse launch baseline,
then prioritize Fast Lane candidates and serious candidates. All-discovered
snapshotting is a cost comparison only. No production scheduler is enabled.

## Runtime study guardrails

The controlled GMGN study uses a bounded queue with concurrency capped at eight,
per-request timeout, at most three attempts, optional pacing, cancellation and
sanitized error categories. Start with 20 tokens, then 50, then 100 only if the
runtime remains stable. The previous attempt at roughly 100 tokens hung; it is
not evidence of either success or provider value. A study must record success,
P50/P95 latency, timeout/rate-limit counts, missing fields and unique versus
duplicated information without printing raw responses or credentials.

## Current status

The repository contains corpus freeze/build tooling, historical label
validation, holder snapshot export and bounded-study controls. The current
available corpus remains the 108-token acceptance cohort and is not balanced
enough for methodology design. Solana status is therefore
`MORE_DATA_WORK_REQUIRED`. Current justified provider spend remains `$0/month`.

## Provisional methodology input set

This is a readiness input classification, not a score or production rule.
It remains provisional until the 300+ case corpus and chronological holdout
are populated.

| Class | Signals currently suitable for the next methodology phase |
|---|---|
| `CORE_DETERMINISTIC` | Canonical chain/token identity; decimals and supply; directly observed token authorities; exact pool/pair identity and quote asset; explicitly scoped price/liquidity/activity observations; Pump lifecycle state when decoded from authoritative state; provenance, timestamp, freshness and completeness. |
| `OPTIONAL_DETERMINISTIC` | Holder count and concentration when the owner set and exclusions are complete; pool age; multi-pool liquidity context; activity deltas; creator transfer facts when directly attributed; cross-provider conflict taxonomy. |
| `PROSPECTIVE_ONLY` | H07 exclusion ledger, L05 liquidity-change history, C08 creator/deployer history and other signals requiring Radar-owned snapshots from launch forward. |
| `DEEP_LANE_CONTEXT` | Provider-derived trader, smart-money, KOL, bundler/sniper/insider, wash/rug and creator-history interpretations; social or other contextual enrichment. These remain attributed and cannot become `VERIFIED_DATA` by assertion. |
| `EXCLUDED` | Investment-intent labels, unsupported historical reconstruction, fabricated current-state substitutions for past checkpoints, and any trading/execution signal. |

The seven unresolved signals retain these explicit decisions: H07
`KEEP_MANDATORY_BUT_PROSPECTIVE_ONLY`, L05
`KEEP_MANDATORY_BUT_PROSPECTIVE_ONLY`, L08 `MORE_EVIDENCE_REQUIRED`, C08
`KEEP_MANDATORY_BUT_PROSPECTIVE_ONLY`, and Q01/Q02/Q04
`KEEP_MANDATORY_FAST_LANE`. These recommendations are not a claim that the
signals are currently complete.

## Historical backfill pilot

The Helius Developer historical pilot used the read-only
`getTransactionsForAddress` archive method and the paid-plan Parsed Events
endpoint against the official Pump program. Three bounded structural pilot
runs made three archive calls and three Parsed Events calls, with 25 parsed
signatures inspected per run; no raw transaction dump was retained. The pilot
confirmed reachable decoded-event structure, but did not close creator/event
or PumpSwap migration attribution. Estimated archive credits are recorded as
an estimate only; provider billing telemetry was not available in the local
environment. No additional Birdeye, CoinGecko or GMGN historical study was
claimed in this phase.
