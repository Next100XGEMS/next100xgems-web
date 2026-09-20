export const ANALYZER_SCHEMA_VERSION = "token-analyzer-v1" as const;
export const ANALYZER_INPUT_TYPES = [
  "CONTRACT_ADDRESS", "TOKEN_MINT", "DEX_URL", "CHART_URL", "X_POST",
  "ARTICLE", "FACEBOOK_POST", "INSTAGRAM_POST", "GENERIC_URL", "UNKNOWN",
] as const;
export type AnalyzerInputType = (typeof ANALYZER_INPUT_TYPES)[number];

export const ANALYZER_STATUSES = [
  "ANALYZED", "PARTIAL", "INSUFFICIENT_DATA", "UNSUPPORTED_CHAIN",
  "TOKEN_NOT_RESOLVED", "PROVIDER_FAILURE", "FEATURE_DISABLED",
] as const;
export type AnalyzerStatus = (typeof ANALYZER_STATUSES)[number];

export type AnalyzerChain = "solana" | "ethereum" | "base" | "bnb" | "unknown";
export type AnalyzerEvidenceClass = "VERIFIED_DATA" | "STRONG_SIGNAL" | "AI_INFERENCE" | "UNKNOWN";
export type AnalyzerClaimVerification = "SUPPORTED" | "PARTIALLY_SUPPORTED" | "UNSUPPORTED" | "UNKNOWN";

export type AnalyzerInput = { raw: string; hintChain?: AnalyzerChain };
export type AnalyzerResolution = {
  inputType: AnalyzerInputType;
  source: string;
  chain: AnalyzerChain;
  tokenAddress: string | null;
  canonicalTokenId: string | null;
  pairAddress: string | null;
  poolAddress: string | null;
  symbol: string | null;
  name: string | null;
  decimals: string | null;
  supply: string | null;
  launchpad: string | null;
  creator: string | null;
  creationTimestamp: string | null;
  programOrContract: string | null;
  confidence: "RESOLVED" | "CANDIDATE_IDENTITY" | "PARTIAL" | "UNKNOWN";
  provenance: AnalyzerProvenance[];
};

export type AnalyzerProvenance = {
  source: string;
  kind: "DIRECT_INPUT" | "URL_STRUCTURE" | "DIRECT_CHAIN" | "OBJECTIVE_PROVIDER" | "PROVIDER_DERIVED" | "CONTEXTUAL_PROPRIETARY";
  reference: string | null;
  capturedAt: string;
};

export type AnalyzerObservation = {
  key: string;
  label: string;
  value: string | number | boolean | null;
  state: "AVAILABLE" | "UNKNOWN" | "UNAVAILABLE" | "UNSUPPORTED" | "STALE";
  evidenceClass: AnalyzerEvidenceClass;
  source: string;
  observedAt: string | null;
  evidenceId: string;
  provenance: AnalyzerProvenance[];
};

export type AnalyzerEvidenceManifest = {
  schemaVersion: typeof ANALYZER_SCHEMA_VERSION;
  manifestVersion: number;
  capturedAt: string;
  input: { type: AnalyzerInputType; rawHash: string };
  resolvedToken: AnalyzerResolution;
  observations: AnalyzerObservation[];
  claims: AnalyzerClaim[];
  providerConflicts: AnalyzerProviderConflict[];
  missing: string[];
  freshness: { state: "FRESH" | "STALE" | "UNKNOWN"; reason: string };
  methodologyVersion: string | null;
  manifestHash: string;
};

export type AnalyzerClaim = {
  claim: string;
  source: string;
  verification: AnalyzerClaimVerification;
  evidenceRefs: string[];
};

export type AnalyzerProviderConflict = {
  capability: string;
  providers: string[];
  state: "AGREEMENT" | "DISAGREEMENT" | "MISSING" | "STALE";
  explanation: string;
  evidenceRefs: string[];
};

export type AnalyzerScore = {
  value: number | null;
  max: 100;
  methodologyVersion: string | null;
  status: "SCORED" | "INCOMPLETE" | "METHODOLOGY_NOT_ACTIVE";
  components: Record<string, number | null>;
};

export type AnalyzerResult = {
  requestId: string;
  status: AnalyzerStatus;
  input: AnalyzerInput;
  resolvedToken: AnalyzerResolution;
  chain: AnalyzerChain;
  pair: { address: string | null; pool: string | null };
  freshness: AnalyzerEvidenceManifest["freshness"];
  dataConfidence: { state: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN"; coverage: number; reason: string };
  evidenceSummary: { total: number; available: number; unknown: number; sources: string[] };
  score: AnalyzerScore;
  market: Record<string, unknown>;
  liquidity: Record<string, unknown>;
  holders: Record<string, unknown>;
  creator: Record<string, unknown>;
  activity: Record<string, unknown>;
  topTrades: AnalyzerObservation[];
  whyMoving: { classification: AnalyzerEvidenceClass; explanation: string; evidenceRefs: string[] }[];
  claimVerification: AnalyzerClaim[];
  riskFactors: { key: string; state: "PRESENT" | "ABSENT" | "UNKNOWN"; explanation: string; evidenceRefs: string[] }[];
  unknowns: string[];
  positionSizing: PositionSizingResult;
  aiInterpretation: { status: "DISABLED" | "NOT_REQUESTED" | "AVAILABLE"; provider: string | null; model: string | null; content: unknown | null };
  citations: AnalyzerProvenance[];
  providerConflicts: AnalyzerProviderConflict[];
  methodologyVersion: string | null;
  schemaVersion: typeof ANALYZER_SCHEMA_VERSION;
  createdAt: string;
};

export type PositionSizingInput = { portfolioCapital: string; maxRiskPercent: string; entryPrice: string; invalidationPrice: string; maxPositionNotional?: string };
export type PositionSizingResult = { status: "AVAILABLE" | "POSITION_SIZE_UNAVAILABLE" | "INVALID_INPUT"; riskBudget: string | null; stopDistancePercent: string | null; positionNotional: string | null; reason: string };
