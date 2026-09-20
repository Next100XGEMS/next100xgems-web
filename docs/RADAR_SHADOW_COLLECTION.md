# Radar Prospective Shadow Collection

Status: development/shadow only, 2026-09-20. This document describes the
read-only prospective collector added for PumpSwap linkage and real
point-in-time data capture. It does not activate production Radar, publish
records, schedule production work, select a score, set thresholds, or add any
wallet or execution capability.

## Purpose and boundaries

The historical corpus cannot reconstruct every market, holder or activity
value as it existed at an old cutoff. The shadow collector therefore admits a
separate cohort from successful official Pump creation observations and records
what is available at the actual checkpoint time. It retains UNKNOWN and
UNAVAILABLE rather than substituting current values for missed historical
checkpoints.

The current bootstrap is intentionally bounded to 10–20 tokens. The runner is
development-only and uses server-side local credentials when present. It does
not use a service key in browser code, call swap or trading endpoints, build or
sign transactions, publish Radar data, or write production tables.

## Official lifecycle linkage

Pump migration is accepted only when a transaction contains the official
`migrate` or `migrate_v2` instruction, its mint and bonding-curve accounts
match the admitted token, and the referenced account is owned by the official
PumpSwap program with canonical pool index `0`, matching base and quote mints.
Names, symbols, current listings and fuzzy pool searches are never linkage
evidence. The decoder uses the [official Pump IDL](https://github.com/pump-fun/pump-public-docs/blob/main/idl/pump.json)
and [PumpSwap program documentation](https://github.com/pump-fun/pump-public-docs/blob/main/docs/PUMP_SWAP_README.md).

The bounded live validation against the ten completed cases in the committed
historical enrichment found 7/10 explicit migrations and verified 7/10
canonical PumpSwap pools. Three cases had no matching migration in the bounded
signature window; there were no ambiguous or false links. This is reliable
positive linkage evidence, not a claim that all historical migrations are
covered. The normalized result is in
`tests/data/radar-pumpswap-validation-20260920.json`.

## Prospective state model

`src/lib/radar/acceptance/shadow.ts` is the repository-neutral contract for:

- deterministic admission identity: mint, creator, creation signature/slot,
  creation time, bonding-curve PDA, decoder version and selection reason;
- fixed checkpoints: `T+5M`, `T+15M`, `T+30M`, `T+1H`, `T+6H`, `T+24H`;
- immutable checkpoint manifests and SHA-256 identities;
- observation states `AVAILABLE`, `UNKNOWN`, `UNAVAILABLE` and `STALE`;
- bounded provenance, source timestamps, capture time and exact string values;
- restart-safe telemetry and idempotent checkpoint replay.

The runner (`scripts/radar-shadow-collect.mjs`) persists only normalized
development state in `tests/data/radar-pump-shadow-20260920.json`. Re-running
it reloads admissions and completed checkpoint manifests. It does not recollect
completed checkpoints. A checkpoint that is already outside the short capture
window remains pending rather than being filled with a late value or marked as
a fabricated historical observation. This preserves no-lookahead discipline;
the next run may report the pending checkpoint for operator review.

## Collection order

1. Read-only Pump-program discovery admits successful official creation
   instructions and derives the bonding-curve PDA with the approved decoder.
2. Helius reads the bonding-curve account and largest token accounts at the
   live checkpoint. Raw balances remain exact strings and top-account coverage
   is explicitly partial; a largest-account response is not a full holder
   census.
3. Birdeye is tried as the primary market observation when the local
   development credential is available.
4. DEX Screener is used only as a bounded fallback for market, liquidity and
   24-hour activity context when the primary response is unavailable.
5. CoinGecko, GeckoTerminal and GMGN remain selective verification/enrichment
   paths and are not called for every checkpoint by default.
6. Provider and RPC telemetry records safe status, latency, request count,
   estimated credits where known, source time, error category and provenance;
   credentials, headers and raw sensitive responses are never persisted.

All monetary, reserve, supply and balance values are transported as strings.
The collector does not calculate a production threshold or score. Consecutive
liquidity/activity observations are retained for a later methodology phase to
derive changes such as `LIQUIDITY_INCREASE`, `LIQUIDITY_DECREASE` and
`LIQUIDITY_COLLAPSE_CANDIDATE` under a future versioned policy.

## Cost and pacing guardrails

The phase has a development ceiling of 250,000 additional Helius credits. The
PumpSwap validation used 470 read-only RPC calls; standard RPC billing was not
exposed, so those calls are recorded as unknown rather than converted to a
false credit total. The shadow bootstrap used 52 bounded
`getTransactionsForAddress` discovery calls, recorded at the existing 100-credit
estimate per call (5,200 estimated credits), admitted 20 tokens, and captured
14 T+5M checkpoints. Those checkpoints produced 14/14 lifecycle reads,
14/14 largest-account snapshots and 14/14 prices; 4/14 Birdeye market calls
succeeded and the bounded DEX Screener fallback supplied the other 10. No
T+24H checkpoint is claimed.

The runner caps discovery pages, keeps the cohort bounded, uses one primary
market source per checkpoint, and records provider failure instead of retrying
without a boundary. Any projected use above the ceiling is a stop condition.
No paid plan is justified by this bootstrap.

## Operating commands

Run locally with credentials already present in the ignored environment; never
print the environment file:

```text
node scripts/radar-shadow-collect.mjs tests/data/radar-pump-shadow-20260920.json 20
```

The optional `RADAR_SHADOW_DISCOVERY_PAGES` value is bounded by the script and
should be increased only when the operator accepts the measured credit impact.
The output is a development artifact and must not be copied into public or
production storage.

## Readiness status

`SHADOW_COLLECTION_READY` is the implementation status once the decoder,
admission, no-lookahead checkpoint contract, persistence, resume behavior and
telemetry tests pass. It does not mean the cohort is mature.

`METHODOLOGY_DATA_READY` remains false until enough real checkpoints and future
objective labels have accumulated. In particular, no T+24H completion is
claimed for the bootstrap until 24 hours have actually elapsed and the
checkpoint was captured inside its observation window.

The provisional unresolved-signal posture remains conservative: H07 and L05
need prospective exclusion/liquidity history, L08 and C08 need more real
distribution/creator history, and Q01/Q02/Q04 remain required data-quality
and replay controls. Their presence in this collector does not make them
production Fast Lane rules.
