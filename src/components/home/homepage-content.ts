export const trustSignals = [
  "First-party research",
  "Human-reviewed Radar publishing",
  "Clear commercial disclosures",
] as const;

export const distributionChannels = ["X", "Telegram", "YouTube", "Instagram"] as const;

export const radarStages = [
  {
    number: "01",
    label: "DISCOVER",
    description: "Market activity and new opportunities are detected.",
  },
  {
    number: "02",
    label: "FILTER",
    description: "Deterministic checks reduce obvious low-quality or risky candidates.",
  },
  {
    number: "03",
    label: "ANALYZE",
    description: "Market structure, on-chain context, and broader signals are evaluated.",
  },
  {
    number: "04",
    label: "REVIEW",
    description: "Human review occurs before public publication.",
  },
  {
    number: "05",
    label: "PUBLISH",
    description: "Approved intelligence appears with sources, freshness, and risk context.",
  },
] as const;

export const radarDimensions = [
  ["Market Structure", "Liquidity, activity, and market conditions."],
  ["Liquidity", "Depth and tradability context, not a promise of execution."],
  ["Holder Concentration", "Ownership distribution and concentration risk."],
  ["Momentum", "Changes in attention and activity over time."],
  ["Risk", "Contract, market, and evidence-aware risk context."],
  ["Narrative", "Social and thematic signals held apart from verified data."],
] as const;

export const researchPillars = [
  ["Market", "Context for the forces moving through crypto markets."],
  ["Memecoins", "A careful editorial frame for high-volatility narratives."],
  ["Altcoins", "Research that distinguishes signal from momentum."],
  ["Deep Dives", "Longer-form analysis with sources and a clear anatomy."],
] as const;

export const intelligenceLabels = [
  ["verified-data", "VERIFIED DATA", "A sourced or directly measured observation."],
  ["strong-signal", "STRONG SIGNAL", "A converging pattern that merits attention."],
  ["ai-inference", "AI INFERENCE", "A model-assisted interpretation, clearly identified."],
  ["unknown", "UNKNOWN", "An unresolved question kept visible instead of guessed."],
] as const;

export const methodologyRows = [
  ["radar", "RADAR", "Algorithmic and intelligence detection. It surfaces activity for review; it does not decide an investment outcome."],
  ["editorial", "EDITORIAL", "Independent research that explains evidence, context, and uncertainty."],
  ["sponsored", "SPONSORED", "Paid placement with visible disclosure and no influence over intelligence conclusions."],
  ["partner", "PARTNER", "A commercial relationship distinct from advertising, editorial coverage, and Radar results."],
] as const;

