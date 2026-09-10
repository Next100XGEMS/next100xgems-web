export type RadarFixtureStatus = "EARLY" | "TRENDING" | "HIGH_RISK";
export type RadarEvidenceKind = "VERIFIED DATA" | "STRONG SIGNAL" | "AI INFERENCE" | "UNKNOWN";
export type RadarFreshness = "FRESH" | "AGING" | "STALE" | "UNKNOWN";

export type RadarFixtureMetric = {
  label: string;
  value: string;
  context: string;
  state?: "available" | "unknown" | "stale" | "unsupported";
};

export type RadarFixtureEvidence = {
  kind: RadarEvidenceKind;
  label: string;
  context: string;
  provenance: string;
  freshness: RadarFreshness;
};

export type RadarFixtureSource = {
  label: string;
  state: "sample source" | "provider unavailable" | "not supported";
};

export type RadarFixture = {
  slug: string;
  tokenLabel: string;
  displayName: string;
  chain: string;
  contract: string;
  status: RadarFixtureStatus;
  score: string;
  methodologyVersion: string;
  freshness: RadarFreshness;
  freshnessContext: string;
  riskPosture: string;
  marketMetrics: RadarFixtureMetric[];
  onChainMetrics: RadarFixtureMetric[];
  evidence: RadarFixtureEvidence[];
  risks: string[];
  whyOnRadar: string[];
  providerState: string;
  editorialNote: string;
  publicationState: string;
  sources: RadarFixtureSource[];
};

// These fixtures are intentionally synthetic and never enter Supabase or production routes.
export const radarFixtures: readonly RadarFixture[] = [
  {
    slug: "sample-token-a",
    tokenLabel: "TOKEN A",
    displayName: "Sample Token A",
    chain: "sample-chain:dev",
    contract: "SAMPLE-ONLY-A",
    status: "EARLY",
    score: "72.4",
    methodologyVersion: "SAMPLE-METHOD-0.1",
    freshness: "FRESH",
    freshnessContext: "Sample observations are shown for interface validation only.",
    riskPosture: "Risk context in frame",
    marketMetrics: [
      { label: "Liquidity", value: "Available", context: "Sample state · no production value" },
      { label: "Trading activity", value: "Available", context: "Sample state · bounded window" },
      { label: "Market structure", value: "Partial", context: "One sample input is unavailable", state: "unknown" },
    ],
    onChainMetrics: [
      { label: "Holder concentration", value: "Unknown", context: "Provider response unavailable", state: "unknown" },
      { label: "Token age", value: "Available", context: "Sample observation" },
      { label: "Contract risk", value: "Not supported", context: "Sample chain has no adapter", state: "unsupported" },
    ],
    evidence: [
      { kind: "VERIFIED DATA", label: "Sample observation received", context: "A typed fixture value with a stated sample timestamp.", provenance: "Development fixture", freshness: "FRESH" },
      { kind: "STRONG SIGNAL", label: "Activity pattern", context: "A derived sample relationship, not a forecast.", provenance: "Deterministic sample rule", freshness: "FRESH" },
      { kind: "AI INFERENCE", label: "Narrative context", context: "Model-assisted context is represented without asserting a fact.", provenance: "Sample inference adapter", freshness: "AGING" },
      { kind: "UNKNOWN", label: "Holder concentration", context: "Unavailable data is not zero and does not indicate safety.", provenance: "Provider unavailable", freshness: "UNKNOWN" },
    ],
    risks: ["Holder concentration is unknown", "Contract capability is not supported for this sample chain", "Sample data is not a publication decision"],
    whyOnRadar: ["Shows how an early analytical context can be explained", "Separates available inputs from unknown inputs", "Exercises the review-ready presentation contract"],
    providerState: "Sample provider state: one capability unavailable; no live provider is connected.",
    editorialNote: "Sample editorial context. This record is not published intelligence.",
    publicationState: "SAMPLE · REVIEWED SHAPE ONLY",
    sources: [
      { label: "Fixture provenance", state: "sample source" },
      { label: "Holder provider", state: "provider unavailable" },
      { label: "Contract adapter", state: "not supported" },
    ],
  },
  {
    slug: "sample-token-b",
    tokenLabel: "TOKEN B",
    displayName: "Sample Token B",
    chain: "sample-chain:test",
    contract: "SAMPLE-ONLY-B",
    status: "HIGH_RISK",
    score: "38.0",
    methodologyVersion: "SAMPLE-METHOD-0.1",
    freshness: "STALE",
    freshnessContext: "Sample observations are intentionally past their display window.",
    riskPosture: "HIGH RISK",
    marketMetrics: [
      { label: "Liquidity", value: "Stale", context: "Last sample observation is outside its freshness window", state: "stale" },
      { label: "Trading activity", value: "Unknown", context: "Sample provider timed out", state: "unknown" },
      { label: "Market structure", value: "Unavailable", context: "No sample response received", state: "unknown" },
    ],
    onChainMetrics: [
      { label: "Holder concentration", value: "Available", context: "Sample observation · review context only" },
      { label: "Token age", value: "Available", context: "Sample observation" },
      { label: "Contract risk", value: "Flagged", context: "Sample deterministic risk context", state: "available" },
    ],
    evidence: [
      { kind: "VERIFIED DATA", label: "Sample contract flag", context: "A bounded sample risk observation with provenance.", provenance: "Development fixture", freshness: "STALE" },
      { kind: "STRONG SIGNAL", label: "Concentration pattern", context: "Sample signals require context and human review.", provenance: "Deterministic sample rule", freshness: "STALE" },
      { kind: "UNKNOWN", label: "Trading activity", context: "The provider timed out; no zero was substituted.", provenance: "Sample timeout", freshness: "UNKNOWN" },
      { kind: "AI INFERENCE", label: "Narrative context", context: "Inference is shown separately from sourceable data.", provenance: "Sample inference adapter", freshness: "STALE" },
    ],
    risks: ["Sample data is stale", "Several provider fields are unavailable", "Risk context is not a binary safety label"],
    whyOnRadar: ["Shows a prominent high-risk analytical status", "Makes stale and unknown inputs visible", "Demonstrates why publication requires current review"],
    providerState: "Sample provider state: timeout and stale observations are intentionally visible.",
    editorialNote: "Sample editorial context. This record is not published intelligence.",
    publicationState: "SAMPLE · NOT PUBLISHED",
    sources: [
      { label: "Fixture provenance", state: "sample source" },
      { label: "Market provider", state: "provider unavailable" },
      { label: "Contract adapter", state: "sample source" },
    ],
  },
];

export function getRadarFixture(slug: string) {
  return radarFixtures.find((fixture) => fixture.slug === slug);
}
