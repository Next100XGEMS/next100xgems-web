import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const corpusPath = path.join(process.cwd(), "tests/data/radar-pump-historical-universe-20260919.json");

describe("frozen Pump historical universe", () => {
  it("contains the acquired, normalized 300-token manifest", () => {
    const corpus = JSON.parse(fs.readFileSync(corpusPath, "utf8")) as {
      corpusStatus: string;
      selection: { program: string; outcomeIndependent: boolean; timeBucketed: boolean };
      metrics: { successfulCalls: number; failedCalls: number; uniqueMints: number; createInstructions: number };
      tokens: Array<Record<string, unknown>>;
      lifecycleBackfill: { lifecycleCounts: { valid: number; complete: number; active: number; unavailable: number }; pumpSwapLinkage: { status: string } };
      pointInTime: { count: number; replayableIdentityOnly: number; marketAndHolderHistory: string };
      chronologicalSplit: { train: number; validation: number; holdout: number; labels: string; lookAheadSafe: boolean };
      outcomeLabels: { assigned: number; status: string };
      marketPilot: { historicalAsOfData: string };
    };

    expect(corpus.corpusStatus).toBe("CORPUS_ACQUIRED");
    expect(corpus.selection).toMatchObject({
      program: "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
      outcomeIndependent: true,
      timeBucketed: true,
    });
    expect(corpus.metrics).toMatchObject({ successfulCalls: 365, failedCalls: 0, uniqueMints: 300, createInstructions: 308 });
    expect(corpus.tokens).toHaveLength(300);
    expect(new Set(corpus.tokens.map((token) => token.mint)).size).toBe(300);
    expect(corpus.tokens.every((token) => token.program === corpus.selection.program)).toBe(true);
    expect(corpus.tokens.every((token) => typeof token.creationSignature === "string" && typeof token.creator === "string" && typeof token.bondingCurveAddress === "string")).toBe(true);
    expect(corpus.tokens.some((token) => "rawTransaction" in token || "apiKey" in token || "authorization" in token)).toBe(false);
    expect(corpus.lifecycleBackfill).toMatchObject({ lifecycleCounts: { valid: 300, complete: 10, active: 290, unavailable: 0 }, pumpSwapLinkage: { status: "NOT_ATTEMPTED" } });
    expect(corpus.pointInTime).toMatchObject({ count: 1800, replayableIdentityOnly: 1800, marketAndHolderHistory: "NOT_RECONSTRUCTABLE_IN_THIS_BACKFILL" });
    expect(corpus.chronologicalSplit).toMatchObject({ train: 180, validation: 60, holdout: 60, labels: "PENDING_FUTURE_WINDOW", lookAheadSafe: true });
    expect(corpus.outcomeLabels).toMatchObject({ assigned: 0, status: "PENDING_FUTURE_WINDOW" });
    expect(corpus.marketPilot.historicalAsOfData).toBe("NOT_RECONSTRUCTED");
  });
});
