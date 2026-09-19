import { normalizeInteger } from "@/lib/radar/decimal";

export type GapEvidenceClass = "AUTHORITATIVE_ONCHAIN" | "OBJECTIVE_DERIVED" | "PROVIDER_DERIVED" | "STRONG_INFERENCE" | "UNKNOWN";

export type PumpField<T> = { value: T | null; evidence: GapEvidenceClass; reason?: string };

export type PumpBondingCurveDecode = {
  accountAddress: string | null;
  valid: boolean;
  creator: PumpField<string>;
  virtualTokenReserves: PumpField<string>;
  virtualSolReserves: PumpField<string>;
  realTokenReserves: PumpField<string>;
  realSolReserves: PumpField<string>;
  tokenTotalSupply: PumpField<string>;
  complete: PumpField<boolean>;
  curveProgress: PumpField<{ numerator: string; denominator: string }>;
};

const UNKNOWN = <T>(reason: string): PumpField<T> => ({ value: null, evidence: "UNKNOWN", reason });

function bytesFromAccountData(data: Uint8Array | string): Uint8Array {
  if (typeof data === "string") return Uint8Array.from(Buffer.from(data, "base64"));
  return data;
}

function readU64LE(bytes: Uint8Array, offset: number): bigint {
  let value = BigInt(0);
  for (let index = 7; index >= 0; index -= 1) value = value * BigInt(256) + BigInt(bytes[offset + index] ?? 0);
  return value;
}

function positiveInteger(value: bigint): string { return normalizeInteger(value.toString(), "Pump integer"); }

/** Decodes the official Pump bonding-curve account payload without floating point arithmetic. */
export function decodePumpBondingCurveAccount(input: { data: Uint8Array | string; accountAddress?: string | null }): PumpBondingCurveDecode {
  const bytes = bytesFromAccountData(input.data);
  if (bytes.length < 49) {
    const reason = `Expected at least 49 bytes, received ${bytes.length}.`;
    return { accountAddress: input.accountAddress ?? null, valid: false, creator: UNKNOWN(reason), virtualTokenReserves: UNKNOWN(reason), virtualSolReserves: UNKNOWN(reason), realTokenReserves: UNKNOWN(reason), realSolReserves: UNKNOWN(reason), tokenTotalSupply: UNKNOWN(reason), complete: UNKNOWN(reason), curveProgress: UNKNOWN(reason) };
  }
  const virtualTokenReserves = readU64LE(bytes, 8);
  const virtualSolReserves = readU64LE(bytes, 16);
  const realTokenReserves = readU64LE(bytes, 24);
  const realSolReserves = readU64LE(bytes, 32);
  const tokenTotalSupply = readU64LE(bytes, 40);
  const completeByte = bytes[48];
  if (completeByte !== 0 && completeByte !== 1) {
    const reason = `Complete flag must be 0 or 1, received ${String(completeByte)}.`;
    return { accountAddress: input.accountAddress ?? null, valid: false, creator: UNKNOWN(reason), virtualTokenReserves: UNKNOWN(reason), virtualSolReserves: UNKNOWN(reason), realTokenReserves: UNKNOWN(reason), realSolReserves: UNKNOWN(reason), tokenTotalSupply: UNKNOWN(reason), complete: UNKNOWN(reason), curveProgress: UNKNOWN(reason) };
  }
  const fields = {
    virtualTokenReserves: { value: positiveInteger(virtualTokenReserves), evidence: "AUTHORITATIVE_ONCHAIN" as const },
    virtualSolReserves: { value: positiveInteger(virtualSolReserves), evidence: "AUTHORITATIVE_ONCHAIN" as const },
    realTokenReserves: { value: positiveInteger(realTokenReserves), evidence: "AUTHORITATIVE_ONCHAIN" as const },
    realSolReserves: { value: positiveInteger(realSolReserves), evidence: "AUTHORITATIVE_ONCHAIN" as const },
    tokenTotalSupply: { value: positiveInteger(tokenTotalSupply), evidence: "AUTHORITATIVE_ONCHAIN" as const },
    complete: { value: completeByte === 1, evidence: "AUTHORITATIVE_ONCHAIN" as const },
  };
  const curveProgress = tokenTotalSupply > BigInt(0) && realTokenReserves <= tokenTotalSupply
    ? { value: { numerator: positiveInteger(tokenTotalSupply - realTokenReserves), denominator: positiveInteger(tokenTotalSupply) }, evidence: "OBJECTIVE_DERIVED" as const }
    : UNKNOWN<{ numerator: string; denominator: string }>("Token supply is zero or real reserves exceed total supply.");
  return { accountAddress: input.accountAddress ?? null, valid: true, creator: UNKNOWN("Creator is emitted by lifecycle events, not this bonding-curve account layout."), ...fields, curveProgress };
}

export type HolderBalance = { address: string; balance: string; excluded?: boolean; exclusionReason?: string };
export type HolderConcentration = {
  holderCount: number;
  rawTotal: string;
  eligibleTotal: string;
  top: readonly { address: string; balance: string }[];
  concentration: { numerator: string; denominator: string; evidence: "OBJECTIVE_DERIVED" } | null;
  excluded: readonly { address: string; reason: string }[];
};

/** Calculates raw holder facts and exact top-N concentration; exclusions remain explicit. */
export function deriveHolderConcentration(balances: readonly HolderBalance[], topN: number): HolderConcentration {
  if (!Number.isInteger(topN) || topN <= 0) throw new Error("topN must be a positive integer.");
  let rawTotal = BigInt(0);
  let eligibleTotal = BigInt(0);
  const eligible: { address: string; balance: bigint }[] = [];
  const excluded: { address: string; reason: string }[] = [];
  for (const holder of balances) {
    const balance = BigInt(normalizeInteger(holder.balance, "holder balance"));
    rawTotal += balance;
    if (holder.excluded) excluded.push({ address: holder.address, reason: holder.exclusionReason ?? "excluded by supplied snapshot policy" });
    else { eligibleTotal += balance; if (balance > BigInt(0)) eligible.push({ address: holder.address, balance }); }
  }
  eligible.sort((left, right) => left.balance === right.balance ? left.address.localeCompare(right.address) : left.balance > right.balance ? -1 : 1);
  const top = eligible.slice(0, topN).map((holder) => ({ address: holder.address, balance: holder.balance.toString() }));
  const numerator = top.reduce((sum, holder) => sum + BigInt(holder.balance), BigInt(0));
  return { holderCount: eligible.length, rawTotal: rawTotal.toString(), eligibleTotal: eligibleTotal.toString(), top, concentration: eligibleTotal > BigInt(0) ? { numerator: numerator.toString(), denominator: eligibleTotal.toString(), evidence: "OBJECTIVE_DERIVED" } : null, excluded };
}

export type MarketConflictInput = { value: string | null; poolId?: string | null; quoteAsset?: string | null; observedAt?: string | null; freshness?: "FRESH" | "STALE" | "UNKNOWN"; liquidityDefinition?: string | null; scope?: "SINGLE_POOL" | "AGGREGATED" | "UNKNOWN"; methodology?: string | null };
export type MarketConflictTaxonomy = "SAME_POOL_DIFFERENT_VALUE" | "DIFFERENT_PRIMARY_POOL" | "AGGREGATED_VS_SINGLE_POOL" | "STALE_SOURCE" | "QUOTE_ASSET_MISMATCH" | "METHODOLOGY_DIFFERENCE" | "UNRESOLVED" | "AGREEMENT";

/** Explains a provider disagreement without selecting, averaging or thresholding a value. */
export function classifyMarketConflict(left: MarketConflictInput, right: MarketConflictInput): MarketConflictTaxonomy {
  if (left.freshness === "STALE" || right.freshness === "STALE") return "STALE_SOURCE";
  if (left.quoteAsset && right.quoteAsset && left.quoteAsset !== right.quoteAsset) return "QUOTE_ASSET_MISMATCH";
  if (left.methodology && right.methodology && left.methodology !== right.methodology) return "METHODOLOGY_DIFFERENCE";
  if (left.scope && right.scope && left.scope !== right.scope) return "AGGREGATED_VS_SINGLE_POOL";
  if (left.poolId && right.poolId && left.poolId !== right.poolId) return "DIFFERENT_PRIMARY_POOL";
  if (left.value === right.value) return "AGREEMENT";
  if (left.poolId && left.poolId === right.poolId) return "SAME_POOL_DIFFERENT_VALUE";
  return "UNRESOLVED";
}

export type EvmSemanticAssessment = { standard: "STANDARD_ERC20" | "CUSTOM_CONTRACT_SEMANTICS" | "UNKNOWN"; owner: GapEvidenceClass; proxy: GapEvidenceClass; reason: string };

export function assessEvmContractSemantics(input: { bytecodeAvailable: boolean; decimalsRead: boolean; supplyRead: boolean; ownerRead: boolean; proxyImplementationKnown: boolean }): EvmSemanticAssessment {
  if (!input.bytecodeAvailable) return { standard: "UNKNOWN", owner: "UNKNOWN", proxy: "UNKNOWN", reason: "Contract code was not available." };
  const standard = input.decimalsRead && input.supplyRead ? "STANDARD_ERC20" : "CUSTOM_CONTRACT_SEMANTICS";
  return { standard, owner: input.ownerRead ? "AUTHORITATIVE_ONCHAIN" : "UNKNOWN", proxy: input.proxyImplementationKnown ? "AUTHORITATIVE_ONCHAIN" : "UNKNOWN", reason: input.ownerRead ? "Owner behavior was directly read for this contract." : "Owner/proxy behavior is contract-specific and was not proven by the available calls." };
}

export type UnresolvedSignalDecision = "KEEP_MANDATORY_FAST_LANE" | "KEEP_MANDATORY_BUT_PROSPECTIVE_ONLY" | "MOVE_TO_OPTIONAL" | "MOVE_TO_DEEP_LANE" | "REMOVE" | "MORE_EVIDENCE_REQUIRED";
export const unresolvedSignalDecisions: Readonly<Record<"H07" | "L05" | "L08" | "C08" | "Q01" | "Q02" | "Q04", UnresolvedSignalDecision>> = {
  H07: "KEEP_MANDATORY_BUT_PROSPECTIVE_ONLY",
  L05: "KEEP_MANDATORY_BUT_PROSPECTIVE_ONLY",
  L08: "MORE_EVIDENCE_REQUIRED",
  C08: "KEEP_MANDATORY_BUT_PROSPECTIVE_ONLY",
  Q01: "KEEP_MANDATORY_FAST_LANE",
  Q02: "KEEP_MANDATORY_FAST_LANE",
  Q04: "KEEP_MANDATORY_FAST_LANE",
};
