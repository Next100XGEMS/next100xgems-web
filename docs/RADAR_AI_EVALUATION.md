# Radar Production AI Evaluation and Bake-off Specification

Research date: **2026-09-20**. Status: **evaluation design complete; no benchmark executed, model selected or integration authorized**. Requirements: [production intelligence](RADAR_PRODUCTION_INTELLIGENCE.md); acquisition/authority: [provider evaluation](RADAR_PROVIDER_EVALUATION.md). Gate 19G durable Deep Lane remains authoritative; this document does not alter it.

## 1. Decision and architectural boundary

Evaluate roles separately: routine evidence synthesis, difficult-case escalation, rare adjudication, social context and open-weight shadow analysis. The winner is not necessarily the newest, largest or cheapest model. The primary question is **whether every assertion stays within the supplied evidence and preserves uncertainty**. No model is allowed to generate a production score, choose weights, infer absent observations, certify safety or publish.

Core Deep Lane stays:

```text
approved frozen evidence manifest
 → one bounded model invocation under durable authority
 → strict structured output
 → deterministic identity/schema/reference checks + evidence-quality review
 → accepted AI_INFERENCE, or explicit invalid/incomplete disposition
```

Fast Lane is independent of AI. No network tools, browser, shell, wallet, signing, trading or database mutation capability is given to the core model. Supplied token metadata, social posts, provider labels and embedded instructions are untrusted data. Neither a model's confidence nor agreement between models upgrades a claim to VERIFIED_DATA.

## 2. Current candidate register

Official sources below establish available interfaces and advertised limits, **not Radar performance**. Rates are USD per million uncached input / billed output tokens, standard text API, excluding tax, search/tools, cache writes/storage and long-context premiums. Reasoning can consume billed output without appearing in the final answer. Context is a model ceiling, not permission to send unlimited Radar input. RPM/TPM and concurrency are account/model-tier dependent and remain **UNKNOWN for our accounts** until provisioned; no throughput promise is inferred from context length. Pin a concrete revision where available, not a moving `latest` alias; otherwise record unresolved revision identity and restrict reproducibility claims.

| Candidate / API identity | Proposed experimental role | Official context / schema support | Standard input / output rate | Qualification and source |
|---|---|---|---|---|
| OpenAI GPT-5.6 Luna, `gpt-5.6-luna` | Routine, high-volume comparator | 1.05M; structured outputs | $0.20 / $1.20 | Cost-efficient candidate, not presumed evidence-faithful. [Model](https://developers.openai.com/api/docs/models/gpt-5.6-luna) |
| OpenAI GPT-5.6 Sol, `gpt-5.6-sol` | Escalation | 1.05M; structured outputs | $4 / $20 | Promotional rates stated through at least Nov 21, 2026; >272K input premium. [Model](https://developers.openai.com/api/docs/models/gpt-5.6-sol) |
| OpenAI GPT-6 Astra, `gpt-6-astra` | Rare adjudication | 1.05M; structured outputs | $10 / $50 | Cost premium must buy measured improvement; >272K input premium. [Model](https://developers.openai.com/api/docs/models/gpt-6-astra) |
| Anthropic Claude Sonnet 5, `claude-sonnet-5` | Routine quality comparator / escalation | 1M; structured output support must be exercised against our schema | $2 / $10 | Current canonical pricing canceled the earlier planned Sep 1 increase. [Pricing](https://platform.claude.com/docs/en/about-claude/pricing), [models](https://platform.claude.com/docs/en/models/overview) |
| Anthropic Claude Opus 5, `claude-opus-5` | Escalation / adjudication comparator | 1M; structured outputs | $5 / $25 | Test conflicting evidence, not general benchmark rank. [Opus guide](https://platform.claude.com/docs/en/models/opus-5/whats-new-opus-5), [schema contract](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) |
| Google Gemini 3.8 Flash, `gemini-3.8-flash` | Routine | 1,048,576 input; structured outputs | $0.75 / $3.75 through Dec 31, 2026; announced $1.50 / $7.50 from Jan 1, 2027 | Stable September release; reasoning settings affect cost/latency. [Model](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash), [pricing](https://ai.google.dev/gemini-api/docs/pricing) |
| Google Gemini 3.1 Pro Preview, `gemini-3.1-pro-preview` | Optional stronger-tier escalation comparison | 1,048,576 input; structured outputs | $2 / $12 up to 200K input; $4 / $18 above | Preview lifecycle risk; do not presume stronger than newer Flash on this task. [Model](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-pro-preview), [pricing](https://ai.google.dev/gemini-api/docs/pricing) |
| xAI Grok 4.6, `grok-4.6` | Social specialist; isolated no-tools control | 500K; structured outputs documented | $2 / $6 below long-context tier; $4 / $12 from 200K input | Search is separate from model knowledge and separately metered. [Models](https://docs.x.ai/developers/models), [pricing](https://docs.x.ai/developers/pricing) |
| Mistral Small 4, `mistral-small-2603` | Routine and open-weight shadow | 256K; reasoning/instruct + structured outputs | $0.15 / $0.60 | Apache 2.0 model, hosted API available. [Model](https://docs.mistral.ai/models/mistral-small-4-0-26-03) |
| Qwen3.8-27B, exact hosted weight revision TBD | Open-weight shadow; possible future routine | 262,144 native, extensible 1M; schema enforcement depends on host/runtime | UNKNOWN / host-specific | Apache 2.0; official card says managed 27B service coming soon, so do not claim that endpoint is available. [Card](https://huggingface.co/Qwen/Qwen3.8-27B) |
| Qwen3.8-Flash-Next, pinned weights | Optional open-weight shadow | 262,144 native, extensible 1M; host schema test required | UNKNOWN / endpoint-specific | Experimental architecture, custom license; official hosted Qwen3.8-Flash is based on it, not automatically identical weights. [Card](https://huggingface.co/Qwen/Qwen3.8-Flash-Next) |
| Moonshot Kimi K3, `kimi-k3` | Optional escalation / open-weight comparison | 1M; JSON-schema example in official guide | Announced $3 / $15; current account rate/cache-write terms reconfirm | Custom-license open weights, very large deployment footprint. [Guide](https://platform.kimi.ai/docs/guide/kimi-k3-quickstart), [official launch rate](https://forum.moonshot.ai/t/kimi-k3-is-here-our-most-capable-model/480), [current billing](https://platform.kimi.ai/docs/pricing/chat) |

These are **12 named bake-off candidates**, not 12 subscriptions to buy immediately. API endpoint entitlement, revision pinning, limits, schema subset, refusal/truncation behavior and data terms must pass an account-level preflight before an approved experiment. No advertised output-format feature proves semantic faithfulness.

Other current options assessed but deferred: Mistral Medium 3.5 ($1.50/$7.50) or Large 3 ($0.50/$1.50) may be added only if Small's failures justify another open-family comparator ([official API pricing](https://mistral.ai/pricing/api/), [catalog](https://docs.mistral.ai/models)). Qwen3.8-2.4T-A95B is too large for an initial self-host plan and adds a custom-license review; see section 4. Claude Fable-class premium expansion is deferred: Opus/Astra already provide expensive comparison roles, and Covered Model retention constraints need separate review. Coding-only, speech/image-generation models and autonomous multi-agent products are NOT NEEDED for frozen text-evidence synthesis. Older Qwen3.6 models were researched but superseded in this shortlist by current 3.8 cards; no stale “latest” claim.

## 3. Privacy, licensing, output and account gates

| Family | Evidence and risk | Preflight condition for Radar |
|---|---|---|
| OpenAI | API data-control table distinguishes training, abuse logs and application storage; typical abuse retention is up to 30 days, with endpoint/model-specific arrangements. [Data controls](https://developers.openai.com/api/docs/guides/your-data) | Review actual model/project retention and storage settings; no assumption `store=false` removes every log. No unnecessary stateful conversations, files or tools |
| Anthropic | API retention is feature/model-dependent; Covered Models impose additional retention. [Retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention) | Review Sonnet/Opus account terms and exceptions; do not assume consumer-chat privacy applies to API or vice versa |
| Google | Pricing distinguishes free data-use from paid service treatment. [API terms](https://ai.google.dev/gemini-api/terms), [pricing](https://ai.google.dev/gemini-api/docs/pricing) | Paid API project for permitted nonpublic benchmark data; region, logging and grounding terms reviewed separately |
| xAI | API security/retention controls differ from consumer/CLI settings. [Security FAQ](https://docs.x.ai/developers/faq/security) | Confirm account ZDR/retention, X retrieval/caching/display rights and search billing; minimize search-query disclosure |
| Mistral | Model weight license is not API processing/privacy contract. [Model licensing](https://help.mistral.ai/en/articles/347393-under-which-license-are-mistral-s-open-models-available), [legal](https://legal.mistral.ai/) | Verify hosted region/retention/training settings; exact API data terms UNKNOWN until account review |
| Qwen / Kimi | Weight license, third-party host terms and data location are distinct | Pin artifacts/serving engine; verify host authorization, privacy, retention and subprocessor rights. Hosting quotes/SLAs UNKNOWN; no open-weight = private assumption |

All API access stays in an approved server-side benchmark process, separate per provider/environment, least privilege and spend-capped. No API key, secret header, raw prompt, hidden reasoning or unbounded response metadata goes into Git, public Radar or audit prose. Store validated final structured content, sanitized diagnostics, usage counts and provider/model revision references. Do not request chain-of-thought; measure reasoning-token cost without retaining hidden reasoning. Proprietary API models have no assumed self-host/fine-tune rights. Procurement must also permit sending the licensed BE/GM/CG/etc. data to model processors; a provider subscription alone does not grant that right.

## 4. Open weights, hosted first, self-host later

Open weights are useful for vendor independence, controlled shadow comparison and possibly later domain adaptation, **not evidence that quality, privacy or serving cost is automatically better**. Core schema validation remains project-owned. First test a licensed hosted endpoint with exact artifact/quantization identification; if none exists at acceptable terms, defer that candidate rather than silently use a different model. No GPU purchase or deployment now.

| Model | Architecture / license | Reasoning / structured output / hosted path | Self-host and fine-tune assessment |
|---|---|---|---|
| Mistral Small 4 | 119B total, 6.5B active MoE; Apache 2.0 | Hybrid reasoning/instruct; Mistral API structured outputs; pinned weights also available | ~238 GB BF16 or ~59.5 GB ideal 4-bit weight-only lower bound; realistic serving requires overhead and often multiple accelerators. Adapters/fine-tuning technically possible, but corpus rights and separate evaluation required. [Weights](https://huggingface.co/mistralai/Mistral-Small-4-119B-2603) |
| Qwen3.8-27B | 27B language model plus vision components; Apache 2.0 | Thinking configurable; constrain JSON through qualified serving runtime, not a promise from weights. Managed service status on model card is coming soon | ~54 GB BF16 / ~13.5 GB ideal 4-bit LM weights, excluding vision/KV/runtime. Short-context quantized single-accelerator experiments plausible; long context/concurrency can require much more. Best compact shadow candidate; later adapter fine-tuning only after generalization/rights proof. [Card](https://huggingface.co/Qwen/Qwen3.8-27B) |
| Qwen3.8-Flash-Next | 125B base with 6B active + 51B n-gram embeddings + 4B MTP; custom Community License 1.0 | Experimental architecture; native 262K context, optional extension; hosted Flash relative not assumed exact parity | ~360 GB BF16 / ~90 GB ideal 4-bit for 180B, plus overhead. Active-parameter count is NOT resident memory. Hosted benchmark conditional on exact revision and license; self-host/fine-tune later only. [License](https://huggingface.co/Qwen/Qwen3.8-Flash-Next/raw/main/LICENSE) |
| Kimi K3 | 2.8T total / 104B active MoE, custom Kimi K3 License, 1M context | Hosted Kimi API; structured-output guide; released quantized weights | Ideal 4-bit weight floor ~1.4 TB before overhead: multi-node/expert serving is not a beta recommendation. Hosted escalation first; fine-tuning permitted subject to terms but economically deferred. [Card](https://huggingface.co/moonshotai/Kimi-K3), [license](https://huggingface.co/moonshotai/Kimi-K3/raw/main/LICENSE) |
| Qwen3.8-2.4T-A95B — DEFER | 2.4T total / 95B active; custom Qwen3.8-Max license; 262,144 native context | Hosted Max differs from open artifact in features; JSON/host parity not certified | ~1.2 TB ideal 4-bit weights before overhead; no justification for local procurement. Potential future hosted comparator, not initial self-host. [Card](https://huggingface.co/Qwen/Qwen3.8-2.4T-A95B), [license](https://huggingface.co/Qwen/Qwen3.8-2.4T-A95B/raw/main/LICENSE) |

Hardware values above are **our arithmetic lower bounds**, parameters × bytes/weight, decimal GB/TB—not measured VRAM requirements or cloud quotes. KV cache, activation buffers, quantization scales, unused expert residence, CPU offload, tensor/expert parallelism, context length and throughput alter requirements. A theoretical weight fit does not establish service latency. Full fine-tuning adds optimizer/gradient memory and can be much larger; no training budget is assumed.

License-specific cautions: Flash-Next's custom terms require separate permission for certain Model-as-a-Service/AI Work Assistant businesses, with internal-use exceptions and large-service attribution conditions. Max's corresponding business condition uses an aggregate revenue threshold. Kimi's custom license has its own Model-as-a-Service revenue and large-product attribution terms. Have the actual proposed deployment reviewed; do not conflate these with Apache 2.0 or describe all Qwen/Kimi weights as unrestricted open source. Fine-tuning rights do not grant rights to vendor data, scraped posts or other models' outputs.

Any future fine-tuned Radar model needs a separately approved, provenance-complete training corpus, no test-set contamination, baseline comparison, missingness/adversarial regressions and versioned rollback. Do not train a model to mimic a vendor's opaque risk labels or optimize token returns.

## 5. Frozen-manifest dataset design

Propose **400 independently curated cases**, split by token/deployer cluster and time: 80 development, 80 calibration and 240 sealed holdout. These are experiment sizes, not production thresholds. Human approval of cost/data rights precedes collection. Multiple time snapshots of one token stay in the same split; source families and token names are balanced. Use as-known-at-time evidence with later outcomes hidden from models. Known popular historical tokens can leak through pretraining: include prospective shadow cases and a pseudonymized-content arm, reporting that pseudonymization does not remove every leakage channel.

| Primary stratum | Proposed cases | Required evidence/annotation |
|---|---|---|
| Organic activity, diverse participation | 40 | Complete comparable windows; uncertainty remains even with healthy-looking activity |
| Rapid pumps and abnormal bursts | 40 | Raw trade/flow/window coverage; distinguish activity from quality |
| Failed/quiet launches | 35 | Include delisted/inactive assets and gaps; no survivor-only sampling |
| Objectively established harmful/rug events | 30 | Specific verifiable event and adjudicated label; disputed allegations separate |
| Concentrated holdings | 30 | Owner census/exclusions and denominator; no beneficial-owner invention |
| Healthy distribution controls | 30 | Comparable complete census; no safety guarantee |
| Cross-provider conflicts | 35 | Preserve scope/time/quote differences and genuinely unresolved conflicts |
| Missing / unsupported / outage cases | 30 | All missing states distinguished; counterfactual no-zero/no-safe traps |
| Stale evidence | 30 | As-of time and explicit state; age policy fixture only, not production duration |
| Pump bonding-curve and migration transitions | 40 | Split curve versus graduated examples; completion != migration; exact quote/reserves |
| GMGN proprietary-label challenges | 30 | Smart-money/KOL/bundler claims with confirming, refuting and absent raw evidence |
| Misleading social/news context | 30 | Copy-paste, paid promotion, stale/retracted claims, wrong-token aliases |

Total **400**; secondary tags deliberately overlap. “Healthy,” “rug” and “pump” are curator strata, not model targets for financial probability. Event labels require a stated objective criterion and supporting evidence; uncertain cases remain disputed rather than forced into scam/non-scam. No return/PnL/profit or buy/sell success objective.

Each case package includes canonical chain/token, as-of time, admitted evidence IDs/content hashes, normalized values/units, available-at/source times, state/missingness, provider/decoder provenance, conflicts, input/method/schema version and manifest fingerprint. No fresh web lookup is permitted during core evaluation. Do not reconstruct past holders/authority with today's values. If historical truth is unavailable, label that gap; collect prospectively rather than fabricate it.

Create an annotation ledger with supported atomic claims, contradicted claims, permissible inferences, required uncertainties, forbidden assertions and source-reference mappings. Two independent human reviewers adjudicate high-risk/disputed items; record unresolved disagreements and inter-rater agreement. LLM judging can assist triage but is not sole ground truth or self-certification by the tested model.

## 6. Experimental protocol and acceptance evidence

1. **Freeze preflight:** approve rights/retention, exact model/host/revision, prompt version, schema, reasoning/sampling parameters, token/tool budgets and dataset splits. Confirm limits using account documentation before any future requests. No unknown endpoint silently replaced.
2. **Contract tests before quality ranking:** valid JSON, unexpected fields, empty/truncated/refused output, Unicode, decimal strings, invalid/out-of-manifest references, wrong work/token/model/hash, provider outage and oversized output. Never coerce an unsupported claim into accepted evidence.
3. **Paired comparison:** identical bounded evidence content and task instructions across models; provider-specific schema transport differences recorded. Randomize call order, separate warm/cold/cache tests and record region, queue time, retries and model revision. Do not feed one model another's answer in the primary round.
4. **Three repetitions per evaluated case/model** as an initial variability sample. These are distinct authorized benchmark runs, not repeated HTTP delivery under one completed durable request. Replaying one receipt three times would measure dedupe, not model reproducibility. Keep benchmark case ID separate from durable work/request identity; never weaken production receipt/fence rules.
5. **Perturbation arm:** reorder evidence/object keys; preserve meaning; vary irrelevant names/formatting; remove key evidence; inject contradictory provider claims, stale facts and hostile token metadata. Check faithful abstention and contradiction reporting, not just fluent wording.
6. **Blind human scoring:** reviewers see source evidence and anonymized final outputs, not model brand/cost. Claim-level labeling and critical omissions precede stylistic preference. Store reviewer rationale succinctly, not model hidden reasoning.
7. **Report uncertainty:** paired confidence intervals by case/cluster, per-stratum failures and abstention rates; no pooled average hiding catastrophic evidence fabrication. Small cohort uncertainty is explicit. Do not equate no observed failures with guaranteed reliability.
8. **Lock calibration before holdout:** select experiment acceptance criteria and routing rule candidates with humans using calibration data; evaluate once on holdout. No invented final production cutoff in this document. Extend sample when decision uncertainty remains.
9. **Prospective shadow:** after separate integration authorization, observe real outages/cost/latency and changing schemas without public influence. Re-test whenever model revision, prompt, quantization, data-source recipe or schema changes.

### Measurement register

| Dimension | Operational measurement |
|---|---|
| Structured validity | First-response schema pass, refusal, truncation and repair rate separately; cost/latency includes failed attempts |
| Evidence fidelity | Supported atomic claims / adjudicated factual claims; reference entailment, exact amounts/units and attribution correctness |
| Hallucination / unsupported claims | Fabricated events/entities/citations separately from plausible but unsupported assertions; count severity and cases affected |
| UNKNOWN handling | Correct uncertainty/abstention; missing or stale fact incorrectly called zero/absent/safe; unsupported controls acknowledged |
| Contradictions | Detection, source-specific explanation, and unresolved state preserved rather than convenient source selection |
| Risk awareness | Recall/precision of supported risk evidence; omission and unjustified alarm; no scam probability unless separately validated |
| Provenance discipline | Citation points to allowed frozen evidence AND supports the claim; copied references alone do not pass |
| Reproducibility | Semantic claim/uncertainty stability across independent runs, not byte equality or receipt replay |
| Latency / reliability | Queue and end-to-end p50/p95, timeout/429/failure, accepted-result latency; streaming first token not completion |
| Usage / cost | Uncached/cached input, visible and reasoning output where available, cache writes, tool items, retries and invalid responses; cost per accepted evidence-faithful result |
| Rate / context | Account RPM/TPM/concurrency, saturation, omitted evidence under input cap; advertised context tested at realistic manifest size |
| Licensing / privacy | Artifact/API rights, hosted region, retention/training controls, vendor-data model-input rights, export/deletion |
| Tool dependence | Core tools-disabled control; social retrieval tested separately on fixed retrieved corpus and on live acquisition |

Quality gates precede cost ranking. A cheap model producing unsupported certainty does not win; a premium model does not waive a failed contract. Publish no overall “accuracy” without denominator, label scope and confidence interval. Select by role-specific evidence/cost tradeoffs after the experiment, not coding leaderboards.

## 7. Existing Deep Lane contract fit

Inspected `src/lib/radar/deep-lane.ts`, the system-gateway context boundary, and [Gate 19G documentation](RADAR_IMPLEMENTATION_PLAN.md). Current request is `deep-lane-request-v2`, task `DEEP_ANALYSIS`, result `deep-lane-output-v1`. Durable context includes work, token, reserved analysis version, exact observation/evidence manifests, method/input/schema versions and trusted adapter/provider/model/revision. PostgreSQL owns canonical request/output hashes. Historical receipt replay is lease-free **only for exact context match**; new invocation remains fenced/leased/pause-checked. No framework may own a parallel authoritative job state.

The existing output admits a bounded inference array (at most 32), bounded labels/statements/uncertainty, and 1–16 allowed evidence references per inference. Classification/origin are constrained to **AI_INFERENCE / INFERENCE**. Plan the model response inside that shape; do not add score/risk-edit/publish fields. A cited VERIFIED_DATA input does not convert model text into VERIFIED_DATA. Trusted identity is adapter configuration, never provider/model strings supplied by untrusted text.

Syntax/reference validation is necessary but insufficient: a real existing evidence ID may still be cited for a claim it does not support. The bake-off explicitly tests entailment/unsupported claims; passing foundation tests is not empirical model approval. Oversized manifests need a separately reviewed deterministic evidence-selection policy, not silent truncation or free-form model selection of convenient facts.

The proposed research-context envelope is not automatically compatible with the existing input classifications (`VERIFIED_DATA`, `STRONG_SIGNAL`, `UNKNOWN`). Future integration must establish an approved honest representation for each admitted contextual claim, or keep it outside the core run pending a separately authorized contract change. Do not relabel raw social/proprietary context as STRONG_SIGNAL merely to fit the schema. No input-schema expansion is authorized here.

Preserve bounded explicit retries, uncertain-call handling and durable completion. A timeout after possible provider execution is not proof the model never ran. Actual provider idempotency support must be demonstrated before same-key recovery is claimed; no reviewed model API is certified here for exactly-once external execution. No production retry count is selected. Benchmark calls, if later approved, need their own finite request and dollar budgets without changing Gate 19G semantics.

## 8. Cost-aware routing proposal, not activation policy

```text
Fast Lane PASS with method-eligible, adequate frozen inputs
 → routine candidate model
 → independent schema/reference/uncertainty/evidence-quality checks
 → accept bounded inference OR escalate an eligible difficult case
 → stronger model with the same frozen facts
 → rare adjudication/human review if unresolved
```

Fast Lane REJECT/INCOMPLETE is not rescued by persuasive AI. Missing required evidence should trigger acquisition/INCOMPLETE, not ever-more-expensive speculation. Model self-confidence cannot be the sole escalation gate. Candidate triggers include contradictory evidence, unsupported claims, invalid structured response or genuinely difficult interpretation, evaluated against the calibration set. Bounded escalation depth/spend is required; exact production cutoffs and routes remain undecided.

No majority-vote scoring. Multiple models may repeat a shared training error or the same proprietary GMGN label. Premium adjudication is another untrusted analysis, not truth or auto-publication. Unresolved cases remain unresolved. A separately approved Fast-only method can remain useful without AI; do not downgrade a combined method implicitly when its required AI fails.

## 9. Social lane: separate retrieval from analysis

Propose a **Grok 4.6 + X Search experiment**, not selection. Compare against the same fixed licensed post/news package summarized by a routine model; this separates retrieval quality from model quality. Grok without search does not have live X access merely by model identity. Use original post/news IDs, author, timestamps, retrieval scope, query and citation references. No private Telegram/community collection or implied permission to retain all posts.

Possible tasks: narrative changes, attributed KOL attention, coverage-qualified mention velocity, repeated/copy-paste content and reported news events. Search samples are not the entire X population; popularity, engagement and “smart money” are manipulable. Synchronized content is an indicator, not proof of coordination. Social conclusions remain CONTEXT / AI_INFERENCE; no direct VERIFIED_DATA upgrade or popularity-driven Radar score. A news claim affecting chain facts requires separate objective verification.

Pricing change: [official X Search docs](https://docs.x.ai/developers/tools/x-search) announce **Sep 21, 2026, 12:00 PM PT**, replacing $5/1,000 calls with **$5/1,000 posts fetched and $10/1,000 user profiles fetched**; parent/quoted posts count. Budget future experiments against the announced item-based rate and reconfirm actual billing. Model tokens are additional. Cap queries, tool iterations and returned items independently. Retrieval latency, deleted content, retractions, bot/promotion bias and licensing are measured; no hidden unlimited search loop.

## 10. Agent frameworks: optional research tooling, not core orchestration

| Framework | Current evidence / license | Potential benefit | Recommendation for this project |
|---|---|---|---|
| LangGraph / LangGraph.js | Explicit graph/checkpoints and durable execution; JS/TS path. [Overview](https://docs.langchain.com/oss/javascript/langgraph/overview), [MIT license](https://github.com/langchain-ai/langgraphjs/blob/main/LICENSE) | Bounded research-tool workflow, explicit branches and human handoff | First framework to evaluate **only if** a separately approved read-only research agent outgrows a small existing TS workflow. Not required for core Deep Lane; checkpoint replay cannot replace PG attempt authority |
| PydanticAI | Typed Python agents, validated output and testing. [Overview](https://pydantic.dev/docs/ai/overview/), [output](https://pydantic.dev/docs/ai/core-concepts/output/), [MIT license](https://github.com/pydantic/pydantic-ai/blob/main/LICENSE) | Offline evaluation/research experiments with strong Python typing | Optional isolated research harness; no justification to add a Python production service to the monolith solely for this |
| Microsoft Agent Framework | Successor path from AutoGen/Semantic Kernel; Python/.NET workflows. [Migration](https://learn.microsoft.com/en-us/agent-framework/migration-guide/from-autogen/), [repository/MIT](https://github.com/microsoft/agent-framework) | Enterprise workflow/checkpoint integrations if an approved host already uses that stack | DEFER; adds runtime/platform surface without a demonstrated Radar need. Do not start a new AutoGen implementation |
| No added framework | Existing TS interfaces + deterministic validation + durable PostgreSQL contracts | Smallest, most transparent frozen-input evaluation boundary | **Recommended for core Deep Lane and initial bake-off design**. No package install authorized |

Framework retry/checkpoint semantics can rerun a model node; they are not evidence of exactly-once external calls. Separate optional research checkpoints from the existing work/receipt authority. Commercial tracing/cloud products have separate pricing/privacy from open framework licenses. No shell, general browser automation, filesystem agent, skill auto-install or auto-generated tools are needed here.

### Proposed bounded read-only Research Agent

This is an architectural option, **not an implemented subsystem**. Approved inputs: token/case scope, permitted time window, capability allowlist and finite spend/step budget. Brokered tools may read Pump state, GMGN read-only, Helius RPC, BE, CG, DS only after rights clearance, and licensed X/news/web sources. No general-purpose RPC forwarding or arbitrary URLs: method/host allowlists must exclude send/simulate/build/trade/claim operations; query POST is allowed only when explicitly read-only. Credentials stay outside model-visible prompts/tool results.

Output is a bounded **structured context package**: canonical token, as-of/query scope, source/item IDs, source and retrieval timestamps, attributed statements, observation state, exact units, evidence references, classification, conflicts, coverage gaps, acquisition cost and sanitized tool disposition. This is a proposed external acquisition envelope, not a new DB schema or existing DTO. Validate identity/provenance, licensing, prompt-injection content, limits and freshness before trusted code admits any context into a **new sealed manifest**. Never append live research to an already frozen run.

The agent cannot score, publish, change VERIFIED_DATA, invoke privileged database functions, choose providers dynamically, alter quotas/policies, trade, sign or execute transactions. Tool failure remains missingness. Research tools cannot grant SYSTEM authority. Independent core evaluation compares with/without admitted context to quantify incremental benefit and hallucination risk.

## 11. Experimental cost envelope

Formula: total = uncached input × input rate + cached input × cache rate + billed output/reasoning × output rate + cache writes/storage + tools + retry/failure usage + hosted endpoint minimums. Rates per million tokens must be converted accordingly. No promise of cache hit rate, batch discount or no hidden reasoning cost.

Illustrative equal-sized call: **30,000 input + 3,000 total billed output** tokens, no tools/cache/long-context premium. This is a budget scenario, not a model token cap or product threshold.

| Model | Example dollars/call | 1,200 calls (400 cases × 3) |
|---|---|---|
| Luna | $0.0096 | $11.52 |
| Gemini Flash at current introductory rate | $0.03375 | $40.50 |
| Sonnet 5 | $0.09 | $108 |
| Mistral Small 4 | $0.0063 | $7.56 |
| Sol | $0.18 | $216 |
| Opus 5 | $0.225 | $270 |
| Astra | $0.45 | $540 |
| Gemini Pro Preview, short context | $0.096 | $115.20 |
| Grok, short context, tools disabled | $0.078 | $93.60 |
| Kimi K3, announced uncached rate | $0.135 | $162; reconfirm billing |
| Hosted Qwen / other exact open artifacts | UNKNOWN | Obtain endpoint token/GPU-hour/minimum-uptime quote |

A staged experiment could run the first four routine models across 400 × 3 cases (**$167.58 token-only**), Sol/Opus/Pro across an identified 100 × 3 difficult-case subset (**$150.30**), and Astra across 40 × 3 cases (**$54**): **$371.88 illustrative token-only subtotal**. Qwen/Kimi/social runs, human annotation, source acquisition, storage/hosting, failures, longer reasoning and any extra repetitions are **additional**. This is not an approved budget or expected bill; all primary models use the same full cases, while escalation rankings must use matched hard-case subsets. If reasoning output is larger, recalculate rather than truncating cost from the report.

At the announced X rate, 10,000 retrieved posts + 1,000 profiles would add **$60 retrieval fees**, separate from model tokens; sample sizes are budgeting examples, not approved collection. Fixed provider subscriptions remain in [provider evaluation section 11](RADAR_PROVIDER_EVALUATION.md#11-costrate-model-with-explicit-assumptions). Keep four ledgers: data subscriptions, variable data usage, worker/storage infrastructure, and AI tokens/tools/host. There is no defensible all-in monthly production total without measured arrivals, route frequency, context sizes and approved subscriptions.

Before any experiment, human approves a hard total cap, provider subcaps and stop-on-budget behavior. No auto top-up, automatic stronger model or uncapped retry/search. Costs for invalid/refused/uncertain outcomes remain in the denominator; report accepted evidence-faithful results per dollar, not raw request count.

## 12. Final shortlist and decision gates

| Classification | Candidates | Why included / boundary |
|---|---|---|
| PRIMARY BAKE-OFF | Luna; Sonnet 5; Gemini 3.8 Flash; Mistral Small 4 | Paired routine structured evidence comparison across cost levels; no winner |
| ESCALATION BAKE-OFF | Sol; Opus 5; optional Gemini 3.1 Pro Preview and Kimi K3 | Same difficult manifests; determine incremental value before routine use |
| RARE ADJUDICATION BAKE-OFF | Astra; Opus comparator | Small, human-adjudicated hard subset; premium model not automatic truth |
| SOCIAL SPECIALIST | Grok 4.6 + bounded X Search, fixed-corpus routine control | Separate retrieval from interpretation; no social score authority |
| OPEN-WEIGHT BAKE-OFF | Hosted Small 4 and Qwen3.8-27B; Flash-Next conditional on exact hosting/license | Shadow first; portability, schema behavior and actual cost measured |
| DEFER | Kimi/Qwen large self-hosting; Qwen Max; extra Mistral Medium/Large; additional premium families; fine-tuning | No unique requirement yet justifies operational/licensing/budget expansion |
| NOT NEEDED | Trading agents, coding/shell agents, autonomous agent swarms, multimodal generation | Outside Radar analytical role |

Required human decisions before implementation:

1. Approve the initial Solana/Pump universe, provider stack, data rights and quota budget in the [combined provider checklist](RADAR_PROVIDER_EVALUATION.md#16-concrete-human-approvalsaccounts-before-implementation).
2. Approve dataset scope/rights, prospective shadow collection, reviewers and a **bake-off-only** spend cap; no public influence.
3. Choose which accounts to provision: OpenAI API project, Claude Console API workspace, Google paid API project and Mistral Studio for the primary experiment; optional xAI/X Search and Kimi API only if those comparisons are approved. Consumer subscriptions do not substitute for API accounts.
4. Approve a specifically named hosted endpoint for pinned Qwen/open-weight comparison after price, retention, region, model parity and license review. Do not buy GPUs. If unavailable, document the deferred experiment honestly.
5. Approve supervised worker/benchmark hosting and secrets delivery through a secure manager; no keys in chat/docs/Git. Give the research process read-only provider scope, not Radar database mutation/publication authority.
6. After results, decide role-specific models, actual retry/routing budgets and any production methodology contribution in a separate review. Scoring weights/formulas, freshness durations, final thresholds and public activation remain undecided.

No empirical winner, production AI, account purchase, credential, SDK/framework dependency, implementation, schema, feature flag, trading/execution capability or remote push is introduced by this document.
