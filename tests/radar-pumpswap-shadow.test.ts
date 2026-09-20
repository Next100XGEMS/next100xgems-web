import { describe, expect, it } from "vitest";
import { decodePumpSwapPoolAccount, linkPumpSwapMigration, PUMP_MIGRATION_DISCRIMINATORS, PUMPSWAP_PROGRAM_ID, SOL_MINT } from "@/lib/radar/acceptance/pumpswap";
import { PUMP_PROGRAM_ID } from "@/lib/radar/acceptance/solana";
import { admitShadowToken, appendShadowTelemetry, classifyShadowMarketStage, createShadowCheckpoint, createShadowCollectionState, dueShadowCheckpoints, recordImmutableShadowCheckpoint, summarizeShadowAvailability, type ShadowAdmission } from "@/lib/radar/acceptance/shadow";

const MINT = "AKbox1hQ5zfLghcbqTukUJq3THaeAJFpXQ31w1M6pump";
const CURVE = "5a2XSN4qvTbB5oNCDqfYVifFdfU3gdRn8cjhp74GmgaW";
const POOL = "FGduCcZsaNz8ieDwNnVPGtrtAh13i5FLhds3cac42Jac";
const CREATOR = "Gygj9QQby4j2jryqyqBHvLP7ctv2SaANgh4sCb69BUpA";
const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function encodeBase58(bytes: Uint8Array): string {
  let number = BigInt(0); for (const byte of bytes) number = number * BigInt(256) + BigInt(byte);
  let value = ""; while (number > BigInt(0)) { value = alphabet[Number(number % BigInt(58))] + value; number /= BigInt(58); }
  for (const byte of bytes) { if (byte !== 0) break; value = `1${value}`; }
  return value;
}

function poolData(): string {
  const bytes = new Uint8Array(301); bytes.set(Uint8Array.from([1, 0, 0]), 8);
  const decode = (value: string) => { let n = BigInt(0); for (const c of value) n = n * BigInt(58) + BigInt(alphabet.indexOf(c)); const out: number[] = []; while (n) { out.unshift(Number(n % BigInt(256))); n /= BigInt(256); } for (const c of value) { if (c !== "1") break; out.unshift(0); } return Uint8Array.from(out); };
  bytes.set(decode(CREATOR), 11); bytes.set(decode(MINT), 43); bytes.set(decode(SOL_MINT), 75);
  return Buffer.from(bytes).toString("base64");
}

const admission: ShadowAdmission = { mint: MINT, creator: CREATOR, creationSignature: "creation-signature", creationSlot: 1, creationTimestamp: "2026-09-19T23:30:00.000Z", bondingCurveAddress: CURVE, decoderVersion: "shadow-v1", admissionTimestamp: "2026-09-19T23:31:00.000Z", selectionReason: "bounded read-only discovery" };

describe("PumpSwap linkage decoder", () => {
  it("requires an official migrate instruction and verifies the canonical pool account", () => {
    const accounts = Array.from({ length: 26 }, (_, index) => `account-${index}`); accounts[2] = MINT; accounts[3] = CURVE; accounts[9] = POOL; accounts[10] = "pool-authority";
    const migration = linkPumpSwapMigration({ mint: MINT, bondingCurve: CURVE, poolAccount: decodePumpSwapPoolAccount({ address: POOL, owner: PUMPSWAP_PROGRAM_ID, dataBase64: poolData() })!, transaction: { signature: "migration-signature", slot: 2, blockTime: 1_000, instructions: [{ programId: PUMP_PROGRAM_ID, accounts, data: encodeBase58(PUMP_MIGRATION_DISCRIMINATORS.migrate) }] } });
    expect(migration).toMatchObject({ status: "LINKED", poolAddress: POOL, baseMint: MINT, quoteMint: SOL_MINT, canonical: true, evidence: "AUTHORITATIVE_ONCHAIN" });
  });

  it("does not infer a pool from a non-migration transaction", () => {
    expect(linkPumpSwapMigration({ mint: MINT, bondingCurve: CURVE, poolAccount: null, transaction: { signature: "other", slot: 2, blockTime: null, instructions: [{ programId: PUMP_PROGRAM_ID, accounts: [], data: "11111111" }] } }).status).toBe("NOT_FOUND");
  });
});

describe("prospective shadow collection", () => {
  it("separates pre-graduation bonding-curve liquidity from DEX-pool liquidity", () => {
    expect(classifyShadowMarketStage({ lifecycleComplete: false, poolFound: false })).toBe("PUMP_BONDING_CURVE_STAGE");
    expect(classifyShadowMarketStage({ lifecycleComplete: true, poolFound: true })).toBe("DEX_POOL_STAGE");
    expect(classifyShadowMarketStage({ lifecycleComplete: null, poolFound: false })).toBe("UNKNOWN");
  });

  it("admits deterministically, schedules due checkpoints, and preserves idempotency", () => {
    let state = createShadowCollectionState({ now: "2026-09-19T23:31:00.000Z", cohortTarget: 20 });
    state = admitShadowToken(state, admission); state = admitShadowToken(state, admission);
    expect(state.admissions).toHaveLength(1);
    expect(dueShadowCheckpoints(state, "2026-09-19T23:40:00.000Z").map((item) => item.name)).toEqual(["T+5M"]);
    const checkpoint = createShadowCheckpoint({ admission, name: "T+5M", capturedAt: "2026-09-19T23:40:00.000Z", observations: [{ capability: "LIFECYCLE", metric: "complete", state: "AVAILABLE", value: "false", unit: "boolean", source: "helius", sourceTimestamp: "2026-09-19T23:40:00.000Z", observedAt: "2026-09-19T23:40:00.000Z", provenance: { endpoint: "getAccountInfo", reference: CURVE, scope: "bonding_curve" } }] });
    state = recordImmutableShadowCheckpoint(state, checkpoint); state = recordImmutableShadowCheckpoint(state, checkpoint);
    expect(state.checkpoints).toHaveLength(1);
    expect(summarizeShadowAvailability(appendShadowTelemetry(state, { provider: "helius", capability: "LIFECYCLE", chain: "solana", success: true, latencyMs: 10, calls: 1, credits: null, errorCode: null, observedAt: "2026-09-19T23:40:00.000Z" }), ["complete"]).complete.available).toBe(1);
  });

  it("rejects look-ahead observations and conflicting checkpoint replay", () => {
    expect(() => createShadowCheckpoint({ admission, name: "T+5M", capturedAt: "2026-09-19T23:40:00.000Z", observations: [{ capability: "MARKET", metric: "price", state: "AVAILABLE", value: "1", unit: "decimal", source: "fixture", sourceTimestamp: "2026-09-19T23:41:00.000Z", observedAt: "2026-09-19T23:41:00.000Z", provenance: { endpoint: "fixture", reference: null, scope: "token" } }] })).toThrow(/future/);
    const state = recordImmutableShadowCheckpoint(createShadowCollectionState({ now: "2026-09-19T23:40:00.000Z" }), createShadowCheckpoint({ admission, name: "T+5M", capturedAt: "2026-09-19T23:40:00.000Z", observations: [] }));
    expect(() => recordImmutableShadowCheckpoint(state, { ...state.checkpoints[0], manifestHash: "conflict" })).toThrow(/immutable/);
  });

  it("keeps a missed window due instead of treating it as captured", () => {
    const checkpoint = createShadowCheckpoint({ admission, name: "T+5M", capturedAt: "2026-09-19T23:40:00.000Z", status: "MISSED", observations: [] });
    const admitted = admitShadowToken(createShadowCollectionState({ now: "2026-09-19T23:40:00.000Z" }), admission);
    const state = recordImmutableShadowCheckpoint(admitted, checkpoint);
    expect(dueShadowCheckpoints(state, "2026-09-19T23:50:00.000Z").map((item) => item.name)).toEqual(["T+5M", "T+15M"]);
  });
});
