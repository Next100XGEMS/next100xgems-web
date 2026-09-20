import { isValidSolanaPublicKey } from "@/lib/radar/acceptance/solana";
import type { AnalyzerResolution, AnalyzerTrustedPool } from "./contracts";

export const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
export const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
export function canonicalAddress(chain: string, value: unknown): string | null {
  if (typeof value !== "string") return null;
  return chain === "solana" ? (isValidSolanaPublicKey(value) ? value : null)
    : ["ethereum", "base", "bnb"].includes(chain) && /^0x[0-9a-fA-F]{40}$/.test(value) ? value.toLowerCase() : null;
}

/** Decode only initialized Mint layouts, never token accounts or arbitrary owners.
 * Token-2022 without extensions has the legacy 82-byte Mint layout. Extended
 * mints have zero padding to 165, AccountType::Mint=1, followed by bounded TLVs.
 * Extension contents do not establish extra capabilities here.
 */
export function verifySolanaMint(account: unknown) {
  if (!account || typeof account !== "object") return null;
  const value = account as Record<string, unknown>;
  if (typeof value.owner !== "string" || ![TOKEN_PROGRAM, TOKEN_2022_PROGRAM].includes(value.owner) || value.executable !== false
    || !Array.isArray(value.data) || value.data[1] !== "base64" || typeof value.data[0] !== "string"
    || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value.data[0])) return null;
  const bytes = Buffer.from(value.data[0], "base64");
  if (bytes.length < 82 || bytes.length === 355 || bytes.length > 65536 || bytes[45] !== 1
    || ![0, 1].includes(bytes.readUInt32LE(0)) || ![0, 1].includes(bytes.readUInt32LE(46))) return null;
  if (value.owner === TOKEN_PROGRAM && bytes.length !== 82) return null;
  if (value.owner === TOKEN_2022_PROGRAM && bytes.length !== 82) {
    if (bytes.length < 166 || bytes[165] !== 1 || bytes.subarray(82, 165).some((b) => b !== 0)) return null;
    let offset = 166;
    const seen = new Set<number>();
    while (offset < bytes.length) {
      if (bytes.subarray(offset).every((b) => b === 0)) break;
      if (offset + 4 > bytes.length) return null;
      const type = bytes.readUInt16LE(offset), size = bytes.readUInt16LE(offset + 2);
      if (type === 0 || seen.has(type) || offset + 4 + size > bytes.length) return null;
      seen.add(type); offset += 4 + size;
    }
  }
  return { bytes, tokenProgram: String(value.owner), supply: bytes.readBigUInt64LE(36).toString(), decimals: String(bytes[44]) };
}

export function totalSupplyShare(rows: { address: string; balance: string }[], supply: string | null, topN = 10, exclusions: string[] = []) {
  if (!Number.isInteger(topN) || topN <= 0 || topN > 20 || rows.length > 20 || rows.some((r) => !/^(0|[1-9][0-9]{0,19})$/.test(r.balance))) return null;
  const eligible = rows.filter((row) => !exclusions.includes(row.address)).sort((a, b) => BigInt(a.balance) > BigInt(b.balance) ? -1 : BigInt(a.balance) < BigInt(b.balance) ? 1 : 0).slice(0, topN);
  if (!supply || !/^[1-9][0-9]{0,19}$/.test(supply)) return null;
  const numerator = eligible.reduce((sum, row) => sum + BigInt(row.balance), BigInt(0)), denominator = BigInt(supply);
  if (numerator > denominator) return null;
  const scale = BigInt("1000000000000000000"), scaled = numerator * scale / denominator;
  // Do not represent a positive share as zero if it is below display precision.
  if (numerator > BigInt(0) && scaled === BigInt(0)) return null;
  return `${scaled / scale}.${(scaled % scale).toString().padStart(18, "0")}`.replace(/0+$/, "").replace(/\.$/, "");
}

export function trustedPoolForObservation(resolution: AnalyzerResolution, context: { provider?: string; chain: string; token: string; poolId: string | null; quoteAsset: string | null }): AnalyzerTrustedPool | null {
  if (!context.poolId || !context.quoteAsset) return null;
  return (resolution.trustedPools ?? []).find((pool) =>
    pool.provider === (context.provider ?? "") &&
    pool.chain === context.chain &&
    pool.poolAddress === context.poolId &&
    pool.baseToken === context.token &&
    pool.quoteToken === context.quoteAsset
  ) ?? null;
}
