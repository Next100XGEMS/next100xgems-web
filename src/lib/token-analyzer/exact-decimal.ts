const DECIMAL = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;
const MAX_DIGITS = 38;
const MAX_SCALE = 18;
export class AnalyzerDecimalError extends Error { constructor(message: string) { super(message); this.name = "AnalyzerDecimalError"; } }
export type ExactDecimal = { coefficient: bigint; scale: number };
export type ExactRatio = { numerator: bigint; denominator: bigint };
export function parseExactDecimal(value: string, label: string): ExactDecimal { if (typeof value !== "string" || !DECIMAL.test(value) || value.length > 40) throw new AnalyzerDecimalError(`${label} must be a bounded decimal string.`); const [whole, fraction = ""] = value.split("."); if (fraction.length > MAX_SCALE || whole.length + fraction.length > MAX_DIGITS) throw new AnalyzerDecimalError(`${label} exceeds the supported precision.`); return normalize({ coefficient: BigInt(`${whole}${fraction}`), scale: fraction.length }); }
function normalize(value: ExactDecimal): ExactDecimal { let coefficient = value.coefficient; let scale = value.scale; while (scale > 0 && coefficient % BigInt(10) === BigInt(0)) { coefficient /= BigInt(10); scale -= 1; } return { coefficient, scale }; }
function pow10(value: number) { return BigInt(10) ** BigInt(value); }
export function multiply(left: ExactDecimal, right: ExactDecimal): ExactDecimal { return normalize({ coefficient: left.coefficient * right.coefficient, scale: left.scale + right.scale }); }
export function subtract(left: ExactDecimal, right: ExactDecimal): ExactDecimal { const scale = Math.max(left.scale, right.scale); return normalize({ coefficient: left.coefficient * pow10(scale - left.scale) - right.coefficient * pow10(scale - right.scale), scale }); }
export function absolute(value: ExactDecimal): ExactDecimal { return { coefficient: value.coefficient < BigInt(0) ? -value.coefficient : value.coefficient, scale: value.scale }; }
export function compare(left: ExactDecimal, right: ExactDecimal) { const scale = Math.max(left.scale, right.scale); const l = left.coefficient * pow10(scale - left.scale); const r = right.coefficient * pow10(scale - right.scale); return l === r ? 0 : l < r ? -1 : 1; }
export function divide(left: ExactDecimal, right: ExactDecimal, outputScale = 12): ExactDecimal { if (right.coefficient === BigInt(0)) throw new AnalyzerDecimalError("Division by zero."); const exponent = outputScale + right.scale - left.scale; const numerator = exponent >= 0 ? left.coefficient * pow10(exponent) : left.coefficient; const denominator = exponent >= 0 ? right.coefficient : right.coefficient * pow10(-exponent); const sign = numerator < BigInt(0) === denominator < BigInt(0) ? BigInt(1) : BigInt(-1); const n = numerator < BigInt(0) ? -numerator : numerator; const d = denominator < BigInt(0) ? -denominator : denominator; let quotient = n / d; if (n % d * BigInt(2) >= d) quotient += BigInt(1); return normalize({ coefficient: quotient * sign, scale: outputScale }); }
export function toRatio(value: ExactDecimal): ExactRatio { return { numerator: value.coefficient, denominator: pow10(value.scale) }; }
export function multiplyRatios(left: ExactRatio, right: ExactRatio): ExactRatio { return { numerator: left.numerator * right.numerator, denominator: left.denominator * right.denominator }; }
export function divideRatios(left: ExactRatio, right: ExactRatio): ExactRatio { if (right.numerator === BigInt(0)) throw new AnalyzerDecimalError("Division by zero."); return { numerator: left.numerator * right.denominator, denominator: left.denominator * right.numerator }; }
export function compareRatios(left: ExactRatio, right: ExactRatio) { const l = left.numerator * right.denominator; const r = right.numerator * left.denominator; return l === r ? 0 : l < r ? -1 : 1; }
export function ratioToDecimal(value: ExactRatio, outputScale: number): ExactDecimal {
  if (!Number.isInteger(outputScale) || outputScale < 0 || value.denominator === BigInt(0)) throw new AnalyzerDecimalError("Ratio output is invalid.");
  const sign = value.numerator < BigInt(0) === value.denominator < BigInt(0) ? BigInt(1) : BigInt(-1);
  const numerator = value.numerator < BigInt(0) ? -value.numerator : value.numerator;
  const denominator = value.denominator < BigInt(0) ? -value.denominator : value.denominator;
  const scaled = numerator * pow10(outputScale); let quotient = scaled / denominator;
  if ((scaled % denominator) * BigInt(2) >= denominator) quotient += BigInt(1);
  return normalize({ coefficient: quotient * sign, scale: outputScale });
}
export function roundToScale(value: ExactDecimal, outputScale: number): ExactDecimal {
  if (!Number.isInteger(outputScale) || outputScale < 0) throw new AnalyzerDecimalError("Output scale is invalid.");
  if (value.scale <= outputScale) return value;
  const divisor = pow10(value.scale - outputScale); const negative = value.coefficient < BigInt(0); const absoluteCoefficient = negative ? -value.coefficient : value.coefficient; let quotient = absoluteCoefficient / divisor;
  if ((absoluteCoefficient % divisor) * BigInt(2) >= divisor) quotient += BigInt(1);
  return normalize({ coefficient: negative ? -quotient : quotient, scale: outputScale });
}
export function format(value: ExactDecimal, outputScale?: number) { const rounded = outputScale === undefined ? value : roundToScale(value, outputScale); const negative = rounded.coefficient < BigInt(0); const digits = (negative ? -rounded.coefficient : rounded.coefficient).toString().padStart(rounded.scale + 1, "0"); const split = rounded.scale ? `${digits.slice(0, -rounded.scale)}.${digits.slice(-rounded.scale)}` : digits; return `${negative ? "-" : ""}${split.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "")}`; }
