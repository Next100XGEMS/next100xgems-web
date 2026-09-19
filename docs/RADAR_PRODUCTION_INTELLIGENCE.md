# Radar Production Intelligence Requirements

Status: production signal-design specification, version 1, 2026-09-20. Documentation only. Software baseline: `9ee3a1b`, with Gate 19G software-foundation sign-off **PASS WITH NON-BLOCKING FINDINGS**. Software approval is not approval of a production intelligence methodology or launch.

This is the source of truth for **what data Radar needs**, before selecting who supplies it. It defines candidate signals, required evidence and vendor-evaluation questions; it does not activate rules, select providers/models, approve scoring, set numeric thresholds, change storage, or authorize deployment. “Required” below is a proposed production-method prerequisite, not a claim that the current evaluator implements it. Any change to these requirements must retain its rationale and version.

Read with [PROJECT_SPEC.md](PROJECT_SPEC.md), [ARCHITECTURE.md](ARCHITECTURE.md), [RADAR_SPEC.md](RADAR_SPEC.md), [RADAR_IMPLEMENTATION_PLAN.md](RADAR_IMPLEMENTATION_PLAN.md), [RADAR_DATABASE.md](RADAR_DATABASE.md), and [ROADMAP.md](ROADMAP.md). Their approved identity, durable work, immutable inputs, evidence, authorization, pause, review and publication contracts remain authoritative. Historical implementation notes in those files describe their named gates, not live provider readiness. No historical decisions are rewritten here.

## 1. Objectives and non-objectives

Radar should surface **early, evidence-supported changes worth investigating**, while making capital-risk exposure and uncertainty more visible than excitement. “Early” means lead time to a defined observable activity/structure event, not a promise of future price appreciation. “Important” means a reproducible change in activity, participation, market structure or risk, relative to a declared baseline and coverage universe.

| Objective | Detect or establish | Do not infer |
|---|---|---|
| Discovery | Newly observed assets/pools and previously quiet assets becoming active; distinguish creation from first coverage | First seen by one source means newly created; obscurity means opportunity |
| Quality | Depth, usable liquidity, distribution, token controls and evidence-supported participation | Volume, holder count or a revoked authority alone means quality |
| Momentum | Comparable-window changes in transactions, participants, volume, liquidity and holders | Acceleration predicts returns or has an approved cutoff already |
| Risk | Concentration, fragile liquidity, transfer/authority constraints, suspicious patterns and verifiable creator actions | A risk indicator proves fraud or absence of indicators proves safety |
| Freshness | Whether each observation and its baseline remain usable at evaluation time | Recent retrieval refreshes an old source observation |
| Explainability/replay | Why this asset appeared, exact inputs, missingness, computation and method version | A narrative can replace missing facts or revise historical evidence |

Priority order: evidence quality → capital-risk awareness → early meaningful activity → manipulation detection → freshness → explainability → replayability. This is a product ordering, **not score weights**. Fast Lane must remain useful without AI. Research may explain findings; commercial affiliation must never influence discovery priority, screening, score, risk or publication ranking.

Radar is not a buy signal, auto-trader, price predictor, volume-chasing pump detector or KOL sentiment bot. No wallets, private keys, transaction construction/signing/submission, execution quotes, orders, positions, PnL or trading simulation are proposed. Depth analytics below are read-only arithmetic over observed market state, not executable routes or transactions.

## 2. Inventory contract and reading key

The inventory contains **80 candidate signals in 10 categories**: 30 must-have, 34 high-value, 9 optional, 6 Deep-Lane-only and 1 excluded-for-now. IDs identify requirements, not new database columns or currently registered metrics. Some rows are deliberately coherent bundles (for example authority type/address/state); arbitrary splitting must not inflate coverage or score influence.

Each row plus the explicit shared definitions in this section forms a complete signal record. The table gives name/category, exact meaning/use, raw inputs, normalized representation/type, capture profile, freshness, manipulation/false-positive risks, requirement/priority, lane, evidence tier, current support and capabilities. No omitted field is an implicit approval.

### Representation and authoritative numeric types

- `ID`: canonical chain/address/UUID or bounded identifier; not numeric. Token symbol/name are display only.
- `ENUM`: closed typed state plus reason and evidence reference; not a fabricated numeric boolean. `NONE` is a positively verified authority state, never a synonym for missing.
- `I`: exact nonnegative integral decimal string → bounded PostgreSQL integral `numeric` (not JS Number). Raw amounts retain token decimals; counts retain counting unit.
- `D`: exact finite decimal string → PostgreSQL `numeric`, with unit/quote and calculation/rounding version. Signed deltas allowed only for a defined delta metric. No NaN/Infinity or implicit USD conversion.
- `R`: exact numerator/denominator strings plus named denominator universe; a derived decimal requires a later rounding policy. A zero/unknown denominator produces UNKNOWN, not infinity or a default zero.
- `TS`: source timestamp with precision/uncertainty, plus block/slot/event order where applicable; UTC ISO text → `timestamptz`. Missing block time is not replaced by receipt time.
- `REC` / `SER`: bounded typed record / ordered series of the above types, with scope, source references and versioned calculation. These are **requirements**, not permission to put nested data in today's scalar observation envelope.
- `TXT`: bounded attributed source excerpt/summary and reference; no arbitrary HTML, prompts, headers, credentials or private messages.

All monetary, ratio, supply, balance, notional, change and count fields inherit exact string transport. Time windows, pool sets, valuation currency, native/wrapped-asset treatment, fees, exclusions and sample completeness are part of identity. Formatting never feeds calculations.

### Capture profiles: chain availability, timestamps, determinism and verification

`S` means Solana; `E` means one separately approved EVM chain; neither implies all assets/protocols are supported. Every profile also requires received time, source/adapter identity and source/capture version. Freshness labels are defined in section 7.

| Profile | Expected availability and required source timestamp | Deterministic? | Provider-derived? | Directly on-chain verifiable? |
|---|---|---|---|---|
| CS | S/E chain state, subject to program/contract support; state block/slot + source observation time + commitment/finality | Yes, for decoded state under pinned decoder | Transport/indexer may supply; decode must be reproducible | Yes for supported state at identified block; not real-world intent |
| CE | S/E decoded event history with archival coverage; event block/slot, transaction/instruction/log identity and occurrence time | Yes for facts and declared counts | Indexing usually needed; not a black-box label | Yes with complete referenced history; coverage must be proven |
| MK | Supported on-chain venues on S/E; pool snapshot/trade time, pool identity and window start/end | Yes for declared pool/price formulas | Usually aggregate/indexer-derived | Underlying trades/state yes; aggregate requires recipe and universe |
| HD | S/E owner-resolved balance snapshots; snapshot block/time plus comparison snapshot when used | Yes for defined owner/account/exclusion rules | Indexer typically required | Underlying balances yes; economic beneficial owner is not proven |
| DR | S/E where all referenced inputs exist; every input time plus window bounds and pinned evaluation time | Yes only after calculation/baseline is versioned | May be locally computed; opaque provider result not sufficient | Inputs may be verified; interpretation is not a chain fact |
| CX | S/E attribution/history where available; event times, label observation time and label validity interval | Facts yes; identity/intent interpretation no | Attribution/indexing often required | Transfers/actions yes; ownership relationships usually only partial |
| OF | Chain-independent but token identity must be linked; original publication/edit time + capture time + coverage interval | Extraction/counts possibly; narrative no | Platform/indexer-derived | No; a hash anchors a capture, not its truth |
| QA | All supported sources; each source observed/received time, coverage window and evaluation time | Yes for specified audit/quality calculation | Derived from supplied lineage/measurements | Underlying references sometimes; source completeness not proven by a hash |

### Requirement, lane, evidence and implementation codes

| Code | Meaning |
|---|---|
| M / P0 | MUST HAVE for proposed normal production PASS, scoped to supported chain/venue; missing/unusable required data → INCOMPLETE |
| H / P1 | HIGH VALUE; omission disclosed, may become mandatory only under a separately approved method |
| O / P2 | OPTIONAL enrichment; missing does not improve any safety/quality conclusion |
| D / P2 | DEEP LANE ONLY contextual use; never substitutes for mandatory deterministic data |
| X / P3 | EXCLUDED FOR NOW from production evaluation; research feasibility only |
| F | FAST LANE eligible objective fact/calculation; no AI dependency |
| B | BOTH: deterministic measurement in Fast Lane and separately labeled interpretation in Deep Lane |
| L | DEEP LANE only; source capture may be deterministic, analytical use is contextual |
| N | NEITHER lane approved now |
| A | Chain-verifiable fact tier; may support VERIFIED_DATA only after verification |
| B-tier | Reproducible derived measurement tier; may support VERIFIED_DATA for the measured fact, not implied quality |
| C | Heuristic tier; at most STRONG_SIGNAL after empirical validation, otherwise UNKNOWN |
| D-tier | Off-chain/context tier; attributed context or AI_INFERENCE if model synthesized, never model-derived VERIFIED_DATA |
| ID-base | Canonical identity registry exists; live verification/chain decoder still absent |
| NUM-base | Exact scalar observation transport/comparison exists; live acquisition and signal-specific calculation/verification absent |
| STRUCT-gap | Typed nonnumeric/series/relationship acquisition and safe persistence mapping require a future reviewed contract; not implemented |
| DERIVE-gap | Inputs may fit numeric primitives, but this calculation/baseline is not implemented |
| CTX-base | Bounded Deep Lane evidence input/output and durable receipt framework exists; real context capture/model/method absent |

In row policy cells, `M/F/A/ID-base` means M/P0, Fast Lane, tier A, ID-base. `B-tier` is a reliability code, while lane `B` means both. Production priority is inherited explicitly from M/H/O/D/X above.

### Missingness inherited by every signal

Every row must report AVAILABLE, UNKNOWN, UNAVAILABLE, UNSUPPORTED or STALE with a bounded reason. UNKNOWN covers unresolved identity, ambiguity, incomplete history or disagreement; UNAVAILABLE covers temporary acquisition failure; UNSUPPORTED covers missing source/chain/decoder capability; STALE covers aged data under a later approved policy. No missing → zero, false, safe or healthy conversion. A verified absence is an explicit fact, not UNKNOWN.

Non-AVAILABLE observations carry no current numeric value under the existing DB matrix. A last-known-good value remains a separate immutable historical observation with its original timestamp, not a value smuggled into a STALE row. M signals force INCOMPLETE when unusable; optional gaps stay visible. Unsupported mandatory capability makes that asset/venue outside the normal-PASS universe, not an exemption. Non-applicability requires an approved chain profile and affirmative evidence, not a provider's unsupported response.

## 3. Candidate signal inventory

### 3.1 Token identity and contract controls — 12 signals

| ID — name | Exact meaning and reason | Raw input → normalized representation/type | Capture | Freshness | Manipulation/false-positive caveat | Policy | Capabilities |
|---|---|---|---|---|---|---|---|
| I01 — Canonical chain | Network namespace plus specific network; prevents cross-chain identity collision | Chain configuration/genesis evidence → chain ID + network reference, ID | CS | SLOW-CHANGING | A provider's display chain label can be wrong; testnet/mainnet distinct | M/F/A/ID-base | TOKEN_IDENTITY |
| I02 — Contract/mint identity | Exact fungible asset address reconciled to registry UUID; never symbol matching | Mint/account or contract evidence → chain/address/UUID, ID | CS | SLOW-CHANGING | Counterfeit symbols, case corruption and wrapped copies; program owner is not token owner | M/F/A/ID-base | TOKEN_IDENTITY |
| I03 — Creation/deployment age | First verified initialization/deployment time; supports honest “new” claims | Initialization/deployment transaction → event reference + TS + age at evaluation, D seconds | CE | SLOW-CHANGING | Source first-seen and pool opening are not creation; archive gaps leave age UNKNOWN | H/F/A/STRUCT-gap | TOKEN_IDENTITY, WALLET_HISTORY |
| I04 — Creator/deployer identities | Distinguish initializer, fee payer, factory, mint authority and claimed creator | Creation instructions/call trace + role evidence → role-address list, REC | CX | MODERATE | Launchpad/factory/relayer need not be beneficial creator; role is not intent | H/B/A/STRUCT-gap | TOKEN_CREATOR |
| I05 — Token decimals | Supported program/contract unit scale used for every amount | Mint state or documented contract read → decimals, I | CS | SLOW-CHANGING | Incorrect decimals corrupt all values; unsupported/mutable implementations need fresh decode | M/F/A/NUM-base | TOKEN_IDENTITY |
| I06 — Total supply | Outstanding raw issuance at identified state; not circulating float | Mint/contract supply → raw I + scale + token amount D | CS | FRESH | Mint/burn/rebase effects; stale supply contaminates ratios and FDV | M/F/A/NUM-base | TOKEN_SUPPLY |
| I07 — Objective circulating supply | Supply minus explicitly evidenced noncirculating balances under a disclosed rule | I06 + balances + vesting/lock classifications → eligible supply and exclusion ledger, I/REC | HD | FRESH | Treasury intent/unlocked ownership rarely prove circulation; provider estimate labeled, not authoritative | O/B/B-tier/STRUCT-gap | TOKEN_SUPPLY, HOLDER_BALANCES, ADDRESS_LABELS |
| I08 — Mint authority | Current ability and controlling authority to increase supply where exposed | State/control implementation → authority state/address/scope, ENUM/ID | CS | FRESH | Revocation does not remove other powers; EVM mint controls are implementation-specific | M/F/A/STRUCT-gap | TOKEN_AUTHORITIES |
| I09 — Freeze/transfer controls | Freeze, pause, blacklist, transfer-fee/hook/delegate restrictions for supported token type | State, extensions or verified control logic → typed powers/parameters/holders, REC | CS | FRESH | Unknown extension/implementation is not unrestricted; absence of one control proves little | M/F/A/STRUCT-gap | TOKEN_AUTHORITIES |
| I10 — Upgradeability | Applicable program/implementation mutability and authority, distinct from token holder controls | Program/proxy/implementation evidence → upgrade mechanism/address/state, REC | CS | FRESH | No recognized proxy slot does not prove immutable; standard shared program differs from custom code | M/F/A/STRUCT-gap | TOKEN_AUTHORITIES |
| I11 — Token standard and authority map | Supported standard/program plus complete known authority roles, including metadata controls | Program ID/bytecode/interface + state → standard/version and role-state map, REC | CS | FRESH | “Owner renounced” is not all authority revoked; custom behavior may be undecodable | M/F/A/STRUCT-gap | TOKEN_IDENTITY, TOKEN_AUTHORITIES |
| I12 — Metadata/source provenance | Whether name/metadata/code claims match the actual asset and a reproducible source | Metadata records + authority + content/code references → attributed verification record, REC/TXT | CX | MODERATE | Verification/badges do not endorse safety; URI content can change or impersonate others | H/B/B-tier/STRUCT-gap | TOKEN_METADATA |

### 3.2 Discovery and baseline context — 3 signals

| ID — name | Exact meaning and reason | Raw input → normalized representation/type | Capture | Freshness | Manipulation/false-positive caveat | Policy | Capabilities |
|---|---|---|---|---|---|---|---|
| D01 — Discovery event | Earliest observation within our declared universe, tied to mint/pool/trade source event | Stable event ID/block/source scope → canonical event + first-seen TS, REC | CE | VERY FRESH | Spam mints and provider onboarding flood discovery; first-seen is not birth | M/F/A/STRUCT-gap | DISCOVERY_EVENTS |
| D02 — Historical baseline availability | Comparable past coverage for the claimed activity change, including asset age/censoring | Coverage/checkpoints + prior windows → baseline intervals, counts and missing intervals, REC/I | QA | FRESH | Backfilled future data creates false early detection; short history cannot be called normal | M/F/B-tier/STRUCT-gap | HISTORICAL_WINDOWS, COVERAGE_LINEAGE |
| D03 — Meaningful acceleration candidate | Joint change in activity/participation with quality context; investigation trigger only | M11/M12/A01/A02/H02 + baseline → versioned changes and reasons, REC/D | DR | VERY FRESH | Launch spikes/arbitrage may be transient; no “important” cutoff approved | H/B/C/DERIVE-gap | HISTORICAL_WINDOWS, TRADES, LIQUIDITY |

### 3.3 Market structure and momentum — 12 signals

| ID — name | Exact meaning and reason | Raw input → normalized representation/type | Capture | Freshness | Manipulation/false-positive caveat | Policy | Capabilities |
|---|---|---|---|---|---|---|---|
| M01 — Referenced price | Defined observed trade/pool price in explicit quote unit, not a universal true price | Eligible trade/pool snapshot + quote conversion → price D + pair/time/recipe | MK | VERY FRESH | Dust trades, manipulated quotes and thin pools distort spot price; no execution guarantee | M/F/B-tier/NUM-base | PRICE, MARKET_PAIR, QUOTE_CONTEXT |
| M02 — Market capitalization | Price × objectively defined circulating supply, with aligned times | M01/I07 → D valuation + input references | DR | VERY FRESH | Provider headline cap may use total supply or unsupported float; UNKNOWN if supply basis unresolved | O/B/B-tier/DERIVE-gap | PRICE, TOKEN_SUPPLY |
| M03 — Fully diluted valuation | Price × explicitly named diluted-supply basis; record whether current total or verified maximum | M01 + supply definition → D valuation and basis ID | DR | VERY FRESH | Infinite/unknown future issuance makes maximum-basis FDV undefined; never equate with market cap | H/B/B-tier/DERIVE-gap | PRICE, TOKEN_SUPPLY |
| M04 — Liquidity by pool | Underlying reserves/positions at a block, separately from marked valuation and usable depth | Pool reserve/position snapshot → per-asset raw I/scale, D valuation and pool ID | MK | VERY FRESH | Self-priced token reserve inflates TVL; inactive range reserves may not support nearby depth | M/F/B-tier/STRUCT-gap | POOL_STATE, LIQUIDITY |
| M05 — Venue/pair identity and age | Verified pool program/factory, assets, fee model, first initialization and support status | Pool registry + creation/state → ID/TS/ENUM and decoder version | CE | FRESH | Fake pools/venues and duplicate representations; known venue does not certify token | M/F/A/STRUCT-gap | MARKET_PAIR, POOL_STATE |
| M06 — Quote asset quality context | Quote identity, reference-price lineage and observed conversion consistency | Quote state/prices + supported asset mapping → ID, D conversion/deviation, coverage REC | MK | VERY FRESH | Peg/name is not a guarantee; circular token/quote prices cannot verify each other | M/B/B-tier/STRUCT-gap | QUOTE_CONTEXT, PRICE |
| M07 — Volume | Deduplicated executed swap notional by pair and closed window, with counting convention | Decoded swaps/amounts + contemporaneous quote conversion → D quote notional and window | MK | VERY FRESH | Wash trades, route-leg duplication and fee-on-transfer semantics inflate provider totals | M/F/B-tier/NUM-base | TRADES, VOLUME, HISTORICAL_WINDOWS |
| M08 — Transaction/trade counts | Separate successful transaction count from swap-event count for declared scope | Unique transaction IDs and decoded swaps → two I counts with completeness | CE | VERY FRESH | One transaction may contain many swaps; failed transactions are not trades | M/F/B-tier/NUM-base | TRADES |
| M09 — Buy/sell composition | Token-perspective classified swaps, unknown direction retained; imbalance is not net capital entry | Decoded asset flows/route endpoints → side counts/notional D/I and imbalance R | MK | VERY FRESH | Aggregators/MEV/multi-hop routes obscure initiator and direction; every trade has two sides | H/B/B-tier/DERIVE-gap | TRADES, MARKET_PAIR |
| M10 — Price change windows | Signed relative/absolute change between like reference prices over named windows | M01 history → D delta and R relative change with window IDs | DR | VERY FRESH | Tiny starting price, gaps, rebases or changing pairs can manufacture extreme changes | H/F/B-tier/DERIVE-gap | PRICE, HISTORICAL_WINDOWS |
| M11 — Volume acceleration | Change in volume rate between comparable windows, not cumulative-volume growth | M07 + window durations/baseline → D rate/delta and R comparison | DR | VERY FRESH | Wash bursts, unequal windows and denominator near zero; missing baseline stays UNKNOWN | H/B/C/DERIVE-gap | VOLUME, HISTORICAL_WINDOWS |
| M12 — Liquidity acceleration | Change/rate change in reserve and depth measures; separate price marking from deposits | M04/L05/L08 history → per-asset D deltas/rates and valuation decomposition | DR | VERY FRESH | Mark-to-market appreciation is not added capital; range moves can change usable depth | H/B/B-tier/DERIVE-gap | LIQUIDITY, POOL_STATE, HISTORICAL_WINDOWS |

### 3.4 Holders and distribution — 9 signals

| ID — name | Exact meaning and reason | Raw input → normalized representation/type | Capture | Freshness | Manipulation/false-positive caveat | Policy | Capabilities |
|---|---|---|---|---|---|---|---|
| H01 — Holder count | Distinct resolved owners with positive balances under declared exclusions; also retain account count | Complete token-account/balance snapshot + owner mapping → I owners/accounts, coverage | HD | FRESH | Accounts ≠ people; custodians pool users; dust/airdrops/Sybil owners inflate counts | M/F/B-tier/NUM-base | HOLDER_BALANCES, ADDRESS_LABELS |
| H02 — Holder growth | New/removed owner counts and net change across like snapshots | H01 snapshots + unchanged counting policy → I additions/removals, signed D net | HD | FRESH | New source coverage or mass dust creates apparent adoption | H/B/B-tier/DERIVE-gap | HOLDER_BALANCES, HISTORICAL_WINDOWS |
| H03 — Top 10 concentration | Sum of largest 10 resolved-owner balances divided by declared supply; raw and adjusted separately | Ranked owner balances + I06/H07 → R, ranked references | HD | FRESH | Address splitting hides control; custodians/LPs create benign concentration; not scam proof | M/B/B-tier/DERIVE-gap | TOP_HOLDERS, HOLDER_BALANCES, ADDRESS_LABELS |
| H04 — Top 20 concentration | Same definition as H03 over 20 owners, same snapshot/denominator | Owner distribution + I06/H07 → R and covered owner count I | HD | FRESH | A largest-account endpoint is not necessarily largest owners or exhaustive denominator | H/B/B-tier/DERIVE-gap | TOP_HOLDERS, HOLDER_BALANCES, ADDRESS_LABELS |
| H05 — Top 50 concentration | Same definition over 50 owners; broader distribution view | Full indexed owner distribution + I06/H07 → R and coverage | HD | FRESH | Cannot extrapolate 50 owners from 20 token accounts; truncated data is UNKNOWN | H/B/B-tier/DERIVE-gap | TOP_HOLDERS, HOLDER_BALANCES, ADDRESS_LABELS |
| H06 — Creator allocation | Directly attributed creator balances and share, without guessing linked ownership | I04 + balances + attribution evidence → raw I + R + attribution class | CX | FRESH | Factory attribution and unproven wallet links can falsely accuse; transferred allocation differs from holdings | H/B/B-tier/STRUCT-gap | TOKEN_CREATOR, HOLDER_BALANCES |
| H07 — Exclusion ledger | Explicit known pool/burn/treasury/custody categories and rationale at snapshot time | Verified program/address labels + balances → versioned REC, raw and adjusted denominators I | HD | MODERATE | Treasury is not automatically excluded; apparent burn address is not verified burn; retain raw view | M/F/B-tier/STRUCT-gap | ADDRESS_LABELS, HOLDER_BALANCES, POOL_STATE |
| H08 — New-wallet concentration | Share held by wallets newly observed within a declared history scope | Wallet first-seen history + balances → R and coverage bounds | CX | FRESH | New to source ≠ newly created; fresh custodial addresses legitimate; never equate to bots | O/B/C/DERIVE-gap | WALLET_HISTORY, HOLDER_BALANCES |
| H09 — Distribution change | Per-cohort/top-owner share changes across aligned snapshots | H03–H07 history → signed D share deltas + owner churn I | HD | FRESH | Migration/custody reorganization/label revisions resemble dumping or dispersal | H/B/B-tier/DERIVE-gap | HOLDER_BALANCES, HISTORICAL_WINDOWS |

### 3.5 Liquidity quality — 8 signals

| ID — name | Exact meaning and reason | Raw input → normalized representation/type | Capture | Freshness | Manipulation/false-positive caveat | Policy | Capabilities |
|---|---|---|---|---|---|---|---|
| L01 — Meaningful liquidity universe | Reserves/valuation in identified supported pools; eligible and excluded totals separately, never assumed all-chain total | M04–M06 + pool coverage/dedup policy → per-asset I/D and scope REC | MK | VERY FRESH | Duplicate pools, circular quotes and synthetic reserves inflate totals; “meaningful” recipe still requires approval | M/B/B-tier/DERIVE-gap | LIQUIDITY, POOL_STATE, QUOTE_CONTEXT |
| L02 — Pool concentration | Share of observed usable liquidity/depth in largest pools and venues | L01/L08 → R by pool/venue under common valuation | DR | VERY FRESH | Largest TVL pool may not supply largest usable depth; concentration is fragility, not fraud | H/B/B-tier/DERIVE-gap | LIQUIDITY, MARKET_DEPTH |
| L03 — LP lock/burn state | Verified custody/lock expiry/withdrawal rights of LP shares or positions; locked fraction denominator explicit | Lock contract/program state, LP supply/positions and owner history → ENUM/TS/R/REC | CS | FRESH | Locked LP is not safe; unlock rights, upgrades, fees and concentrated positions differ; assertion alone insufficient | H/B/A/STRUCT-gap | LP_STATE, POOL_STATE |
| L04 — LP ownership concentration | Share of liquidity positions/withdrawal authority by resolved owner | LP share balances or position ownership/ranges → R and rights map REC | HD | FRESH | Position NFT count is not liquidity share; custody is not beneficial control | H/B/B-tier/STRUCT-gap | LP_STATE, HOLDER_BALANCES |
| L05 — Liquidity additions/removals | Net/gross reserve movements due to deposit/withdrawal, distinct from swaps/fees/repricing | Decoded pool events + before/after reserves → per-asset raw I, signed D flows and event refs | CE | VERY FRESH | Legitimate migration/rebalancing resembles drain; decode source/destination before interpretation | M/F/B-tier/STRUCT-gap | POOL_STATE, LIQUIDITY_EVENTS |
| L06 — Sudden drain indicator | Rapid loss of usable reserves/depth relative to baseline with attribution limits | L05/L08 history → D/R change + migration context + versioned reason | DR | VERY FRESH | Requires approved window/cutoff; liquidity migration is not theft and price drop alone is not withdrawal | H/B/C/DERIVE-gap | LIQUIDITY_EVENTS, MARKET_DEPTH, HISTORICAL_WINDOWS |
| L07 — Liquidity/capitalization relation | Liquidity divided by explicitly supported market-cap basis at aligned times | L01/M02 → R, separate FDV-based variant if named | DR | VERY FRESH | Bad cap/quote causes misleading ratio; undefined denominator stays UNKNOWN | O/B/B-tier/DERIVE-gap | LIQUIDITY, PRICE, TOKEN_SUPPLY |
| L08 — Market depth/price impact | Two-sided theoretical depth curve at a pinned market state and declared notionals; no executable quote | Reserves/ticks/ranges/fees/token behavior → SER of exact notional, impact R, available depth D | MK | VERY FRESH | TVL not depth; fees/hooks/range gaps matter; read-only model cannot guarantee real fillability | M/F/B-tier/STRUCT-gap | MARKET_DEPTH, POOL_STATE, TOKEN_AUTHORITIES |

### 3.6 Activity and flows — 9 signals

| ID — name | Exact meaning and reason | Raw input → normalized representation/type | Capture | Freshness | Manipulation/false-positive caveat | Policy | Capabilities |
|---|---|---|---|---|---|---|---|
| A01 — Transaction rate | Successful scoped transaction/event count per explicit elapsed window | M08 + window → exact R count/time and D rate | DR | VERY FRESH | Spam, batching and failed transactions; activity is not unique demand | H/F/B-tier/DERIVE-gap | TRADES, HISTORICAL_WINDOWS |
| A02 — Unique buyers/sellers | Distinct attributable swap participants by token-side action, unknown actor bucket retained | Decoded swaps + route/owner mapping → I counts and overlap sets/references | CE | VERY FRESH | Routers/relayers are not traders; one person controls many wallets; provider estimate must be labeled | M/B/B-tier/STRUCT-gap | TRADES, PARTICIPANT_MAPPING |
| A03 — Active wallets | Distinct resolved addresses participating in defined successful token activity | Trades/transfers + actor mapping → I counts by activity type/window | CE | FRESH | Airdrop recipients not automatically active; bots/Sybils and shared custody distort organic participation | M/B/B-tier/DERIVE-gap | TRADES, TOKEN_TRANSFERS, PARTICIPANT_MAPPING |
| A04 — New participants | Addresses first participating in scoped token activity, not newly created people | A03 + prior history → I entrants and first-seen TS/coverage | CE | FRESH | Truncated history and rotating bot addresses inflate novelty | H/B/B-tier/DERIVE-gap | WALLET_HISTORY, PARTICIPANT_MAPPING |
| A05 — Repeat participation | Returning addresses/cohort retention across defined windows | A03 historical cohorts → I returning and R cohort fractions | DR | FRESH | Repeated bot activity looks loyal; retention is not conviction | H/B/C/DERIVE-gap | PARTICIPANT_MAPPING, HISTORICAL_WINDOWS |
| A06 — Wallet inflow/outflow | Token transfers and quote flows across an explicitly named boundary/cohort; separately gross/net | Transfers/swaps + cohort definitions → per-asset I gross and D signed net | CE | VERY FRESH | Closed-universe transfers net to zero; wallet outflow is not automatically a sale/capital exit | H/B/B-tier/STRUCT-gap | TOKEN_TRANSFERS, TRADES, ADDRESS_LABELS |
| A07 — Large transfers | Transfers large relative to declared supply/distribution baseline; retain size without final cutoff | Transfer events + I06/H distribution → I amount, R fraction, references | CE | VERY FRESH | Exchange sweeps/bridges/treasury movements are not necessarily dumping | H/B/B-tier/STRUCT-gap | TOKEN_TRANSFERS, ADDRESS_LABELS |
| A08 — Large-holder activity | Actions by a versioned balance-ranked cohort, not an influencer “smart money” label | H03/H04 + transfer/trade history → REC actions, D amounts, cohort definition | CX | VERY FRESH | Changing cohorts create bias; whale status neither expertise nor intent | O/B/C/STRUCT-gap | TOP_HOLDERS, TOKEN_TRANSFERS, TRADES |
| A09 — Transaction-size distribution | Quantiles/bins of executed swap sizes with reproducible estimator and unit | Complete swaps/amounts → SER quantiles D/counts I | DR | FRESH | Splitting/batching/fees and converted prices distort pattern; bins not selected here | H/B/B-tier/DERIVE-gap | TRADES, HISTORICAL_WINDOWS |

### 3.7 Creator/deployer context — 8 signals

| ID — name | Exact meaning and reason | Raw input → normalized representation/type | Capture | Freshness | Manipulation/false-positive caveat | Policy | Capabilities |
|---|---|---|---|---|---|---|---|
| C01 — Deployer history | Observed actions of precisely attributed role address within covered history | I04 + referenced transactions → timeline REC/TS and coverage | CX | MODERATE | Shared factories/fee payers and incomplete archive; history is not character evidence | H/B/B-tier/STRUCT-gap | TOKEN_CREATOR, WALLET_HISTORY |
| C02 — Previous launches | Verified repeated initialization roles; outcomes only with independent event evidence | Launch events + I04 → I launches, asset IDs, attributed outcome references | CX | MODERATE | Serial development is legitimate; copied code/factory usage does not link beneficial creators | O/B/C/STRUCT-gap | TOKEN_CREATOR, WALLET_HISTORY |
| C03 — Creator transfers/sales | Proven role wallet movement; “sale” only with decoded matching swap, not transfer alone | Creator balances + transfers/swaps → REC event, raw I and D quote proceeds if observed | CX | VERY FRESH | Vesting, treasury/custody transfers and migrations can be benign | H/B/B-tier/STRUCT-gap | TOKEN_CREATOR, TOKEN_TRANSFERS, TRADES |
| C04 — Funding source | Immediate, evidenced funding edges with timestamps; no criminality inference | Native/token funding transactions → bounded address-edge REC with I amounts | CX | MODERATE | Exchange/bridge/common funder links unrelated users; privacy mixer use proves no wrongdoing | O/B/C/STRUCT-gap | WALLET_HISTORY, TOKEN_TRANSFERS |
| C05 — Linked-wallet hypothesis | Explainable clustering hypotheses with competing explanations, not asserted common ownership | Attributable funding/action evidence + versioned linkage rule → labeled hypothesis REC/TXT | CX | MODERATE | Exchange, router, airdrop or timestamp similarity yields false links; no guilt by association | D/L/C/CTX-base | WALLET_HISTORY, PARTICIPANT_MAPPING |
| C06 — Creator rewards | Decoded program-specific reward accrual/claims and beneficiary, not reported income | Reward program/state/claim events → raw I, D token amount, beneficiary ID | CE | FRESH | Launchpad definitions vary; entitlement differs from claimed cash; no universal capability | O/B/A/STRUCT-gap | CREATOR_REWARDS |
| C07 — Launch/migration history | Verified movement between launch mechanism/pools, preserving asset identity and lifecycle | Program events + pool ancestry → ordered REC/TS and destination identities | CE | FRESH | Migration is not new token adoption; fake destination claims and double-counted liquidity | H/B/A/STRUCT-gap | LAUNCH_LIFECYCLE, MARKET_PAIR |
| C08 — Authority change events | Changes to supported mint/freeze/upgrade/transfer controls since previous snapshot | I08–I11 snapshots and authority events → typed before/after REC/TS | CE | VERY FRESH | Legitimate rotation exists; missed events cannot prove unchanged controls | M/F/A/STRUCT-gap | TOKEN_AUTHORITIES, HISTORICAL_WINDOWS |

### 3.8 Manipulation and quality indicators — 8 signals

These are candidate **indicators, not deterministic proofs of manipulation**. Computations can be deterministic while the interpretation remains uncertain. Every row requires empirical false-positive evaluation before any production influence.

| ID — name | Exact meaning and reason | Raw input → normalized representation/type | Capture | Freshness | Manipulation/false-positive caveat | Policy | Capabilities |
|---|---|---|---|---|---|---|---|
| X01 — Wash-like repetition | Repeated circular/reversing flows with participant/size/time recurrence, not a fraud label | Decoded trades/transfers/actor graph → versioned motif counts I and evidence REC | DR | VERY FRESH | Arbitrage/market making/routing resemble washing; adversaries randomize patterns | H/B/C/DERIVE-gap | TRADES, TOKEN_TRANSFERS, PARTICIPANT_MAPPING |
| X02 — Volume/liquidity mismatch | Turnover relative to comparable usable liquidity/depth over window | M07/L01/L08 → R plus baseline/context | DR | VERY FRESH | Legitimate high turnover/arbitrage; artificial denominator or quote conversion amplifies ratio | H/B/C/DERIVE-gap | VOLUME, LIQUIDITY, MARKET_DEPTH |
| X03 — Concentration risk indicator | Interprets raw/adjusted ownership concentration with cohort context | H03–H09 → component observations R and versioned reason | DR | FRESH | Exchanges/vesting/LP custody are not secret controllers; fragmentation hides exposure | H/B/C/DERIVE-gap | TOP_HOLDERS, ADDRESS_LABELS |
| X04 — Transaction synchronization | Excess time/size/sequence clustering across addresses against declared baseline | Ordered event timestamps/instruction order/amounts → motif I/R and window | DR | VERY FRESH | Block batching, bots doing legitimate arbitrage and coarse timestamps; synchronized ≠ coordinated owner | H/B/C/DERIVE-gap | TRADES, PARTICIPANT_MAPPING, HISTORICAL_WINDOWS |
| X05 — Rapid distribution | Abrupt balance dispersal from specific sources/cohorts | H09 + transfer graph → destination count I, shares R, source refs | DR | FRESH | Legitimate airdrops/vesting/migration; common recipient does not identify control | H/B/C/DERIVE-gap | HOLDER_BALANCES, TOKEN_TRANSFERS |
| X06 — Thin-market price distortion | Price move disproportionate to observed depth/notional and cross-pool consistency | M01/M10/L08 + trades → D move, depth curve and discrepancy R | DR | VERY FRESH | Genuine repricing can precede liquidity; incomplete venues mimic distortion | H/B/C/DERIVE-gap | PRICE, MARKET_DEPTH, TRADES |
| X07 — Artificial-holder-growth indicator | Growth dominated by dust/related funding/repeated distribution motifs | H02/H08/A04 + transfers → count/share R and evidence references | DR | FRESH | Organic giveaways and low-budget participants; dust rule must not penalize identity/economic class | H/B/C/DERIVE-gap | HOLDER_BALANCES, TOKEN_TRANSFERS, WALLET_HISTORY |
| X08 — Recycled launch/burst pattern | Recurring observable launch/activity sequences across accurately attributed assets | C02/D03 + event histories → versioned motif REC/I and uncertainty | DR | MODERATE | Shared launchpad templates/reused open-source code are benign; association alone is insufficient | O/B/C/DERIVE-gap | LAUNCH_LIFECYCLE, WALLET_HISTORY, HISTORICAL_WINDOWS |

### 3.9 Social and off-chain context — 6 signals

| ID — name | Exact meaning and reason | Raw input → normalized representation/type | Capture | Freshness | Manipulation/false-positive caveat | Policy | Capabilities |
|---|---|---|---|---|---|---|---|
| S01 — Public X activity | Attributed public discussion/mention change and coverage, not sentiment-as-quality | Licensed public posts/IDs/time/deletions + token disambiguation → bounded TXT/REC and I counts | OF | FRESH | Bots, purchased engagement, ticker collision and deleted samples; no raw hype score | D/L/D-tier/CTX-base | PUBLIC_SOCIAL |
| S02 — Public community activity | Public community participation context where access and reuse are legitimate | Public channel records/coverage/time → bounded aggregate I/context TXT | OF | FRESH | Purchased members, spam, moderation and private gaps; no private-message scraping | D/L/D-tier/CTX-base | PUBLIC_SOCIAL |
| S03 — Website presence/provenance | Dated domain/content existence and verified token linkage; not team legitimacy | Allowlisted public metadata/capture and linkage refs → ID/TS/TXT | OF | MODERATE | Cloned pages, stale domains, malicious content/SSRF; presence proves neither trust nor utility | D/L/D-tier/CTX-base | PUBLIC_WEB |
| S04 — Development activity | Repository provenance and substantive change context only for projects claiming software development | Public repository history/releases/ownership evidence → REC/I/TXT | OF | MODERATE | Forks, cosmetic commits and copied code; no repository is normal for some tokens, not adverse evidence | D/L/D-tier/CTX-base | DEVELOPMENT_CONTEXT |
| S05 — News/media context | Attributed independent reports with original source and uncertainty | Licensed dated articles/corrections/source graph → bounded TXT/REC | OF | MODERATE | Syndicated PR and circular citations are not independent corroboration; factual claims need original evidence | D/L/D-tier/CTX-base | PUBLIC_NEWS |
| S06 — KOL endorsement/popularity | Candidate influencer mentions/follower counts; excluded from analytical quality | Public mention/engagement claims → attributed TXT/I only if later research approved | OF | FRESH | Paid promotion, fake reach, conflicted sponsorship and survivorship; no endorsement-based scoring | X/N/D-tier/CTX-base | PUBLIC_SOCIAL |

### 3.10 Data quality and provenance — 5 signals

| ID — name | Exact meaning and reason | Raw input → normalized representation/type | Capture | Freshness | Manipulation/false-positive caveat | Policy | Capabilities |
|---|---|---|---|---|---|---|---|
| Q01 — Coverage/completeness | Covered/expected inputs, pools, accounts and event intervals under fixed scope | Capability declarations, checkpoints, history gaps → REC and R coverage where denominator known | QA | FRESH | Provider coverage percentage is not independently proven; omitted failed metrics cannot inflate coverage | M/F/B-tier/STRUCT-gap | COVERAGE_LINEAGE |
| Q02 — Observation lag/finality | Age, source-to-receipt lag, commitment and cross-input alignment at evaluation time | Source/receipt times + block refs/finality → D durations and ENUM finality | QA | VERY FRESH | Recent API response with old data; future timestamps; finality not interchangeable across chains | M/F/B-tier/DERIVE-gap | COVERAGE_LINEAGE, CHAIN_STATE |
| Q03 — Source agreement/conflict state | Whether like-for-like facts agree, disagree or have only one independent origin | Aligned source observations and upstream provenance → ENUM/REC plus D/R differences | QA | FRESH | Two resellers may share upstream data; single source is not corroboration, nor inherently conflict | M/F/B-tier/DERIVE-gap | COVERAGE_LINEAGE |
| Q04 — Provenance/replay completeness | Recoverable source references and normalized inputs linked to sealed run/method | Observation/event lineage + source snapshots + hashes → bounded manifest REC and completeness ENUM | QA | SLOW-CHANGING | Hash alone cannot recover data or prove source truth; edited mutable URLs are insufficient | M/F/B-tier/STRUCT-gap | COVERAGE_LINEAGE, HISTORICAL_WINDOWS |
| Q05 — Numeric/semantic validity | Exact units/scales, plausible domain, identity and timestamp consistency | Raw string amounts/metadata + schema → validation ENUM/reasons and exact I/D | QA | FRESH | Plausible fabricated values pass range checks; bounds validate format, not economic truth | M/F/B-tier/NUM-base | COVERAGE_LINEAGE |

## 4. Chain-specific interpretation and important cautions

### Token controls are not universal

Solana mint state exposes decimals, supply and optional mint/freeze authorities. Mint identity, program ownership and token-account ownership are different concepts. Token Extensions require explicit supported-extension decoding rather than assuming classic Token Program behavior. Extension combinations outside the tested decoder must remain unsupported. See [Solana mint structure](https://solana.com/docs/tokens/basics/create-mint) and [Token Extensions](https://solana.com/docs/tokens/extensions).

For EVM assets, ERC-20 defines token operations, not a universal creator, owner, mint-control or freeze-risk interface; even decimals metadata is optional in the standard. Proxy implementation/admin observations need implementation-aware analysis; recognized proxy slots do not exhaust all upgrade patterns. See [ERC-20](https://ercs.ethereum.org/ERCS/erc-20) and [ERC-1967](https://eips.ethereum.org/EIPS/eip-1967). A renounced owner field is never sufficient evidence that every effective control is gone.

No chain-specific authority is flattened into a universal “safe” boolean. Each record must identify scope, role, authority address or verified absence, state block, decoder and uncertainty. If contract behavior cannot be understood within the approved supported universe, the result is INCOMPLETE, not a silent extension of support.

### Distribution, supply and liquidity

Solana's largest-account RPC returns 20 **token accounts**, not a full census of beneficial owners. H03–H05 therefore require owner resolution and sufficient distribution coverage; top-50 data cannot be invented from that response. Supply responses expose exact raw amounts and decimals, which should be retained instead of floating UI amounts. See [getTokenLargestAccounts](https://solana.com/docs/rpc/http/gettokenlargestaccounts) and [getTokenSupply](https://solana.com/docs/rpc/http/gettokensupply).

Raw concentration must always remain accessible alongside adjusted concentration. Exclusions require separately versioned evidence: burn mechanics, pool custody, treasury, vesting and exchange labels are not interchangeable. Do not automatically exclude treasury balances merely to improve apparent distribution. Wallet clustering remains uncertain even with complete chain data.

Pool value, withdrawal rights and immediately usable depth are distinct. Concentrated liquidity can sit outside the active price range; accounting reserves and position counts cannot replace a depth curve. This is a protocol-model requirement, not selection of that protocol as a provider. See [concentrated-liquidity mechanics](https://developers.uniswap.org/docs/get-started/concepts/liquidity-providers/concentrated-liquidity).

“LP locked” or “LP burned” must name the share/position, fraction, rights, contract version, unlock conditions and verification time. It cannot establish token safety, permanently usable depth, benign creator intent, or unrestricted transfers. Lack of a recognized lock is not itself a rug finding.

Creator facts must be phrased narrowly: “address X initialized mint Y,” “address X transferred amount Z,” or “these addresses share an observed funding source.” “Same operator,” “sold,” “wash trading” and “fraud” require additional evidence and often remain inference. No guilt by association, criminality labels from weak heuristics, or inferred personal identities.

## 5. Reliability tiers and permitted influence

| Tier | Verification requirement | May influence | Must not do |
|---|---|---|---|
| A — Verifiable state/event fact | Canonical identity, supported decode, source/block/time/finality and reconstructible fact | Deterministic controls, factual risk disclosure and eligible future component inputs | Convert verified fact into safety guarantee; hide uncertainty in coverage |
| B — Reproducible measurement | A inputs or reproducible provider recipe, complete declared scope, aligned windows/units | Structure/activity metrics and validated future component inputs | Treat source branding as verification or derived price/cap as an independent chain truth |
| C — Validated heuristic candidate | Versioned computation, attributable inputs, false-positive analysis and holdout evidence | Initially shadow evaluation; later explainable caution/investigation signals under approved policy | Prove manipulation, auto-accuse creators, or inherit VERIFIED_DATA status from inputs |
| D — Context/inference | Dated source, identity linkage, access rights, uncertainty and bounded synthesis | Separately labeled narrative/context only | Lift missing-data restrictions, manufacture high quality, override deterministic risk or publish itself |

AVAILABLE is an acquisition state, not verification certification. A numeric comparison passing does not alone justify VERIFIED_DATA. Before production use, the adapter/verification methodology must establish what the numeric fact actually means; current generic comparison primitives are not a production verification policy. Tier A/B facts can still describe adverse conditions. Any model-written interpretation stays AI_INFERENCE/INFERENCE; human review cannot relabel it as VERIFIED_DATA.

No confidence probability or score weight is assigned to tiers. “Higher reliability” means a better-supported observation, not a better token. Known limits and disagreements accompany the fact.

## 6. Minimum viable signal set and lane boundaries

### A. Minimum viable production signal set

**30 M/P0 signal records** for a supported-asset normal-PASS methodology:

- Identity/controls (8): **I01, I02, I05, I06, I08, I09, I10, I11**.
- Discovery/baseline (2): **D01, D02**.
- Market (6): **M01, M04, M05, M06, M07, M08**.
- Distribution (3): **H01, H03, H07**.
- Liquidity (3): **L01, L05, L08**.
- Participation (2): **A02, A03**.
- Authority change (1): **C08**.
- Quality/lineage (5): **Q01, Q02, Q03, Q04, Q05**.

This deliberately requires evidence of participation, usable liquidity and concentration, not just price/volume. Q03 requires an honest agreement/coverage state; it does not silently mandate two vendors. Whether independent corroboration is mandatory for a particular metric is a later capability-specific decision.

The initial normal-PASS universe is **market-active assets with enough declared history**, not every newly minted asset. An asset without pools, a comparable baseline, supported controls or adequate owner coverage can still be discovered and investigated, but remains INCOMPLETE. Accurate verified zero counts/reserves are facts; their acceptance/rejection awaits approved rules. Unknown birth time prohibits a creation-age claim, even if first-seen discovery is valid.

High-value and optional signals are explicitly marked in the inventory. Market capitalization, circulating supply, LP-lock claims, creator attribution, social activity and AI are not mandatory for the initial Fast-only method. Unknown optional inputs remain displayed; they cannot be silently dropped to inflate quality. If vendor evaluation cannot satisfy this minimum, return for an explicit scope revision—do not downgrade requirements to fit a convenient vendor.

### B. Full candidate set

I01–I12, D01–D03, M01–M12, H01–H09, L01–L08, A01–A09, C01–C08, X01–X08, S01–S06, Q01–Q05: **80** total. The inventory, not marketing copy, defines each candidate and its limitations.

### D. Fast Lane eligible set

**73 candidates**: I01–I12, D01–D03, M01–M12, H01–H09, L01–L08, A01–A09, C01–C04, C06–C08, X01–X08, Q01–Q05. This includes lane B's deterministic fact/measurement portion only. Eligibility is not implementation or approval of a heuristic, threshold or score. Tier-C indicators stay shadow-only until validated.

Fast Lane takes frozen observations plus pinned evaluation time, window definitions, chain/decoder/source policy and methodology. Same accepted inputs/configuration must produce the same outcome/reasons. A required gap yields INCOMPLETE; a verified disqualifying fact can yield REJECT only under an approved rule. Neither UNKNOWN nor provider failure is automatically bad. PASS means “met this screening contract,” not permission to buy or automatic public eligibility.

### E. Deep Lane eligible set

**51 candidates** may supply Deep Lane context: the 45 rows marked **B**, plus **6 L-only** rows, C05 and S01–S05. The B rows supply deterministic facts for separately labeled interpretation; the L-only rows are contextual requirements. Deep Lane explains competing hypotheses, source discrepancies, creator context or narratives; it does not resolve uncertainty by invention. It cannot override a required INCOMPLETE state, change deterministic values, or supply a missing production score.

No AI provider/model, prompt strategy or score contribution is selected. Any later use preserves the accepted durable request/attempt/receipt model: PostgreSQL-authoritative hashes, exact frozen manifest, trusted adapter identity, lease/fence/pause checks, lease-free but identity-bound receipt replay, bounded explicit retries and UNCERTAIN after unprovable external execution. No external exactly-once claim.

### F. Excluded and deferred

- S06 is excluded from production analytical scoring; follower counts/endorsements are not quality evidence.
- Final heuristic cutoffs, wallet-cluster truth claims, social sentiment scoring, opaque “smart money” labels and black-box scam/safety scores are not accepted evidence contracts.
- Private-community surveillance, personal doxxing, unlicensed content capture, unverifiable creator accusations and hidden-reasoning storage are excluded.
- Circulating-supply estimates without an objective denominator remain optional/UNKNOWN; no fabricated market cap.
- CEX order books, cross-chain aggregation, derivative markets, predictive-return models and execution-oriented liquidity routing are outside this initial universe. No cross-venue total may imply those are covered.

## 7. Freshness requirements, without numeric durations

Freshness is signal- and chain-specific. These classes are **relative requirements** to benchmark, not numeric SLAs. Windows, clock skew, finality and stale/expiry durations need empirical approval. Deterministic facts do not necessarily “decay in truth”; their usefulness for a current-state claim does. No arbitrary confidence-decay coefficient is introduced.

| Class | Typical rows | Why age matters | Stale visibility/evaluation | INCOMPLETE behavior |
|---|---|---|---|---|
| VERY FRESH | Discovery, price, pool/depth state, trades, flows, drain indicators, authority changes | Rapid changes can invalidate current capital-risk interpretation | Historical value may remain explicitly as-of; never evaluated as current. Recompute from fresh inputs | Any required input outside approved usability → INCOMPLETE |
| FRESH | Supply/authority snapshots, holder distribution, participation, quality coverage | Mutable state and sample windows must align | Display separately aged history; evaluate only in historical replay with pinned time, not a new current run | Required stale input or incoherent cross-input times → INCOMPLETE |
| MODERATE | Exclusion labels, deployer history, migration interpretation, public context | Facts may persist but attribution/coverage and new events change interpretation | Dated context may remain visible with limitations; current mutable conclusions require re-verification | Required exclusion basis becoming unusable blocks normal PASS; optional context loss does not |
| SLOW-CHANGING | Canonical identity, decimals for supported immutable semantics, creation facts, retained lineage | Stable facts still need validity/reorg/implementation-change detection | Historical immutable fact remains useful when its validity is independently established; changed code/control invalidates assumptions | Required identity/provenance not established → INCOMPLETE regardless of nominal age |

Every major inventory category has a row-level class. Event-driven invalidation can force immediate re-evaluation even for slow-changing facts. A fresh fact does not compensate for a stale denominator. New observations after sealing require a new run/version; they cannot patch an existing run. Reorgs/source corrections preserve old evidence and add correction/invalidation lineage.

Public display follows existing policy-eligible projections: only approved soft-stale historical presentation where permitted; hard-expired, withdrawn-policy or critically invalidated output suppressed. Current and historical views cannot share unlabeled freshness/ranking semantics. These requirements do not change flags or the publication contract.

## 8. Initial-chain recommendation

### G. Recommendation and tradeoffs

**Recommend evaluating a Solana-only initial production universe**, restricted further to explicitly supported fungible-token programs/extensions and identified pool/launch mechanisms. This is a recommendation for human confirmation and provider benchmarking, not implementation or a final chain-selection decision.

Reasoning: a single-chain initial corpus reduces identity, finality, decoder and history-normalization variation. Solana's mint-based token state offers a concrete initial control/supply model, while token extensions, account-to-owner aggregation and pool-specific positions remain real complexity. It is a plausible fit for the requested early token/memecoin activity focus; this document does **not** claim measured market-share superiority or that any vendor currently supplies all mandatory data. Provider coverage must be demonstrated.

| Option | Advantages for this project | Tradeoffs and validation burden |
|---|---|---|
| Narrow Solana universe — recommended evaluation | One finality/account model; mint controls and token-program identity can be profiled; coherent launch/activity corpus | Owner census/history and concentrated depth need indexing; Token Extensions/launch mechanisms require explicit decoders; high activity stresses completeness/latency |
| One separately selected EVM chain | Alternative if corpus/licensing/coverage is better; event-based histories and well-understood standard interfaces where supported | Arbitrary contracts, proxies, fees/rebases and authority models increase behavioral verification; deployer/factory ambiguity; actual chain not selected |
| Solana plus EVM or general multi-chain | Broader discovery universe later | More normalization/finality/provider failure modes; unequal coverage can masquerade as cross-chain quality differences; reject as initial default |

Gate for confirming a chain: demonstrate all 30 M signals on representative supported assets, prove raw evidence/history and rights, benchmark missingness/finality/latency, and complete adversarial replay. Expand only with a separate chain capability profile and empirical cohort; no assumption of identical risk semantics or score comparability. Solana commitment levels differ in their guarantees; choosing one for discovery versus verified evaluation is an explicit later policy decision. See [Solana RPC commitment documentation](https://solana.com/docs/rpc).

## 9. Provider capability requirements

### C. Vendor-neutral capability matrix

These **23 capability names** are procurement/design labels, not newly implemented capability identifiers. A future adapter may supply several. M means needed by an M signal; H/O/D follow the highest-priority dependent signal. Capability support is per chain, token program, venue, interval and exact metric definition, not a vendor-wide checkbox.

“Live” means incremental delivery or measured sufficiently frequent snapshots, not necessarily WebSocket transport. No latency number is chosen. Historical requirement is for reproducible as-of acquisition, not only today's backfilled latest values.

| Capability | Signal mapping | Requirement | Chain-specific? | Live need | Historical need | Raw preferred / provider-derived acceptable |
|---|---|---|---|---|---|---|
| TOKEN_IDENTITY | I01–I05, I11 | M | Yes | Discovery + change detection | Creation and prior state | Raw identity/program evidence required; aliases alone unacceptable |
| TOKEN_SUPPLY | I06/I07, M02/M03/L07 | M for total; O for circulating | Yes | FRESH snapshots | As-of supply | Raw units required; derived circulating only with exclusion recipe |
| TOKEN_AUTHORITIES | I08–I11, C08/L08 | M | Yes/program-specific | State changes promptly | Prior control state/events | Raw supported state/implementation refs required; black-box risk boolean insufficient |
| TOKEN_METADATA | I12 | H | Yes plus off-chain | MODERATE | Captured revisions | Attributed snapshots acceptable; verification method disclosed |
| DISCOVERY_EVENTS | D01 | M | Yes/program/venue | VERY FRESH incremental | Replay/checkpoint/backfill | Stable event IDs/raw refs required; source first-seen explicitly labeled |
| CHAIN_STATE | Q02 and all CS/CE | M | Yes | Finality/reorg/change status | Referenced blocks/slots | Read-only authoritative state and finality context required |
| MARKET_PAIR | M01/M05, C07 | M | Yes/venue | New pools/updates | Creation/ancestry | Raw pool identity and supported decoder; provider catalog reconciled |
| PRICE | M01–M03/M06/M10/X06 | M | Venue/quote-specific | VERY FRESH | Trade/pool as-of history | Raw trades/state preferred; reproducible named aggregate acceptable |
| QUOTE_CONTEXT | M06/L01 | M | Asset/venue-specific | VERY FRESH | Conversion history | Source lineage required; no unproven stable-unit assumption |
| LIQUIDITY | M04/M12, L01/L02/L07/X02 | M | Pool-model-specific | VERY FRESH | Snapshots/deltas | Raw reserves/positions preferred; aggregate with universe/recipe acceptable |
| POOL_STATE | M04/M05, L01/L03/L05/L08/H07 | M | Pool-model-specific | VERY FRESH | Reconstructible state | Raw reserve/tick/range/fee state required for independent depth checks |
| LIQUIDITY_EVENTS | L05/L06 | M | Program-specific | VERY FRESH | Deposits/withdrawals/migration | Decoded events with underlying references required |
| MARKET_DEPTH | L08/L02/L06/X06 | M | Pool-model-specific | VERY FRESH | Replayable curves | Read-only state arithmetic preferred; provider curve acceptable only with inputs/recipe/fee scope |
| VOLUME | M07/M11/X02 | M | Venue/route-specific | Window updates | Complete aligned windows | Raw swaps preferred; provider totals acceptable with dedup/notional/coverage definitions |
| TRADES | M07–M09, A01–A03/A06/A09, X01/X04 | M | Program/route-specific | VERY FRESH | Ordered swap records | Raw/decoded records and stable IDs required for independent aggregation |
| HOLDER_BALANCES | H01–H09, L04 | M | Account-model-specific | FRESH snapshots/deltas | Owner-resolved as-of census | Raw balances/owner mapping preferred; aggregate only with reproducible denominator/coverage |
| TOP_HOLDERS | H03–H05, A08 | M for H03; H for H04/H05 | Account-model-specific | FRESH | Rankings at past snapshots | Reconstructible owner balances/ranks; top accounts alone insufficient |
| ADDRESS_LABELS | H07, A06/A07/L03 | M for exclusion ledger | Yes/program-specific | Change detection | Label validity intervals | Evidence-backed pool/burn labels; treasury/custody attribution uncertainty retained |
| PARTICIPANT_MAPPING | A02–A05, X01/X04/C05 | M | Route/account-specific | Trade-window updates | Attributed actor histories | Raw signer/owner/route evidence preferred; unknown attribution explicitly counted |
| TOKEN_TRANSFERS | A03/A06/A07, C03/C04/X05/X07 | M for scoped activity | Yes/token behavior | VERY FRESH | Complete scoped transfers | Raw/decoded transfers required; inferred sale labels insufficient |
| WALLET_HISTORY | I03/H08/A04/C01–C05/X07/X08 | H | Yes | FRESH/MODERATE | Essential covered range | Attributed raw actions preferred; unknown prehistory explicit; no personal identity claims |
| HISTORICAL_WINDOWS | D02, momentum/distribution, C08/Q04 | M | Definition-specific | Window completion | Essential as-of retention | Reproducible raw-derived windows required; immutable snapshot exports acceptable |
| COVERAGE_LINEAGE | D02/Q01–Q05, all signals | M | Source-specific | Gaps/lag/outages | Revisions, corrections, lineage | Source ancestry, timestamps, units, quality outcomes, access/retention rights required |

Additional **8 optional/context capabilities** (31 total capability requirements including these):

| Capability | Signal mapping | Requirement | Chain-specific? | Live need | Historical need | Raw preferred / provider-derived acceptable |
|---|---|---|---|---|---|---|
| LP_STATE | L03/L04 | H | Pool/lock-specific | FRESH rights/expiry state | Position/control history | Raw rights/lock evidence; no unexplained “locked” boolean |
| TOKEN_CREATOR | I04/H06/C01–C04 | H | Program/factory-specific | Creation + attribution corrections | Essential action history | Raw roles required; claimed beneficial identity separate |
| CREATOR_REWARDS | C06 | O | Launch/reward-program-specific | FRESH | Claims/accruals | Decoded program evidence preferred |
| LAUNCH_LIFECYCLE | C07/X08 | H | Launch-program-specific | Lifecycle events | Launch/migration histories | Raw program events/ancestry required |
| PUBLIC_SOCIAL | S01/S02/S06 | D; S06 excluded | No; token linking required | FRESH aggregate/capture | Licensed point-in-time samples | Licensed public records, bot/coverage limits; aggregate estimates labeled |
| PUBLIC_WEB | S03 | D | No | MODERATE | Versioned captures | Safe attributed capture; no arbitrary crawling authority |
| DEVELOPMENT_CONTEXT | S04 | D | No | MODERATE | Repository/release revisions | Public repository evidence with ownership/linkage context; no commit-count quality score |
| PUBLIC_NEWS | S05 | D | No | MODERATE | Articles and corrections | Licensed attributed reporting and original-source lineage; no opaque sentiment |

The complete matrix defines **31 capabilities: 23 core + 8 enrichment**. Of these, **21 have mandatory coverage requirements** for the proposed minimum set; TOKEN_METADATA and WALLET_HISTORY in the core matrix are high-value, not mandatory. Vendor responses must answer each independently. A capability may be assembled from raw data plus our future deterministic computation; no requirement demands buying a precomputed score. Mandatory derived metrics do not force selecting an aggregator.

## 10. Production data-quality contract

1. **Identity and scope:** canonical chain/address/token UUID, supported token/pool program and decoder version, pool/quote/owner universe, event key and source identity must reconcile before acceptance. Display labels cannot establish identity.
2. **Time:** preserve source event/state time, observed time, received time, window bounds, chain ordering/finality, revision time and pinned evaluation time. Unknown block time stays unknown; lack of time precision/finality is explicit. Later approval will define clock-skew and alignment bounds.
3. **Exact amounts:** raw integer strings + scale and validated finite decimal strings; explicit quote units and denominator. No authoritative JS floating point. Rate/ratio arithmetic, truncation and rounding require a versioned method; no silently rounded vendor numbers presented as exact raw facts.
4. **Lineage:** bounded source/adapter/normalization version, references to recoverable evidence, calculation recipe, independent upstream source ancestry and licensed retention. Do not put secrets, raw prompts, headers, arbitrary nested payloads or unbounded URLs in provenance.
5. **Duplicates:** same scoped source event/revision/content replays idempotently; same identity with changed content conflicts. Provider corrections require new revisions and linked invalidations. Independent sources remain separate even if values match. Receipt time must not manufacture new signal identity.
6. **Missingness/outages:** preserve all four non-available states and reasons. Partial responses retain valid fields with explicit gaps. Record outages/rate limits without recording credentials. Unsupported capabilities do not receive endless retries or fabricated observations.
7. **Staleness:** a successful fetch does not refresh an unchanged old observation. Preserve historical available values separately; never violate the existing state/value matrix. Required stale data blocks current normal PASS.
8. **Plausibility:** validate domain, raw-unit/decimal consistency, event ordering, duplicates, supply/balance reconciliation, scope coverage and denominator. Outliers are investigated, not winsorized into “good” values. Quarantine malformed/conflicting data; preserve bounded reasons. An extreme but verified value is not invalid merely because unusual.
9. **Point-in-time correctness:** available-at time is distinct from event time. Replays cannot use data/labels/corrections that arrived later unless explicitly evaluating revised knowledge. Freeze every accepted source version and all meaningful context before evaluation.
10. **Operational/privacy separation:** trusted server ingestion only, existing SYSTEM RPCs, immutable records, finalization, reserved versions, lease/fence/pause and audit authority unchanged. No browser capability or raw-table grant. Model context is allowlisted; personal identity inference and sensitive raw response retention are excluded.

### Fit against current implementation

`src/lib/radar/contracts.ts` has string-named capabilities/metrics and `supportsHistorical`, not an approved production capability catalog. Observations currently have a numeric `value` and bounded flat context/provenance. `normalization.ts` allowlists those fields; `fast-lane.ts` provides exact scalar comparisons and conservative conflict handling, not holder indexing, authority decoders, window arithmetic, depth calculations or a production freshness engine. `methods.ts` registers `contract-v1` as wiring only; the production score calculator is intentionally unconfigured.

Consequently, **none of these 80 signals has a live approved provider/calculation policy today**. NUM-base does not mean the signal is implemented end-to-end. STRUCT-gap and DERIVE-gap entries require later scoped implementation design after requirements and provider evidence are accepted. In particular, block/finality/coverage detail, authority records, pool positions and full wallet/holder series cannot simply be inserted into today's narrow observation JSON. Do not encode arbitrary enum/object data as magic numbers, drop provenance, or bypass validation to fit the current envelope. Reuse existing domains where possible; any genuinely needed additive contract requires separate approval, not this planning document.

Deep Lane's existing immutable context/receipt guarantees remain necessary, but cannot prove accuracy of external facts. PostgreSQL-authoritative request/output hashes must remain distinct from any future signal-computation digest; do not introduce a competing JSON canonicalizer.

## 11. Conflict policy without vendor precedence

First compare identity, slot/block/finality, observation window, units, supply basis, quote conversion, pool set, exclusions, rounding and source independence. Two unlike definitions are not measurements of the same fact. Preserve both sources and the reason comparison is invalid.

For equivalent facts, a later approved capability-specific authority policy may deterministically reconcile to reproducible chain state or reconstruct the aggregate from agreed raw events. Naming a vendor is not that policy. Prefer evidence, not the freshest receipt, highest value, lowest risk or a commercial relationship.

If conflict cannot be resolved, retain disagreement evidence, mark the affected input UNKNOWN and make required evaluation INCOMPLETE. Optional conflicts remain visible and cannot increase apparent safety. Do not average unlike data, silently select favorable values, or call two resellers independent corroboration. Expected rounding differences need a later documented tolerance; none is invented here. A single source is explicitly singly sourced, not falsely “cross-verified.”

Current Fast Lane treats distinct eligible observation hashes for one capability/metric as conflict. This specification does not change that selector or permit feeding multiple contradictory observations and hoping it chooses one. Any future reconciliation must create an attributable, reproducible accepted input under an approved contract, retaining the originals and their disagreement.

## 12. Empirical validation design

### J. Dataset and measurement plan

Build a legally usable, versioned, point-in-time corpus from the declared discovery universe, including assets never published and assets lost by current provider listings. Sample by launch period, token program, venue, age, liquidity regime and source coverage—not a handpicked winners list. Retain source rights, raw-reference availability, observed/received times, corrections, missing intervals and adjudication evidence.

Required strata:

- Early tokens with later sustained **observed participation/usable liquidity** and organic-looking growth, with the definition adjudicated independently.
- Failed/inactive assets, high-volume failures and transient activity bursts.
- Objectively evidenced liquidity-withdrawal/control-abuse incidents; reserve “rug/scam” labels for defensible event evidence rather than price decline.
- Pump-and-dump-like temporal patterns labeled as patterns unless intent is established; legitimate launches, migrations and arbitrage as confounders.
- Low-cap assets with later meaningful activity (“winners” for sampling only); future price performance is not the optimization target.
- False positives and false negatives from an initial frozen shadow method, including unsupported/incomplete cases and provider outages.

Define labels before fitting: event type, event timestamp, known-at time, evidence basis, adjudicator agreement, ambiguity and censoring. Use independent reviewers for contested labels, preserve disagreement and exclude ambiguous cases from definitive fraud claims. An unlabeled asset is not a negative. Failed/delisted history and inaccessible archives must remain visible as selection limits.

Split chronologically into exploration/calibration, validation and locked holdout; group linked launches/creator clusters/near-duplicates to limit leakage without declaring common ownership as fact. Embargo overlapping windows. Parameters and signal selection are frozen before holdout; subsequent changes need a new version and untouched evaluation. Use point-in-time creator labels and only information actually available by the evaluation timestamp.

| Measurement | Operational definition and required breakdown |
|---|---|
| Coverage | Fraction of declared universe/windows with each required usable signal; denominator includes failed fetches, inactive and unsupported assets |
| Missingness | State/reason rates and gap duration by capability, token program, venue, asset age and source; distinguish UNKNOWN from verified zero |
| False-positive behavior | Cases flagged for each specific adverse pattern without corroborating event evidence; investigate legitimate migration/arbitrage/airdrop explanations |
| False negatives | Independently documented adverse/meaningful events missed despite adequate observation opportunity; separate inaccessible data from model errors |
| Discriminatory usefulness | Event-specific separation, precision/recall or precision-recall curves under observed base rates, uncertainty intervals and calibration only for an explicitly probabilistic task |
| Stability | Sensitivity to small input changes, window boundaries, decimals, provider substitutions, one missing input and source corrections |
| Lead time | Time from evidence available to Radar's first eligible flag versus independently dated target activity/risk event; report capture latency separately |
| Replay consistency | Identical normalized inputs/method/evaluation time yield identical deterministic result/hash; Deep Lane accepted output replay, not identical future model generation |
| Manipulation robustness | Ablations for inflated volume, holder dust, Sybils, quote distortion, clustered trades, pool duplication and partial history |
| Incremental value | Compare each added signal/family against simple declared baselines and ablations; account for correlated inputs to avoid counting one fact repeatedly |
| Operational quality | Source lag/finality lag, backfill correctness, outage recovery, dedup/conflict behavior, acquisition cost per useful evaluated asset and storage/retention feasibility |

Do not optimize for future profit, return multiples, profitable entries, execution fills or trading Sharpe. Coverage, risk separation and explanation quality are the targets. Temporal price outcomes may describe sample diversity, not define a buy score. Missing evidence must not improve safety/confidence through weight renormalization; test this monotonicity property explicitly.

After offline evaluation, run an approved **nonpublic shadow** observation phase, retaining disagreements and reviewer feedback without automatic publication. Monitor cohort drift, unsupported program uptake and changed source definitions. Benchmark alternative windows/freshness classes and approve actual durations only from measured risk/lag tradeoffs. No dataset sample-size, accuracy target, score cutoff or retry budget is fabricated here; establish power/precision and acceptance requirements before accessing the holdout.

Exit artifact: versioned dataset manifest, source licenses, cohort/label policy, signal definitions and computation artifacts, missingness/freshness results, adversarial/ablation results, holdout report, limitations and named human approval. If useful discrimination/coverage cannot be demonstrated, narrow or defer the product rather than publish a confident score.

## 13. Score design inputs, not a scoring design

| Candidate component family | Supporting measurements, subject to verification | Important boundary |
|---|---|---|
| Market Structure | M01, M04–M06, M10, L02/L08 | Price level/price increase is not quality or expected return |
| Liquidity Quality | M04, L01–L08, C07 | Depth, reserve provenance and withdrawal rights separate; LP lock not a guarantee |
| Distribution | H01–H09, A04/A05 | Owners are not people; raw/adjusted distributions separate; no Sybil certainty |
| Activity/Momentum | D02/D03, M07–M12, A01–A09, H02 | Count/volume acceleration is not organic demand without context |
| Contract/Authority Risk | I08–I11, C08 | Only supported controls decoded; absence of a detected power is not full safety |
| Creator/Deployer Risk | I04, H06, C01–C04/C06–C08 | Address actions only; C05 hypotheses cannot become verified ownership |
| Data Quality | Q01–Q05, D02 and every observation's source/time | Prefer eligibility/coverage constraint, not a reward that hides unknowns |
| Manipulation Risk | X01–X08 with verified underlying trades/balances/depth | Heuristics require validation and false-positive context; no fraud certainty |

No final family set, scale, weight, aggregation, rounding, score formula, classification or thresholds is selected. Correlated inputs (volume, turnover, rate acceleration; concentration variants; liquidity ratios) must not multiply one fact's influence. Strong momentum must not numerically cancel an unresolved critical control/coverage condition; the eventual method must separate eligibility, data quality and risk from any scalar summary.

Recommended conceptual meaning: **a versioned summary of the strength and quality of observed token activity and market structure, constrained by measured risk and data sufficiency at a stated time**. Pair any future scalar with coverage, risk, freshness and reasons. It must not automatically mean probability of appreciation, expected return, buy recommendation, safety guarantee or scam probability. A probability claim would require a separately defined task and empirical calibration, not a renamed Radar Score. No implicit 0–100 scale is approved.

## 14. Decisions and next phase

### H. Unresolved decisions

| Decision | Evidence needed before approval | Decision owner/boundary |
|---|---|---|
| Initial chain/program/venue universe | Mandatory capability coverage, decoder feasibility and representative historical corpus | Product + engineering; recommendation only here |
| Event/discovery universe and baseline windows | Point-in-time history completeness and early-event lead-time measurements | Intelligence methodology review |
| Finality/clock skew, freshness durations and cross-input alignment | Measured source latency, corrections/reorg behavior and risk of aged conclusions | Methodology + reliability review |
| Metric definitions needing policy | Circulation/exclusions, pool eligibility, holder/actor unit, quote valuation, depth notionals, windows/rounding | Explicit versioned metric approval; no arbitrary defaults |
| Providers and authoritative-source precedence | Capability proofs, independence, licensing/retention, cost and reliability comparison | Next provider-evaluation phase; no vendor chosen |
| Storage/decoder gaps | Mapping of structured requirements to existing safe contracts and narrowly justified additions | Separately scoped implementation/security approval |
| Signal selection and score policy | Label/corpus quality, holdout and ablation results, limitations | Human empirical methodology approval |
| AI use/provider/model | Demonstrated incremental explanatory value, privacy/cost and model identity/idempotency capabilities | Optional later Deep Lane decision, not Fast Lane prerequisite |
| Operating budget and retry/schedule/retention policy | Measured throughput, outage behavior, licensed history needs and bounded cost | Operations approval; no deployment or flag changes here |
| Public activation | Approved method/freshness, operational controls, empirical validation and human review | Separate launch approval; software sign-off alone insufficient |

### I. Provider evaluation criteria for the next phase

Request **evidence per capability and supported scope**, without selecting a vendor now:

1. Can it supply the exact raw fields, units, owner/actor definitions, source times, chain context and history in the matrix? Require sample schemas and legally shareable examples, not marketing checkmarks.
2. Can independent reconstruction explain prices, liquidity, trade counts, circulation estimates, holder ranking and exclusions? Reject undisclosed black-box scores as substitutes.
3. Does history include dead/delisted assets, revisions, gaps and known-at time? Can we retain enough licensed normalized inputs and underlying references for historical replay and public attribution?
4. What are measured completeness, end-to-end lag, update/correction behavior and failure/missingness semantics by asset/venue? Does a source silently emit zero or current data for historical queries?
5. Can it distinguish unsupported capabilities, outages and stale cache? Does it expose stable event IDs, duplicate/revision semantics and reproducible pagination/checkpoints?
6. Are purportedly independent providers actually sharing upstream sources? What corroboration is affordable/possible for risk-critical fields?
7. What are documented quotas, burst behavior, historical/backfill limits, redistribution restrictions, attribution requirements and total costs at measured workload? No prices assumed here.
8. What server-only credential, allowlisted destination, privacy and bounded-response controls will be needed? No API key acquisition or integration in this phase.

Evaluate in order: mandatory capability feasibility → verifiability/history/rights → measured quality/failure handling → cost/operational fit → optional enrichment. A vendor's feature breadth or social popularity is not a quality criterion. Provider evaluation may recommend a combination, raw indexing plus calculations, a narrower initial universe, or a stop for inadequate data; it must not invent observations to close coverage gaps.

## 15. Completion and scope record

Follow-on planning: [RADAR_PROVIDER_EVALUATION.md](RADAR_PROVIDER_EVALUATION.md) maps these unchanged requirements to ten sources, including direct Pump/PumpSwap data and read-only GMGN, with conditional authority/stack recommendations. [RADAR_AI_EVALUATION.md](RADAR_AI_EVALUATION.md) defines the proprietary/open-weight bake-off and bounded research-agent option. These documents do not change the 80 candidate signals, 30 proposed mandatory signals, 31 capabilities, 21 mandatory capabilities, lane eligibility, scoring or freshness policy; recommendations and empirical testing still require human approval before implementation.

Deliverables A–J are defined above: minimum set (section 6), full inventory (3/6), provider matrix (9), Fast/Deep Lane eligibility (6), exclusions (6), chain recommendation (8), unresolved decisions/provider criteria (14), empirical validation (12). This document is complete as a **requirements baseline**, not as an approved production methodology.

Gate 19G software foundation remains approved. Production intelligence remains unconfigured pending requirements review, capability/provider evaluation, empirical method/freshness decisions and separately authorized implementation/activation. No live provider/model, API key, schema change, Fast Lane change, score weight, final threshold, deployment, feature-flag mutation or trading/execution capability is introduced by this document.

## Historical corpus acquisition status — 2026-09-20

A real 300-token Solana Pump corpus is now frozen for empirical preparation.
The manifest uses a 90-day, 13-bucket, outcome-independent selection process
and preserves creation provenance, current lifecycle reads and explicit
identity-only T+5M/T+15M/T+30M/T+1H/T+6H/T+24H checkpoint manifests. It does
not claim reconstructed historical market, liquidity or holder values. PumpSwap
pool linkage and future structural outcome labels remain open. This corpus is
an input to later methodology review, not a score, production threshold or
public Radar activation.

## Gap-closure status — 2026-09-20

The development acceptance layer now supports exact Pump bonding-curve
decoding, explicit holder/distribution derivation, provider conflict taxonomy,
conservative EVM semantic assessment and a structural historical-outcome label
contract. These utilities do not alter the 80-signal inventory, 30 proposed
mandatory signals, evidence tiers, scoring boundary or freshness policy.

The current measured coverage remains 23/30 any-source, 6/30
authoritative/direct, 8/30 objective-provider and 7/30 provider-derived-only;
seven signals remain missing or history-limited. Solana is not yet ready for
methodology design. Missing Pump event/migration, holder history, LP history,
creator history and balanced outcome data must be collected or explicitly
removed from mandatory status through a later approved decision.

The final corpus-phase tooling is documented in
[RADAR_HISTORICAL_CORPUS.md](RADAR_HISTORICAL_CORPUS.md). It supports frozen
cutoff manifests, structural labels, holder snapshots and bounded provider
studies, but does not claim that the current 108-token acceptance sample is a
balanced 300-token historical corpus. Solana remains MORE_DATA_WORK_REQUIRED.
