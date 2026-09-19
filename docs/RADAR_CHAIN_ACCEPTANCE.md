# Radar Multi-Chain Acceptance

Status: **LOCAL / DEVELOPMENT ONLY**. This is a measurement framework, not a
production chain-support declaration.

## Acceptance tiers

| Tier | Chains | Purpose |
| --- | --- | --- |
| A — deep | Solana, BNB Chain, Base, Ethereum | Complete acceptance of identity, market, distribution, creator/contract and activity routes where data exists |
| B — shadow | Monad, Sui, HyperEVM, Robinhood Chain | Measure discovery, market, holder coverage, chain-state access, history and cost; no complete methodology |
| C — cheap discovery | Arbitrum, Avalanche, Polygon, Tron, X Layer, MegaETH, NEAR, OP Mainnet and additional supported chains | Low-cost coverage discovery only |

The tier is an experiment scope. It does not promise production support and
does not change feature flags, provider selection or Radar publication.

## Chain acceptance report

| Chain | Discovery coverage | Mandatory signal coverage | Provider coverage | Data quality | Historical depth | Estimated API cost | Chain-specific complexity | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Solana | Pending live dataset | Pending live dataset | Pump, Helius, Birdeye, GMGN, CG, DS profiles | Fixture contract only | Unknown | $0 current sandbox spend | Program/lifecycle decoders, quote-aware Pump state | A — unmeasured |
| BNB Chain | Pending live dataset | Pending live dataset | EVM RPC, CG, DS profiles | Fixture contract only | Unknown | $0 current sandbox spend | Launchpad, proxy, tax and LP semantics | A — unmeasured |
| Base | Pending live dataset | Pending live dataset | EVM RPC, CG, DS profiles | Fixture contract only | Unknown | $0 current sandbox spend | Aerodrome/Uniswap and proxy semantics | A — unmeasured |
| Ethereum | Pending live dataset | Pending live dataset | EVM RPC, CG, DS profiles | Fixture contract only | Unknown | $0 current sandbox spend | Archive depth and gas/cost pressure | A — unmeasured |
| Monad / Sui / HyperEVM / Robinhood Chain | Shadow template | Not required yet | Provider-dependent | Unmeasured | Unknown | $0 current sandbox spend | Chain-specific identity/state | B — shadow |
| Tier C chains | Discovery template | Not required yet | CG/DS where available | Unmeasured | Unknown | $0 current sandbox spend | Coverage and terms vary | C — discovery |

## Common and chain-specific concepts

Every collector reports the common Radar concepts: identity, launch,
market structure, liquidity, participation, distribution, creator/deployer,
contract/authority risk, activity/momentum, manipulation/context, data quality
and freshness.

The collector does not pretend those concepts have identical raw fields:

- Solana uses mint/freeze authority, token accounts, program events, bonding
  curves, Pump completion and migration state where verified.
- EVM chains use contract deployment, ERC-20 supply/permissions, owner and
  proxy/upgradeability state, pool/LP state and chain-specific launch context.
- Sui and other non-EVM/non-Solana chains remain schema-specific shadow
  probes until an approved adapter defines their authoritative primitives.

## Development chain activity summary

`summarizeChainActivity` reports sample count, discovered IDs, available and
missing records, stale records, provider/capability counts and a development
status of `PROMOTE`, `SHADOW`, `WATCH_ONLY`, `DEFER` or `UNASSESSED`.

The status is a descriptive acceptance output, not a final ranking formula.
The current implementation deliberately does not calculate a production chain
score or automatically promote a chain.

## Promotion evidence required later

Before any chain promotion decision, collect comparable evidence for:

- candidate frequency and discovery latency;
- completeness and missingness of mandatory signals;
- objective state verification and provenance quality;
- historical depth and replay consistency;
- stale/conflict/error behavior;
- calls, units, retries and cost per useful candidate;
- chain-specific decoder and operational complexity.

No chain can be called production-ready from fixture results. Missing data
must remain `UNKNOWN`, `UNAVAILABLE`, `UNSUPPORTED` or `STALE`.

## Live run result — 2026-09-20

The frozen public-discovery cohort contains 108 real sample addresses:

| Chain | Samples | Live market matches | Next-experiment classification |
| --- | ---: | ---: | --- |
| Solana | 40 | 40/40 DEX Screener | SHADOW |
| BNB Chain | 40 | 37/40 DEX Screener | SHADOW |
| Base | 20 | 20/20 DEX Screener | SHADOW |
| Ethereum | 0 | 0 | DEFER |
| Monad | 0 | 0 | DEFER |
| Sui | 0 | 0 | DEFER |
| HyperEVM | 0 | 0 | DEFER |
| Robinhood Chain | 8 | 4/8 DEX Screener | WATCH ONLY |
| Arbitrum, Polygon, OP Mainnet, X Layer | 0 | 0 | DEFER |
| Avalanche, Tron, MegaETH, NEAR | 0 | 0 | DEFER |

Solana, BNB and Base are **SHADOW**, not **PROMOTE**, because no direct
chain/RPC, holder, authority, creator or independent provider acceptance was
available. Robinhood Chain is **WATCH ONLY** because discovery existed but
market matches were only 4/8. Ethereum, Monad and Sui public discovery pages
were rate-limited or unavailable in the run; no unsupported capability was
invented.

The cohort was selected from GeckoTerminal new-pool pages and the DEX
Screener latest-profile feed and is intentionally frozen. It contains only
new-launch discovery, not a balanced historical or outcome sample. The
selection file is `tests/fixtures/radar-acceptance-live-20260920.json`.

The main measured gaps are missing direct RPC/provider credentials, no Pump
program verification, no holder/distribution or creator-history measurements,
no GMGN value test, no CoinGecko Demo test, and GeckoTerminal HTTP 429
pressure after five successful discovery pages. These gaps block any
production chain-support conclusion.
