export const radarPipeline = [
  ["01", "DISCOVER", "Identify relevant market activity."],
  ["02", "FILTER", "Apply deterministic screening and risk checks."],
  ["03", "ANALYZE", "Evaluate broader context where data is available."],
  ["04", "REVIEW", "Have a human review the proposed public presentation."],
  ["05", "PUBLISH", "Present approved intelligence with sources, freshness, and disclosures."],
] as const;

export const evidenceFramework = [
  ["verified-data", "VERIFIED DATA", "Directly supported by sourceable or structured information."],
  ["strong-signal", "STRONG SIGNAL", "Multiple indicators support an interpretation, but it is not a guaranteed fact or outcome."],
  ["ai-inference", "AI INFERENCE", "A model-assisted interpretation derived from available inputs and requiring appropriate caution."],
  ["unknown", "UNKNOWN", "Information is unavailable, incomplete, stale, or insufficiently verified."],
] as const;

export const radarDataCategories = [
  ["Market Structure", "Liquidity, activity, and changing market conditions."],
  ["Liquidity", "Depth and tradability context where coverage exists."],
  ["Volume / Trading Activity", "Activity patterns considered with their limitations."],
  ["Holder / Wallet Concentration", "Ownership distribution and concentration context."],
  ["Token Age", "Time since an asset or contract became observable."],
  ["Momentum", "Changes in attention and activity over time."],
  ["Contract / Technical Risk", "Technical and contract-level risk signals where available."],
  ["Narrative / Social Context", "Noisy thematic signals kept separate from verified data."],
  ["Freshness", "How current the relevant observation or update is."],
] as const;

export const radarStatuses = [
  ["early", "EARLY", "Activity or evidence is developing and may have limited history."],
  ["trending", "TRENDING", "Activity is showing a meaningful change that merits attention."],
  ["high-risk", "HIGH RISK", "Risk context is sufficiently important to make prominent."],
  ["unknown", "UNKNOWN", "Information is insufficient for a confident public presentation."],
] as const;

export const methodologyPrinciples = [
  "Evidence before hype.",
  "Sourceable claims where possible.",
  "Fact, inference, and unknown kept distinct.",
  "Commercial relationships disclosed in plain sight.",
  "Material information should prompt correction or update.",
  "No guaranteed-return claims.",
] as const;

export const contentClassifications = [
  ["radar", "RADAR", "Intelligence-system output presented with review, evidence, freshness, and context."],
  ["editorial", "EDITORIAL", "Independent research and explanation."],
  ["sponsored", "SPONSORED", "Paid content or placement with visible disclosure."],
  ["partner", "PARTNER", "Commercial partner relationship or related context."],
  ["advertisement", "ADVERTISEMENT", "Paid advertising inventory."],
  ["ai-assisted", "AI-ASSISTED", "AI contributed to analysis or production and should be read with appropriate context."],
] as const;

export const commercialServices = [
  "Sponsored Content",
  "Advertising",
  "Featured Partners",
  "Campaigns",
  "AMA",
  "Social Distribution",
] as const;
