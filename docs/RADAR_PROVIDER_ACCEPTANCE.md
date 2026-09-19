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

Before the live run, the repository had no live keys configured and no live
provider calls had been performed. The run below used only public routes, so
no authenticated capability is certified, no paid upgrade is currently
justified, and current development/beta spend attributable to this sandbox is
**$0**.

## Live acceptance run — 2026-09-20

The first live run used only public, read-only discovery and market routes.
The frozen sample is committed at
`tests/fixtures/radar-acceptance-live-20260920.json`; its selection timestamp
is `2026-09-19T19:42:42.607Z` UTC. Selection used GeckoTerminal `new_pools`
pages and the DEX Screener latest token-profile feed. It did not call trade,
swap, wallet-signing or transaction-building endpoints.

| Provider/source | Requests | Successful | Measured result |
| --- | ---: | ---: | --- |
| GeckoTerminal public discovery | 13 pages | 5 HTTP 200 / 8 HTTP 429 | 108-sample construction; rate limiting began during the run |
| DEX Screener latest profiles | 1 | 1 HTTP 200 | 8 Robinhood Chain discovery samples |
| DEX Screener token lookup | 4 batches | 4 HTTP 200 | 101/108 samples had a matching market pair; 7 were unknown |

DEX Screener token coverage was **101/108 (93.52%)**. By chain: Solana
40/40, BNB 37/40, Base 20/20 and Robinhood Chain 4/8. For matching pairs,
price, 24-hour volume, transaction counts and pair timestamps were present
for 101/101. Liquidity USD was present for 62/101 and missing for 39/101;
missing liquidity was preserved as missing. Batched lookup latency was
approximately P50 **461 ms** and P95 **485 ms** in this run. The public
endpoint exposed no billable credit/CU counter.

The 108 samples were all selected as `NEW_LAUNCH`/new-pool or latest-profile
discovery records. This is a frozen discovery cohort, not a balanced quality
or outcome cohort. It does not establish successful, failed, concentrated,
risky or organic-growth coverage.

### Credential and capability status

The ignored `.env.local` file was present and ignored, but these values were
absent: `HELIUS_API_KEY`, `BIRDEYE_API_KEY`, `GMGN_API_KEY`,
`COINGECKO_API_KEY`, `SOLANA_RPC_URL` and `EVM_RPC_URL`. Consequently Helius,
Birdeye, GMGN, CoinGecko Demo, direct Pump program reads, Solana RPC and EVM
RPC had **0 live requests**. Their live success, precision, holder,
authority, history, CU and provider-derived classification behavior is
**UNKNOWN**, not successful by inference.

The GeckoTerminal results are public Onchain API observations and must not be
described as a CoinGecko Demo-account test. CoinGecko Demo value, monthly
credits and historical acceptance remain **INSUFFICIENT_EVIDENCE**.

### Measured free-tier pressure and decision

The only observed rate block was GeckoTerminal HTTP 429 on 8/13 discovery
page requests. It degraded Tier B/C discovery during this run. No paid plan
was purchased or recommended. Before any upgrade, the next experiment should
test slower collection, cached cursors, candidate-only enrichment and a
smaller discovery schedule. The result is **PAID UPGRADE NOT YET JUSTIFIED**;
the exact entitlement and sustainable request window need account-level
measurement.

For the observed DEX Screener batching policy, request-count projections are
approximately one discovery call plus 4, 34 or 334 token batches for 100,
1,000 or 10,000 discovered tokens/day respectively (30 addresses per batch).
These are request projections, not a price estimate. Discovery, enrichment,
chain verification, cross-check and historical costs are otherwise
**UNKNOWN** because the corresponding credentials were missing.

### Live conclusions

- `DEX_SCREENER` is useful for cheap discovery and market-pair coverage, but
  liquidity missingness and provider-derived values require independent
  verification.
- GMGN unique-value testing is **INSUFFICIENT_EVIDENCE**; no GMGN request was
  made. Smart-money, KOL, bundler, sniper, insider and wash/rug fields remain
  unverified provider classifications.
- Pump lifecycle acceptance is **INSUFFICIENT_EVIDENCE**; Solana samples came
  from public pool discovery, not direct Pump program/RPC verification.
- Birdeye and Helius free-tier sufficiency is **INSUFFICIENT_EVIDENCE**.
- No provider upgrade is justified from this run.
