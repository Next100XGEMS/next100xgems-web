import { normalizeDecimal, normalizeInteger } from "@/lib/radar/decimal";
import { sha256 } from "@/lib/radar/hash";
import { RADAR_DATA_STATES, type RadarDataState, type RadarNormalizedObservation, type RadarProviderCapability, type RadarProviderObservation } from "@/lib/radar/contracts";

const ID = /^[a-z][a-z0-9_.:-]{1,63}$/;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const SAFE_URL = /^https?:\/\/[^\s/?#@]+(:[0-9]{1,5})?(\/[^\s?#]*)?$/i;
const CONTEXT_KEYS = new Set(["provider_reference", "source_id", "capability", "metric_key", "status_code", "status_category", "method_version", "normalization_version", "chain", "window"]);
const PROVENANCE_KEYS = new Set(["authority", "provider", "reference_id", "source_url", "normalization_version", "reason", "chain", "last_verified", "trace_reference"]);

export class RadarNormalizationError extends Error { constructor(message: string) { super(message); this.name = "RadarNormalizationError"; } }
function identifier(value: string, label: string, pattern = ID) { if (typeof value !== "string" || !pattern.test(value)) throw new RadarNormalizationError(`${label} has an invalid identifier.`); return value; }
function boundedText(value: unknown, label: string, max = 512) { if (value === null || value === undefined) return null; if (typeof value !== "string" || value.length === 0 || value.length > max || /[\u0000-\u001f]/.test(value)) throw new RadarNormalizationError(`${label} is not safe.`); return value; }
function timestamp(value: string, label: string) { if (!/^\d{4}-\d\d-\d\dT/.test(value) || !Number.isFinite(Date.parse(value))) throw new RadarNormalizationError(`${label} must be an ISO timestamp.`); return new Date(value).toISOString(); }
function flatMap(value: Record<string, unknown> | undefined, label: string, keys: Set<string>) {
  if (value === undefined) return {};
  if (!value || Array.isArray(value) || Object.keys(value).length > 8) throw new RadarNormalizationError(`${label} must be a bounded flat object.`);
  for (const [key, item] of Object.entries(value)) {
    if (!keys.has(key)) throw new RadarNormalizationError(`${label} contains an unsupported field.`);
    if (item !== null && !["string", "number", "boolean"].includes(typeof item)) throw new RadarNormalizationError(`${label} must contain scalar values only.`);
    if (typeof item === "string") boundedText(item, `${label}.${key}`, 256);
    if (typeof item === "number" && !Number.isFinite(item)) throw new RadarNormalizationError(`${label} contains a non-finite number.`);
  }
  return value as Record<string, string | number | boolean | null>;
}

export type RadarNormalizationContext = { tokenId: string; chain: string; contractAddress: string; provider: string; adapterVersion: string; capability: string; metricKey: string; capabilities?: readonly RadarProviderCapability[] };

export function normalizeProviderObservation(observation: RadarProviderObservation, receivedAt = new Date().toISOString(), expected?: RadarNormalizationContext): RadarNormalizedObservation {
  if (!RADAR_DATA_STATES.includes(observation.state as RadarDataState)) throw new RadarNormalizationError("Provider returned an unsupported data state.");
  if (expected) {
    if (observation.provider !== expected.provider || observation.adapterVersion !== expected.adapterVersion) throw new RadarNormalizationError("Provider identity does not match the registered adapter.");
    if (observation.capability !== expected.capability || observation.metricKey !== expected.metricKey) throw new RadarNormalizationError("Provider result scope does not match the request.");
    if (observation.tokenId !== undefined && observation.tokenId !== expected.tokenId) throw new RadarNormalizationError("Provider result token does not match the request.");
    if (observation.chain !== undefined && observation.chain !== expected.chain) throw new RadarNormalizationError("Provider result chain does not match the request.");
    if (observation.contractAddress !== undefined && observation.contractAddress !== expected.contractAddress) throw new RadarNormalizationError("Provider result contract does not match the request.");
    const capability = expected.capabilities?.find((item) => item.capability === expected.capability);
    if (expected.capabilities && (!capability || !capability.metrics.includes(expected.metricKey))) throw new RadarNormalizationError("Provider result capability is not supported by the adapter.");
  }
  const state = observation.state;
  const value = observation.value === undefined ? null : normalizeDecimal(observation.value, "observation value");
  const rawIntegerValue = observation.rawIntegerValue === undefined ? null : normalizeInteger(observation.rawIntegerValue, "raw integer value");
  if (state === "AVAILABLE" && value === null) throw new RadarNormalizationError("AVAILABLE observations require a value.");
  if (state !== "AVAILABLE" && (value !== null || rawIntegerValue !== null)) throw new RadarNormalizationError("Unavailable observations cannot carry a numeric value.");
  if (state !== "AVAILABLE" && !observation.reason?.trim()) throw new RadarNormalizationError("Non-available observations require an explicit reason.");
  if (observation.decimalPlaces !== undefined && (!Number.isInteger(observation.decimalPlaces) || observation.decimalPlaces < 0 || observation.decimalPlaces > 255)) throw new RadarNormalizationError("decimalPlaces is outside the supported range.");
  const context = flatMap(observation.context, "context", CONTEXT_KEYS);
  const provenance = flatMap({ ...(observation.provenance ?? {}), ...(observation.reason ? { reason: observation.reason } : {}) }, "provenance", PROVENANCE_KEYS);
  if (provenance.source_url !== undefined && provenance.source_url !== null && (typeof provenance.source_url !== "string" || !SAFE_URL.test(provenance.source_url))) throw new RadarNormalizationError("provenance source URL is not public-safe.");
  const normalized = { provider: identifier(observation.provider, "provider"), adapterVersion: identifier(observation.adapterVersion, "adapter version", VERSION), capability: identifier(observation.capability, "capability"), metricKey: identifier(observation.metricKey, "metric key"), state, value, rawIntegerValue, decimalPlaces: observation.decimalPlaces ?? null, unit: boundedText(observation.unit, "unit", 64), context, provenance, traceReference: boundedText(observation.traceReference, "trace reference"), observedAt: timestamp(observation.observedAt, "observedAt"), receivedAt: timestamp(receivedAt, "receivedAt") };
  const { receivedAt: ignoredReceivedAt, ...canonicalContent } = normalized;
  void ignoredReceivedAt;
  return { ...normalized, contentHash: sha256(canonicalContent) };
}
