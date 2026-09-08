import type { ResearchCategory, ResearchEvidenceKind } from "@/components/research/research-content";

export type ResearchDbStatus = "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";
export type ResearchDbClassification = "EDITORIAL" | "SPONSORED" | "PARTNER";
export type ResearchDbCategory = "MARKET" | "MEMECOINS" | "ALTCOINS" | "DEEP_DIVES";
export type ResearchDbEvidence = "VERIFIED_DATA" | "STRONG_SIGNAL" | "AI_INFERENCE" | "UNKNOWN";

export type ResearchInputSource = {
  id?: string;
  title: string;
  publisher: string;
  url: string;
  published_on?: string | null;
  accessed_on?: string | null;
};

export type ResearchInputFact = { label: string; detail: string; evidence?: ResearchDbEvidence };
export type ResearchAdminBlock =
  | { type: "paragraph"; text: string }
  | { type: "quote"; text: string; attribution?: string }
  | { type: "callout"; label: string; text: string }
  | { type: "data_placeholder"; label: string; description: string };
export type ResearchInputSection = { id: string; heading: string; blocks: ResearchAdminBlock[] };

export type ResearchEditorInput = {
  title: string;
  slug: string;
  dek: string;
  category: ResearchDbCategory | "";
  classification?: ResearchDbClassification;
  ai_assisted: boolean;
  tldr: string;
  body_blocks: { version: 1; sections: ResearchInputSection[] };
  key_facts: ResearchInputFact[];
  disclosure: string;
  seo_title: string;
  seo_description: string;
  sources: ResearchInputSource[];
  related_research: string[];
  related_tokens: string[];
  author_id?: string;
  reason?: string;
};

export type AdminResearchAuthor = { profile_id: string; display_name: string; title: string | null };
export type AdminResearchToken = { id: string; chain: string; contract_address: string | null; symbol: string | null; name: string | null };
export type AdminResearchRelation = { id: string; title: string; slug: string; category: ResearchDbCategory | null; status: ResearchDbStatus; updated_at: string };

export type AdminResearchSummary = {
  id: string; slug: string; title: string; category: ResearchDbCategory | null; classification: ResearchDbClassification;
  ai_assisted: boolean; status: ResearchDbStatus; author_id: string | null; public_author_id: string | null;
  tldr: string; scheduled_at: string | null; published_at: string | null; updated_at: string; revision: number;
};

export type AdminResearchArticle = AdminResearchSummary & {
  dek: string | null; body_blocks: { version: 1; sections: ResearchInputSection[] }; key_facts: ResearchInputFact[];
  disclosure: string; seo_title: string | null; seo_description: string | null; created_at: string;
  sources: ResearchInputSource[]; related_research: string[]; related_tokens: string[];
};

export type AdminResearchReadModel = {
  articles: AdminResearchSummary[];
  authors: AdminResearchAuthor[];
  relations: AdminResearchRelation[];
  tokens: AdminResearchToken[];
};

export const categoryLabels: Record<ResearchDbCategory, string> = {
  MARKET: "Market", MEMECOINS: "Memecoins", ALTCOINS: "Altcoins", DEEP_DIVES: "Deep Dives",
};

export const statusLabels: Record<ResearchDbStatus, string> = {
  DRAFT: "Draft", SCHEDULED: "Scheduled", PUBLISHED: "Published", ARCHIVED: "Archived",
};

export const classificationLabels: Record<ResearchDbClassification, string> = {
  EDITORIAL: "Editorial", SPONSORED: "Sponsored", PARTNER: "Partner",
};

export const evidenceLabels: Record<ResearchDbEvidence, string> = {
  VERIFIED_DATA: "Verified data", STRONG_SIGNAL: "Strong signal", AI_INFERENCE: "AI inference", UNKNOWN: "Unknown",
};

export function toPublicCategory(category: ResearchDbCategory): ResearchCategory {
  return categoryLabels[category] as ResearchCategory;
}

export function toPublicEvidence(evidence?: ResearchDbEvidence): ResearchEvidenceKind | undefined {
  return evidence ? ({ VERIFIED_DATA: "verified-data", STRONG_SIGNAL: "strong-signal", AI_INFERENCE: "ai-inference", UNKNOWN: "unknown" } as const)[evidence] : undefined;
}
