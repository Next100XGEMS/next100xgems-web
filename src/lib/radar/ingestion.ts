import { sha256 } from "@/lib/radar/hash";
import { normalizeProviderObservation, type RadarNormalizationContext } from "@/lib/radar/normalization";
import { sanitizeRadarProviderError } from "@/lib/radar/errors";
import type { RadarFastLaneMethod, RadarNormalizedObservation, RadarProviderAdapter, RadarProviderRequest } from "@/lib/radar/contracts";
import type { RadarSealedManifest, RadarSystemGateway } from "@/lib/radar/system-gateway";

export type RadarIngestionInput = { eventKey: string; eventType: string; tokenId: string | null; sourceEventId: string | null; observedAt: string; context?: Record<string, unknown>; requests: readonly (RadarProviderRequest & { adapter: RadarProviderAdapter })[]; method: RadarFastLaneMethod };
export type RadarIngestionReceipt = { eventId: string; observationIds: readonly string[]; workItemId: string; observations: readonly RadarNormalizedObservation[]; sealedManifest: RadarSealedManifest };

export async function ingestRadarEvent(input: RadarIngestionInput, gateway?: RadarSystemGateway): Promise<RadarIngestionReceipt> {
  const active = gateway ?? (await import("@/lib/radar/system-gateway")).createRadarSystemGateway();
  if (!input.tokenId) throw new Error("Radar ingestion requires a canonical token.");
  if (input.requests.some((request) => request.tokenId !== input.tokenId)) throw new Error("Radar provider requests must use the canonical token.");
  const observations = await Promise.all(input.requests.map(async (request) => {
    try {
      const response = await request.adapter.observe(request);
      const expected: RadarNormalizationContext = { tokenId: request.tokenId, chain: request.chain, contractAddress: request.contractAddress, provider: request.adapter.provider, adapterVersion: request.adapter.adapterVersion, capability: request.capability, metricKey: request.metricKey, capabilities: request.adapter.capabilities };
      return normalizeProviderObservation(response, new Date().toISOString(), expected);
    } catch (error) {
      const safe = sanitizeRadarProviderError(error);
      throw new Error(`${safe.code}: ${safe.summary}`);
    }
  }));
  const canonicalObservationIdentity = observations.map((observation) => observation.contentHash).sort();
  const payloadHash = sha256({ eventKey: input.eventKey, eventType: input.eventType, tokenId: input.tokenId, sourceEventId: input.sourceEventId, observedAt: input.observedAt, observations: canonicalObservationIdentity });
  const eventId = await active.insertEvent({ eventKey: input.eventKey, eventType: input.eventType, tokenId: input.tokenId, sourceProvider: input.requests[0]?.adapter.provider ?? "unknown", sourceEventId: input.sourceEventId, payloadHash, context: input.context ?? {}, observedAt: input.observedAt });
  const observationIds: string[] = [];
  for (const observation of observations) observationIds.push(await active.recordObservation({ eventId, tokenId: input.tokenId, observation }));
  const requestKey = `screening:${input.eventKey}:${input.method.version}:${input.method.inputVersion}:${sha256({ observations: canonicalObservationIdentity })}`;
  const workItemId = await active.enqueueWork({ requestKey, workKind: "SCREENING", tokenId: input.tokenId, eventId, parentAnalysisId: null, methodVersion: input.method.version, inputVersion: input.method.inputVersion });
  for (const observationId of observationIds) await active.attachObservation(workItemId, observationId);
  const sealedManifest = await active.finalizeWorkInputs(workItemId, input.method.version, input.method.inputVersion);
  return { eventId, observationIds, workItemId, observations, sealedManifest };
}
