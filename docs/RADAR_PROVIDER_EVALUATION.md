# Radar Production Provider Evaluation

Research date: **2026-09-20**. Requirements baseline: `41ef51a`, [RADAR_PRODUCTION_INTELLIGENCE.md](RADAR_PRODUCTION_INTELLIGENCE.md). Status: **research complete; conditional architecture recommendation, not procurement approval or production readiness**.

The approved requirements remain unchanged: **80 candidate signals, 30 proposed mandatory signals, 31 capabilities, 21 mandatory capabilities**. This document evaluates suppliers against those requirements, not the reverse. Gate 19G software approval does not establish external data quality. No paid account, authenticated data request, provider integration, credential, implementation, migration, deployment, scoring policy, freshness threshold or AI selection was made here.

## 1. Decision summary

Recommend **Option B: Birdeye + Helius + CoinGecko Onchain** for a restricted Solana beta, conditional on the acceptance gates below. Birdeye is the proposed market/discovery source; Helius transports verifiable chain facts and indexed accounts/history; CoinGecko provides a second market observation and historical comparison path. These are recommendations requiring human approval, not already selected production providers.

**Option A: Birdeye + Helius** is the smallest credible engineering/pilot stack. It is not sufficient evidence for claiming all mandatory signals work: exact pool depth, exclusion labels, account-to-participant attribution, historical completeness and source lineage still require project-owned validation/computation. A second RPC is desirable for spot verification but need not become a fourth full subscription at beta launch. **Bitquery should be deferred as an always-on dependency**, while a narrowly scoped historical-data evaluation/quote can proceed after approval.

Coverage result: **21/21 mandatory capabilities and 30/30 mandatory signals have an explicit candidate acquisition/derivation route below; none has been acceptance-tested against paid production responses in this task.** No vendor or combination is certified here as an out-of-the-box implementation of the complete minimum set. The 80-signal traceability map includes optional/context/excluded signals without making them launch dependencies.

Principal no-go gaps are complete owner-resolved holder snapshots, evidence-backed exclusions, route-aware participants, replayable supported-pool depth, historical authority/pool state, and sufficient lineage/retention rights. A vendor endpoint named “holders,” “liquidity” or “security” does not close them. For arbitrary tokens, beneficial owner/treasury attribution has **no credible universal objective source**; an unknown address must remain unknown, not silently excluded. Narrow the supported universe or keep the result INCOMPLETE; do not waive mandatory requirements.

## 2. Research method and evidence conventions

Official API references, product documentation, pricing, coverage and terms were reviewed. Linked sources are evidence for vendor claims; architecture judgments are explicitly our recommendations. Public documentation can demonstrate an interface, not measured correctness, uptime, completeness or independence. No claims of empirical provider performance are made.

- **YES**: documented acquisition surface supplies the named primitive within its stated scope. Not an end-to-end Radar certification.
- **PARTIAL**: useful inputs exist, but coverage, semantics, reconstruction, precision or mandatory subfields are incomplete/unproven.
- **NO**: the reviewed product surface is not a source for this requirement. Not a claim about every private enterprise offering.
- **UNKNOWN**: public evidence was insufficient, contradictory or inaccessible. Never interpret as YES.
- All matrix cells are **Solana-specific**. Support on another chain does not count. Chain/program/DEX version must be verified separately.
- Every cell inherits its provider operational profile in section 4 and its capability qualification in section 3. These linked tables together form the evaluation record, avoiding 248 repetitions of plan/rate/transport fields. An undocumented capability-specific limit, retention floor, update SLA, scale/rounding rule or entitlement is **UNKNOWN**, even if a vendor-wide maximum is stated.
- “Live” means offered near-current delivery, not a measured latency guarantee. HTTP JSON-RPC/GraphQL are identified separately from REST. A WebSocket catalog does not imply streaming for every endpoint.
- Pricing is USD as observed, before tax, hosting, database/storage, egress, engineering, support and optional add-ons. Monthly and annual-equivalent prices are distinguished. Reconfirm checkout/contract before spending.

Important research caveats: Birdeye's documentation is moving from `docs.birdeye.so` to `data.birdeye.so/docs`; some linked endpoint pages failed to resolve. Official product guides substantiate several capabilities but do not replace payload/entitlement tests. Older pricing/index pages conflict with newer pages for some vendors. Where a current canonical pricing card and an older article disagree, the card is used provisionally and the discrepancy retained below. No private dashboard was inspected.

## 3. All 31 capabilities × eight providers

Abbreviations: BE Birdeye; HE Helius; CG CoinGecko/GeckoTerminal; DS DEX Screener; BQ Bitquery; QN QuickNode; SH Shyft; MO Moralis. `M` = mandatory; `H/O/D` = enrichment priority from the requirements. Sources for each column are the linked operational profiles; row-specific acceptance constraints follow this matrix.

| Capability | Need | BE | HE | CG | DS | BQ | QN | SH | MO |
|---|---|---|---|---|---|---|---|---|---|
| TOKEN_IDENTITY | M | PARTIAL | YES | PARTIAL | PARTIAL | PARTIAL | YES | YES | PARTIAL |
| TOKEN_SUPPLY | M | PARTIAL | YES | PARTIAL | NO | PARTIAL | YES | YES | UNKNOWN |
| TOKEN_AUTHORITIES | M | PARTIAL | PARTIAL | NO | NO | PARTIAL | PARTIAL | PARTIAL | UNKNOWN |
| TOKEN_METADATA | H | YES | YES | YES | PARTIAL | PARTIAL | YES | PARTIAL | YES |
| DISCOVERY_EVENTS | M | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL |
| CHAIN_STATE | M | PARTIAL | YES | NO | NO | PARTIAL | YES | YES | PARTIAL |
| MARKET_PAIR | M | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL |
| PRICE | M | YES | PARTIAL | YES | YES | YES | PARTIAL | PARTIAL | YES |
| QUOTE_CONTEXT | M | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL |
| LIQUIDITY | M | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL |
| POOL_STATE | M | PARTIAL | PARTIAL | PARTIAL | NO | PARTIAL | PARTIAL | PARTIAL | UNKNOWN |
| LIQUIDITY_EVENTS | M | PARTIAL | PARTIAL | UNKNOWN | NO | PARTIAL | PARTIAL | PARTIAL | PARTIAL |
| MARKET_DEPTH | M | UNKNOWN | PARTIAL | UNKNOWN | NO | PARTIAL | PARTIAL | PARTIAL | UNKNOWN |
| VOLUME | M | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL |
| TRADES | M | PARTIAL | PARTIAL | PARTIAL | NO | PARTIAL | PARTIAL | PARTIAL | PARTIAL |
| HOLDER_BALANCES | M | PARTIAL | PARTIAL | PARTIAL | NO | PARTIAL | PARTIAL | PARTIAL | UNKNOWN |
| TOP_HOLDERS | M | PARTIAL | PARTIAL | PARTIAL | NO | PARTIAL | PARTIAL | PARTIAL | UNKNOWN |
| ADDRESS_LABELS | M | PARTIAL | PARTIAL | PARTIAL | NO | PARTIAL | PARTIAL | PARTIAL | UNKNOWN |
| PARTICIPANT_MAPPING | M | PARTIAL | PARTIAL | PARTIAL | NO | PARTIAL | PARTIAL | PARTIAL | PARTIAL |
| TOKEN_TRANSFERS | M | PARTIAL | YES | PARTIAL | NO | PARTIAL | YES | PARTIAL | PARTIAL |
| WALLET_HISTORY | H | PARTIAL | PARTIAL | PARTIAL | NO | PARTIAL | PARTIAL | PARTIAL | PARTIAL |
| HISTORICAL_WINDOWS | M | PARTIAL | PARTIAL | PARTIAL | NO | PARTIAL | PARTIAL | PARTIAL | PARTIAL |
| COVERAGE_LINEAGE | M | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL |
| LP_STATE | H | UNKNOWN | PARTIAL | UNKNOWN | NO | PARTIAL | PARTIAL | PARTIAL | UNKNOWN |
| TOKEN_CREATOR | H | PARTIAL | PARTIAL | UNKNOWN | NO | PARTIAL | PARTIAL | PARTIAL | UNKNOWN |
| CREATOR_REWARDS | O | PARTIAL | PARTIAL | NO | NO | PARTIAL | PARTIAL | PARTIAL | UNKNOWN |
| LAUNCH_LIFECYCLE | H | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL |
| PUBLIC_SOCIAL | D | PARTIAL | NO | PARTIAL | PARTIAL | NO | NO | NO | PARTIAL |
| PUBLIC_WEB | D | PARTIAL | PARTIAL | PARTIAL | PARTIAL | NO | PARTIAL | PARTIAL | PARTIAL |
| DEVELOPMENT_CONTEXT | D | NO | NO | PARTIAL | NO | NO | NO | NO | UNKNOWN |
| PUBLIC_NEWS | D | NO | NO | PARTIAL | NO | NO | NO | NO | UNKNOWN |

### Capability-level interpretation and operational exceptions

These are mandatory qualifications to the support matrix, not optional footnotes. “Raw RPC route” requires later supported-program decoders and complete collection; it does not mean a ready-made aggregate endpoint. Derived metrics may use provider data only when their universe/recipe is reproducible.

| Capability | Required surface, time/history, precision and provenance qualification |
|---|---|
| TOKEN_IDENTITY | Read mint account owner/program and decoded decimals at a recorded slot. HE/QN/SH raw RPC is the verification route. Market symbols/catalog addresses alone are PARTIAL. Creation history is separate from present identity. |
| TOKEN_SUPPLY | Raw mint units/decimals, not floating UI supply. RPC current supply is useful; historical supply requires retained state/events. Circulating supply remains optional and requires an exclusion recipe. |
| TOKEN_AUTHORITIES | Mint/freeze plus supported extensions, delegates/hooks and program upgrade control; basic security flags cover only a subset. RPC bytes + pinned decoders required. No provider is certified for all extensions. |
| TOKEN_METADATA | Metadata is attributed content, not verified legitimacy. RPC/DAS metadata URI is not permission to fetch arbitrary URLs. Capture revisions; earliest off-chain history UNKNOWN. |
| DISCOVERY_EVENTS | BE new-listing/pair, CG new-pool, BQ instructions, MO launch feeds and RPC logs supply different event types. Listing time is not mint creation. Require stable references, pagination checkpoints and recoverable gaps. |
| CHAIN_STATE | RPC slot/block/commitment and transaction success are preferred. Parsed/indexed records need indexed-slot lag. A vendor receipt timestamp alone cannot establish finality. |
| MARKET_PAIR | Catalog + raw account program/quote identity + creation event. All named aggregators require a version-specific venue coverage check; RPC needs program decoding. |
| PRICE | BE/CG/DS/BQ/MO expose prices; no claim of exact raw-chain USD truth. Bind pool, side, quote, source time and conversion. Numeric-string preservation cannot undo vendor rounding. |
| QUOTE_CONTEXT | Combine quote mint/program state, source price and declared conversion lineage. None documents the entire Radar quote-quality decision. No assumed dollar peg. |
| LIQUIDITY | Aggregator USD reserves are not usable depth. Require pool set, raw state, active-range semantics and quote conversion. History of headline liquidity does not reconstruct positions. |
| POOL_STATE | HE/QN raw accounts; SH parsed DeFi; BQ recent pool changes; BE/CG pool summaries. Tick/bin/range/fee completeness and same-slot consistency remain unproven. |
| LIQUIDITY_EVENTS | Decode transactions/instructions and distinguish deposits, withdrawals, fees, price revaluation and migration. A changed USD-liquidity number is not a proven withdrawal. Historical coverage differs by decoder/cube. |
| MARKET_DEPTH | No turnkey source is certified. Proposed read-only computation over supported pool state with exact arithmetic and fees. No executable quote, transaction construction or routing API. Missing tick/range state => INCOMPLETE. |
| VOLUME | Align window, quote, successful swap legs and route deduplication. Provider aggregates are PARTIAL until recipe/coverage accepted. No top-trader list as a substitute for the complete window. |
| TRADES | Event signature + instruction/leg identity, time, pool, amounts and attribution needed. CG range and BE/BQ/MO trade surfaces are useful but retention/completeness must be tested. DS public pair counts are not trade records. |
| HOLDER_BALANCES | Complete mint-account enumeration, token-account→owner mapping, raw balances and snapshot coverage. Rank/census of owners, not accounts. Pagination over changing state is not automatically an atomic snapshot. |
| TOP_HOLDERS | Derive from the accepted owner census. CG Solana top list stops at 40; cannot satisfy top-50 directly. Solana largest-accounts RPC is not a full holder list. |
| ADDRESS_LABELS | Raw pool/vault/program relationships are verifiable; treasury/custody/burn control claims need evidence and validity intervals. Proprietary “insider/dev/smart money” labels are hypotheses, not authoritative exclusions. |
| PARTICIPANT_MAPPING | Resolve actual actors from signers, token ownership and routed swap legs; fee payer/router is not necessarily buyer. Human beneficial ownership and wallet clusters remain unproven. |
| TOKEN_TRANSFERS | Raw transaction/pre-post balance and instruction data can establish transfers; verify inner instructions, Token Extensions, mint/burn/fees. Supply changes and swaps are not interchangeable transfer labels. |
| WALLET_HISTORY | Address history alone can omit token-account activity. Require all relevant accounts, coverage start and creation/funding references. “First indexed” is not wallet birth. |
| HISTORICAL_WINDOWS | Assemble licensed snapshots/events and availability-at history. An OHLCV API does not supply old authority, holder or pool state. No universal historical floor is documented. |
| COVERAGE_LINEAGE | Radar owns collection receipts, gaps, decoder versions, capture time and frozen inputs. Vendor completeness/revision/rights assurances remain procurement gates; no vendor alone supplies the entire contract. |
| LP_STATE | Supported lock/position/vault program state + beneficiary/expiry and current withdrawal rights. An LP burn/lock label is neither universal nor a safety guarantee. |
| TOKEN_CREATOR | Creation transaction roles are facts; fee payer, mint initializer, launchpad and beneficial creator are different. Do not promote provider tags to identity. |
| CREATOR_REWARDS | Program-specific fee/reward claim events; BE fee surface and raw/indexed instructions are candidates. Coverage and accrual-vs-paid semantics UNKNOWN until scoped. |
| LAUNCH_LIFECYCLE | Launch/migration programs need versioned event decoding and ancestry. Trending/new-listing feeds alone cannot prove lifecycle completeness. |
| PUBLIC_SOCIAL | Metadata links are PARTIAL only: none evaluated here proves licensed X/Telegram content coverage. No social/KOL score is purchased or imported. |
| PUBLIC_WEB | Links/metadata are not a safe historical website-capture service. Safe capture, rights and token attribution are separate later work. |
| DEVELOPMENT_CONTEXT | CG [coin metadata](https://docs.coingecko.com/reference/coins-id) may offer repository/developer context for listed assets; unlisted Solana coverage/point-in-time evidence UNKNOWN. No commit-count quality inference. |
| PUBLIC_NEWS | CG news catalog is a potential enrichment source, not complete licensed reporting for every mint. Original source, correction and retention rights still required. |

## 4. Provider operational profiles and source evidence

### 4.1 Helius — proposed chain-state authority transport

**Solana YES; current RPC YES; HTTP JSON-RPC YES; REST YES for indexed/parsed APIs; standard WebSocket YES; webhook YES; gRPC YES with plan restrictions.** RPC supplies account/transaction facts; DAS/parsed events are indexed/decoded representations, not independent sources of truth. Use chain identity/slot plus pinned decoding to establish authority, rather than the vendor's brand.

The [DAS token-account reference](https://www.helius.dev/docs/api-reference/das/gettokenaccounts) exposes mint/owner filtering, pagination and an indexed slot. Its amount fields are JSON numbers: test lossless parsing or verify raw account bytes; never feed rounded JS integers into authoritative balances. The [holder derivation guide](https://www.helius.dev/blog/how-to-get-token-holders-on-solana) describes paging mint accounts (up to 1,000 per page); Radar must aggregate owners, exclude zero balances deliberately and prove collection completeness. This is not a documented historical atomic owner census.

[Transaction history](https://www.helius.dev/docs/api-reference/rpc/http/gettransactionsforaddress) provides indexed paging/filtering. Account ownership expansion matters: [Helius explains](https://www.helius.dev/blog/solana-token-accounts-history) why owner-only signature history misses token-account transfers. Archive transaction availability does not guarantee arbitrary old account-state snapshots. Earliest complete coverage for each selected token/program/query remains **UNKNOWN until sampled and confirmed**.

[Parsed Events](https://www.helius.dev/docs/parsed-events) is open beta; the current [documentation index](https://www.helius.dev/docs/llms.txt) marks Enhanced Transactions as legacy maintenance-mode. Do not build an unqualified new dependency on legacy parsing or beta schema stability. Prefer raw canonical references; evaluate pinned Parsed Events responses only after decoder parity checks. Creator/deployer, transfer and liquidity interpretation still require correct protocol semantics.

[LaserStream](https://www.helius.dev/docs/laserstream) documents mainnet gRPC on Business/Professional, approximately 24-hour replay, and separate WebSocket behavior without that replay guarantee. It is not required initially. Webhooks/WS plus bounded HTTP reconciliation suit a small universe; stream recovery needs durable checkpoints, not an assumption of exactly-once delivery.

Current [pricing](https://www.helius.dev/pricing): Free 1M credits/10 RPC RPS; Developer **$49/month, 10M credits, 50 RPC RPS**; Business **$499, 100M, 200 RPS**; Professional **$999, 200M, 500 RPS**. DAS rates differ (Developer 10 RPS, Business 50). Current cards take precedence provisionally over older indexed comparisons with different credit quantities; confirm purchased quotas.

[Credit rules](https://www.helius.dev/docs/billing/credits): standard RPC 1 credit; DAS 10; legacy enhanced parsing 100; `getTransactionsForAddress` full results 10 per 100 returned, rounded up; webhooks 1/event and management calls 100; WS/gRPC byte metering applies (2 credits/0.1 MB in the documented schedule). Method-specific limits must be budgeted independently. Status source: [Helius status](https://helius.statuspage.io), linked by official docs; retrieval failed during this review, so no current uptime claim.

**Recommended responsibilities:** I01/I02/I05/I06 and supported authority state; chain finality; raw pool/account/transfer history; owner-census inputs. **Not supplied automatically:** quality labels, market USD truth, complete historical holdings, human creator identity or a production depth calculator. Production suitability: strong candidate for chain primitives, conditional for the derived requirements.

### 4.2 Birdeye — proposed primary market and discovery source

**Solana YES; REST YES; live market feeds YES; WebSocket YES; historical market data YES within endpoint limits.** The [current overview](https://data.birdeye.so/docs/getting-started) and [price/OHLCV reference](https://data.birdeye.so/docs/data-api/price-ohlcv) describe market, token, wallet and candle surfaces. Price and liquidity are provider-derived observations. Do not treat proprietary token valuation, holder tags or selected-pool aggregation as raw chain truth.

[Discovery documentation in the official guide](https://birdeye.so/data-api/blog/detail/solana-new-token-sniper-api-birdeye-data) identifies `/defi/v2/tokens/new_listing`, `SUBSCRIBE_NEW_PAIR` and `SUBSCRIBE_TOKEN_NEW_LISTING`. REST pages are capped at 20 and have a time cursor; Solana launchpad inclusion is explicit. That is a useful candidate feed, not proof of every newly created mint. Radar does not adopt the guide's trading use case.

The [token-investigation guide](https://birdeye.so/data-api/blog/detail/token-investigation-dashboard-solana-birdeye-data) documents overview, OHLCV V3, distribution, top traders, token security and mint/burn histories. Overview bundles price/liquidity/volume/supply; the guide describes up to 5,000 OHLCV candles, distribution pages up to 50 and top-trader results up to 10. Several linked older references failed to load: exact plan entitlements, unlisted-token coverage and all CU prices remain endpoint acceptance checks. A top-trader ranking cannot establish complete participation.

[Holder Profile/Positions](https://birdeye.so/data-api/blog/detail/token-holder-profile-token-holder-positions-complete-holder-intelligence-on-solana) documents Solana behavioral tags and notes older bundler-tag backfill limitations. These labels remain provider hypotheses. [Holder distribution](https://birdeye.so/data-api/blog/detail/token-holder-distribution-deep-insights-into-token-supply-concentration-on-solana) is an independent surface to test against the owner census, not automatic authority for exclusions. [Blockchain Data APIs](https://birdeye.so/data-api/blog/detail/new-api-suites-blockchain-data-apis-query-solana-accounts-tokens-and-transactions) add account/token/transaction access; raw-field and history completeness are still UNKNOWN here. They do not justify dropping the independent RPC verification path.

[Price](https://data.birdeye.so/docs/data-api/price-ohlcv/get-defi-price) costs **3 CU/request**. [Pool liquidity OHLC](https://data.birdeye.so/docs/data-api/price-ohlcv/get-defi-v3-liquidity-ohlc-pair) documents Solana history from **2024-01-01**, 100 candles/request and a base 20 CU for 1-minute resolution with additional depth/lookback multipliers. This is liquidity history, not historical tick/position state.

[Price WebSocket](https://data.birdeye.so/docs/websockets/subscribe-price-ohlcv) supports up to 100 token/pair addresses in its multi-address subscription. Re-subscribing replaces that subscription's address set. Token price uses a provider pool-ranking mechanism. Example OHLCV fields are JSON numbers, with optional scaling metadata; raw/scaled modes must not be confused. Preserve original decimal lexemes and scale; vendor internal precision/rounding guarantee is **UNKNOWN**. Candle/event timestamps are available; collection latency and source-slot lineage need measurement.

[Current pricing](https://birdeye.so/data-api/pricing): Lite **$39/2.5M CU/15 RPS**, Starter **$99/8M/15**, Premium **$199/20M/50**, Business **$499/60M/100**. Premium is the proposed beta tier for REST plus WS; current card lists 500 WS connections. [Pricing documentation](https://docs.birdeye.so/docs/pricing) lists REST overage per million CU of $15/$12/$9.90/$6.90 respectively, but says WS pricing differs. Growth figures differ between pages; WS message pricing and endpoint throttles require a quote. Connections are not free unlimited messages. Rights source: [terms](https://assets.birdeye.so/bds/policies/2025.04.11-tos.pdf); archival/derived-publication permission requires review, not an assumption.

**Use:** discovery, market snapshots, pool catalog, prices/candles, initial liquidity/volume and trade inputs. **Verify:** pool coverage, units, precise trade identity, route dedup, incomplete pagination, holder definitions, timestamps and market-cap denominator. Proprietary risk/“smart money” classifications never enter Radar as VERIFIED_DATA or inherited scores. Candidate production suitability: primary market source subject to these gates.

### 4.3 CoinGecko / GeckoTerminal — recommended secondary market/history source

**Solana YES; REST YES; WS YES on eligible paid services; historical YES by endpoint/plan.** [Endpoint catalog](https://docs.coingecko.com/reference/endpoint-overview) includes pools, new pools, token/pool prices, candles, trades, top holders, wallet transfers and news. Basic covers unmarked paid endpoints; marked endpoints require Analyst+. This is broader than older comparisons claiming only a short last-trades feed.

[Pool data](https://docs.coingecko.com/reference/pool-address) binds base/quote and DEX/pool identifiers; several monetary values are strings. Provider-calculated reserves/FDV/market cap remain derived. [GeckoTerminal FAQ](https://apiguide.geckoterminal.com/faq) explains that unverified market cap can be null, token price follows its top pool, and the public API limit is 30/minute. Do not equate CoinGecko and GeckoTerminal with two independent providers: they are the same source family.

[New pools](https://docs.coingecko.com/reference/latest-pools-network) covers the preceding 48 hours, up to 20/page; beyond 10 pages requires Analyst+. Source pool creation time and windowed counts exist, but update latency is **UNKNOWN as a contractual guarantee**. Confirm Solana DEX/program coverage through the [network DEX catalog](https://docs.coingecko.com/reference/endpoint-overview) and a representative corpus, not marketing-wide chain totals.

[Pool OHLCV](https://docs.coingecko.com/reference/pool-ohlcv-contract-address): Basic history is six months; Analyst+ can reach September 2021 where the pool was tracked. Maximum 1,000 candles, at most six months per call, with timestamp paging. OHLCV samples are JSON numeric arrays; exact raw-trade precision is not promised. Empty intervals are skipped by default; optional filling is synthetic, so never confuse a carried-forward candle with a newly observed price.

[Time-range trades](https://docs.coingecko.com/reference/pool-trades-contract-address-range) supports cursor pagination and windows no longer than 30 days per query; both boundaries are inclusive. That is not a guaranteed earliest history date or completeness SLA. Deduplicate boundaries. Earliest coverage and page size for the purchased endpoint remain **UNKNOWN** until confirmed. [Top holders](https://docs.coingecko.com/reference/top-token-holders-token-address) is beta, capped at **40 on Solana**, not 50. [Holder chart](https://docs.coingecko.com/reference/token-holders-chart-token-address) is beta with granularity tied to requested range; it is a count chart, not a historical owner-balance census.

[Pricing](https://www.coingecko.com/en/api/pricing), monthly cards: Basic **$35/100k calls/300 per minute**; Analyst **$129/500k/500**; Lite **$499/2M/500**. Annual discounts are separate. Recommend Analyst only when its historical/range/holder endpoints are needed; Basic is a cheaper restricted verification alternative. Free GeckoTerminal is for evaluation, not a production SLA. [Status](https://status.coingecko.com/) was operational when retrieved; this is not a longitudinal reliability measurement. Public redistribution, retention, attribution and WS billing need subscription-specific confirmation.

**Role:** secondary verification and historical evaluation; not primary chain authority. Independence from Birdeye must be checked by upstream ancestry, not presumed from two brand names. Promote it to primary for an exact market metric only after equivalence tests; never silently replace a token-aggregate metric with a single-pool metric.

### 4.4 DEX Screener — tertiary/context only, with a terms gate

[API reference](https://docs.dexscreener.com/api/reference) documents pair/search/token-pair and batched-token surfaces, alongside profiles, ads and boosts. Solana pair data is useful for price/liquidity/volume/count comparisons and pair creation context. Price fields are strings; liquidity, volume, FDV and market-cap fields can be JSON numbers/null. Pair creation is not observation freshness. Common pair/token endpoints are documented at 300 requests/minute; profile/promotion surfaces at 60/minute; token batches up to 30. No reviewed public historical OHLCV/raw-trade or documented WS contract provides the required history. Exact retention/update SLA is UNKNOWN.

**Do not assume permission to build Radar on it.** [API terms](https://docs.dexscreener.com/api/api-terms-and-conditions) restrict direct competing services and resale. Radar's intended use needs explicit terms clearance before production dependence or stored redistribution. Public API access is not a license determination. Cost: no listed public-call charge identified; paid commercial rights/SLA UNKNOWN.

Treat pair statistics as tertiary disagreement clues, paid boosts/ads as disclosed context only. Neither Trending Score, paid visibility nor promotional spend influences analytical quality, discovery priority or Radar Score. No authoritative fallback for holders, depth, authority state or complete event history.

### 4.5 Bitquery — investigation/history candidate, not automatic launch dependency

**Solana YES; HTTP GraphQL YES (not ordinary REST); subscriptions/streaming YES; archive PARTIAL.** [Solana API](https://docs.bitquery.io/docs/blockchain/Solana/) supplies trade/transfer/instruction primitives; [Orca](https://docs.bitquery.io/docs/blockchain/Solana/solana-orca-dex-api/), [PumpSwap](https://docs.bitquery.io/docs/blockchain/Solana/Pumpfun/pump-swap-api/), [Meteora](https://docs.bitquery.io/docs/blockchain/Solana/Meteora-DLMM-API/) and [Raydium launchpad](https://docs.bitquery.io/docs/blockchain/Solana/launchpad-raydium/) documentation establish relevant protocol surfaces, including Pump.fun→PumpSwap migration. Coverage of every program version remains a benchmark question.

The [curated Trading product](https://docs.bitquery.io/docs/trading/trading-data-overview/) and raw chain-level data are not interchangeable. Filtered/MEV-cleaned data can conceal the very activity needed for manipulation research. Use raw referenced events for participant/flow reconstruction; vendor classifications stay separate. Transaction/instruction identities and block times enable verification; decimal precision/GraphQL scalar behavior must be tested per selected field, not inferred from display examples.

[Current retention matrix](https://docs.bitquery.io/docs/graphql/data-coverage-retention/): Solana DEXTrades and many other raw cubes retain roughly 12 hours; DEXTradeByTokens roughly seven days live with archive since mid-2024; minute price aggregates since October 2024. Pool state has no equivalent archive API; deep transfer history may require export. Trading cubes retain about 30 days. These are dataset-specific, not a universal history promise. [Historical aggregate notes](https://docs.bitquery.io/docs/blockchain/Solana/historical-aggregate-data/) give June 1, 2024 for relevant archive aggregates and warn that trade-side accounts are unavailable in aggregate archive/combined queries. Historical OHLCV cannot replace historical counterparties.

The [Meteora reference](https://docs.bitquery.io/docs/blockchain/Solana/Meteora-DLMM-API/) additionally warns about USD aggregation and differing combined/realtime counts. Therefore archived raw trader identity, complete wallet/deployer histories and point-in-time owner distributions need an exact query/export acceptance test. GraphQL limits/offset or cursor strategy, maximum export size and earliest per-program history are UNKNOWN until specified; never use an unbounded query as a production plan.

[Current pricing](https://bitquery.io/pricing): Pro **$99/month, 1M points, 90 requests/minute, 6 concurrent queries, 100k stream-minutes, 5 GB**; Scale **$299, 5M points, 240/minute, 12 queries, 2M stream-minutes, 50 GB**. Personal is noncommercial and unsuitable for Radar beta. Archives are separate: Solana OHLCV $300/month ($210 annual-equivalent); transfers $500/month ($400 annual-equivalent). Solana is excluded from the generic holder add-on. Exact query/export cost is workload-dependent. Pricing and retention docs differ in how transfer history is packaged; obtain written dataset/transport entitlement, not just a plan name.

**Recommendation:** later/targeted investigation. Helius + Birdeye can acquire a bounded forward corpus with our decoders, but cannot be assumed to replace every Bitquery archive query. Conversely Bitquery does not automatically close holder/depth/history gaps. Buy only when a required empirical cohort or a proven raw-indexing bottleneck justifies it. No Kafka or separate service is proposed.

### 4.6 QuickNode — independent RPC fallback candidate

[Solana overview](https://www.quicknode.com/docs/solana/api-overview) documents RPC/archive access; [getProgramAccounts](https://www.quicknode.com/docs/solana/getProgramAccounts) supplies raw accounts. [DAS token accounts](https://www.quicknode.com/docs/solana/getTokenAccounts) requires its add-on and supports mint/owner paging. This is a credible second transport for identity/supply/authority/pool verification, not a second ready-made intelligence model. Archive transactions do not guarantee historical arbitrary account state. Exact earliest archive floor, same-slot census support and add-on limits are UNKNOWN.

HTTP JSON-RPC and WS are available; Streams/webhooks/gRPC are offered products, not proof of included Solana capacity on every plan. Parsed account fields can include numbers; use raw bytes/string amounts where necessary. Slots/signatures provide provenance. [Credit schedule](https://www.quicknode.com/api-credits/sol) charges most Solana methods 30 credits, with advanced/large-call multipliers; these credits are not comparable numerically to Helius credits.

[Pricing](https://www.quicknode.com/pricing): Build **$49/month, 80M credits, 50 RPS**; Accelerate **$249/450M/125**; Scale **$499/950M/250**. Add-ons/streams/overages need separate confirmation. Older help-page allowances differed; use the current purchased contract. [Status history](https://status.quicknode.com/) is available; no measured superiority is claimed. Recommend a sampled failover/verification evaluation, not duplicate full subscriptions by default.

### 4.7 Shyft — pool/indexing alternative with useful scope

[DeFi APIs](https://docs.shyft.to/solana-defi-apis/defi-apis) document parsed pool lookup and liquidity details for named Raydium, Orca, Meteora and PumpSwap programs, among others. Token/pair listings paginate (default 100). This could reduce pool-discovery/decoder work. It does **not** prove replayable historical tick/bin state or exact amounts: the example contains a large scientific-notation numeric square-root price. Verify against raw bytes before authoritative arithmetic.

[RPC documentation](https://docs.shyft.to/solana/shyft-rpcs) supplies the raw alternative; the [official platform](https://shyft.to/) offers RPC, parsing/indexing, callbacks and gRPC. Raw/parsed transports and indexed request budgets are separate. Source slot/transaction context and arbitrary historical earliest coverage require endpoint confirmation. Do not infer full past state from current pool indexing.

Current [pricing](https://shyft.to/) has a new unlimited-credit schedule and a separate legacy schedule: Build **$199/month, 100 RPC RPS, 10 API RPS**; Grow **$349/150/30**; Accelerate **$649/400/100**. Indexing rates are listed separately, and gRPC connections/bandwidth terms need confirmation; “unlimited credits” is not unlimited RPS or guaranteed storage. Do not mix legacy $49 quotas with new-plan features. Recommend as fallback/targeted pool-indexing alternative only if it materially closes POOL_STATE cost/completeness gaps better than the chosen RPC route.

### 4.8 Moralis — market/stream alternative, no demonstrated unique launch requirement

[Solana Token API](https://docs.moralis.com/data-api/solana/token/overview) documents metadata, pairs, swaps, discovery and Pump.fun lifecycle; [price overview](https://docs.moralis.com/data-api/solana/price/overview) includes current/batch prices and OHLC. These duplicate part of Birdeye/CG coverage. Earliest complete history, full holder census and complete extension-control decoding are UNKNOWN here; do not import EVM holder capabilities into the Solana column.

[Wallet swaps](https://docs.moralis.com/web3-data-api/solana/reference/get-swaps-by-wallet-address) has cursor paging up to 100 and date filters. Example amounts are strings while USD fields are numbers; reference examples contain EVM-looking sample fields despite the Solana endpoint, strengthening the need for real Solana payload acceptance. [Current token-swaps reference](https://docs.moralis.com/data-api/solana/token/swaps/token-swaps) is the better starting point for implementation evaluation. Block time, transaction and pair identity should be retained; “buy/sell” remains decoder interpretation.

[Solana Streams](https://docs.moralis.com/streams/solana-streams) now documents webhook delivery with program/address/mint filters, inner instructions and pre/post token balances. [Supported-chain documentation](https://docs.moralis.com/streams/supported-chains) explicitly includes Solana. Thus Solana streaming is **YES via webhooks**, not an assumed EVM-only product; WS/gRPC equivalence and replay retention are UNKNOWN. Retry delivery means deduplication is necessary.

[Pricing](https://moralis.com/pricing/) displayed annual-billed monthly equivalents: Starter **$149/2M CU/40 RPS**, Pro **$249/100M/80**, Business **$749/500M/200**. Monthly billing and exact Solana endpoint CU costs must be confirmed using the [CU guidance](https://api-help.moralis.io/en/articles/27695-compute-units). Do not use the pricing calculator's average request cost for a Radar workload. Candidate fallback, not another paid default: no unique mandatory capability has been demonstrated that justifies buying it alongside all three proposed providers.

### 4.9 Transport, precision and pagination applicability

This table completes the per-provider operational defaults inherited by every capability cell. A YES applies only to the documented endpoint family, not all 31 capabilities; a NO capability remains unsupported even when its provider has a REST API. Historical floors and pricing are in sections 4.1–4.8/10. Cost classes are comparative planning judgments, not vendor tariffs: low = public/test or small shared plan; medium = several paid shared services; variable/high = substantial indexing, stream bandwidth, archives or custom terms.

| Provider | Solana / realtime offering | REST / other HTTP | WS or streaming | Pagination/default bound | Precision, timestamp, provenance | Cost class / production qualification |
|---|---|---|---|---|---|---|
| BE | YES / YES for covered markets | YES | YES WS; per-message-type scope | Price single; discovery 20/page; distribution 50; candles endpoint-specific | Mixed numbers/scale; event/candle times; raw slot/rounding guarantees UNKNOWN for summaries | Medium, variable CU/WS; validate definitions and coverage |
| HE | YES / YES | YES indexed REST + JSON-RPC | YES WS/webhooks; mainnet gRPC paid restriction | DAS up to 1,000; transaction paging; raw RPC method-specific | Raw bytes/string units preferred; DAS numeric caveat; indexed slot/signatures | Low–high by workload; good raw primitive candidate, derived completeness unproven |
| CG | YES / YES offered, latency guarantee UNKNOWN | YES | YES market WS on eligible plan; not every capability | New pools 20/page; candles 1,000; range trades cursor; holder cap 40 Solana | Monetary strings in pool data, numeric OHLCV; pool/trade IDs and times; no full raw-state lineage | Low–medium, variable at scale; good verifier/history candidate |
| DS | YES / current snapshots; update SLA UNKNOWN | YES | NO documented public WS contract reviewed | Token batch 30; no complete history paging contract | Mixed strings/numbers/null; pair-created time not snapshot freshness | Public-call charge not identified; rights/SLA UNKNOWN; tertiary only |
| BQ | YES / YES | NO ordinary REST relied upon; YES HTTP GraphQL | YES subscriptions/streams | Query/cube/plan-specific; safe result-page limit UNKNOWN | Field-specific exactness UNKNOWN; block/tx/instruction refs; filtered vs raw matters | Variable/high with history/bytes; targeted investigation only initially |
| QN | YES / YES | JSON-RPC YES; REST service-specific UNKNOWN | YES RPC WS and offered streams/gRPC; entitlements confirm | DAS page/limit; raw RPC truncation/method limits confirm | Raw bytes/string token units; context slots; parsed fields need precision checks | Low–high; fallback primitive transport, not full derived analytics |
| SH | YES / YES | YES DeFi REST + JSON-RPC/index APIs | YES callbacks/gRPC; WS entitlement confirm | Pool page default 100; maximum/history paging UNKNOWN | Parsed large-number caveat; raw RPC reference needed; same-slot consistency UNKNOWN | Medium; targeted pool/index alternative |
| MO | YES / YES | YES REST | YES Solana webhooks; WS/gRPC UNKNOWN for reviewed scope | Wallet swaps up to 100/cursor; other endpoint maxima confirm | String token amounts/numeric USD; block/tx identity; decoder semantics need verification | Medium/variable CU; overlapping fallback, not proven unique coverage |

### Operational evidence still required from every vendor

Public documentation does not settle SLA enforcement, retention/republication rights, complete DEX version coverage, source ancestry, account-level limits, outage recovery or exact numeric fidelity. Obtain a written capability schedule and rate/credit quote, sample paginated results and historical gaps, status/incident history and support escalation terms. For Birdeye/Bitquery/Shyft/Moralis/DEX Screener, a comparable endpoint-specific historical status/SLA assessment was not established here: **UNKNOWN**, not zero outages. API pages were read, not production endpoints benchmarked.

## 5. Mandatory capability authority and fallback table

Authority classes: **CHAIN** = objective Solana state verified through a read-only RPC; **MARKET** = proposed primary market observation; **VERIFY** = independent market comparison; **INDEX** = expensive indexed events/accounts; **INVESTIGATE** = deeper history/flow analysis; **LOCAL** = Radar-owned reproducible derivation/lineage. Helius is a proposed transport for CHAIN, not a replacement for chain semantics. BQ is optional INVESTIGATE. Context sources never decide mandatory objective facts.

Reliability tiers follow the approved specification: A verifiable chain facts, B reproducible derived measurements, C heuristic, D context/inference. All rows below are Fast-Lane-eligible **only for the accepted deterministic fact portion**. No production rule or threshold is approved. All fallbacks are candidates, not automatic runtime substitution.

| Mandatory capability | Primary authority / proposed provider | Secondary/fallback | Direct verify? | Tier / Fast Lane | Conflict behavior |
|---|---|---|---|---|---|
| TOKEN_IDENTITY | CHAIN via HE raw mint/program | QN; SH alternative | Yes, account/slot | A / yes | Wrong chain/mint/program quarantined |
| TOKEN_SUPPLY | CHAIN via HE raw supply/decimals | QN | Yes | A / yes | Re-read same state context; no averaging |
| TOKEN_AUTHORITIES | CHAIN via HE + supported decoder | QN; BE security clue only | Yes, supported controls | A / yes | Unresolved control/program => UNKNOWN |
| DISCOVERY_EVENTS | MARKET BE listing/pair + CHAIN HE reference | CG new-pool; HE program events | Yes if event referenced | A/B / yes | Preserve source-first-seen separately |
| CHAIN_STATE | CHAIN HE slot/finality | QN | Yes, independent RPC | A / yes | Await comparable finalized context |
| MARKET_PAIR | MARKET BE catalog reconciled to CHAIN HE | CG; SH pool index | Yes | A/B / yes | Unknown program/pool excluded from claimed universe |
| PRICE | MARKET BE pool-scoped price | VERIFY CG; DS only after rights clearance | Raw pair price partly; USD derived | B / yes | Align quote/time/pool before policy reconciliation |
| QUOTE_CONTEXT | LOCAL quote identity/state HE + BE valuation | CG valuation/QN state | State yes, dollar value derived | A/B / yes | Unknown conversion/quote integrity => INCOMPLETE |
| LIQUIDITY | LOCAL accepted pool set/state + BE quote context | CG summary; SH/QN raw verification | Yes for underlying state | A/B / yes | No substitution of TVL for usable depth |
| POOL_STATE | CHAIN HE accounts + supported decoders | QN; SH parsed comparison | Yes | A / yes | Missing tick/bin/fee state => UNSUPPORTED/INCOMPLETE |
| LIQUIDITY_EVENTS | INDEX HE raw transactions + decoded events | BQ recent instructions; QN raw history | Yes, signature/instruction | A/B / yes | No inference of withdrawal from USD change alone |
| MARKET_DEPTH | LOCAL exact read-only state arithmetic | Independent calculation over QN/SH-verified state; no certified turnkey fallback | Yes, inputs/math | B / yes | No complete reproducible curve => INCOMPLETE |
| VOLUME | MARKET BE window + LOCAL route-aware cross-check | CG aligned window; BQ raw subset | Yes given complete swaps/conversion | B / yes | Preserve coverage/route discrepancies, do not average |
| TRADES | MARKET BE feed + INDEX HE raw-reference checks | BQ raw dataset; CG range subset | Yes | A/B / yes | Missing legs/gap => incomplete window |
| HOLDER_BALANCES | INDEX HE mint accounts + LOCAL owner census | QN DAS/raw; BE comparison | Yes, within proven snapshot | A/B / yes | No partial census labeled complete |
| TOP_HOLDERS | LOCAL ranking of accepted owner census | BE distribution; CG up to 40 | Yes | B / yes | Compare same owner/exclusion denominator |
| ADDRESS_LABELS | LOCAL evidence ledger from CHAIN program/vault relationships | QN state; provider tags as untrusted clues | Only objective relationships | A/B facts; C hypothesis / facts only | No credible universal treasury/beneficial-owner fallback |
| PARTICIPANT_MAPPING | LOCAL route/account attribution over HE/BE events | BQ detailed raw trades, if retained | Partial: observable actors, not humans | B / yes | Ambiguous routers/owners explicitly unknown |
| TOKEN_TRANSFERS | INDEX HE raw transactions/token-account history | QN raw; BQ with correct dataset | Yes | A/B / yes | Preserve failed/inner/fee/mint distinctions |
| HISTORICAL_WINDOWS | LOCAL frozen forward corpus + BE market history | CG candles/ranges; HE raw history; BQ scoped archive/export | Partly, retained references | B / yes | Gaps block required baseline, not zero-fill |
| COVERAGE_LINEAGE | LOCAL immutable acquisition/normalization evidence + provider coverage statement | Independent probes/receipts; no vendor substitute | Partly | A/B / yes | Unproven completeness stays UNKNOWN |

On outage, the listed alternative is usable only after exact capability/metric semantics, precision, time, coverage, licensing and provenance are qualified. Otherwise record UNAVAILABLE; lack of an offered capability is UNSUPPORTED, lack of a known fact is UNKNOWN, and aged evidence is STALE. Preserve the last good observation as history, not as a fresh substitute. A required unresolved input makes evaluation INCOMPLETE.

## 6. All 30 mandatory signals: procurement and verification mapping

“One source?” is about acquisition adequacy, not an exemption from validation. **Conditional yes** means one complete referenced dataset can suffice after validation; independent verification remains desirable. **No** means an aggregator scalar alone cannot supply the full signal. **Local** means Radar must establish it across acquisition records. Every row inherits the missingness/outage behavior immediately above; none permits missing→zero/safe or vendor-score substitution.

| Signal | Required capabilities | Best primary candidate / derivation | Verification/fallback | Direct-chain possibility | One source? / independence |
|---|---|---|---|---|---|
| I01 canonical chain | TOKEN_IDENTITY, CHAIN_STATE | HE network/account context | QN | Yes | Conditional yes; independent spot-check |
| I02 canonical mint | TOKEN_IDENTITY | HE mint/program identity | QN | Yes | Conditional yes; desirable |
| I05 decimals | TOKEN_IDENTITY | HE decoded mint | QN/raw bytes | Yes | Conditional yes; desirable |
| I06 total supply | TOKEN_SUPPLY | HE raw amount + decimals | QN; BE comparison only | Yes | Conditional yes; desirable |
| I08 mint authority | TOKEN_AUTHORITIES | HE decoded current authority | QN; BE clue | Yes | Conditional yes; verify critical changes |
| I09 freeze/transfer controls | TOKEN_AUTHORITIES | HE extension-aware decoding | QN; no scalar-security substitute | Supported programs only | No basic flag suffices; decoder gate |
| I10 upgradeability | TOKEN_AUTHORITIES | HE program/control evidence | QN | Program-specific | Conditional only with supported semantics |
| I11 standard/authority map | TOKEN_IDENTITY, TOKEN_AUTHORITIES | HE program + versioned profile | QN | Yes | Conditional; unsupported extension blocks |
| D01 discovery event | DISCOVERY_EVENTS, CHAIN_STATE | BE listing/pair + HE referenced event | CG new pools/HE logs | Yes for actual creation event | No listing feed alone proves creation |
| D02 baseline availability | HISTORICAL_WINDOWS, COVERAGE_LINEAGE | Local window/coverage inventory | CG/BE history; HE/BQ raw where supported | Partial | Local; compare independent coverage |
| M01 price | PRICE, MARKET_PAIR | BE scoped observation | CG; underlying HE pool/trade | Native pair yes; USD derived | Conditional; independent verifier desirable |
| M04 liquidity by pool | LIQUIDITY, POOL_STATE | HE raw state + BE catalog/valuation | SH/QN state; CG summary | Yes for state | No headline liquidity alone |
| M05 venue/pair identity-age | MARKET_PAIR, POOL_STATE | BE catalog + HE creation/state | CG, SH | Yes | Conditional complete raw reference; verify |
| M06 quote quality | QUOTE_CONTEXT, PRICE, TOKEN_AUTHORITIES | Local quote assessment from HE/BE | CG valuation/QN controls | Partial | No provider dollar label alone |
| M07 volume | VOLUME, TRADES | BE aligned volume; local trade validation | CG/BQ aligned/raw coverage | Partial with complete swaps | Conditional after definition validation |
| M08 transaction/trade counts | TRADES, VOLUME | BE records + local dedup unit | HE transaction references; CG | Yes within complete scope | No unqualified dashboard count |
| H01 holder count | HOLDER_BALANCES | HE complete owner census | QN; BE count comparison | Yes within coherent snapshot | Conditional; full census not top list |
| H03 top-10 concentration | TOP_HOLDERS, HOLDER_BALANCES | Local owner ranking/denominator | BE distribution/CG top list | Yes | Conditional census + denominator; verify |
| H07 exclusion ledger | ADDRESS_LABELS, POOL_STATE | Local evidence-backed vault/burn labels | QN; SH pool relation | Partial; treasury claims not universal | No generic label feed suffices |
| L01 meaningful liquidity | LIQUIDITY, QUOTE_CONTEXT, POOL_STATE | Local accepted pools/state/quotes | CG/SH comparison | State yes; usefulness derived | No aggregate alone |
| L05 liquidity adds/removals | LIQUIDITY_EVENTS, POOL_STATE | HE decoded referenced events | QN; BQ recent events | Yes | Conditional complete instruction coverage |
| L08 depth | MARKET_DEPTH, POOL_STATE, TOKEN_AUTHORITIES | Local exact supported-pool calculation | QN/SH input verification | Yes for state/math | No certified turnkey provider |
| A02 unique buyers/sellers | TRADES, PARTICIPANT_MAPPING | Local actor dedup from BE + HE | BQ raw/CG scoped comparison | Observable actors only | No route-agnostic count alone |
| A03 active wallets | TRADES, TOKEN_TRANSFERS, PARTICIPANT_MAPPING | Local scoped activity from HE/BE | QN/BQ | Observable owners/actors only | Conditional complete actor/event scope |
| C08 authority changes | TOKEN_AUTHORITIES, HISTORICAL_WINDOWS | HE events + retained snapshots | QN historical tx; BE mint/burn clue | Yes where history exists | Conditional; current state not history |
| Q01 coverage/missingness | COVERAGE_LINEAGE | Local completeness ledger | Cross-provider probes | Partial | Local; independent probes desirable |
| Q02 lag/finality | CHAIN_STATE, COVERAGE_LINEAGE | HE state + local timestamps | QN | Yes for slot/finality | Local + chain; compare RPC lag |
| Q03 source agreement | COVERAGE_LINEAGE | BE↔CG comparable markets; HE↔QN state samples | No invented independent substitute | Underlying facts partly | No; needs independent ancestry or UNKNOWN |
| Q04 lineage/replay | HISTORICAL_WINDOWS, COVERAGE_LINEAGE | Local immutable evidence/recipes | Provider references + licensed exports | Partial | Local; vendor historical access alone insufficient |
| Q05 semantic precision | COVERAGE_LINEAGE + relevant raw inputs | Local amount/unit/definition checks | Independent raw recomputation | Partial | Local; number strings alone not proof |

No credible provider was demonstrated for universal H07 beneficial-owner exclusions or complete all-program L08 depth. Credible **scoped** routes exist, but H01/H03 coherent census, A02/A03 actor mapping, D02/C08 history and Q01/Q03/Q04/Q05 quality metadata remain explicit acceptance blockers until tested. These are not reasons to weaken the 30-signal specification.

## 7. Traceability of the complete 80-signal inventory

All signal IDs retain their approved meanings/priorities. This map assigns acquisition families; it does not approve interpretation or implement calculation. Mandatory IDs are detailed above. Additional heuristics remain shadow-only until empirically validated; C05 and S01–S05 are Deep-Lane-only, S06 remains excluded from scoring.

| IDs (category count) | Capability/source route | Evaluation caveat |
|---|---|---|
| I01–I12 (12 identity) | HE/QN raw identity/supply/authorities; BE/CG/DAS metadata; creation/creator via referenced history | No supply estimate, mutable link or creator tag becomes objective truth |
| D01–D03 (3 discovery) | BE discovery, CG pools, HE events; local HISTORICAL_WINDOWS and deltas | First-seen and acceleration are different from deployment |
| M01–M12 (12 market) | BE primary/CG verifier; HE pool inputs; local comparable-window calculations | Market cap uses defensible supply; quote/time/pool changes invalidate comparisons |
| H01–H09 (9 holders) | HE owner census, BE/CG comparison, local labels/history; QN fallback | H04/H05 require enough owners; CG Solana top-40 cannot directly supply H05 |
| L01–L08 (8 liquidity) | HE/QN raw pools, BE market history, SH parsed pool alternative, BQ events | Lock/burn rights and depth are distinct; no safety assertion |
| A01–A09 (9 activity) | BE trades + HE transfers/actor attribution; BQ optional detailed investigation | Unique actors not unique humans; sizes/raw amounts before aggregation |
| C01–C08 (8 creator) | HE history/control events; BQ deeper corpus; BE fee/label clues | C05 linked-wallet synthesis is inference; no guilt by association |
| X01–X08 (8 manipulation indicators) | Local reproducible heuristics over trades, holders, pools and history | No provider “wash/insider” classification imported as proof |
| S01–S06 (6 social/context) | Metadata links; CG news/developer context PARTIAL; separate licensed acquisition TBD | No evaluated provider closes full social collection; S06 excluded |
| Q01–Q05 (5 quality) | Local receipts/finality/lineage + independent provider samples | Vendor availability and data completeness are different |

Totals: **80 candidates**. Fast Lane eligibility remains **73 candidates**, Deep Lane context eligibility **51** including shared fact inputs; these overlap, not a partition. This research does not add signals or use endpoints to manufacture new requirements.

## 8. Smallest reliable discovery and collection architecture

### Discovery: three bounded inputs, not an entire-chain firehose

1. **New mint vs new trading pair:** BE new-listing/pair feed proposes a candidate; HE verifies mint and referenced pool/creation facts. CG new-pool polling reconciles coverage. Do not claim detection of every mint with no trading venue. If the approved launch universe requires untraded mint discovery, add scoped token-program observation in a later approved implementation or mark that class unsupported.
2. **Quiet token accelerating:** periodically revisit an explicitly bounded watch universe, retain comparable volume/trade/liquidity windows, then run approved deterministic delta rules later. A “trending” endpoint is only a discovery hint, never a score or the complete quiet-token search space.
3. **Liquidity event / unusual burst:** scoped BE trades and HE account/program notifications prompt collection; fetch raw transactions to establish event meaning. Reconcile missed intervals over HTTP. Do not infer a drain solely from a USD-valued reserve change.

| Transport | Proposed beta role | Tradeoff / recovery requirement |
|---|---|---|
| Polling | Initial snapshots, new-pool reconciliation, bounded watch universe | Simplest; delay and paging gaps must be measured. Cursor overlaps and duplicate handling required |
| WebSocket | BE bounded trade/price/discovery updates; optional HE account notifications | Efficient event hints; disconnect is not a complete-history receipt. Backfill and detect truncation |
| Webhook | Alternative HE/MO scoped delivery where approved runtime can authenticate/receive it | Delivery retries and ordering require durable dedup; external endpoint abuse/rate budget must be handled |
| gRPC | Defer unless measured completeness/scale needs it | More long-lived runtime/bandwidth/operations; not justified merely for subsecond marketing |

Recommend REST polling/reconciliation first, with a small set of WS subscriptions only where a supervised worker runtime has been approved. Do not put permanent socket loops in an ordinary request handler or assume an existing Next.js deployment provides long-lived workers. Scheduler/runtime choice is still a practical implementation prerequisite, not a new microservice/queue decision. PostgreSQL remains durable authority; no Redis/Kafka.

### One candidate's proposed collection flow

```text
BE discovery / bounded refresh (+ CG coverage check)
  → HE canonical mint/program/slot verification
  → BE pool-scoped market observations (+ CG comparable verification)
  → HE pool/authority/supply state and raw event references
  → HE owner census + local evidence-backed exclusions
  → BE/HE trades, transfers, route/actor reconstruction
  → local historical windows, completeness and disagreement assessment
  → exact normalized observations + authoritative sealed manifest
  → existing durable Fast Lane work, fencing, evidence, human review
```

Each arrow requires scope/precision/time validation before later implementation. Bound per-candidate fan-out, page count, retry budget, concurrency and spend. Exhausted budget is UNAVAILABLE/INCOMPLETE, not an incomplete list presented as complete. Prioritize acquisition through an approved noncommercial policy, not paid placement.

Preserve canonical token/event identity and source-specific receipts. The same chain event from two vendors is one underlying event with two provenance observations, not two trades; conflicting content under the same source identity is quarantined. Persist checkpoints only with accepted ingestion. Reconnect/backfill may redeliver events; exactly-once network delivery is not assumed.

## 9. Cross-provider conflicts and direct-chain verification

No fixed disagreement percentage, price tolerance, freshness duration or vendor precedence is approved here. Proposed precedence is **capability-specific evidence authority**, conditional on later versioned policy approval.

Workflow: retain both observations → compare chain/token/pool/quote/window/finality/units/available-at time → determine whether they measure the same thing → inspect source ancestry and raw references → reproduce if possible → record resolution or unresolved disagreement → seal only eligible inputs. Do not average away a conflict, choose the larger value, or silently select the source that yields PASS.

| Example (illustrative, not thresholds) | Response |
|---|---|
| BE liquidity $250k, CG $248k | Could reflect snapshot/quote timing; not automatically “consistent.” Align pool set/time and reproduce before classifying |
| BE liquidity $250k, CG $1.4M | Compare total-vs-pool, duplicate routes, quote valuation, inactive liquidity and update lag; unresolved required liquidity => INCOMPLETE |
| BE security says no mint control, HE decoded account shows authority | Verify program/slot/extension semantics through QN. Raw supported state wins only under approved authority policy; freeze conflicting derived label |
| BE holder count differs from HE census | Compare accounts vs owners, zero balances, vault exclusions, snapshot completion and index lag; do not infer manipulation |
| CG market cap null, BE has a market cap | Null is not zero. Investigate supply denominator; FDV must not silently replace market cap |
| BQ curated volume differs from BE raw trades | Filtered vs unfiltered or route/quote scopes may differ; do not force equality or use a filtered set to prove no wash-like activity |
| Two RPCs disagree on slot/state | Compare commitment, forks and lag; query compatible context. Freshest retrieval alone is not authority |

Direct verification is most valuable for mint identity/decimals/supply, mint/freeze/extensions, program upgrade authority, owner/account relationships, pool/vault identity, creator/initialization transactions, selected transfers and material liquidity/control changes. Use HE for ordinary reads and QN for independent samples or disputes; confirm genuinely independent transport/indexing infrastructure. Verify every newly admitted control/program type, not every unchanged display quote twice.

Use [Solana getAccountInfo](https://solana.com/docs/rpc/http/getaccountinfo), [getTokenSupply](https://solana.com/docs/rpc/http/gettokensupply), [getTokenLargestAccounts](https://solana.com/docs/rpc/http/gettokenlargestaccounts) and [commitment semantics](https://solana.com/docs/rpc) as chain-interface references. Largest accounts are not unique owners; raw token units and UI floats are not interchangeable. A read at a minimum context slot is not automatically a historical snapshot at an exact chosen slot. Coherent holder/pool snapshots need an explicitly tested acquisition method.

Cost control: cache proven slow-changing identity with invalidation; re-read mutable authority/state for eligible runs; use event-triggered targeted verification and sampled market reconciliation. Exact cadence/finality/staleness policy remains undecided. No transaction simulation, construction or execution route is needed for the read-only depth requirement.

## 10. History and retention architecture

Provider history is an acquisition opportunity, not Radar's replay system. “Full archive” transactions do not imply historical account state, all decoders, all wallet owners, all delisted tokens or all fields. Earliest history below is the **documented offered floor**, not guaranteed availability for each token.

| Provider | Token/control/creator history | OHLCV / trades | Liquidity / holders / wallet history | What Radar must retain |
|---|---|---|---|---|
| BE | Mint/burn/security surfaces; complete prior authority history UNKNOWN | OHLCV and trade APIs; universal earliest floor UNKNOWN | Liquidity candles from 2024-01-01; holder/tag history endpoint-dependent; no proven old owner census | Exact accepted snapshots, scoped events, source time, definitions, gaps and revisions |
| HE | Raw/archive transactions + indexed queries; oldest complete query coverage verify | Raw swaps can be decoded; no turnkey market-candle authority | Current accounts/DAS; reconstructing old state requires retained events/baselines; wallet token-account scope important | Raw-unit decoded facts, account/slot reference, owner baselines and changes |
| CG/GT | Metadata and pool tracking history, not full authority history | Basic six-month pool OHLCV; Analyst+ as far as Sep 2021 if tracked; trade-range earliest UNKNOWN | Holder count chart beta, not balance census; historical reserve state UNKNOWN | Accepted market snapshots/candles/coverage; avoid relying on later provider backfills |
| DS | Pair-created time/current summaries, not a historical ledger | Reviewed public API has no full candle/trade history | No qualified holder/liquidity-event history | Only licensed context snapshots; not mandatory replay source |
| BQ | Historical raw instructions severely limited; archive/export product-specific | Mid-2024 relevant archive aggregates, minute candles Oct 2024; recent raw/curated windows differ | Pool state recent only; old transfers/export and balances-derived-from-transfers need entitlement; Solana holder add-on absent | Raw referenced events if licensed, query/dataset/version, coverage receipt |
| QN | RPC archive advertised; exact oldest/protocol completeness UNKNOWN | Derive from transactions with supported decoder | Historical arbitrary pool/account/holder state not established | Same chain evidence/baselines as HE |
| SH | Index/RPC access; earliest complete history UNKNOWN | Query/export and retention UNKNOWN per selected service | Useful current pool state; complete historical holder/tick state UNKNOWN | Same structured accepted state plus decoder identity |
| MO | Swap/date/history surfaces; earliest floor UNKNOWN | Price/OHLC and cursor swaps; no universal depth guarantee | Full owner census/old pool state UNKNOWN | Accepted events/market observations + coverage/definition |

From the first approved shadow-collection day, retain licensed normalized observations; source event/state/received/available-at timestamps; raw integer+scale evidence; canonical event references and scoped pool/trade identities; owner census completeness and evidence-backed exclusions; selected pool/authority snapshots; derived window recipes; decoder/source versions; conflicts, outages and corrections; method inputs and frozen hashes. Preserve both original as-known and later corrected knowledge. Retain only bounded sanitized raw references/material necessary for replay and allowed by contract, not arbitrary full responses or sensitive metadata.

Retention durations, raw archive storage, deletion obligations and export rights remain decisions. Do not create tables here or assume existing scalar observations can hold arbitrary series. Establish a cold-start baseline requirement: absent past windows => INCOMPLETE until enough verified history is available; never fabricate pre-launch history. Backtests must avoid survivor-only token lists and future labels leaking into earlier observations.

## 11. Cost/rate model with explicit assumptions

These are **procurement scenarios, not approved freshness settings, monitored-universe promises or a total project quote**. Month = 30 days = 2,592,000 seconds. Cost depends on pages, pools, routes, historical backfill and messages, not token count alone. Persist actual per-endpoint consumption before selecting a long-term tier.

For `N` tokens, sampling interval `T` seconds, `k` calls/token/sample and batch factor `b`: calls/month = `N × 2,592,000 × k / (T × b)`. CU = sum of calls × endpoint CU; multiply dynamic history/depth charges as documented. Average RPS is calls/2,592,000; burst limits still apply. Below, `b=1` conservatively; batching helps only where identical semantics are supported.

| Scenario | Universe and sample assumption | Per-token market calls, k=2–4 | Average market RPS | Proposed use |
|---|---|---|---|---|
| DEVELOPMENT | N=10–30; T=900–3,600 sec | 14,400–345,600/month | 0.006–0.133 | Payload/history experiments; never a freshness-valid production evaluation |
| BETA | N=100–300; T=300–900 sec | 576,000–10,368,000/month | 0.22–4 | Bounded shadow universe, selective deeper collection; not every Solana token |
| SCALE | N=1,000–5,000; T=60–300 sec | 17.28M–864M/month | 6.7–333 | Demonstrates why naive full-universe polling becomes expensive |

### Metered examples and unknowns

- One BE price call/sample at documented 3 CU costs **21,600–259,200 CU development**, **864,000–7,776,000 beta**, **25.92M–648M scale**. This is only price, not the full market-call table. Other endpoint CU and WS message costs cannot be guessed from price's 3 CU.
- One BE pool-liquidity-history call at the documented 20-CU base is not necessarily 20 CU after depth/lookback multipliers. If used once/sample with one pool/token, the **base-only** beta load would be **5.76M–51.84M CU**, before multipliers. This argues for targeted history/backfill, not blindly calling historical candles every refresh.
- Illustrative HE baseline per sample: **3 standard RPC calls + 1 DAS call = 13 credits**, before large-method exceptions/additional pages. Same ranges produce **93,600–1,123,200 development**, **3,744,000–33,696,000 beta**, **112.32M–2.808B scale**. This is not a full holder census or trade-history budget.
- Holder cost depends on `ceil(accounts/1000)` DAS pages per mint census (where that page size is supported), plus owner dedup and consistency checks. Hundreds of thousands of accounts or many pool-state reads invalidate a “one call/token” assumption.
- CG verifier scenario: **1 call/token every 1–6 hours**, chosen only for cost illustration, yields **1,200–21,600 calls development**, **12,000–216,000 beta**, **120,000–3.6M scale**. History backfills and extra pools add calls. That cadence is not proposed as sufficient for VERY FRESH verification.
- Discovery polling at 1–5 minutes would add **8,640–43,200 calls/month per one-page feed**, before paging/reconciliation. Again this is a cost sensitivity, not a freshness approval.
- Streaming depends on messages/bytes: HE charge formula from section 4.1; BE message/CU quote UNKNOWN. BQ concurrent subscriptions consume stream-minutes and bytes: one continuously active stream is **43,200 stream-minutes/month**, before messages/egress. Never compare connection caps alone.

### Estimated spend envelopes

| Profile | Provisional subscription and metering estimate | What is NOT included / decision |
|---|---|---|
| DEVELOPMENT | BE Lite $39 + HE Free/Developer $0–49 + GT public or CG Basic/Analyst $0/35/129 ⇒ **$39–217/month base**. Example loads can exceed free HE; Premium WS adds cost if explicitly tested | Trial restrictions, history entitlements, other CU, storage, engineering. Free access is not launch approval |
| BETA minimum A | BE Premium $199 + HE Developer $49 ⇒ **$248/month base**. HE illustrative excess at 33.696M vs 10M adds about **$118.48** at $5/M | BE other endpoints/WS, full holder history, tax and hosting unknown; not an all-in $248 promise |
| BETA recommended B | A + CG Analyst $129 ⇒ **$377/month base**; same HE sensitivity gives **$377–495.48 before unknowns**. Basic instead would be $283 base but loses required evaluation conveniences/history depth | BE 20M CU may be insufficient when depth/history pages are frequent. At 30M REST CU, Premium overage example is $99; WS priced separately |
| SCALE | Example BE Business $499 + HE Business $499 + CG Lite $499 ⇒ **$1,497/month base**, not an adequate capacity guarantee. HE example excess above 100M is about **$61.60–13,540**; the market-call maximum exceeds cited shared plan RPS | Quote custom/batched/streamed acquisition; avoid a false finite all-in range without real messages/pages. Plan promotion and burst limits matter |

For Option C, BQ Pro adds **$99/month base**; example totals with Option B become **$476 current-window only**, **$776 with the $300/month OHLCV archive**, or **$1,276 with both $300 OHLCV and $500 transfer archives**, before usage. These are not proof those packages contain required historical counterparties/pool state. Do not mix discounted annual archive rates into monthly quotes. Query weights/exports remain UNKNOWN until measured.

Set an approved spend cap, request/stream quotas, backfill budget and overage alert/stop policy before integration. Benchmarks must measure bytes, returned rows, dynamic credits, duplicates and retry amplification, not just successful calls. A rate-limit response is a data-availability condition; do not raise subscriptions automatically or conceal missing windows.

## 12. Stack alternatives and proposed beta ownership

| Option | Coverage and verification | Complexity / lock-in | Cost and recommendation |
|---|---|---|---|
| A — BE + HE | Market/discovery + chain/account/history primitives. Raw-chain cross-checks, but no separately contracted market verifier. Mandatory derivation/history gaps remain | Lowest acquisition footprint; dependence on BE market recipes and HE indexed availability | Smallest credible pilot. $248 proposed streaming-capable base; approve only as restricted nonpublic collection until quality gates pass |
| B — A + CG | Adds separate market comparison, candles/range-history and gap detection; GT is not another independent source | Moderate; still requires equivalent definitions and upstream ancestry checks | **Recommended restricted beta**. $377 proposed base with Analyst; Basic alternative if advanced history not required |
| C — B + BQ | Adds targeted raw/indexed trade-flow investigation and archive/export options; not universal old Solana pool/owner truth | Higher query/dataset/retention complexity; filtered-vs-raw risk | Later if empirical corpus or indexing economics demonstrates need; subscription alone does not close all gaps |

Proposed beta responsibilities and failure behavior:

| Provider | Proposed tier / why necessary | Owns acquisition | Verifies | Unavailable behavior |
|---|---|---|---|---|
| Birdeye | Premium $199 candidate for WS + market APIs; confirm endpoints | Listing/pair hints, scoped prices/market/trades, selected market history | RPC-derived market samples through its independent index, never chain authority | Use CG only for qualified equivalent metrics; otherwise required signals UNAVAILABLE/INCOMPLETE |
| Helius | Developer $49 starting candidate; larger plan only for measured quota/gRPC need | Solana identity/state, account census inputs, referenced tx/transfer/pool/control evidence | BE token/pool/event references | Qualified QN fallback if provisioned; otherwise chain-required evaluation stops |
| CoinGecko | Analyst $129 candidate for historical/range/holder evaluation; Basic optional reduction | Secondary market snapshots and historical comparison | BE scope/price/volume/liquidity; holder counts as context | No fabricated agreement. Q03 UNKNOWN; whether a specific run can pass requires the approved mandatory quality contract, not an ad hoc exemption |

No provider owns a Radar score. Radar owns coverage, deterministic transformations, source reconciliation, method versions and immutable evidence. Purchase recommendations do not authorize credentials or live ingestion.

## 13. Security, rights and lock-in

Future provider credentials must be separate server-only secrets per vendor/environment, never `NEXT_PUBLIC_*`, never embedded in client bundles, fixture captures, metadata, browser calls or public Radar projections. Least-privilege read-only products/keys where available. Do not grant transaction/send/wallet features because an SDK bundles them. Set quota/spend controls, rotation/revocation ownership and a tested overlap/recovery procedure. No credentials were added in this phase.

Sanitize URL paths/query strings, request headers, WS connection URLs, provider error payloads and raw responses before logging; prefer bounded error categories and correlation IDs. Reject arbitrary caller-selected provider URLs (SSRF), oversized payloads, unexpected schema and numeric coercion. Webhook signatures/secrets, replay windows and idempotent acceptance need a separately reviewed implementation. Do not expose privileged ingestion through a browser action or give provider tokens database authority. Preserve existing SYSTEM-only RPCs, leases/fences/pause, immutable observations, receipts and publication projections.

Procurement must settle display, derivative-analysis, caching, long-term retention, export, attribution, model-input use if later approved, termination and deletion rights. DS competing-service restriction is an explicit hold. Commercial access and data redistribution are different. Sponsored/boosted/provider affiliate classifications must not influence independent analysis. No provider benchmark or recommendation here is paid placement.

### Fit with existing adapter architecture

Inspected `src/lib/radar/contracts.ts`, `normalization.ts`, `fast-lane.ts` and `methods.ts`. Provider adapters expose capabilities/metrics and historical support; observations carry exact strings plus bounded flat context/provenance. This helps swap **semantically equivalent scalar sources** without changing public Radar or core Fast Lane. It does not already implement chain decoders, census snapshots, rich pool state, historical-window computation, streaming schedulers or production policies.

Current normalization allowlists cannot hold arbitrary vendor structures. Current Fast Lane conservatively conflicts on distinct eligible observation hashes for one metric; two vendor records must not simply be inserted and expected to reconcile. A later approved design must produce one policy-qualified input while retaining disagreement/lineage, or intentionally yield INCOMPLETE. This document does not change that behavior or authorize a schema expansion.

| Lock-in risk | Mitigation requirement for later integration |
|---|---|
| BE token aggregation/behavior tags or CG top-pool recipe | Prefer pool-scoped raw references; version definitions; do not import opaque tags/scores |
| HE DAS/Parsed Events, QN add-ons, SH parsed DeFi | Preserve chain IDs/slots/raw-unit evidence and pinned decoders; parity tests against raw RPC |
| BQ cubes/filters/archive licensing | Record query/schema/dataset and scoped coverage; export permitted evidence; separate filtered and raw universes |
| MO swap interpretation/market metrics | Reconcile raw references and accepted definitions before treating it as a fallback |
| Historical retention and vendor corrections | Retain licensed as-known snapshots, correction lineage and replay inputs locally |
| Provider replacement changes metric semantics | New adapter/metric/method version and shadow validation; not silent continuity in scores |

Switching a vendor need not redesign the observation/public model **if** identical evidence semantics fit it. Where the approved requirements need richer structured contracts, later scoped approval is necessary regardless of vendor. Do not claim the existing scalar adapter makes every provider drop-in compatible.

## 14. Empirical provider acceptance and historical validation

Before live public intelligence, obtain an approved limited dataset/universe and run a provider comparison in nonpublic shadow mode. This task defines that work; it has not performed it.

1. Stratify supported Solana token programs/extensions, pool versions, token ages and activity levels. Include inactive/delisted tokens, organic growth, thin markets, verified harmful events, high-volume failures and ambiguous cases, not just today's popular listings.
2. Collect synchronized comparable observations and raw-reference samples. Record actual availability-at time, lag, index slot, pages/cursors, truncation, 429/outage recovery, duplicates, invalid numerics, quote scope and provider ancestry.
3. Validate exact supply/control/account facts through separate RPC. Reconstruct owner rankings/exclusions and route-aware counts; reproduce depth on supported pool types from retained state, not an executable quote.
4. Test new-token and new-pool discovery separately, quiet-token detection and reconnect gaps. Measure covered event recall within the declared universe and time-to-discovery without defining final product freshness thresholds prematurely.
5. Challenge every mandatory signal with missing/unsupported/stale/conflicting input. Confirm it cannot improve apparent quality or become zero/safe. Require all 30 mandatory-signal acceptance records before claiming normal PASS readiness.
6. Request old samples at the actual desired dates and failed-token cohorts. Check raw trader identity, historical ownership/control/pool state, not only candles. Reject retrospective datasets with irrecoverable look-ahead or unknown survivor selection.
7. Compare coverage, precision loss, disagreement after scope alignment, reproducibility, correction stability, cost per complete candidate/window and recovery time. Separate reliability of data from predictive usefulness of a signal.
8. Evaluate signal quality/risk separation and false-positive/negative behavior with held-out time/token/deployer groups under the approved intelligence requirements. No optimization for future-price profits, trading thresholds or execution outcomes.

Acceptance targets, numeric error tolerances, observation cadence, finality, retry/spend budgets and freshness durations require approval from measured evidence. No arbitrary thresholds are supplied here. A source with many endpoints but unproven lineage/rights fails procurement suitability for the affected mandatory capability.

## 15. Final provider decision table

| Candidate | Recommendation classification | Rationale / condition |
|---|---|---|
| Birdeye | RECOMMENDED NOW | Conditional primary market/discovery evaluation; exact response/coverage/plan/rights gates remain |
| Helius | RECOMMENDED NOW | Conditional chain-state/account/history transport; program decoding and coherent snapshots remain Radar responsibilities |
| CoinGecko Onchain | RECOMMENDED NOW | Conditional independent market/history verifier; choose Analyst vs Basic deliberately. GT public useful for development, not another source |
| DEX Screener | NOT REQUIRED INITIALLY | Tertiary/promotion context only; terms clearance required before production use. Not a scored-data authority |
| Bitquery | RECOMMENDED LATER | Targeted historical/raw-flow investigation if it closes a demonstrated corpus/indexing gap; not full-history panacea |
| QuickNode | FALLBACK | Independent RPC sampling/failover candidate; do not duplicate the full workload without measured benefit |
| Shyft | FALLBACK | Potential pool/indexing/gRPC alternative if proof shows better completeness/cost for the supported universe |
| Moralis | NOT REQUIRED INITIALLY | Credible overlapping market/webhook alternative; no demonstrated unique mandatory gap warranting another subscription |

No candidate is rejected categorically as a company. Opaque provider scores, paid trending and execution-oriented products are **REJECTED FOR CURRENT NEED**, regardless of supplier. Social/news/community licensing remains separate deferred context procurement; no extra vendor catalog or AI choice is added.

## 16. Human go / no-go decisions before integration

1. **Universe:** confirm Solana-only beta and the initially supported token programs/extensions and pool/launch mechanisms. May unsupported assets remain INCOMPLETE rather than appear fully assessed? This must preserve the mandatory-signal contract.
2. **Stack and subscriptions:** approve Option B or a restricted Option A shadow pilot; confirm BE Premium, HE Developer starting point and CG Analyst vs Basic. No purchase was made.
3. **Scale and budget:** target monitored-token/pool universe, candidate admissions/day, historical backfill scope, monthly hard cap and overage approval. Approve operational coverage expectations before translating them into schedules.
4. **Rights:** obtain commercial display/derivation/retention/export terms for selected endpoints. Clear DS use explicitly if desired; otherwise omit it. Confirm upstream independence and provider correction/coverage obligations.
5. **Historical cohort:** required dates/programs and whether to purchase a targeted BQ dataset now or defer. Written confirmation must distinguish raw participants/pool states from candles/aggregate archives.
6. **Gap policy:** approve the supported decoder/snapshot/exclusion/actor-attribution acceptance scope. If a mandatory fact is not supportable, narrow the universe or retain INCOMPLETE; do not quietly downgrade it.
7. **Operations:** approve the scheduler/supervised worker host and quota/failure ownership needed for polling/streams within the modular monolith. No deployment or queue change is authorized by this document.
8. **Credentials:** after provider/rights approval, provision environment-specific read-only credentials through a secure channel and define rotation ownership. Do not paste them into documentation or chat.
9. **Later methodology activation:** approve empirical results and then scoring/freshness/finality/conflict policies in their own phase. Provider integration/shadow collection is not authorization for public scored intelligence. AI remains optional and unselected.

**End state:** provider research and architecture recommendation only. All 31 capabilities, 21 mandatory authority/fallback routes, 30 mandatory signals and 80 candidate IDs are mapped. Unknowns are procurement/acceptance questions, not filled with invented facts. No provider integration, production activation or remote push belongs to this phase.
