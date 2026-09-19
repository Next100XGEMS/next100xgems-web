import { describe, expect, it, vi } from "vitest";
import { createFastLaneMethod } from "@/lib/radar/methods";
import { FixtureRadarProvider } from "@/lib/radar/providers/fixture";
import { ingestRadarEvent } from "@/lib/radar/ingestion";
import type { RadarSystemGateway } from "@/lib/radar/system-gateway";

const method = createFastLaneMethod({ version: "fixture-fast-lane-v1", inputVersion: "fixture-input-v1", rules: [{ key: "liquidity", capability: "market", metricKey: "liquidity", required: true }] });
const manifest = { workItemId: "work-1", tokenId: "token-1", reservedAnalysisVersion: 1, methodVersion: method.version, inputVersion: method.inputVersion, sealedInputHash: "a".repeat(64), sealedAt: "2026-09-19T00:00:00.000Z", pauseGeneration: 1, inputManifest: [{ observation_id: "observation-1", content_hash: "b".repeat(64) }] } as const;

function gateway(): RadarSystemGateway {
  return { insertEvent: vi.fn().mockResolvedValue("event-1"), recordObservation: vi.fn().mockResolvedValue("observation-1"), enqueueWork: vi.fn().mockResolvedValue("work-1"), attachObservation: vi.fn().mockResolvedValue(undefined), finalizeWorkInputs: vi.fn().mockResolvedValue(manifest), claimWork: vi.fn(), getWorkManifest: vi.fn(), completeScreening: vi.fn(), renewWork: vi.fn(), failWork: vi.fn() };
}

describe("Radar ingestion RPC boundary", () => {
  it("normalizes, persists, deduplicates through database RPCs, and finalizes screening inputs", async () => {
    const active = gateway();
    const provider = new FixtureRadarProvider([{ capability: "market", metricKey: "liquidity", state: "AVAILABLE", value: "120.5" }]);
    const receipt = await ingestRadarEvent({ eventKey: "fixture-event-1", eventType: "OBSERVATION", tokenId: "token-1", sourceEventId: "source-1", observedAt: "2026-09-19T00:00:00.000Z", method, requests: [{ tokenId: "token-1", chain: "fixture:test", contractAddress: "FIXTURE", capability: "market", metricKey: "liquidity", observedAt: "2026-09-19T00:00:00.000Z", adapter: provider }] }, active);
    expect(receipt).toMatchObject({ eventId: "event-1", observationIds: ["observation-1"], workItemId: "work-1", sealedManifest: manifest });
    expect(active.enqueueWork).toHaveBeenCalledWith(expect.objectContaining({ workKind: "SCREENING", methodVersion: method.version }));
    expect(active.finalizeWorkInputs).toHaveBeenCalledWith("work-1", method.version, method.inputVersion);
  });

  it("rejects a provider request that escapes the canonical token scope", async () => {
    const provider = new FixtureRadarProvider([{ capability: "market", metricKey: "liquidity", state: "AVAILABLE", value: "120.5" }]);
    await expect(ingestRadarEvent({ eventKey: "fixture-event-2", eventType: "OBSERVATION", tokenId: "token-1", sourceEventId: "source-2", observedAt: "2026-09-19T00:00:00.000Z", method, requests: [{ tokenId: "token-2", chain: "fixture:test", contractAddress: "FIXTURE", capability: "market", metricKey: "liquidity", observedAt: "2026-09-19T00:00:00.000Z", adapter: provider }] }, gateway())).rejects.toThrow("canonical token");
  });
});
