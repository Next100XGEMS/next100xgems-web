import { compareDecimals, normalizeDecimal } from "@/lib/radar/decimal";
import { sha256 } from "@/lib/radar/hash";
import type { RadarFastLaneMethod, RadarFastLaneResult, RadarFastLaneRule, RadarFrozenInputs, RadarNormalizedObservation } from "@/lib/radar/contracts";

function matches(value: string, rule: RadarFastLaneRule) {
  if (!rule.operator || rule.threshold === undefined) return true;
  const c = compareDecimals(value, normalizeDecimal(rule.threshold));
  return rule.operator === "gt" ? c > 0 : rule.operator === "gte" ? c >= 0 : rule.operator === "lt" ? c < 0 : c <= 0;
}

export function freezeRadarInputs(observations: readonly RadarNormalizedObservation[], sealedAt = new Date().toISOString()): RadarFrozenInputs {
  const ordered = [...observations].sort((left, right) => `${left.provider}:${left.capability}:${left.metricKey}:${left.observedAt}:${left.contentHash}`.localeCompare(`${right.provider}:${right.capability}:${right.metricKey}:${right.observedAt}:${right.contentHash}`));
  const canonical = ordered.map((observation) => { const { receivedAt, ...canonicalObservation } = observation; void receivedAt; return canonicalObservation; });
  return { schemaVersion: "frozen-input-v1", observations: ordered, sealedAt, inputHash: sha256({ schemaVersion: "frozen-input-v1", observations: canonical }) };
}

function selectObservation(observations: readonly RadarNormalizedObservation[], capability: string, metricKey: string) {
  const matches = observations.filter((item) => item.capability === capability && item.metricKey === metricKey);
  if (matches.length < 2) return { observation: matches[0], conflict: false };
  const hashes = new Set(matches.map((item) => item.contentHash));
  if (hashes.size === 1) return { observation: [...matches].sort((left, right) => left.provider.localeCompare(right.provider))[0], conflict: false };
  return { observation: undefined, conflict: true };
}

export function evaluateFastLane(method: RadarFastLaneMethod, observations: readonly RadarNormalizedObservation[], evaluatedAt = new Date().toISOString(), authoritativeInputHash?: string): RadarFastLaneResult {
  const frozen = freezeRadarInputs(observations, evaluatedAt);
  const reasons: RadarFastLaneResult["reasons"][number][] = [];
  const evidence: RadarFastLaneResult["evidence"][number][] = [];
  for (const rule of method.rules) {
    const selected = selectObservation(frozen.observations, rule.capability, rule.metricKey);
    if (selected.conflict) {
      const detail = `${rule.metricKey} has contradictory eligible provider observations.`;
      evidence.push({ key: rule.key, label: rule.key, state: "UNKNOWN", origin: "DETERMINISTIC", metricKey: rule.metricKey, value: null, reason: detail });
      if (rule.required) reasons.push({ code: "DATA_CONFLICT", ruleKey: rule.key, detail });
      continue;
    }
    const observation = selected.observation;
    if (!observation || observation.state !== "AVAILABLE" || observation.value === null) {
      const detail = observation ? `${rule.metricKey} is ${observation.state.toLowerCase()}.` : `${rule.metricKey} was not supplied by the provider.`;
      evidence.push({ key: rule.key, label: rule.key, state: "UNKNOWN", origin: "DETERMINISTIC", metricKey: rule.metricKey, value: null, reason: detail });
      if (rule.required) reasons.push({ code: `DATA_${observation?.state ?? "UNKNOWN"}`, ruleKey: rule.key, detail });
      continue;
    }
    if (!matches(observation.value, rule)) {
      const detail = rule.rejectReason ?? `${rule.metricKey} failed the versioned Fast Lane rule.`;
      reasons.push({ code: "RULE_REJECTED", ruleKey: rule.key, detail });
      evidence.push({ key: rule.key, label: rule.key, state: "STRONG_SIGNAL", origin: "DETERMINISTIC", metricKey: rule.metricKey, value: observation.value, reason: detail });
    } else evidence.push({ key: rule.key, label: rule.key, state: "VERIFIED_DATA", origin: "DETERMINISTIC", metricKey: rule.metricKey, value: observation.value });
  }
  const reject = reasons.some((item) => item.code === "RULE_REJECTED");
  return { result: reject ? "REJECT" : reasons.length ? "INCOMPLETE" : "PASS", methodVersion: method.version, inputVersion: method.inputVersion, inputHash: authoritativeInputHash ?? frozen.inputHash, evaluatedAt, reasons, evidence };
}

export function createUnconfiguredScoreCalculator(): never { throw new Error("No production Radar scoring methodology has been approved."); }
