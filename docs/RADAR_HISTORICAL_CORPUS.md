# Radar Historical Corpus Specification

Status: development/shadow specification, 2026-09-20. No production
methodology, score, threshold, AI provider or public activation is authorized.

## Objective

Build a reproducible Solana corpus of at least 300 tokens, preferably 500 when
free/read-only access permits, for structural signal validation. The corpus is
not a list of winners and must retain inconvenient, incomplete and conflicting
cases. The first real acquisition is now frozen at 300 Pump tokens; it is a
structural acquisition corpus, not yet a balanced historical outcome corpus.

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
validation, holder snapshot export and bounded-study controls. A real frozen
manifest is now committed at
`tests/data/radar-pump-historical-universe-20260919.json`:

- 300 unique Pump mints from a 90-day window ending 2026-09-19;
- deterministic oldest/newest, 13-bucket, outcome-independent sampling;
- 299 `create_v2` and 1 `create` token; 308 decoded creation instructions;
- 300/300 creation signatures, creators and bonding-curve PDAs decoded;
- 300/300 current bonding-curve account reads valid, with 10 complete and 290
  active at the observation time;
- 1,800 identity-only checkpoint manifests across T+5M, T+15M, T+30M, T+1H,
  T+6H and T+24H; market and historical holder values remain explicitly
  `UNKNOWN`/not reconstructable rather than replaced with current values;
- a bounded official PumpSwap validation tested the 10 currently complete
  curves: 7/10 explicit migrations linked to canonical PumpSwap pools, 3/10
  had no matching migration in the bounded signature window, and 0 ambiguous or
  false links were accepted; this is not full historical coverage;
- chronological metadata is reserved as 180 TRAIN, 60 VALIDATION and 60 locked
  HOLDOUT cases, with outcome labels still pending a future observation window.

The Helius gTFA acquisition used 365 successful calls and 36,500 estimated
credits at the documented 100-credit call rate. A creator-history pilot used
20 `getTransfersByAddress` calls, returned 1,905 rows and consumed an
estimated 200 credits. Current account enrichment used six batched RPC posts
for 300 logical reads; exact batch billing was not exposed locally. The
bounded 25-token market pilot made 3 authenticated CoinGecko Demo calls, 25
Birdeye calls and 25 GeckoTerminal calls. It measured current market/pool
availability only, not historical as-of values: CoinGecko calls succeeded but
returned no usable values for the sample, Birdeye returned 1 success and 24
errors, and GeckoTerminal returned 4 successes, 1 missing response and 20
errors. No raw provider payloads were retained.

Solana status remains `MORE_DATA_WORK_REQUIRED`: the corpus-size gate is met,
but point-in-time market/holder history, PumpSwap linkage, balanced future
labels and sufficient LP/creator-history evidence are not yet closed. Current
justified provider spend remains `$0/month`; no Birdeye upgrade is justified by
this bounded pilot.

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

## Prospective shadow expansion status — 2026-09-20

The separate prospective shadow cohort was expanded in controlled 20-token
batches using the existing read-only Helius/Birdeye/DEX configuration. It
reached 62 unique real Pump admissions against a target of 100; the bounded
discovery source produced no additional unique candidates on the final
continuation check. The current observation artifact contains 29 immutable
captures (14 `T+5M`, 15 `T+15M`) and no fabricated late windows. Later
checkpoints and all future labels remain pending. This cohort is not merged
into the frozen 300-token historical universe and does not change its
chronological split.

The shadow collector now represents pre-graduation absence of a DEX pool as
`NOT_APPLICABLE` with `PUMP_BONDING_CURVE_STAGE`, while a verified market pair
is `DEX_POOL_STAGE`. Liquidity amounts are never replaced by zero. The live
expansion used 213 Helius calls/15,300 estimated credits, 30 Birdeye market
requests (10 successful and 20 rate-limited with HTTP 429), and 22 successful
DEX Screener requests. These are measured development values; CoinGecko and
GMGN were not required for this bounded run. No production schedule or paid
upgrade is justified.

## Historical backfill pilot

The Helius Developer historical acquisition used the read-only
`getTransactionsForAddress` archive method against the official Pump program.
The final run made 365 successful calls, inspected 36,500 transaction rows and
selected 300 unique mints. Anchor discriminators for the official `create` and
`create_v2` instructions, raw account keys and Borsh creation data were used
to derive the mint, creation signature/slot/time, creator and bonding-curve
PDA. No raw transaction dump was retained.

A bounded Parsed Events pilot confirmed the endpoint and decoded-event shape,
but its creation-event density was too sparse to replace the direct gTFA
acquisition. It was not used as a second full-corpus pass. A separate 20-creator
`getTransfersByAddress` pilot succeeded for all 20 creators and returned 1,905
rows; its transfer history is evidence for a future creator-history study, not
an automatic exit or intent label.

Current lifecycle enrichment read the 300 derived bonding-curve accounts and
recorded exact integer reserves/supply/progress where the account was valid.
This is current state observed after acquisition, not a historical checkpoint.
The new read-only linkage decoder accepts only official Pump `migrate` or
`migrate_v2` instructions plus a PumpSwap-owned canonical Pool account whose
base/quote mints agree. No pool identity is inferred from names, symbols or
current market listings. The bounded result is retained in
`tests/data/radar-pumpswap-validation-20260920.json`; its standard RPC billing
was not exposed locally.

The market pilot was intentionally bounded and current-state only. CoinGecko
Demo returned successful batch responses but no usable values for this sample;
Birdeye and GeckoTerminal showed substantial error/missingness. Historical
OHLCV, liquidity, pool and holder values therefore remain
`NOT_RECONSTRUCTABLE` in this backfill. No Birdeye Lite purchase is justified.
