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

## Authenticated acceptance pass attempt — 2026-09-19T19:50:34Z

The requested authenticated rerun used the existing frozen 108-sample
fixture and first checked the ignored local environment without displaying
values. All requested credentials were **MISSING**:
`HELIUS_API_KEY`, `BIRDEYE_API_KEY`, `GMGN_API_KEY`, `COINGECKO_API_KEY` and
`EVM_RPC_URL`. `.env.local` was present and gitignored.

Because no authenticated credential was available, the pass made **0**
authenticated provider requests. Helius, Pump/direct Solana RPC, Birdeye,
GMGN, CoinGecko Demo and EVM RPC remain **UNKNOWN / INSUFFICIENT EVIDENCE**;
no success rate, CU/credit usage, holder coverage, authority coverage,
creator history, Pump lifecycle result or cross-provider authenticated
comparison is claimed. The public DEX Screener/GeckoTerminal measurements in
the preceding section remain the baseline and the frozen dataset was not
replaced.

No paid plan is justified. The next run requires server-only read-only
credentials or endpoints for the missing providers; adding them to the
ignored local environment is a human prerequisite, not an automatic upgrade.

## Authenticated acceptance pass — 2026-09-19

The exact frozen 108-sample fixture was reused. The credential-bearing
`.env.local` file remained present and gitignored. Credential presence was
checked without displaying values:

| Credential | Status |
| --- | --- |
| `GMGN_API_KEY` | AVAILABLE |
| `HELIUS_API_KEY` | AVAILABLE |
| `SOLANA_RPC_URL` | AVAILABLE |
| `COINGECKO_API_KEY` | AVAILABLE |
| `BIRDEYE_API_KEY` | AVAILABLE |
| `ALCHEMY_API_KEY` | AVAILABLE |

### Helius / Solana RPC — MEASURED

The Solana sample contains 40 addresses. A bounded individual-call recipe
made 120 sample-scoped RPC calls: 40 `getAccountInfo`, 40 `getTokenSupply`,
20 `getTokenLargestAccounts` and 20 `getSignaturesForAddress` calls. The
follow-up used three concurrent workers after a ten-token JSON-RPC batch shape
returned HTTP 429; no response exposed credit headers.

| Method | Available | HTTP 429 | P50/P95 latency |
| --- | ---: | ---: | --- |
| Account/mint state | 36/40 | 4 | 269/332 ms |
| Supply/decimals | 34/40 | 6 | 280/300 ms |
| Largest accounts | 16/20 | 4 | 312/880 ms |
| Recent signatures | 14/20 | 6 | 270/777 ms |

Successful account responses exposed decimals and current mint/freeze
authority fields for 36 samples; supply/decimals were available for 34;
largest-account derivation worked for 16; recent signature history worked for
14. This is direct chain evidence for the returned records, not proof of
complete historical coverage. Helius Free is **FREE TIER SUFFICIENT** for
development/shadow use with low concurrency, caching and candidate-only
holder/history calls. It is not sufficient for an unbounded burst recipe.
The exact measured 429 behavior is an optimization boundary; no paid upgrade
is justified.

### Pump lifecycle — UNKNOWN / INSUFFICIENT EVIDENCE

Mint/account/signature visibility was measured through Solana RPC, but the
acceptance sandbox does not yet contain a pinned Pump IDL/program decoder or a
safe curve-PDA/migration reconciler. Creation, creator, bonding-curve
reserves/progress, completion and PumpSwap migration were therefore not
claimed. No swap, buy, sell, transaction-building or signing route was used.

### Birdeye — MEASURED PARTIAL

With 1.1-second pacing, 40/40 free read-only price probes and 10/10 holder
probes succeeded with no HTTP 429. Price responses included a liquidity field;
holder responses included holder/top-ten fields. A single overview probe and a
single OHLCV probe both returned HTTP 429. Birdeye response numeric fields
were JSON `number` values (`value`, `priceInNative`, `liquidity`, and price
change), so lossless decimal fidelity remains a qualification issue even
when HTTP success is 200. Rate/credit headers were present, but no CU value
was exposed in the sanitized record.

The measured decision is **PAID UPGRADE NOT JUSTIFIED**. Keep price/holder
collection slow and selective, cache slow-changing fields, and defer
overview/OHLCV until entitlement/rate behavior is clarified. Lite/Starter/
Premium is not justified for headroom.

### GMGN — INSUFFICIENT EVIDENCE

The key was present, but no safe official read-only data route was invoked.
Current official documentation describes Agent/skills access and separately
states that a general data API is not open; its trading routes require
additional permissions and are out of scope. No key was sent to a guessed or
execution-oriented endpoint. Token, security, holder, trader, developer,
smart-money, KOL, sniper, bundler, insider and wash/rug fields are therefore
all **UNAVAILABLE** in this pass. Unique objective value and unique
provider-derived value are both **INSUFFICIENT EVIDENCE**.

### CoinGecko Demo — INSUFFICIENT EVIDENCE

The authenticated Demo key was present, but both a Demo ping and one
candidate Onchain token probe returned HTTP 401 with provider error code
10002. No market/history comparison was accepted. The earlier public
GeckoTerminal discovery baseline remains separate and is not a CoinGecko Demo
measurement. Basic/paid upgrade is not justified until the account/key scope
is corrected and a candidate-only run succeeds.

### Alchemy / EVM RPC — MEASURED PARTIAL

The acceptance sandbox now has a development-only chain endpoint helper with
an allowlist of read-only JSON-RPC methods and chain-specific endpoints for
Ethereum, Base, BNB, Arbitrum, Avalanche, Polygon and OP Mainnet. It never
permits transaction submission or signing methods.

`eth_blockNumber` returned HTTP 200 for Ethereum. Base and BNB token/state
probes returned HTTP 403, and their block probes also returned HTTP 403. The
frozen dataset contains no Ethereum sample, so no per-token Ethereum
verification was claimed. Alchemy's one available health result is not enough
to establish multi-chain free-tier suitability; the decision is
**INSUFFICIENT EVIDENCE** and no upgrade is justified.

### Current comparison and signal coverage

A synchronized 40-token Solana price comparison produced 40/40 Birdeye
responses and 24 unique DEX token-address matches (40 sample rows, including
repeated pool/token rows). Every overlapping price row differed as an exact
provider value. Diagnostic relative differences had P50 **0.3937%** and P95
**46.1937%**; these are observations, not production thresholds. Time,
pool-selection, quote and numeric-serialization differences must be resolved
before calling this a quality failure or choosing an authority. No averaging
was performed.

Against the approved 30 mandatory signals, this pass has:

- **15/30** with at least one tested-source observation: I01, I02, I05, I06,
  I08, I09, D01, M01, M04, M05, M07, M08, H01, H03 and L01;
- **6/30** with partial direct-source observations from Helius: I01, I02, I05,
  I06, I08 and I09;
- **9/30** provider-derived-only or provider-discovery observations: D01, M01,
  M04, M05, M07, M08, H01, H03 and L01;
- **15/30** not observed in this run: I10, I11, D02, M06, H07, L05, L08,
  A02, A03, C08, Q01, Q02, Q03, Q04 and Q05.

No signal is declared production-ready. No signal was conclusively declared
unsupported; the unobserved group is missing/free-tier-blocked or requires a
decoder/authority contract that was not available.

### Measured request and usage envelope

The authenticated pass made 120 sample-scoped Helius calls, 95 Birdeye calls
(90 sample/comparison calls plus five route/precision probes), two CoinGecko
probes, and 11 Alchemy probes. No GMGN request was made. No provider exposed a
usable CU/credit total in the sanitized responses. The public DEX baseline
remains four token batches plus one profile call; the synchronized comparison
used two additional DEX token batches.

Measured recipe projections, not prices:

| Daily discovery | Helius observed recipe | Birdeye optimized recipe | DEX Screener batch recipe |
| ---: | ---: | ---: | ---: |
| 100 | ~300 RPC calls | ~125 calls (price all + holders for 25%) | 1 discovery + 4 token batches |
| 1,000 | ~3,000 RPC calls | ~1,250 calls | 1 discovery + 34 token batches |
| 10,000 | ~30,000 RPC calls | ~12,500 calls | 1 discovery + 334 token batches |

These projections exclude historical and blocked endpoints and do not include
AI. They are not a paid-plan recommendation. The cheapest justified monthly
provider spend remains **$0**; all paid upgrades are either **PAID UPGRADE
NOT JUSTIFIED** or **INSUFFICIENT EVIDENCE**.

## Targeted access remediation — 2026-09-20

This pass changed only acceptance-sandbox access paths and reran the three
previously unresolved provider checks. Credentials were read from the ignored
local environment only; no credential value was printed or persisted.

### CoinGecko Demo — key/account blocker confirmed

The sandbox now has an explicit development-only client using the official
Demo contract: `https://api.coingecko.com/api/v3/` and the recommended
`x-cg-demo-api-key` header ([official Demo authentication documentation](https://docs.coingecko.com/demo/reference/authentication)). The official documentation also permits a query
parameter, but the sandbox deliberately does not use query parameters because
they can leak keys through logs or referrers.

The local key is present (length only was inspected). Harmless `/ping` probes
returned:

| Root | Header | Result |
| --- | --- | --- |
| Demo root | `x-cg-demo-api-key` | HTTP 401 / error 10002 |
| Demo root | `x-cg-pro-api-key` | HTTP 400: use the Pro root |
| Pro root | `x-cg-demo-api-key` | HTTP 401 / error 10002 |
| Pro root | `x-cg-pro-api-key` | HTTP 401 / error 10002 |

This rules out a sandbox root/header mix-up. The local credential is invalid,
revoked, mistyped, or not authorized for the requested account; only the
CoinGecko Developer Dashboard can distinguish those cases. No key was
regenerated automatically. Status: **INSUFFICIENT EVIDENCE**. No paid upgrade
is justified.

### GMGN — official CLI read-only route verified

The official CLI is available through `npx --yes gmgn-cli`; `gmgn-cli
config --check` exited 0 without printing configuration values. The documented
read-only route is described in the [official GMGN Agent API documentation](https://docs.gmgn.ai/index/gmgn-agent-api):

`gmgn-cli token info --chain sol --address <address> --raw`

One frozen Solana sample returned exit 0 and a structured token-information
object. The acceptance client now permits only documented read-only commands
and rejects execution-oriented commands. It does not read or use the local
private key. GMGN fields remain **PROVIDER_DERIVED** or **CONTEXTUAL_PROPRIETARY**,
not `VERIFIED_DATA`. Status: **LIVE READ-ONLY ROUTE VERIFIED**; a full value
comparison remains a separate measurement.

### Alchemy — Base and BNB access recovered

The existing helper already constructed the official chain roots exactly,
consistent with [Alchemy's supported-chain documentation](https://www.alchemy.com/docs/reference/node-supported-chains):

- `eth-mainnet.g.alchemy.com/v2/<key>`
- `base-mainnet.g.alchemy.com/v2/<key>`
- `bnb-mainnet.g.alchemy.com/v2/<key>`

Targeted read-only probes now return:

| Chain | `eth_blockNumber` | `eth_chainId` | Frozen `eth_getCode` sample |
| --- | ---: | ---: | ---: |
| Ethereum | 200 | 200 | no frozen samples |
| Base | 200 | 200 | 5/5 HTTP/RPC success |
| BNB | 200 | 200 | 5/5 HTTP/RPC success |

The earlier 403 was transient or account/network provisioning state; it was
not caused by endpoint construction. No manual dashboard action is currently
required. The acceptance client remains read-only and does not permit wallet,
bundler, gas-manager, signing or transaction-submission methods.

### Targeted rerun accounting

Additional live requests in this remediation pass were four CoinGecko `/ping`
matrix probes plus one blocked query-string probe that was not executed, one
GMGN `token info` CLI request, six Alchemy health probes and ten Alchemy
`eth_getCode` probes. The blocked query-string probe was rejected before
execution because it would expose a credential in a URL. No expensive
unaffected provider cohort was rerun.
