/** Count Unicode code points, matching PostgreSQL char_length(text). */
export function unicodeCodePointLength(value: string) {
  return Array.from(value).length;
}

// This is the canonical Research blankness set. It intentionally does not
// depend on the host runtime's trim implementation.
const RESEARCH_WHITESPACE = /[\u0009-\u000d\u0020\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]/u;

export function isBlankResearchText(value: string) {
  return value.replace(/[\u0009-\u000d\u0020\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]/gu, "") === "";
}

export function isResearchSourceDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = Date.parse(value + "T00:00:00.000Z");
  if (!Number.isFinite(parsed)) return false;
  const date = new Date(parsed);
  const [year, month, day] = value.split("-").map(Number);
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day && year >= 1 && year <= 9999;
}

export function isResearchPublicTimestamp(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && parsed >= Date.parse("0001-01-01T00:00:00.000Z") && parsed <= Date.parse("9999-12-31T23:59:59.999Z");
}

export function hasResearchWhitespace(value: string) {
  return RESEARCH_WHITESPACE.test(value);
}

const RESEARCH_DNS_HOST = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$/;
const RESEARCH_IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;

function validResearchIpv4(host: string) {
  return RESEARCH_IPV4.test(host) && host.split(".").every((octet) => Number(octet) <= 255);
}

/**
 * Deliberately narrow source URL contract shared by the Admin validator and
 * public reader: HTTP(S), ASCII DNS hostname or IPv4, optional valid port,
 * and no credentials. IPv6 and internationalized hosts are deferred.
 */
export function isResearchSourceUrl(value: string) {
  if (value.length < 8 || value.length > 2048 || !/^https?:\/\//.test(value) || hasResearchWhitespace(value) || /[\\<>"\u0000-\u001f]/.test(value)) return false;
  const authority = value.match(/^https?:\/\/([^/?#]+)/)?.[1];
  if (!authority || authority.includes("@") || authority.includes("%")) return false;
  const parts = authority.split(":");
  if (parts.length > 2) return false;
  const host = parts[0];
  if (!host || host.length > 253 || !(validResearchIpv4(host) || RESEARCH_DNS_HOST.test(host))) return false;
  if (parts.length === 2 && (!/^\d{1,5}$/.test(parts[1]) || Number(parts[1]) < 1 || Number(parts[1]) > 65535)) return false;
  try {
    const parsed = new URL(value);
    return (parsed.protocol === "http:" || parsed.protocol === "https:") && !parsed.username && !parsed.password && parsed.hostname === host.toLowerCase();
  } catch {
    return false;
  }
}
