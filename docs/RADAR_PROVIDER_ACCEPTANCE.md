# Radar Provider Acceptance Sandbox

Status: **LOCAL / DEVELOPMENT ONLY**. The sandbox was added after planning
commit `245b1b5` on 2026-09-20. It does not activate production Radar, create
provider integrations, or store credentials.

## Purpose and boundary

The sandbox measures whether a provider can supply useful, reproducible Radar
observations before a paid plan or production decision. It reuses the existing
provider-neutral Radar observation and normalization contracts at
`src/lib/radar/contracts.ts` and `src/lib/radar/normalization.ts`.

The acceptance layer is intentionally separate from production ingestion. It
can accept a later server-only live adapter through the typed
`AcceptanceProviderAdapter` boundary, while the repository currently ships
only credential-free fixture adapters. No browser route imports this layer.

Never add swaps, buys, sells, transaction construction, signing, wallet keys,
positions, PnL, or execution to an acceptance adapter. Pump data is read-only
program/lifecycle data. GMGN is read-only and its classifications remain
`PROVIDER_DERIVED` or `CONTEXTUAL`; they do not become `VERIFIED_DATA` merely
because GMGN returned them.

Deferred providers are not implemented: Bitquery, paid QuickNode, paid Shyft
and paid Moralis. They remain compatible with the provider-neutral contract
only where a future adapter is separately approved.

## Provider profiles

| Provider | Sandbox role | Chains in the acceptance profile | Credential template | Current mode |
| --- | --- | --- | --- | --- |
| Pump program | Solana launch/lifecycle and program-state evidence | Solana | `SOLANA_RPC_URL` | Fixture |
| Helius | Solana indexed/RPC verification | Solana | `HELIUS_API_KEY` | Fixture |
| Birdeye | Solana market and historical comparison | Solana | `BIRDEYE_API_KEY` | Fixture |
| GMGN | Solana read-only memecoin enrichment | Solana | `GMGN_API_KEY` | Fixture |
| CoinGecko/GeckoTerminal | Cross-chain market verification | Solana and configured EVM profiles | `COINGECKO_API_KEY` | Fixture |
| DEX Screener | Cheap discovery/tertiary market comparison | Solana and configured EVM profiles | None in template | Fixture |
| EVM RPC | Direct chain-state verification | BNB, Base, Ethereum | `EVM_RPC_URL` | Fixture |

The profiles are capability test envelopes, not claims that every endpoint is
available on every plan. Actual support, limits, retention and terms must be
recorded from a real response and the relevant provider account.

## Acceptance record

Each probe records:

- chain, tier, sample, provider, capability and metric;
- normalized state: `AVAILABLE`, `UNKNOWN`, `UNAVAILABLE`, `UNSUPPORTED` or
  `STALE`;
- exact decimal value only after the shared Radar normalizer accepts it;
- provider/source timestamp, collection latency and response size;
- request units/credits when a provider reports them;
- expensive-endpoint marker, retries and historical-depth note;
- sanitized error category only, never headers, URLs containing credentials,
  tokens or raw sensitive payloads.

No missing value becomes zero, false, safe or healthy. `MALFORMED` is a
sandbox record outcome when a provider response cannot pass the shared
normalization boundary; it is never an analytical result.

## Dataset and collection

`src/lib/radar/acceptance/dataset.ts` defines the versioned
`radar-acceptance-dataset-v1` format. Each sample has a stable sample ID,
chain, acceptance tier, category, optional real token address, notes and an
explicit `approvedForLiveProbe` flag. Empty addresses are deliberate
templates, not fabricated token facts.

The initial template covers Solana, BNB, Base, Ethereum, Monad, Sui, Arbitrum
and Polygon. Extend it with real addresses only after a human approves the
universe and provenance. The target sample counts are operational goals:
Solana 40, BNB 25, Base 25, Ethereum 15, Monad 15, Sui 10, plus small shadow
and discovery samples. The code does not pretend those samples exist yet.

`createChainAcceptancePlan` keeps chain-specific work explicit:

- Solana adds authorities, supply, transfers, Pump lifecycle, pool state,
  OHLCV and creator/security context.
- EVM Tier A adds contract state, pool/LP state, metadata and token security;
  it does not ask for Solana mint/freeze semantics.
- Tier B measures coverage and chain-state accessibility only.
- Tier C performs cheap discovery/market probes only.

## Cost telemetry and upgrade rule

`AcceptanceTelemetryStore` groups records by chain/provider/capability and
reports success rate, missingness, p50/p95 latency, retries, response bytes,
expensive endpoint count and sanitized errors. It projects calls and reported
units for 100, 1,000 and 10,000 discovered tokens/day from measured records.
The projection is not a bill and does not infer a plan price.

A paid upgrade is **NOT JUSTIFIED** until a measured report identifies the
exact limit, frequency, degraded capability and whether caching, batching,
sampling or collection order can avoid it. Provider subscription cost,
variable usage, infrastructure and future AI costs remain separate.

## Cross-provider comparison

`compareAcceptanceRecords` compares the same chain/sample/capability/metric
using normalized exact decimals. It records only `AGREEMENT`, `DISAGREEMENT`,
`MISSING` or `STALE`. It never averages, chooses the larger/smaller value, or
turns disagreement into a score. Both source records remain available for
authority review. Provider count is not consensus.

## Provider acceptance report template

Populate this table from live records; blank/unknown values must remain
explicit rather than estimated.

| Provider | Chain | Capability | Success rate | P50/P95 latency | Missingness | Units/credits | Data quality | Conflict rate | Plan | Upgrade needed? | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixture | fixture input | fixture input | Measured by tests | Measured by tests | Measured by tests | Fixture-only | Contract-valid | See comparisons | None | No | Does not establish live coverage |
| Live provider | Pending approval | Pending | Not measured | Not measured | Not measured | Unknown until account | Pending | Pending | Free/demo first | Not justified | Requires approved key and dataset |

## Security and live-run procedure

1. Approve the token universe, chain tier and provider read-only scope.
2. Put server-only values in the local ignored environment; never use
   `NEXT_PUBLIC_*` for provider secrets and never paste a key into a fixture.
3. Run probes from a server-side development process using the injected
   adapter; retain bounded normalized records and telemetry only.
4. Sanitize errors and verify no secret appears in output, logs or fixtures.
5. Compare equivalent observations and record unsupported/stale/missing data.
6. Produce a development summary. Do not alter production chain flags or
   publish records.

The current repository has no live keys configured and no live provider calls
were performed. Therefore no capability is certified, no paid upgrade is
currently justified, and current development/beta spend attributable to this
sandbox is **$0**.
