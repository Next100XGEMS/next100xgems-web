# Universal Token Analyzer cost control

The Analyzer is selective by design: one primary evidence source, conditional
verification, cached normalized observations, and stable request/evidence
fingerprints. It must not query every provider for every request.

Before an AI call, the future runner estimates input/output cost and checks
per-analysis, daily, monthly, and escalation caps. Afterward it records model,
usage, latency, estimated cost, and provider-reported actual cost where known.
Budget failure is explicit `AI_BUDGET_EXCEEDED`; it never silently spends more.

Provider events and cost usage are bounded structured telemetry. API keys,
headers, cookies, raw prompts, hidden reasoning, and unbounded provider
responses are not retained. Slow-changing observations use their freshness
class; fresh cached evidence is reused for the same deterministic request.

No model provider or paid plan is selected or enabled by this foundation.
