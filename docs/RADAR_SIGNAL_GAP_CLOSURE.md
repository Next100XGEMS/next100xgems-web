# Radar Signal Gap Closure

Status: development-only gap-closure implementation and empirical report,
2026-09-20. This document does not activate public Radar, select scoring
weights, set freshness thresholds, buy provider access, run AI, or authorize
trading/execution.

## Scope and result

The approved beta scope is Solana as the primary development chain, BNB Chain
and Base as shadow chains, Ethereum and Robinhood Chain as watch-only, and
Monad/Sui/HyperEVM/Tier-C chains deferred. The implementation adds only
read-only acceptance utilities, tests and dataset documentation.

Implemented:

- official Pump bonding-curve account decoding using exact little-endian
  integers, the `complete` flag and an exact numerator/denominator progress
  representation;
- deterministic Pump bonding-curve PDA derivation from the official program
  and `bonding-curve`/mint seeds;
- server-side, read-only Helius JSON-RPC transport and a bounded Pump lifecycle
  collector;
- raw holder totals, explicit exclusions and exact top-N concentration
  derivation;
- provider-conflict taxonomy that preserves each source instead of averaging;
- conservative EVM standard/owner/proxy semantic assessment;
- historical dataset types, chronological split rules and a closed structural
  outcome-label vocabulary.

The public Radar, database schema, workers, Fast Lane rules, score contracts,
Deep Lane and feature flags were not changed.

## Pump lifecycle contract

The Pump bonding-curve decoder reads the official account fields:

| Field | Classification | Contract |
|---|---|---|
| mint / derived bonding-curve PDA | OBJECTIVE_DERIVED | Derived from the canonical mint and official program seeds. |
| bonding-curve account validity | AUTHORITATIVE_ONCHAIN | Account must be present, owned by the expected program in the collector context, and have the minimum layout. |
| virtual token/SOL reserves | AUTHORITATIVE_ONCHAIN | Exact unsigned integer strings; no JavaScript floating point. |
| real token/SOL reserves | AUTHORITATIVE_ONCHAIN | Exact unsigned integer strings; no inferred USD value. |
| total token supply | AUTHORITATIVE_ONCHAIN | Exact integer string from the account layout. |
| complete/graduated flag | AUTHORITATIVE_ONCHAIN | Only `0`/`1` is accepted; malformed values become UNKNOWN. |
| curve progress | OBJECTIVE_DERIVED | `(total supply - real token reserves) / total supply` as exact numerator/denominator, only when the inputs are valid. |
| creator and creation event | UNKNOWN unless decoded from a referenced event | The bonding-curve account layout alone does not prove creator/event attribution. |
| PumpSwap migration/pool | UNKNOWN unless independently reconciled | No migration is inferred from `complete=true`. |

The collector performs one account read per token after PDA derivation. It does
not call swap endpoints, construct transactions, sign, submit, or infer a
creator from a factory/fee payer. A future lifecycle collector must add event
and migration decoders with transaction/instruction identity, slot/time,
program ownership and pool ancestry before those fields can be accepted.

The previous live sample remains the empirical baseline: 10 relevant Solana
rows, 4 curve accounts found and decoded, 4 incomplete active curves, and no
confident creator or PumpSwap linkage. A larger run was not relabeled from
unsupported values; missing lifecycle fields remain UNKNOWN.

The new bounded collector probe used the first 10 Solana rows and made 10
Helius account reads: 7 valid curve accounts, 1 complete account, 6 active
accounts and 3 unavailable/error responses. This is a measured decoder
improvement on the bounded sample, not a production coverage claim. Creator,
creation-event and PumpSwap migration fields remained UNKNOWN.

## Holder and distribution contract

`deriveHolderConcentration` accepts raw balance snapshots and an explicit
exclusion ledger. It returns:

- raw total and eligible total separately;
- positive eligible holder count;
- deterministic top-N ordering with address tie-breaks;
- exact numerator/denominator concentration;
- every excluded address and reason.

Provider-precomputed “concentration,” “smart money” or “insider” labels are
not direct holder facts. Current acceptance evidence supports selective current
Solana holder/top-holder reads, not historical holder reconstruction. A
historical snapshot cannot be invented from present balances.

### Radar-owned future snapshot plan

For every accepted token, store a versioned snapshot manifest containing chain,
token, slot/block, source, received time, finality/commitment, raw holder
balances or a licensed reference, exclusion ledger, coverage and decoder
version. Capture frequency remains a policy decision and should be tested in
three cost classes: launch/rapid-change, active-market, and slow-changing.
Prioritize tokens that enter Fast Lane or have an active lifecycle event; do
not snapshot the entire discovery universe indefinitely. Retain a sparse
launch baseline and subsequent aligned snapshots so distribution change is
point-in-time reproducible.

## Creator/deployer evidence

Current safe classification:

| Field | Classification | Boundary |
|---|---|---|
| creator/deployer address from a decoded initialization event | VERIFIED_FACT / AUTHORITATIVE_ONCHAIN | Role attribution only; not beneficial ownership or intent. |
| creator balance or transfer | VERIFIED_FACT when directly observed | A transfer is not automatically a sale or exit. |
| previous launches attributed to the exact role address | OBJECTIVE_DERIVED | Requires complete event history and explicit coverage. |
| GMGN dev/smart-money/KOL/sniper/bundler/insider labels | PROVIDER_DERIVED / CONTEXTUAL_PROPRIETARY | Preserve source attribution; never relabel as VERIFIED_DATA. |
| funding or linked-wallet relationship | STRONG_INFERENCE at most | Competing explanations must remain visible; no guilt-by-association. |

The prior 30-request GMGN expansion remains the measured value study: all
token-info, security, holder, trader and kline commands succeeded across six
sample rows. A subsequent attempt to expand to 100 samples was stopped because
the CLI processes hung under the local environment; it produced no accepted
additional measurements. GMGN therefore remains optional enrichment, paid
access is not justified, and UNIQUE_OBJECTIVE_VALUE is not demonstrated.

## Liquidity and provider conflict closure

The conflict utility classifies disagreements without a tolerance or source
precedence rule:

- `SAME_POOL_DIFFERENT_VALUE`
- `DIFFERENT_PRIMARY_POOL`
- `AGGREGATED_VS_SINGLE_POOL`
- `STALE_SOURCE`
- `QUOTE_ASSET_MISMATCH`
- `METHODOLOGY_DIFFERENCE`
- `UNRESOLVED`
- `AGREEMENT`

Before any future methodology chooses a value, preserve pool/pair identity,
quote asset, source timestamp, freshness, scope, liquidity definition and
methodology identifier. The previous 43–49% Birdeye divergences remain
unresolved until those fields are available for the same rows. No provider is
averaged, and “LP locked” is not interpreted as safe.

LP state, additions/removals, pool age and depth remain partially covered.
Direct pool/DEX decoders or licensed historical observations are required for
the missing event history; a current aggregate endpoint cannot recreate it.

## BNB and Base shadow contract

Alchemy can directly read code, decimals, supply, metadata and transfers on a
representative BNB/Base subset. Owner and proxy semantics remain contract
specific:

- `STANDARD_ERC20` means only that the core decimals/supply reads succeeded;
- `CUSTOM_CONTRACT_SEMANTICS` means the core contract interface was not
  established by the supplied evidence;
- owner/proxy values remain UNKNOWN unless directly read or decoded;
- an absent owner method is not proof of renouncement or immutability.

The current shadow status remains BNB `CONTINUE_SHADOW` and Base
`CONTINUE_SHADOW`; neither is promoted to methodology design.

## Historical outcome dataset specification

The next empirical corpus must be point-in-time and chronologically split.
Each sample stores token/chain identity, launch-observed time, cutoff time,
source coverage, frozen inputs, selection category, label version and evidence
references. Selection must include healthy organic activity, failed launches,
objectively documented liquidity collapses, concentrated launches,
high-volume failures, successful and failed graduations, strong activity with
weak liquidity, broad holder growth, noisy/misleading activity and provider
disagreements. The sample must not be cherry-picked for only visible winners.

Use `TRAIN`, `VALIDATION` and locked `HOLDOUT` splits by event time. Group
near-duplicate launches and exact attributed clusters to reduce leakage, while
never asserting common ownership from weak linkage. Inputs must be limited to
what was knowable at the evaluation timestamp; future corrections belong to a
separate audit record.

Safe structural labels currently implemented:

`SURVIVED_24H`, `SURVIVED_7D`, `LIQUIDITY_COLLAPSE`, `CREATOR_EXIT_EVENT`,
`HIGH_CONCENTRATION`, `GRADUATED`, `FAILED_TO_GRADUATE`, `SUSTAINED_ACTIVITY`,
`ACTIVITY_COLLAPSE`, `STRONG_ACTIVITY_WEAK_LIQUIDITY`, and
`PROVIDER_DISAGREEMENT`.

The framework rejects `WINNER`, `GOOD_INVESTMENT`, `BUY`, `SCAM` and similar
investment/intent claims. Ambiguous, censored or inaccessible cases remain
unlabeled or explicitly coverage-limited.

## Mandatory signal coverage after gap closure

The sample-scoped classification remains conservative:

| Classification | Count | Next action |
|---|---:|---|
| Any-source evidence | 23/30 | Do not treat endpoint availability as production readiness. |
| AUTHORITATIVE_DIRECT | 6/30 | Expand direct lifecycle, holder and pool evidence. |
| OBJECTIVE_PROVIDER | 8/30 | Preserve source scope, timestamps and provider semantics. |
| PROVIDER_DERIVED | 7/30 | Keep attributed and out of VERIFIED_DATA unless independently verified. |
| MISSING / INSUFFICIENT_HISTORY | 7/30 | Requires new collection, Radar-owned history or a reviewed requirement change. |

Gap closure improved the implementation contract but did not honestly increase
the live coverage count: no unsupported Pump creator/migration values were
fabricated, and the stalled GMGN study was not counted. The remaining signals
are H07, L05, L08, C08, Q01, Q02 and Q04 in the current conservative mapping.

## Incremental usage and beta decision

This implementation adds no paid provider usage and no production schedule.
The bounded live probe was stopped after repeated GMGN CLI hangs; no reliable
additional request total is claimed. Existing measured totals remain the
baseline: Helius 130, Birdeye 101, GMGN 37, CoinGecko 40 known, Alchemy 81,
DEX Screener 107, and GeckoTerminal public rate pressure. Paid upgrades remain
not justified; current justified spend is `$0/month`.

| Chain | Development decision |
|---|---|
| Solana | MORE_DATA_WORK_REQUIRED |
| BNB Chain | CONTINUE_SHADOW |
| Base | CONTINUE_SHADOW |
| Ethereum | WATCH |
| Robinhood Chain | WATCH |

Before methodology design, the human decision is whether to approve a larger
licensed/history corpus and a bounded GMGN value study under a controlled CLI
runtime, or to proceed with the documented missingness and keep Solana out of
`READY_FOR_METHODOLOGY_DESIGN`.
