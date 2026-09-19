import { describe, expect, it } from "vitest";
import { classifyDeepLaneFailure, executeDeepLane, prepareDeepLaneRequest, validateDeepLaneOutput } from "@/lib/radar/deep-lane";
import { FixtureDeepLaneProvider } from "@/lib/radar/providers/fixture-deep-lane";

const request = prepareDeepLaneRequest({ tokenId: "token-1", promptTemplateVersion: "fixture-template-v1", promptTemplateHash: "hash-template", evidence: [{ evidenceId: "evidence-1", contentHash: "hash-evidence", classification: "VERIFIED_DATA", statement: "A bounded source observation." }] });

describe("Radar provider-independent Deep Lane", () => {
  it("binds fixture inference to sealed inputs and preserves AI_INFERENCE origin", async () => { const result = await executeDeepLane(new FixtureDeepLaneProvider(), request); expect(result.requestHash).toBe(request.inputHash); expect(result.inferences[0]).toMatchObject({ classification: "AI_INFERENCE", origin: "INFERENCE", evidenceIds: ["evidence-1"] }); });
  it("rejects output that references unsealed evidence or attempts HTML", () => { expect(() => validateDeepLaneOutput({ schemaVersion: "deep-lane-output-v1", provider: "fixture", model: "fixture-model", modelRevision: "fixture-v1", requestHash: request.inputHash, generatedAt: "2026-09-19T00:00:00.000Z", inferences: [{ key: "bad", label: "Bad", statement: "<script>", uncertainty: "unknown", evidenceIds: ["other"] }] }, request)).toThrow(); });
  it("rejects a request mutated after its input hash was sealed", () => { const mutated = { ...request, promptTemplateVersion: "changed-template" }; expect(() => validateDeepLaneOutput({ schemaVersion: "deep-lane-output-v1", provider: "fixture", model: "fixture-model", modelRevision: "fixture-v1", requestHash: request.inputHash, generatedAt: "2026-09-19T00:00:00.000Z", inferences: [] }, mutated)).toThrow(/changed after sealing/); });
  it("rejects provider identity that is not trusted by the adapter", async () => { const adapter = new FixtureDeepLaneProvider(); await expect(adapter.request(request).then((raw) => validateDeepLaneOutput({ ...(raw as object), provider: "untrusted" }, request, { provider: adapter.provider, model: adapter.model, modelRevision: adapter.modelRevision }))).rejects.toThrow(); });
  it("distinguishes retryable failures from permanent failures", () => { expect(classifyDeepLaneFailure({ error: new Error("provider timeout"), attempt: 1, maxAttempts: 3 }).kind).toBe("TRANSIENT"); expect(classifyDeepLaneFailure({ error: new Error("malformed output"), attempt: 1, maxAttempts: 3 }).kind).toBe("PERMANENT"); });
});
