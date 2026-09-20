import type { PositionSizingInput, PositionSizingResult } from "./contracts";
import { absolute, compare, divide, format, multiply, parseExactDecimal, subtract, type ExactDecimal } from "./exact-decimal";
const HUNDRED: ExactDecimal = { coefficient: BigInt(100), scale: 0 };
const ZERO: ExactDecimal = { coefficient: BigInt(0), scale: 0 };
function invalid(reason: string): PositionSizingResult { return { status: "INVALID_INPUT", riskBudget: null, stopDistancePercent: null, positionNotional: null, reason }; }
export function calculatePositionSizing(input: PositionSizingInput): PositionSizingResult {
  try {
    const capital = parseExactDecimal(input.portfolioCapital, "portfolioCapital"); const risk = parseExactDecimal(input.maxRiskPercent, "maxRiskPercent"); const entry = parseExactDecimal(input.entryPrice, "entryPrice"); const invalidation = parseExactDecimal(input.invalidationPrice, "invalidationPrice");
    if (compare(capital, ZERO) <= 0 || compare(risk, ZERO) <= 0 || compare(risk, parseExactDecimal("100", "maximum risk")) > 0 || compare(entry, ZERO) <= 0 || compare(invalidation, ZERO) <= 0) return invalid("Provide positive bounded decimal inputs and a risk percentage from 0 to 100.");
    const stopDistance = absolute(subtract(entry, invalidation)); if (compare(stopDistance, ZERO) === 0) return invalid("An objective invalidation distance is required.");
    const riskBudget = divide(multiply(capital, risk), HUNDRED, 12); const stopDistancePercent = divide(multiply(stopDistance, HUNDRED), entry, 12); let positionNotional = divide(multiply(riskBudget, entry), stopDistance, 12);
    if (input.maxPositionNotional !== undefined) { const cap = parseExactDecimal(input.maxPositionNotional, "maxPositionNotional"); if (compare(cap, ZERO) <= 0) return invalid("maxPositionNotional must be positive."); if (compare(positionNotional, cap) > 0) positionNotional = cap; }
    const output = [format(riskBudget), format(stopDistancePercent), format(positionNotional)]; if (output.some((item) => !/^(?:0|\d+(?:\.\d+)?)$/.test(item))) return invalid("The calculation exceeded the supported numeric range.");
    return { status: "AVAILABLE", riskBudget: output[0], stopDistancePercent: output[1], positionNotional: output[2], reason: "Calculated from explicit user-provided parameters; this is not a recommendation." };
  } catch { return invalid("Provide bounded finite decimal values within the supported precision and magnitude."); }
}
