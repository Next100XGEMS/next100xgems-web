import { describe, expect, it } from "vitest";
import { buildHistoricalCorpus, corpusCategoryCounts, createHistoricalCheckpoints, createSolanaHolderSnapshot, runBoundedStudy, selectFrozenSolanaCandidates, unresolvedSignalDecisions } from "@/lib/radar/acceptance";

const baseSample = { sampleId: "solana-001", chain: "solana" as const, mint: "mint", category: "ACTIVE_CURVE" as const, launchObservedAt: "2026-09-20T00:00:00.000Z", cutoffs: [{ name: "T+5M" as const, cutoffAt: "2026-09-20T00:05:00.000Z", inputManifestHash: "hash-5m" }, { name: "T+15M" as const, cutoffAt: "2026-09-20T00:15:00.000Z", inputManifestHash: "hash-15m" }, { name: "T+1H" as const, cutoffAt: "2026-09-20T01:00:00.000Z", inputManifestHash: "hash-1h" }, { name: "T+24H" as const, cutoffAt: "2026-09-21T00:00:00.000Z", inputManifestHash: "hash-24h" }], labels: ["SURVIVED_24H" as const], labelEvidence: ["direct-event"], split: "TRAIN" as const, selectionReason: "bounded fixture selection" };

describe("Radar historical validation tooling", () => {
  it("freezes point-in-time samples and does not claim readiness below target", () => {
    const corpus = buildHistoricalCorpus({ samples: [baseSample], frozenAt: "2026-09-21T00:00:00.000Z", labelVersion: "labels-v1", selectionRules: ["no look-ahead"] });
    expect(corpus.readyForMethodology).toBe(false);
    expect(corpus.corpusHash).toMatch(/^[a-f0-9]{64}$/);
    expect(corpusCategoryCounts([baseSample])).toMatchObject({ ACTIVE_CURVE: 1 });
  });

  it("rejects investment and intent labels", () => {
    expect(() => buildHistoricalCorpus({ samples: [{ ...baseSample, labels: ["BUY" as never] }], frozenAt: "2026-09-21T00:00:00.000Z", labelVersion: "labels-v1", selectionRules: ["bounded"] })).toThrow(/unsafe/);
  });

  it("creates hashed holder snapshots with explicit partial coverage", () => {
    const snapshot = createSolanaHolderSnapshot({ token: "mint", slot: "123", observedAt: "2026-09-20T00:00:00.000Z", source: "helius", commitment: "confirmed", decoderVersion: "holders-v1", coverage: "PARTIAL", balances: [{ address: "a", balance: "70" }, { address: "b", balance: "30" }], topN: 1 });
    expect(snapshot).toMatchObject({ coverage: "PARTIAL", snapshotHash: expect.stringMatching(/^[a-f0-9]{64}$/), concentration: { eligibleTotal: "100", top: [{ address: "a" }] } });
  });

  it("bounds controlled provider studies with timeout and retries", async () => {
    const result = await runBoundedStudy(["ok", "slow", "fail"], async (item) => {
      if (item === "slow") await new Promise((resolve) => setTimeout(resolve, 150));
      if (item === "fail") throw new Error("provider unavailable");
      return item.toUpperCase();
    }, { concurrency: 2, timeoutMs: 100, maxAttempts: 1 });
    expect(result.values).toEqual(["OK"]);
    expect(result.results).toEqual(expect.arrayContaining([
      expect.objectContaining({ item: "ok", success: true }),
      expect.objectContaining({ item: "slow", success: false, errorCode: "TIMEOUT" }),
      expect.objectContaining({ item: "fail", success: false, errorCode: "STUDY_ERROR" }),
    ]));
  });

  it("prevents future observations from entering earlier checkpoints", () => {
    const observations = [{ observedAt: "2026-09-20T00:04:00.000Z", source: "chain", value: "early" }, { observedAt: "2026-09-20T00:06:00.000Z", source: "chain", value: "future-for-five-minutes" }];
    const checkpoints = createHistoricalCheckpoints({ launchObservedAt: "2026-09-20T00:00:00.000Z", observations });
    const earlyOnly = createHistoricalCheckpoints({ launchObservedAt: "2026-09-20T00:00:00.000Z", observations: observations.slice(0, 1) });
    expect(checkpoints.find((item) => item.cutoff === "T+5M")?.state).toBe("REPLAYABLE");
    expect(checkpoints.find((item) => item.cutoff === "T+5M")?.inputManifestHash).toBe(earlyOnly.find((item) => item.cutoff === "T+5M")?.inputManifestHash);
    expect(checkpoints.find((item) => item.cutoff === "T+15M")?.inputManifestHash).not.toBe(earlyOnly.find((item) => item.cutoff === "T+15M")?.inputManifestHash);
  });

  it("selects a frozen corpus deterministically without outcome ranking", () => {
    const candidates = ["a", "b", "c"].map((mint) => ({ mint, launchObservedAt: "2026-09-20T00:00:00.000Z", category: "ACTIVE_CURVE" as const, source: "fixture", selectionReason: "stratum" }));
    expect(selectFrozenSolanaCandidates(candidates, 2, "seed")).toEqual(selectFrozenSolanaCandidates([...candidates].reverse(), 2, "seed"));
  });

  it("records explicit recommendations for the seven unresolved signals", () => {
    expect(Object.keys(unresolvedSignalDecisions)).toHaveLength(7);
    expect(unresolvedSignalDecisions.Q01).toBe("KEEP_MANDATORY_FAST_LANE");
    expect(unresolvedSignalDecisions.L08).toBe("MORE_EVIDENCE_REQUIRED");
  });
});
