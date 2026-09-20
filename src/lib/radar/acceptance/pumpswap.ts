import { PUMP_PROGRAM_ID } from "@/lib/radar/acceptance/solana";

export const PUMPSWAP_PROGRAM_ID = "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA";
export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const PUMP_MIGRATION_DISCRIMINATORS = {
  migrate: Uint8Array.from([155, 234, 231, 146, 236, 158, 162, 30]),
  migrate_v2: Uint8Array.from([187, 203, 18, 31, 206, 237, 254, 41]),
} as const;

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function decodeBase58(value: string): Uint8Array {
  let number = BigInt(0);
  for (const character of value) {
    const digit = BASE58.indexOf(character);
    if (digit < 0) throw new Error("Invalid base58 value.");
    number = number * BigInt(58) + BigInt(digit);
  }
  const bytes: number[] = [];
  while (number > BigInt(0)) {
    bytes.unshift(Number(number % BigInt(256)));
    number /= BigInt(256);
  }
  for (const character of value) {
    if (character !== "1") break;
    bytes.unshift(0);
  }
  return Uint8Array.from(bytes);
}

function encodeBase58(bytes: Uint8Array): string {
  let number = BigInt(0);
  for (const byte of bytes) number = number * BigInt(256) + BigInt(byte);
  let output = "";
  while (number > BigInt(0)) {
    output = BASE58[Number(number % BigInt(58))] + output;
    number /= BigInt(58);
  }
  for (const byte of bytes) {
    if (byte !== 0) break;
    output = `1${output}`;
  }
  return output;
}

function startsWith(bytes: Uint8Array, prefix: Uint8Array): boolean {
  return prefix.every((byte, index) => bytes[index] === byte);
}

function pubkeyAt(bytes: Uint8Array, offset: number): string | null {
  if (offset < 0 || offset + 32 > bytes.length) return null;
  return encodeBase58(bytes.slice(offset, offset + 32));
}

export type PumpSwapPoolAccount = {
  address: string;
  owner: string;
  poolBump: number;
  index: number;
  creator: string | null;
  baseMint: string;
  quoteMint: string;
  lpMint: string | null;
  coinCreator: string | null;
  dataBytes: number;
  canonical: boolean;
};

/** Decodes only the stable Pool prefix and never treats an unknown suffix as truth. */
export function decodePumpSwapPoolAccount(input: { address: string; owner: string; dataBase64: string }): PumpSwapPoolAccount | null {
  if (input.owner !== PUMPSWAP_PROGRAM_ID) return null;
  const bytes = Uint8Array.from(Buffer.from(input.dataBase64, "base64"));
  if (bytes.length < 107) return null;
  const dataOffset = 8;
  const poolBump = bytes[dataOffset] ?? 0;
  const index = (bytes[dataOffset + 1] ?? 0) | ((bytes[dataOffset + 2] ?? 0) << 8);
  const creator = pubkeyAt(bytes, dataOffset + 3);
  const baseMint = pubkeyAt(bytes, dataOffset + 35);
  const quoteMint = pubkeyAt(bytes, dataOffset + 67);
  const lpMint = pubkeyAt(bytes, dataOffset + 99);
  if (!baseMint || !quoteMint) return null;
  return {
    address: input.address,
    owner: input.owner,
    poolBump,
    index,
    creator,
    baseMint,
    quoteMint,
    lpMint,
    coinCreator: pubkeyAt(bytes, dataOffset + 203),
    dataBytes: bytes.length,
    canonical: index === 0,
  };
}

export type ParsedPumpInstruction = { programId: string; accounts: readonly string[]; data: string };
export type ParsedPumpTransaction = { signature: string; slot: number; blockTime: number | null; instructions: readonly ParsedPumpInstruction[] };

export type PumpSwapLinkage = {
  status: "LINKED" | "MIGRATION_FOUND_POOL_INVALID" | "MIGRATION_FOUND_POOL_UNAVAILABLE" | "NOT_FOUND" | "AMBIGUOUS";
  mint: string;
  bondingCurve: string;
  migrationSignature: string | null;
  migrationSlot: number | null;
  migrationTimestamp: string | null;
  poolAddress: string | null;
  poolAuthority: string | null;
  baseMint: string | null;
  quoteMint: string | null;
  canonical: boolean | null;
  evidence: "AUTHORITATIVE_ONCHAIN" | "UNKNOWN";
  reason: string;
};

function migrationCandidates(transaction: ParsedPumpTransaction): Array<{ name: "migrate" | "migrate_v2"; accounts: readonly string[] }> {
  const candidates: Array<{ name: "migrate" | "migrate_v2"; accounts: readonly string[] }> = [];
  for (const instruction of transaction.instructions) {
    if (instruction.programId !== PUMP_PROGRAM_ID) continue;
    let data: Uint8Array;
    try { data = decodeBase58(instruction.data); } catch { continue; }
    if (startsWith(data, PUMP_MIGRATION_DISCRIMINATORS.migrate)) candidates.push({ name: "migrate", accounts: instruction.accounts });
    if (startsWith(data, PUMP_MIGRATION_DISCRIMINATORS.migrate_v2)) candidates.push({ name: "migrate_v2", accounts: instruction.accounts });
  }
  return candidates;
}

/** Links only explicit official migration instructions to a verified PumpSwap Pool account. */
export function linkPumpSwapMigration(input: { transaction: ParsedPumpTransaction; mint: string; bondingCurve: string; poolAccount: PumpSwapPoolAccount | null | undefined }): PumpSwapLinkage {
  const candidates = migrationCandidates(input.transaction);
  if (candidates.length === 0) return { status: "NOT_FOUND", mint: input.mint, bondingCurve: input.bondingCurve, migrationSignature: null, migrationSlot: null, migrationTimestamp: null, poolAddress: null, poolAuthority: null, baseMint: null, quoteMint: null, canonical: null, evidence: "UNKNOWN", reason: "No official migrate or migrate_v2 instruction was found." };
  if (candidates.length > 1) return { status: "AMBIGUOUS", mint: input.mint, bondingCurve: input.bondingCurve, migrationSignature: input.transaction.signature, migrationSlot: input.transaction.slot, migrationTimestamp: input.transaction.blockTime === null ? null : new Date(input.transaction.blockTime * 1000).toISOString(), poolAddress: null, poolAuthority: null, baseMint: null, quoteMint: null, canonical: null, evidence: "UNKNOWN", reason: "More than one official migration instruction was present in the transaction." };
  const candidate = candidates[0];
  const accounts = candidate.accounts;
  const mint = accounts[candidate.name === "migrate" ? 2 : 2];
  const bondingCurve = accounts[candidate.name === "migrate" ? 3 : 4];
  const poolAddress = accounts[candidate.name === "migrate" ? 9 : 10] ?? null;
  const poolAuthority = accounts[candidate.name === "migrate" ? 10 : 11] ?? null;
  const quoteFromInstruction = candidate.name === "migrate" ? SOL_MINT : accounts[3] ?? null;
  if (mint !== input.mint || bondingCurve !== input.bondingCurve) return { status: "AMBIGUOUS", mint: input.mint, bondingCurve: input.bondingCurve, migrationSignature: input.transaction.signature, migrationSlot: input.transaction.slot, migrationTimestamp: input.transaction.blockTime === null ? null : new Date(input.transaction.blockTime * 1000).toISOString(), poolAddress, poolAuthority, baseMint: null, quoteMint: quoteFromInstruction, canonical: null, evidence: "UNKNOWN", reason: "Migration instruction identity did not match the supplied mint and bonding curve." };
  if (!poolAddress || !input.poolAccount) return { status: "MIGRATION_FOUND_POOL_UNAVAILABLE", mint: input.mint, bondingCurve: input.bondingCurve, migrationSignature: input.transaction.signature, migrationSlot: input.transaction.slot, migrationTimestamp: input.transaction.blockTime === null ? null : new Date(input.transaction.blockTime * 1000).toISOString(), poolAddress, poolAuthority, baseMint: mint, quoteMint: quoteFromInstruction, canonical: null, evidence: "UNKNOWN", reason: "Official migration was found, but the PumpSwap Pool account was not available for verification." };
  const valid = input.poolAccount.address === poolAddress && input.poolAccount.owner === PUMPSWAP_PROGRAM_ID && input.poolAccount.baseMint === mint && input.poolAccount.quoteMint === quoteFromInstruction && input.poolAccount.canonical;
  return { status: valid ? "LINKED" : "MIGRATION_FOUND_POOL_INVALID", mint: input.mint, bondingCurve: input.bondingCurve, migrationSignature: input.transaction.signature, migrationSlot: input.transaction.slot, migrationTimestamp: input.transaction.blockTime === null ? null : new Date(input.transaction.blockTime * 1000).toISOString(), poolAddress, poolAuthority, baseMint: input.poolAccount.baseMint, quoteMint: input.poolAccount.quoteMint, canonical: input.poolAccount.canonical, evidence: valid ? "AUTHORITATIVE_ONCHAIN" : "UNKNOWN", reason: valid ? "Official migration instruction and PumpSwap-owned canonical Pool account agree on mint and quote." : "Migration instruction and Pool account identity did not agree." };
}
