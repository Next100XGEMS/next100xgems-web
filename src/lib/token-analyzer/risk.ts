import type { PositionSizingInput, PositionSizingResult } from "./contracts";
import { absolute, compare, compareRatios, divideRatios, format, multiply, multiplyRatios, parseExactDecimal, ratioToDecimal, subtract, toRatio, type ExactDecimal } from "./exact-decimal";
const HUNDRED: ExactDecimal = { coefficient: BigInt(100), scale: 0 };
const ZERO: ExactDecimal = { coefficient: BigInt(0), scale: 0 };
const OUTPUT_SCALE = 18;
function invalid(reason: string): PositionSizingResult { return { status: "INVALID_INPUT", riskBudget: null, stopDistancePercent: null, positionNotional: null, reason }; }
export function calculatePositionSizing(input: PositionSizingInput): PositionSizingResult {
  try {
    const capital = parseExactDecimal(input.portfolioCapital, "portfolioCapital"); const risk = parseExactDecimal(input.maxRiskPercent, "maxRiskPercent"); const entry = parseExactDecimal(input.entryPrice, "entryPrice"); const invalidation = parseExactDecimal(input.invalidationPrice, "invalidationPrice");
    if (compare(capital, ZERO) <= 0 || compare(risk, ZERO) <= 0 || compare(risk, parseExactDecimal("100", "maximum risk")) > 0 || compare(entry, ZERO) <= 0 || compare(invalidation, ZERO) <= 0) return invalid("Provide positive bounded decimal inputs and a risk percentage from 0 to 100.");
    const stopDistance = absolute(subtract(entry, invalidation)); if (compare(stopDistance, ZERO) === 0) return invalid("An objective invalidation distance is required.");
    const riskProduct = multiply(capital, risk); const riskBudget = { coefficient: riskProduct.coefficient, scale: riskProduct.scale + 2 }; const stopDistancePercentRatio = divideRatios(multiplyRatios(toRatio(stopDistance), toRatio(HUNDRED)), toRatio(entry)); let positionNotionalRatio = divideRatios(toRatio(riskBudget), divideRatios(toRatio(stopDistance), toRatio(entry)));
    if (input.maxPositionNotional !== undefined) { const cap = parseExactDecimal(input.maxPositionNotional, "maxPositionNotional"); if (compare(cap, ZERO) <= 0) return invalid("maxPositionNotional must be positive."); if (compareRatios(positionNotionalRatio, toRatio(cap)) > 0) positionNotionalRatio = toRatio(cap); }
    const exactValues = [toRatio(riskBudget), stopDistancePercentRatio, positionNotionalRatio];
    const displayValues = exactValues.map((value) => ratioToDecimal(value, OUTPUT_SCALE));
    const output = displayValues.map((value) => format(value, OUTPUT_SCALE));
    if (exactValues.some((value, index) => (value.numerator !== BigInt(0)) !== (output[index] !== "0"))) return { status: "POSITION_SIZE_UNAVAILABLE", riskBudget: null, stopDistancePercent: null, positionNotional: null, reason: "A nonzero result is below the supported output precision." };
    if (output.some((item) => !/^(?:0|\d+(?:\.\d+)?)$/.test(item))) return invalid("The calculation exceeded the supported numeric range.");
    return { status: "AVAILABLE", riskBudget: output[0], stopDistancePercent: output[1], positionNotional: output[2], reason: "Calculated from explicit user-provided parameters; this is not a recommendation." };
  } catch { return invalid("Provide bounded finite decimal values within the supported precision and magnitude."); }
}
