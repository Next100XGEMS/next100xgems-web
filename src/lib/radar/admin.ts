import "server-only";

import type { AuthorizationContext } from "@/lib/auth/authorization";
import type { RadarAdminRecord, RadarAnalysisStatus, RadarReviewState } from "@/lib/radar/admin-types";

export class RadarAdminReadError extends Error {
  constructor() { super("Radar administration is temporarily unavailable."); this.name = "RadarAdminReadError"; }
}

function row(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new RadarAdminReadError();
  return value as Record<string, unknown>;
}
function stringValue(value: unknown): string | null { return typeof value === "string" && value.length > 0 ? value : null; }
function requiredString(value: unknown): string { const result = stringValue(value); if (!result) throw new RadarAdminReadError(); return result; }
function integerValue(value: unknown, fallback = 0): number { return typeof value === "number" && Number.isInteger(value) ? value : fallback; }
function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T { return typeof value === "string" && allowed.includes(value as T) ? value as T : fallback; }
async function checked<T>(promise: PromiseLike<{ data: T; error: unknown }>): Promise<T> { const result = await promise; if (result.error) throw new RadarAdminReadError(); return result.data; }

const analysisStatuses = ["EARLY", "TRENDING", "HIGH_RISK", "REJECTED"] as const;
const reviewStates = ["PENDING", "APPROVED", "PUBLISHED", "REJECTED", "HIDDEN"] as const;

export async function listRadarAdminRecords(context: AuthorizationContext): Promise<RadarAdminRecord[]> {
  const analyses = await checked(context.supabase.from("radar_analyses").select("id,token_id,version,status,score,risk_summary,analyzed_at,data_as_of,run_type,work_item_id,public_eligibility").order("analyzed_at", { ascending: false }).limit(100));
  const analysisRows = Array.isArray(analyses) ? analyses.map(row) : [];
  const analysisIds = analysisRows.map((item) => requiredString(item.id));
  const tokenIds = [...new Set(analysisRows.map((item) => stringValue(item.token_id)).filter((item): item is string => item !== null))];
  const workIds = [...new Set(analysisRows.map((item) => stringValue(item.work_item_id)).filter((item): item is string => item !== null))];
  const [tokens, workItems, evidence, reviews] = await Promise.all([
    tokenIds.length ? checked(context.supabase.from("tokens").select("id,chain,contract_address,symbol,name").in("id", tokenIds)) : Promise.resolve([]),
    workIds.length ? checked(context.supabase.from("radar_work_items").select("id,state,method_version,input_hash,sealed_at,screening_result").in("id", workIds)) : Promise.resolve([]),
    analysisIds.length ? checked(context.supabase.from("radar_evidence").select("analysis_id").in("analysis_id", analysisIds)) : Promise.resolve([]),
    context.permissions.includes("radar.read.review") && analysisIds.length ? checked(context.supabase.from("radar_reviews").select("id,analysis_id,state,revision,editorial_note,public_note,public_disclosure").in("analysis_id", analysisIds)) : Promise.resolve([]),
  ]);
  const tokenById = new Map((Array.isArray(tokens) ? tokens : []).map((item) => { const value = row(item); return [requiredString(value.id), value] as const; }));
  const workById = new Map((Array.isArray(workItems) ? workItems : []).map((item) => { const value = row(item); return [requiredString(value.id), value] as const; }));
  const evidenceCount = new Map<string, number>();
  for (const item of Array.isArray(evidence) ? evidence : []) { const id = stringValue(row(item).analysis_id); if (id) evidenceCount.set(id, (evidenceCount.get(id) ?? 0) + 1); }
  const reviewByAnalysis = new Map((Array.isArray(reviews) ? reviews : []).map((item) => { const value = row(item); return [requiredString(value.analysis_id), value] as const; }));
  return analysisRows.flatMap((analysis) => {
    const analysisId = requiredString(analysis.id); const tokenId = stringValue(analysis.token_id); const token = tokenId ? tokenById.get(tokenId) : undefined;
    if (!tokenId || !token) return [];
    const work = stringValue(analysis.work_item_id) ? workById.get(requiredString(analysis.work_item_id)) : undefined;
    const review = reviewByAnalysis.get(analysisId);
    return [{
      reviewId: review ? stringValue(review.id) : null, analysisId, tokenId,
      chain: requiredString(token.chain), contractAddress: requiredString(token.contract_address), symbol: stringValue(token.symbol), name: stringValue(token.name),
      analysisVersion: integerValue(analysis.version, 1), status: oneOf(analysis.status, analysisStatuses, "REJECTED") as RadarAnalysisStatus,
      score: stringValue(analysis.score), riskSummary: stringValue(analysis.risk_summary), analyzedAt: requiredString(analysis.analyzed_at), dataAsOf: requiredString(analysis.data_as_of),
      publicEligible: analysis.public_eligibility === true, runType: stringValue(analysis.run_type) ?? "LEGACY",
      workState: work ? stringValue(work.state) : null, workMethodVersion: work ? stringValue(work.method_version) : null, workInputHash: work ? stringValue(work.input_hash) : null,
      screeningResult: work ? (oneOf(work.screening_result, ["PASS", "REJECT", "INCOMPLETE"] as const, "INCOMPLETE") as "PASS" | "REJECT" | "INCOMPLETE") : null,
      evidenceCount: evidenceCount.get(analysisId) ?? 0,
      reviewState: review ? (oneOf(review.state, reviewStates, "PENDING") as RadarReviewState) : null,
      reviewRevision: review ? integerValue(review.revision, 1) : null,
      editorialNote: review ? stringValue(review.editorial_note) : null, publicNote: review ? stringValue(review.public_note) : null, publicDisclosure: review ? stringValue(review.public_disclosure) : null,
    } satisfies RadarAdminRecord];
  });
}
