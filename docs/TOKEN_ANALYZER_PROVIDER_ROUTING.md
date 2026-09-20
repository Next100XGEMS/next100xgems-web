# Universal Token Analyzer provider routing

Status: internal deterministic development phase. No provider is public,
paid, or execution-capable through this routing layer.

| Chain / input | Primary authority | Market source | Conditional source |
| --- | --- | --- | --- |
| Solana mint | Helius/Solana RPC plus validated Pump curve state | Birdeye token overview | DEX Screener pair comparison/fallback |
| Solana DEX URL | Exact URL pair identity, then checked base/quote response | DEX Screener pair response | Birdeye token overview (different scope) |
| Ethereum contract | Alchemy read-only RPC | DEX Screener | None activated |
| Base contract | Alchemy read-only RPC | DEX Screener | None activated |
| BNB contract | Alchemy read-only RPC | DEX Screener | None activated |

CoinGecko and GMGN routine enrichment are not connected. This pass adds no
providers. A DEX chart identifies its provider-declared base token; both base
and quote addresses are retained in the typed pair proof. A token URL cannot
change its embedded token address. EVM owner() is an owner observation, never
a creator/deployer assertion.

## Capability semantics

The collector advertises SUPPORTED, UNSUPPORTED, NOT_CONFIGURED, or
TEMPORARILY_UNAVAILABLE for each provider/capability pair. A capability is
not called when it is unsupported or unconfigured. Provider-derived fields
remain provider-derived; GMGN labels never become direct verified facts.

Current deterministic capabilities include token identity, supply/decimals,
Solana mint authorities, largest-account concentration, Pump lifecycle where
decoding succeeds, market price, market cap/FDV as separately labelled,
liquidity, pool identity where the pair identifier is a valid chain address,
volume, transaction activity, and creator/owner observations. Top trades, full
holder census, deployer history, and social/article interpretation remain
UNKNOWN or explicitly unavailable unless an accepted source supports them.

## Request safety and cost

Provider-integrity contract (development remediation): reserve from validated
input syntax before any provider request. Only the reservation owner resolves
pairs and collects evidence. URL hosts/paths and returned chain, pair and token
identities must agree; provenance labels cannot authorize identity changes.
Pair resolution retains a typed base/quote response proof, checked again at
persistence. Routine replay uses the existing 300-second delivery reuse policy,
not new timestamps or an indefinitely fresh provider cache.

Completed receipts contain only sealed analysis data. Append-only operational
telemetry is fetched separately and cannot change receipt contents. Market
observations retain scope, pool, quote and window metadata. Results expose all
scoped observations without choosing a winner or overwriting aggregate values
with pair values. Different scopes are structural differences, not numerical
disagreements. No price, liquidity, market-cap, FDV or volume is averaged.

Solana mint facts require an initialized Mint owned by SPL Token or Token-2022.
Token-2022 extensions are accepted only with Mint account type and a bounded,
well-formed TLV region. Largest accounts are a PARTIAL sample, never a census.
TOP10_TOTAL_SUPPLY_SHARE divides eligible top-account balances by verified raw
total supply; exclusions remove numerator accounts, not the total-supply
denominator. The ratio is OBJECTIVE_DERIVED, not a direct verified fact.

Provider calls are server-only and use an eight-second per-attempt timeout and a
2 MB streaming response limit. Redirects fail closed. Only 5xx responses
receive one bounded backoff retry; 429 uses fallback without retry. Timeout,
malformed JSON/RPC errors and other non-retryable failures stop immediately.
Attempts count actual outbound calls. Request outcome is separate from known
capability availability (absent/null availability is UNKNOWN).
Error telemetry is reduced to safe categories such
as TIMEOUT, RATE_LIMITED, and HTTP_4xx. No API key is printed, persisted,
sent to the browser, or included in telemetry.

The development ceiling is 50,000 estimated additional Helius credits. No
paid upgrade or production scheduler is authorized. Repeated routine requests
reuse the same sealed delivery inside the configured reuse window. The local
smoke runner must leave token_analyzer_enabled OFF after the run, while
token_analyzer_public_enabled remains OFF at all times.

Social/article retrieval is intentionally not live in this phase, and no AI,
Radar methodology, public publication, wallet, signing, or execution path is
connected.

## Controlled validation (not live internal testing)

The provider-integrity tests use the actual collector and local HTTP responses,
with separate database sessions in disposable local databases. A held advisory
lock plus pg_stat_activity/pg_blocking_pids proves overlap for two and five
default calls. Telemetry persistence is deliberately delayed until waiting
callers receive the sealed result; all callers and later retries must match.
Repeated inputs must produce zero additional provider calls. The opt-in external
smoke test is separate and now fails on each unresolved/missing required case
or failed provider request; it is not run during this remediation.

New additive migration: 20260920000006_token_analyzer_provider_integrity.sql.
Previously applied migrations are not rewritten. Development flags are not
enabled by migration or these tests. Only disposable test databases enable the
internal flag to exercise authenticated RPCs.

Validated in this remediation: 85 focused application regressions plus seven
real application/database integration cases pass (92 total); 29 clean migrations
and all 993 clean database tests pass. The full application suite has 234 passes,
19 intentional skips and the single pre-existing historical-universe fixture
failure (missing timeBucketed). Lint, typecheck, Webpack and diff checking pass.
No external live smoke was run. The development master/public/AI flags remain
OFF; the additive migration has only been applied to disposable test databases.
