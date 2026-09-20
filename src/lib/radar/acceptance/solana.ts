import { createHash } from "node:crypto";
import type { AcceptanceChain } from "@/lib/radar/acceptance/contracts";
import { decodePumpBondingCurveAccount, type PumpBondingCurveDecode } from "@/lib/radar/acceptance/signal-gaps";

export const PUMP_PROGRAM_ID = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
const PDA_MARKER = new TextEncoder().encode("ProgramDerivedAddress");
const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const P = (BigInt(1) << BigInt(255)) - BigInt(19);
const D = (BigInt(-121665) * modInverse(BigInt(121666), P)) % P;

function mod(value: bigint): bigint { const result = value % P; return result < BigInt(0) ? result + P : result; }
function powMod(base: bigint, exponent: bigint): bigint { let result = BigInt(1); let value = mod(base); let power = exponent; while (power > BigInt(0)) { if (power % BigInt(2) === BigInt(1)) result = mod(result * value); value = mod(value * value); power /= BigInt(2); } return result; }
function modInverse(value: bigint, prime: bigint): bigint { return powModFor(value, prime - BigInt(2), prime); }
function powModFor(base: bigint, exponent: bigint, prime: bigint): bigint { let result = BigInt(1); let value = ((base % prime) + prime) % prime; let power = exponent; while (power > BigInt(0)) { if (power % BigInt(2) === BigInt(1)) result = (result * value) % prime; value = (value * value) % prime; power /= BigInt(2); } return result; }

function base58Decode(value: string): Uint8Array {
  let number = BigInt(0);
  for (const character of value) { const index = BASE58.indexOf(character); if (index < 0) throw new Error("Invalid base58 public key."); number = number * BigInt(58) + BigInt(index); }
  const bytes: number[] = []; while (number > BigInt(0)) { bytes.unshift(Number(number % BigInt(256))); number /= BigInt(256); }
  for (const character of value) if (character === "1") bytes.unshift(0); else break;
  return Uint8Array.from(bytes);
}
function base58Encode(bytes: Uint8Array): string { let number = BigInt(0); for (const byte of bytes) number = number * BigInt(256) + BigInt(byte); let output = ""; while (number > BigInt(0)) { const remainder = Number(number % BigInt(58)); output = BASE58[remainder] + output; number /= BigInt(58); } for (const byte of bytes) { if (byte !== 0) break; output = `1${output}`; } return output; }
function isEd25519Point(bytes: Uint8Array): boolean {
  if (bytes.length !== 32) return false;
  let y = BigInt(0); for (let index = 31; index >= 0; index -= 1) y = y * BigInt(256) + BigInt(bytes[index] ?? 0);
  y &= (BigInt(1) << BigInt(255)) - BigInt(1); if (y >= P) return false;
  const y2 = mod(y * y); const u = mod(y2 - BigInt(1)); const v = mod(D * y2 + BigInt(1));
  const x2 = mod(u * modInverse(v, P)); let x = powMod(x2, (P + BigInt(3)) / BigInt(8));
  if (mod(x * x - x2) !== BigInt(0)) x = mod(x * powMod(BigInt(2), (P - BigInt(1)) / BigInt(4)));
  return mod(x * x - x2) === BigInt(0);
}

/** Validates a Solana address encoding. Token/account verification is separate. */
export function isValidSolanaPublicKey(value: string): boolean {
  try {
    return base58Decode(value).length === 32;
  } catch {
    return false;
  }
}
function sha256(parts: readonly Uint8Array[]): Uint8Array { const hash = createHash("sha256"); for (const part of parts) hash.update(part); return Uint8Array.from(hash.digest()); }

/** Derives the official Pump bonding-curve PDA without adding a Solana SDK dependency. */
export function derivePumpBondingCurveAddress(mint: string, programId = PUMP_PROGRAM_ID): string {
  const mintBytes = base58Decode(mint); const programBytes = base58Decode(programId);
  if (mintBytes.length !== 32 || programBytes.length !== 32) throw new Error("Pump PDA seeds must be 32-byte public keys.");
  const seed = new TextEncoder().encode("bonding-curve");
  for (let bump = 255; bump >= 0; bump -= 1) { const digest = sha256([seed, mintBytes, Uint8Array.of(bump), programBytes, PDA_MARKER]); if (!isEd25519Point(digest)) return base58Encode(digest); }
  throw new Error("No valid Pump bonding-curve PDA bump was found.");
}

export type SolanaRpcResult = { result?: unknown; error?: { code?: number; message?: string } };
export type SolanaRpcRequest = (method: string, params: readonly unknown[]) => Promise<SolanaRpcResult>;

const READ_ONLY_METHODS = new Set(["getAccountInfo", "getTokenSupply", "getTokenLargestAccounts", "getSignaturesForAddress", "getTransaction", "getTransactionsForAddress", "getTransfersByAddress", "getProgramAccounts", "getSlot", "getBlockTime"]);
export const HELIUS_HISTORICAL_CREDIT_ESTIMATES = { getTransactionsForAddress: 100, getTransfersByAddress: 10 } as const;

export class HeliusSolanaAcceptanceClient {
  private readonly endpoint: string;
  constructor(apiKey: string, private readonly fetchImpl: typeof fetch = fetch) {
    if (!apiKey || /[\r\n]/.test(apiKey)) throw new Error("Helius acceptance requires a bounded server-side API key.");
    this.endpoint = `https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(apiKey)}`;
  }
  async request(method: string, params: readonly unknown[] = []): Promise<SolanaRpcResult> {
    if (!READ_ONLY_METHODS.has(method)) throw new Error("Solana acceptance permits read-only methods only.");
    const response = await this.fetchImpl(this.endpoint, { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
    const payload = await response.json() as SolanaRpcResult;
    if (!response.ok && !payload.error) return { error: { code: response.status, message: `HTTP_${response.status}` } };
    return payload;
  }
}

export type PumpLifecycleResult = { mint: string; bondingCurveAddress: string; decode: PumpBondingCurveDecode; rpcCalls: number; error: string | null };

export async function collectPumpLifecycle(input: { mint: string; request: SolanaRpcRequest; programId?: string }): Promise<PumpLifecycleResult> {
  const bondingCurveAddress = derivePumpBondingCurveAddress(input.mint, input.programId);
  const account = await input.request("getAccountInfo", [bondingCurveAddress, { encoding: "base64", commitment: "confirmed" }]);
  const value = (account.result as { value?: { data?: [string, string] } } | undefined)?.value;
  const encoded = value?.data?.[0];
  if (!encoded) return { mint: input.mint, bondingCurveAddress, decode: decodePumpBondingCurveAccount({ data: new Uint8Array(0), accountAddress: bondingCurveAddress }), rpcCalls: 1, error: account.error?.message ?? "Bonding-curve account was not available." };
  return { mint: input.mint, bondingCurveAddress, decode: decodePumpBondingCurveAccount({ data: encoded, accountAddress: bondingCurveAddress }), rpcCalls: 1, error: account.error?.message ?? null };
}

export function isSupportedSolanaAcceptanceChain(chain: AcceptanceChain): boolean { return chain === "solana"; }
