import { sha256 } from "@/lib/radar/hash";
import { deriveHolderConcentration, type HolderBalance, type HolderConcentration } from "@/lib/radar/acceptance/signal-gaps";

export type SolanaHolderSnapshot = { schemaVersion: "solana-holder-snapshot-v1"; token: string; slot: string; observedAt: string; source: string; commitment: string; decoderVersion: string; coverage: "COMPLETE" | "PARTIAL" | "UNKNOWN"; balances: readonly HolderBalance[]; concentration: HolderConcentration; snapshotHash: string };

export function createSolanaHolderSnapshot(input: { token: string; slot: string; observedAt: string; source: string; commitment: string; decoderVersion: string; coverage: SolanaHolderSnapshot["coverage"]; balances: readonly HolderBalance[]; topN: number }): SolanaHolderSnapshot {
  const concentration = deriveHolderConcentration(input.balances, input.topN);
  const snapshot = { schemaVersion: "solana-holder-snapshot-v1" as const, token: input.token, slot: input.slot, observedAt: input.observedAt, source: input.source, commitment: input.commitment, decoderVersion: input.decoderVersion, coverage: input.coverage, balances: input.balances, concentration };
  return { ...snapshot, snapshotHash: sha256(snapshot) };
}
