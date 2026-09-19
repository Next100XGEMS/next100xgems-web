import { describe, expect, it, vi } from "vitest";
import { classifyDeepLaneFailure, executeDeepLane, executeDeepLaneWork, prepareDeepLaneRequest, validateDeepLaneOutput, type RadarDeepLaneResult } from "@/lib/radar/deep-lane";
import { FixtureDeepLaneProvider } from "@/lib/radar/providers/fixture-deep-lane";
import type { RadarDeepLaneGateway, RadarDeepLaneReservation, RadarSealedManifest } from "@/lib/radar/system-gateway";

const preparedRequest = prepareDeepLaneRequest({
  workItemId: "work-1", tokenId: "token-1", reservedAnalysisVersion: 4,
  methodVersion: "fixture-method-v1", inputVersion: "fixture-input-v1",
  inputManifest: [{ observation_id: "observation-1", content_hash: "a".repeat(64) }],
  provider: "fixture", model: "fixture-model", modelRevision: "fixture-v1",
  adapterVersion: "fixture-deep-lane-v1", frozenInputHash: "b".repeat(64),
  evidence: [{ evidenceId: "evidence-1", contentHash: "c".repeat(64), classification: "VERIFIED_DATA", statement: "A bounded source observation." }],
});
const request = Object.freeze({ ...preparedRequest, requestHash: "a".repeat(64) });
const manifest: RadarSealedManifest = { workItemId: "work-1", tokenId: "token-1", reservedAnalysisVersion: 4, methodVersion: "fixture-method-v1", inputVersion: "fixture-input-v1", sealedInputHash: request.frozenInputHash, sealedAt: "2026-09-19T00:00:00.000Z", pauseGeneration: 1, inputManifest: [...request.inputManifest] };
const claimed = { workItemId: "work-1", workKind: "DEEP_ANALYSIS", tokenId: "token-1", worker: "worker-a", leaseToken: "lease-a", leaseGeneration: 1, pauseGeneration: 1 } as const;

function reservation(overrides: Partial<RadarDeepLaneReservation> = {}): RadarDeepLaneReservation { return { requestId: "request-1", requestHash: request.requestHash, requestState: "IN_PROGRESS", attemptId: "attempt-1", attemptNumber: 1, attemptState: "INVOKING", invocationOwner: true, providerIdempotencyKey: "deep-lane-v1:key-1", pauseGeneration: 1, workItemId: request.workItemId, tokenId: request.tokenId, reservedAnalysisVersion: request.reservedAnalysisVersion, taskType: request.taskType, methodVersion: request.methodVersion, inputVersion: request.inputVersion, schemaVersion: request.schemaVersion, outputSchemaVersion: request.outputSchemaVersion, inputHash: request.frozenInputHash, inputManifest: request.inputManifest, evidenceManifest: request.evidence, provider: request.provider, model: request.model, modelRevision: request.modelRevision, adapterVersion: request.adapterVersion, completionOutput: null, completionOutputHash: null, ...overrides }; }
function gateway(overrides: Partial<RadarDeepLaneGateway> = {}): RadarDeepLaneGateway { return { getWorkManifest: vi.fn().mockResolvedValue(manifest), reserveDeepLaneAttempt: vi.fn().mockResolvedValue(reservation()), completeDeepLaneAttempt: vi.fn(async ({ result }: { result: RadarDeepLaneResult }) => ({ ...result, outputHash: "d".repeat(64) })), failDeepLaneAttempt: vi.fn().mockResolvedValue("FAILED_RETRYABLE"), markDeepLaneUncertain: vi.fn().mockResolvedValue("UNCERTAIN"), ...overrides } as RadarDeepLaneGateway; }

describe("Radar provider-independent Deep Lane", () => {
  it("leaves request identity to the database reservation", () => { expect(preparedRequest.requestHash).toBeNull(); });
  it("binds fixture inference to the durable request and preserves AI_INFERENCE origin", async () => { const result = await executeDeepLane(new FixtureDeepLaneProvider(), request); expect(result.requestHash).toBe(request.requestHash); expect(result.outputHash).toBeNull(); expect(result.inferences[0]).toMatchObject({ classification: "AI_INFERENCE", origin: "INFERENCE", evidenceIds: ["evidence-1"] }); });
  it("rejects output that references unsealed evidence or attempts HTML", () => { expect(() => validateDeepLaneOutput({ schemaVersion: "deep-lane-output-v1", provider: "fixture", model: "fixture-model", modelRevision: "fixture-v1", requestHash: request.requestHash, generatedAt: "2026-09-19T00:00:00.000Z", inferences: [{ key: "bad", label: "Bad", statement: "<script>", uncertainty: "unknown", evidenceIds: ["other"] }] }, request)).toThrow(); });
  it("requires the authoritative database request hash", () => { const unbound = { ...request, requestHash: null }; expect(() => validateDeepLaneOutput({ schemaVersion: "deep-lane-output-v1", provider: "fixture", model: "fixture-model", modelRevision: "fixture-v1", requestHash: request.requestHash, generatedAt: "2026-09-19T00:00:00.000Z", inferences: [] }, unbound)).toThrow(/authoritative database request hash/); });
  it("rejects provider identity that is not trusted by the adapter", async () => { const adapter = new FixtureDeepLaneProvider(); await expect(adapter.request(request).then((raw) => validateDeepLaneOutput({ ...(raw as object), provider: "untrusted" }, request, { provider: adapter.provider, model: adapter.model, modelRevision: adapter.modelRevision, adapterVersion: adapter.adapterVersion }))).rejects.toThrow(); });
  it("distinguishes retryable failures from permanent failures", () => { expect(classifyDeepLaneFailure({ error: new Error("provider timeout"), attempt: 1, maxAttempts: 3 }).kind).toBe("TRANSIENT"); expect(classifyDeepLaneFailure({ error: new Error("malformed output"), attempt: 1, maxAttempts: 3 }).kind).toBe("PERMANENT"); });
  it("uses the database-returned request and output identities", async () => { const adapter = new FixtureDeepLaneProvider(); const active = gateway(); const result = await executeDeepLaneWork({ claimed, request, adapter, gateway: active }); expect(result.requestHash).toBe(request.requestHash); expect(result.outputHash).toBe("d".repeat(64)); expect(adapter.invocationCount).toBe(1); expect(adapter.invocationKeys).toEqual(["deep-lane-v1:key-1"]); expect(active.reserveDeepLaneAttempt).toHaveBeenCalledOnce(); });
  it("does not invoke the adapter for an in-progress duplicate or completed replay", async () => {
    const adapter = new FixtureDeepLaneProvider();
    const duplicate = gateway({ reserveDeepLaneAttempt: vi.fn().mockResolvedValue(reservation({ invocationOwner: false })) });
    await expect(executeDeepLaneWork({ claimed, request, adapter, gateway: duplicate })).rejects.toThrow(/already owned/);
    expect(adapter.invocationCount).toBe(0);
    const completedOutput = validateDeepLaneOutput({ schemaVersion: "deep-lane-output-v1", provider: "fixture", model: "fixture-model", modelRevision: "fixture-v1", requestHash: request.requestHash, generatedAt: "2026-09-19T00:00:00.000Z", inferences: [] }, request, { provider: "fixture", model: "fixture-model", modelRevision: "fixture-v1", adapterVersion: "fixture-deep-lane-v1" });
    const completed = executeDeepLaneWork({ claimed, request, adapter, gateway: gateway({ reserveDeepLaneAttempt: vi.fn().mockResolvedValue(reservation({ requestState: "SUCCEEDED", attemptState: "SUCCEEDED", invocationOwner: false, completionOutput: { ...completedOutput, outputHash: undefined }, completionOutputHash: "d".repeat(64) })) }) });
    await expect(completed).resolves.toMatchObject({ requestHash: request.requestHash });
    expect(adapter.invocationCount).toBe(0);
  });
  it("allows only one overlapping application request to invoke the adapter", async () => {
    const adapter = new FixtureDeepLaneProvider();
    let releaseReservation!: () => void;
    const reservationReleased = new Promise<void>((resolve) => { releaseReservation = resolve; });
    let reservations = 0;
    let enteredResolve!: () => void;
    const bothEntered = new Promise<void>((resolve) => { enteredResolve = resolve; });
    const concurrentGateway = gateway({
      reserveDeepLaneAttempt: vi.fn(async () => {
        reservations += 1;
        const invocationOwner = reservations === 1;
        if (reservations === 2) enteredResolve();
        await reservationReleased;
        return reservation({ invocationOwner });
      }),
    });
    const first = executeDeepLaneWork({ claimed, request, adapter, gateway: concurrentGateway });
    const second = executeDeepLaneWork({ claimed: { ...claimed, worker: "worker-b", leaseToken: "lease-b" }, request, adapter, gateway: concurrentGateway });
    await bothEntered;
    releaseReservation();
    const results = await Promise.allSettled([first, second]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(adapter.invocationCount).toBe(1);
    expect(concurrentGateway.reserveDeepLaneAttempt).toHaveBeenCalledTimes(2);
  });
  it("routes unknown provider execution to UNCERTAIN instead of blind retry", async () => { const adapter = new FixtureDeepLaneProvider(); adapter.request = vi.fn().mockRejectedValue(new Error("provider timeout after dispatch")); const active = gateway(); await expect(executeDeepLaneWork({ claimed, request, adapter, gateway: active })).rejects.toThrow(); expect(active.markDeepLaneUncertain).toHaveBeenCalledOnce(); expect(active.failDeepLaneAttempt).not.toHaveBeenCalled(); });
});
