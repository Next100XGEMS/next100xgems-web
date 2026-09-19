export type RadarProviderErrorCode =
  | "TIMEOUT"
  | "RATE_LIMITED"
  | "UNAUTHORIZED_PROVIDER"
  | "MALFORMED_RESPONSE"
  | "UPSTREAM_UNAVAILABLE"
  | "UNSUPPORTED"
  | "UNKNOWN_PROVIDER_ERROR";

export type RadarProviderError = { code: RadarProviderErrorCode; retryable: boolean; summary: string };

const SAFE_ERROR_TEXT: Record<RadarProviderErrorCode, string> = {
  TIMEOUT: "The provider timed out before returning a usable result.",
  RATE_LIMITED: "The provider rate limit was reached.",
  UNAUTHORIZED_PROVIDER: "The provider rejected the configured authorization.",
  MALFORMED_RESPONSE: "The provider returned a malformed response.",
  UPSTREAM_UNAVAILABLE: "The provider was temporarily unavailable.",
  UNSUPPORTED: "The provider does not support this capability.",
  UNKNOWN_PROVIDER_ERROR: "The provider returned an unclassified failure.",
};

export function sanitizeRadarProviderError(error: unknown): RadarProviderError {
  const raw = error instanceof Error ? error.message.toLowerCase() : "";
  const code: RadarProviderErrorCode = /timeout|timed out/.test(raw) ? "TIMEOUT" : /rate.?limit|too many requests/.test(raw) ? "RATE_LIMITED" : /unauthor|forbidden|invalid api|invalid key|401|403/.test(raw) ? "UNAUTHORIZED_PROVIDER" : /malformed|invalid response|parse|schema/.test(raw) ? "MALFORMED_RESPONSE" : /unsupported|not supported/.test(raw) ? "UNSUPPORTED" : /unavailable|network|econn|5\d\d/.test(raw) ? "UPSTREAM_UNAVAILABLE" : "UNKNOWN_PROVIDER_ERROR";
  return { code, retryable: ["TIMEOUT", "RATE_LIMITED", "UPSTREAM_UNAVAILABLE"].includes(code), summary: SAFE_ERROR_TEXT[code] };
}
