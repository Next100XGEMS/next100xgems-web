import policy from "./persistence-policy.json";
import { canonicalJson } from "@/lib/radar/hash";
import { isValidSolanaPublicKey } from "@/lib/radar/acceptance/solana";
import type { AnalyzerClaim, AnalyzerObservation, AnalyzerResolution } from "./contracts";
import { totalSupplyShare } from "./provider-integrity";

type Shape = { ref?: string; const?: unknown; type?: string; nullable?: boolean; enum?: unknown[]; properties?: Record<string, Shape>; optional?: string[]; items?: Shape; maxItems?: number; minLength?: number; maxLength?: number; pattern?: string; format?: string };
const shapes = policy.schemas as unknown as Record<string, Shape>;
export const ANALYZER_VERSIONS = policy.versions;
export function assertContract(value: unknown, shape: Shape | string): void {
  const schema = typeof shape === "string" ? shapes[shape] : shape;
  if (!schema) throw new Error("Unsupported Analyzer contract.");
  if (schema.ref) return assertContract(value, schema.ref);
  if (Object.hasOwn(schema, "const")) { if (canonicalJson(value) !== canonicalJson(schema.const)) throw new Error("Unsupported Analyzer version."); return; }
  if (value === null && schema.nullable) return;
  const type = value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
  if (schema.type === "scalar") { if (!["string", "number", "boolean", "null"].includes(type) || (type === "number" && !Number.isFinite(value))) throw new Error("Invalid Analyzer scalar."); return; }
  if (type !== schema.type) throw new Error("Invalid Analyzer JSON type.");
  if (schema.enum && !schema.enum.includes(value)) throw new Error("Invalid Analyzer enum.");
  if (type === "object") {
    const record = value as Record<string, unknown>, properties = schema.properties ?? {};
    if (Object.keys(record).some((key) => !Object.hasOwn(properties, key))) throw new Error("Unknown Analyzer field.");
    for (const [key, child] of Object.entries(properties)) {
      if (!Object.hasOwn(record, key)) { if (schema.optional?.includes(key)) continue; throw new Error("Missing Analyzer field."); }
      assertContract(record[key], child);
    }
  } else if (type === "array") {
    const values = value as unknown[];
    if (values.length > (schema.maxItems ?? 1000)) throw new Error("Analyzer collection too large.");
    values.forEach((item) => assertContract(item, schema.items!));
  } else if (type === "string") {
    const text = value as string;
    if (text.length < (schema.minLength ?? 0) || text.length > (schema.maxLength ?? 4096) || (schema.pattern && !new RegExp(schema.pattern).test(text))) throw new Error("Invalid Analyzer string.");
    if (schema.format === "timestamp" && (!/^\d{4}-\d\d-\d\dT/.test(text) || !Number.isFinite(Date.parse(text)))) throw new Error("Invalid Analyzer timestamp.");
  }
}

export function validEntityAddress(chain: string, value: string): boolean {
  return chain === "solana" ? isValidSolanaPublicKey(value) : ["ethereum", "base", "bnb"].includes(chain) && /^0x[0-9a-f]{40}$/.test(value);
}

export function validTransactionReference(chain: string, value: string): boolean {
  if (chain !== "solana") return ["ethereum", "base", "bnb"].includes(chain) && /^0x[0-9a-f]{64}$/.test(value);
  if (!/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(value)) return false;
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let number = BigInt(0), bytes = 0;
  for (const character of value) number = number * BigInt(58) + BigInt(alphabet.indexOf(character));
  while (number > BigInt(0)) { bytes++; number /= BigInt(256); }
  return bytes + (value.match(/^1*/)?.[0].length ?? 0) === 64;
}

export function assertObservation(observation: AnalyzerObservation, resolution: AnalyzerResolution): void {
  assertContract(observation, "observation");
  if (observation.state !== "AVAILABLE") return;
  const registered = policy.fields[observation.key as keyof typeof policy.fields];
  const aggregate = observation.context?.scope === "TOKEN_AGGREGATE" && ["liquidity", "volume", "transactions"].includes(observation.key);
  const rule = aggregate ? { ...registered, identityType: "TOKEN", referenceType: "TOKEN" } : registered;
  const c = observation.context;
  if (["birdeye", "dex-screener", "helius", "alchemy"].includes(observation.source) && !c) throw new Error("Provider observation requires explicit scope.");
  if (observation.source === "birdeye" && (c?.scope !== "TOKEN_AGGREGATE" || c.methodology !== "BIRDEYE_TOKEN_OVERVIEW")) throw new Error("Birdeye overview cannot claim a pool.");
  if (c && (c.chain !== resolution.chain || c.token !== resolution.tokenAddress || (c.scope === "TOKEN_AGGREGATE" && c.poolId !== null) || (["PAIR", "POOL"].includes(c.scope) && (!c.poolId || !validEntityAddress(c.chain, c.poolId))) || (c.quoteAsset !== null && !validEntityAddress(c.chain, c.quoteAsset)))) throw new Error("Analyzer observation scope is invalid.");
  if (c && rule.identityType === "POOL" && c.poolId !== observation.identity) throw new Error("Analyzer scope/provenance pool mismatch.");
  if (c?.classification === "OBJECTIVE_DERIVED" && observation.evidenceClass === "VERIFIED_DATA") throw new Error("Derived metrics are not direct verified facts.");
  if (observation.key === "concentration" && (!c || c.classification !== "OBJECTIVE_DERIVED" || c.denominatorType !== "TOTAL_SUPPLY" || c.completeness !== "PARTIAL" || c.methodology !== "TOP10_TOTAL_SUPPLY_SHARE" || c.requestedTopN !== 20 || c.metricTopN !== 10 || !c.rawBalances || c.returnedAccountCount !== c.rawBalances.length || !c.exclusions || c.rawBalances.some((r) => !validEntityAddress(resolution.chain, r.address)) || totalSupplyShare(c.rawBalances, c.denominatorValue ?? null, 10, c.exclusions) !== observation.value)) throw new Error("Invalid total-supply share derivation.");
  if (!rule || !resolution.canonicalTokenId || observation.tokenId !== resolution.canonicalTokenId || observation.identityType !== rule.identityType || !observation.identity || !validEntityAddress(resolution.chain, observation.identity) || !observation.observedAt) throw new Error("Analyzer evidence identity is invalid.");
  if (rule.identityType === "TOKEN" && observation.identity !== resolution.tokenAddress) throw new Error("Analyzer evidence token mismatch.");
  if (rule.identityType === "POOL" && (resolution.poolAddress ?? resolution.pairAddress) && observation.identity !== (resolution.poolAddress ?? resolution.pairAddress)) throw new Error("Analyzer evidence pool mismatch.");
  const value = observation.value;
  if (typeof value !== "string" || (rule.value === "decimal" && !/^(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(value)) || (rule.value === "integer" && !/^(0|[1-9][0-9]*)$/.test(value)) || (rule.value === "address" && !validEntityAddress(resolution.chain, value)) || (rule.value === "text" && value.trim().length === 0)) throw new Error("Analyzer evidence value is invalid.");
  if (["creator", "owner"].includes(observation.key) && value !== observation.identity) throw new Error("Entity identity mismatch.");
  const reference = observation.key === "trade" ? observation.transactionReference : observation.identity;
  if (observation.key === "trade" && (!reference || !validTransactionReference(resolution.chain, reference))) throw new Error("Trade transaction identity is required.");
  const kinds: readonly string[] = observation.evidenceClass === "VERIFIED_DATA" ? policy.verifiedProvenance : policy.signalProvenance;
  if (!["VERIFIED_DATA", "STRONG_SIGNAL"].includes(observation.evidenceClass) || !observation.provenance.length || !observation.provenance.every((p) => p.source === observation.source && p.referenceType === rule.referenceType && p.reference === reference && kinds.includes(p.kind))) throw new Error("Analyzer evidence provenance is incompatible.");
}

export function assertTypedClaim(claim: AnalyzerClaim, observations: readonly AnalyzerObservation[], resolution: AnalyzerResolution): void {
  assertContract(claim, "claim");
  if (claim.claim !== `${claim.field} (${claim.identity}) = ${claim.value}`) throw new Error("Positive claim text must be deterministically rendered from its typed fact.");
  if (!claim.evidenceRefs.length) throw new Error("Analyzer claim lacks evidence.");
  for (const id of claim.evidenceRefs) {
    const observation = observations.find((item) => item.evidenceId === id);
    if (!observation || observation.state !== "AVAILABLE") throw new Error("Analyzer claim evidence is unavailable.");
    assertObservation(observation, resolution);
    if (claim.field !== observation.key || claim.identity !== observation.identity || claim.identityType !== observation.identityType || claim.tokenId !== observation.tokenId || claim.source !== observation.source || claim.evidenceType !== observation.evidenceClass || canonicalJson(claim.value) !== canonicalJson(observation.value) || (claim.verification === "SUPPORTED" && claim.evidenceType !== "VERIFIED_DATA")) throw new Error("Analyzer claim is not grounded.");
  }
}
