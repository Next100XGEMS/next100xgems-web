import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import {
  researchCategories,
  type ResearchArticle,
  type ResearchArticleSummary,
  type ResearchBodyBlock,
  type ResearchCategory,
  type ResearchClassification,
  type ResearchEvidenceKind,
} from "@/components/research/research-content";
import { hasResearchWhitespace, isBlankResearchText, isResearchPublicTimestamp, isResearchSourceDate, isResearchSourceUrl, unicodeCodePointLength } from "@/lib/research/text";

const CATEGORY_MAP: Record<string, ResearchCategory> = Object.fromEntries(
  researchCategories.map(([category]) => [category.toUpperCase().replaceAll(" ", "_"), category]),
) as Record<string, ResearchCategory>;

const CLASSIFICATION_MAP: Record<string, ResearchClassification> = {
  EDITORIAL: "editorial",
  SPONSORED: "sponsored",
  PARTNER: "partner",
};

const EVIDENCE_MAP: Record<string, ResearchEvidenceKind> = {
  VERIFIED_DATA: "verified-data",
  STRONG_SIGNAL: "strong-signal",
  AI_INFERENCE: "ai-inference",
  UNKNOWN: "unknown",
};

type PublicResearchListRow = {
  id: unknown;
  slug: unknown;
  title: unknown;
  dek: unknown;
  category: unknown;
  classification: unknown;
  ai_assisted: unknown;
  tldr: unknown;
  author: unknown;
  published_at: unknown;
  updated_at: unknown;
};

type PublicResearchArticleRow = PublicResearchListRow & {
  key_facts: unknown;
  body_blocks: unknown;
  disclosure: unknown;
  seo_title: unknown;
  seo_description: unknown;
  sources: unknown;
  related_research: unknown;
  related_tokens: unknown;
};

export class ResearchReadError extends Error {
  constructor() {
    super("Research is temporarily unavailable.");
    this.name = "ResearchReadError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedString(value: unknown, maxLength: number, required = true) {
  if (typeof value !== "string" || unicodeCodePointLength(value) > maxLength || (required && isBlankResearchText(value))) {
    throw new ResearchReadError();
  }
  return value;
}

function optionalString(value: unknown, maxLength: number) {
  if (value === null || value === undefined) return undefined;
  return boundedString(value, maxLength, false) || undefined;
}

function optionalProjectedString(value: unknown) {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== "string") throw new ResearchReadError();
  return value || undefined;
}

function dateString(value: unknown) {
  const result = boundedString(value, 64);
  if (!isResearchPublicTimestamp(result)) throw new ResearchReadError();
  return result;
}

function optionalDateString(value: unknown, maxLength: number) {
  if (value === null || value === undefined) return undefined;
  const result = boundedString(value, maxLength);
  if (!isResearchSourceDate(result)) throw new ResearchReadError();
  return result;
}

function mapCategory(value: unknown): ResearchCategory {
  const category = typeof value === "string" ? CATEGORY_MAP[value] : undefined;
  if (!category) throw new ResearchReadError();
  return category;
}

function mapClassification(value: unknown): ResearchClassification {
  const classification = typeof value === "string" ? CLASSIFICATION_MAP[value] : undefined;
  if (!classification) throw new ResearchReadError();
  return classification;
}

function mapAuthor(value: unknown) {
  if (!isRecord(value)) throw new ResearchReadError();
  return {
    name: boundedString(value.display_name, 160),
    role: optionalString(value.title, 160),
  };
}

function mapResearchBlock(value: unknown): ResearchBodyBlock {
  if (!isRecord(value) || typeof value.type !== "string") throw new ResearchReadError();

  switch (value.type) {
    case "paragraph":
      return { type: "paragraph", text: boundedString(value.text, 10000, false) };
    case "quote":
      return {
        type: "quote",
        text: boundedString(value.text, 10000, false),
        attribution: optionalString(value.attribution, 240),
      };
    case "callout":
      return {
        type: "callout",
        label: boundedString(value.label, 120),
        text: boundedString(value.text, 10000, false),
      };
    case "data_placeholder":
      return {
        type: "data-placeholder",
        label: boundedString(value.label, 160),
        description: boundedString(value.description, 10000, false),
      };
    default:
      throw new ResearchReadError();
  }
}

function mapBodyBlocks(value: unknown) {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.sections) || value.sections.length > 40) {
    throw new ResearchReadError();
  }

  const sectionIds = new Set<string>();
  return value.sections.map((section) => {
    if (!isRecord(section) || !Array.isArray(section.blocks) || section.blocks.length === 0 || section.blocks.length > 50) {
      throw new ResearchReadError();
    }

    const sectionId = boundedString(section.id, 80);
    if (hasResearchWhitespace(sectionId) || sectionIds.has(sectionId)) throw new ResearchReadError();
    sectionIds.add(sectionId);
    const blocks = section.blocks.map(mapResearchBlock);
    return {
      heading: boundedString(section.heading, 160),
      paragraphs: blocks.filter((block) => block.type === "paragraph").map((block) => block.text),
      blocks,
    };
  });
}

function mapEvidence(value: unknown): ResearchEvidenceKind | undefined {
  if (value === null || value === undefined) return undefined;
  const evidence = typeof value === "string" ? EVIDENCE_MAP[value] : undefined;
  if (!evidence) throw new ResearchReadError();
  return evidence;
}

function mapKeyFacts(value: unknown) {
  if (!Array.isArray(value) || value.length > 12) throw new ResearchReadError();
  return value.map((fact) => {
    if (!isRecord(fact)) throw new ResearchReadError();
    return {
      label: boundedString(fact.label, 120),
      detail: boundedString(fact.detail, 1000),
      evidence: mapEvidence(fact.evidence),
    };
  });
}

function safeSourceUrl(value: unknown) {
  const source = boundedString(value, 2048);
  if (!isResearchSourceUrl(source)) throw new ResearchReadError();
  return source;
}

function mapSources(value: unknown) {
  if (!Array.isArray(value) || value.length > 50) throw new ResearchReadError();
  return value.map((source) => {
    if (!isRecord(source)) throw new ResearchReadError();
    return {
      title: boundedString(source.title, 240),
      publisher: boundedString(source.publisher, 160),
      url: safeSourceUrl(source.url),
      publishedAt: optionalDateString(source.published_on, 32),
      accessedAt: optionalDateString(source.accessed_on, 32),
    };
  });
}

function mapRelatedResearch(value: unknown) {
  if (!Array.isArray(value) || value.length > 12) throw new ResearchReadError();
  return value.map((item) => {
    if (!isRecord(item)) throw new ResearchReadError();
    const slug = boundedString(item.slug, 160);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new ResearchReadError();
    return { slug, title: boundedString(item.title, 200), category: mapCategory(item.category) };
  });
}

function mapRelatedTokens(value: unknown) {
  if (!Array.isArray(value) || value.length > 12) throw new ResearchReadError();
  return value.map((item) => {
    if (!isRecord(item)) throw new ResearchReadError();
    return {
      symbol: optionalProjectedString(item.symbol),
      name: optionalProjectedString(item.name),
      chain: boundedString(item.chain, 120),
      contract: optionalProjectedString(item.contract_address),
    };
  });
}

function mapListRow(row: unknown): ResearchArticleSummary {
  if (!isRecord(row)) throw new ResearchReadError();
    const typedRow = row as PublicResearchListRow;
  if (typeof typedRow.ai_assisted !== "boolean") throw new ResearchReadError();
  const slug = boundedString(typedRow.slug, 160);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new ResearchReadError();
  return {
    id: boundedString(typedRow.id, 80),
    slug,
    title: boundedString(typedRow.title, 200),
    dek: optionalString(typedRow.dek, 500),
    category: mapCategory(typedRow.category),
    classification: mapClassification(typedRow.classification),
    aiAssisted: typedRow.ai_assisted,
    tldr: optionalString(typedRow.tldr, 1200),
    author: mapAuthor(typedRow.author),
    publishedAt: dateString(typedRow.published_at),
    updatedAt: dateString(typedRow.updated_at),
  };
}

function mapArticleRow(row: unknown): ResearchArticle {
  if (!isRecord(row)) throw new ResearchReadError();
  const typedRow = row as PublicResearchArticleRow;
  return {
    ...mapListRow(row),
    tldr: boundedString(typedRow.tldr, 1200),
    keyFacts: mapKeyFacts(typedRow.key_facts),
    sections: mapBodyBlocks(typedRow.body_blocks),
    sources: mapSources(typedRow.sources),
    relatedResearch: mapRelatedResearch(typedRow.related_research),
    relatedTokens: mapRelatedTokens(typedRow.related_tokens),
    disclosure: boundedString(typedRow.disclosure, 2000),
    seo: {
      title: optionalString(typedRow.seo_title, 200),
      description: optionalString(typedRow.seo_description, 320),
    },
  };
}

function createPublicResearchClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) throw new ResearchReadError();

  return createSupabaseClient(url, publishableKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
}

export async function readPublicResearchPage() {
  const { data, error } = await createPublicResearchClient().rpc("read_public_research_page", {
    p_category: null,
    p_cursor: null,
    p_limit: 20,
  });
  if (error || !Array.isArray(data)) throw new ResearchReadError();
  return data.map(mapListRow);
}

export async function readPublicResearchArticle(slug: string) {
  const { data, error } = await createPublicResearchClient().rpc("read_public_research_article", {
    p_slug: slug,
  });
  if (error || !Array.isArray(data)) throw new ResearchReadError();
  if (data.length === 0) return null;
  if (data.length !== 1) throw new ResearchReadError();
  return mapArticleRow(data[0]);
}
