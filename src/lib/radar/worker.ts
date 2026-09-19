import { evaluateFastLane } from "@/lib/radar/fast-lane";
import { sanitizeRadarProviderError } from "@/lib/radar/errors";
import type { RadarFastLaneMethod, RadarNormalizedObservation } from "@/lib/radar/contracts";
import type { RadarSealedManifest, RadarSystemGateway } from "@/lib/radar/system-gateway";

export async function completeFastLaneWork(input: { workItemId: string; worker: string; leaseToken: string; leaseGeneration: number; observations: readonly RadarNormalizedObservation[]; sealedManifest: Pick<RadarSealedManifest, "workItemId" | "sealedInputHash"> }, method: RadarFastLaneMethod, gateway: RadarSystemGateway, evaluatedAt = new Date().toISOString()) {
  if (input.sealedManifest.workItemId !== input.workItemId) throw new Error("Fast Lane manifest does not match the work item.");
  const result = evaluateFastLane(method, input.observations, evaluatedAt, input.sealedManifest.sealedInputHash);
  const receipt = await gateway.completeScreening({ workItemId: input.workItemId, worker: input.worker, leaseToken: input.leaseToken, leaseGeneration: input.leaseGeneration, result });
  return { receipt, result };
}

export function failFastLaneWork(input: { workItemId: string; worker: string; leaseToken: string; leaseGeneration: number }, gateway: RadarSystemGateway, error: unknown, retryable?: boolean) {
  const safe = sanitizeRadarProviderError(error);
  return gateway.failWork({ ...input, retryable: retryable ?? safe.retryable, summary: `${safe.code}: ${safe.summary}` });
}
