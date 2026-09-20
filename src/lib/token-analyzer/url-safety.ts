import "server-only";
import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";

export class AnalyzerUrlSecurityError extends Error { constructor(message: string) { super(message); this.name = "AnalyzerUrlSecurityError"; } }
const MAX_BYTES = 1_000_000;
const MAX_REDIRECTS = 3;
const SAFE_TYPES = ["text/", "application/json", "application/xml", "application/xhtml+xml"];
const IPV4 = (value: string) => value.split(".").map(Number);
function ipv4In(value: string, base: number[], bits: number) { const octets = IPV4(value); if (octets.length !== 4 || octets.some((item) => !Number.isInteger(item) || item < 0 || item > 255)) return false; const actual = octets.reduce((n, item) => (n << BigInt(8)) | BigInt(item), BigInt(0)); const target = base.reduce((n, item) => (n << BigInt(8)) | BigInt(item), BigInt(0)); const mask = bits === 0 ? BigInt(0) : ((BigInt(1) << BigInt(32)) - BigInt(1)) ^ ((BigInt(1) << BigInt(32 - bits)) - BigInt(1)); return (actual & mask) === (target & mask); }
function ipv6BigInt(value: string) { const halves = value.toLowerCase().split("::"); if (halves.length > 2) return null; const left = halves[0] ? halves[0].split(":") : []; const right = halves[1] ? halves[1].split(":") : []; const expanded = [...left, ...Array(8 - left.length - right.length).fill("0"), ...right]; if (expanded.length !== 8 || expanded.some((part) => !/^[0-9a-f]{1,4}$/.test(part))) return null; const number = expanded.reduce((n, part) => (n << BigInt(16)) | BigInt(`0x${part}`), BigInt(0)); if (number >> BigInt(32) === BigInt(0xffff)) { const v4 = Number(number & ((BigInt(1) << BigInt(32)) - BigInt(1))); return { mapped: [v4 >>> 24, (v4 >>> 16) & 255, (v4 >>> 8) & 255, v4 & 255].join("."), value: null as bigint | null }; } return { mapped: null, value: number };
}
function unsafeAddress(value: string) {
  const stripped = value.replace(/^\[|\]$/g, ""); const family = net.isIP(stripped);
  if (family === 4) return ipv4In(stripped, [0, 0, 0, 0], 8) || ipv4In(stripped, [10, 0, 0, 0], 8) || ipv4In(stripped, [100, 64, 0, 0], 10) || ipv4In(stripped, [127, 0, 0, 0], 8) || ipv4In(stripped, [169, 254, 0, 0], 16) || ipv4In(stripped, [172, 16, 0, 0], 12) || ipv4In(stripped, [192, 0, 0, 0], 24) || ipv4In(stripped, [192, 0, 2, 0], 24) || ipv4In(stripped, [192, 168, 0, 0], 16) || ipv4In(stripped, [198, 18, 0, 0], 15) || ipv4In(stripped, [198, 51, 100, 0], 24) || ipv4In(stripped, [203, 0, 113, 0], 24) || ipv4In(stripped, [224, 0, 0, 0], 4) || ipv4In(stripped, [240, 0, 0, 0], 4);
  if (family !== 6) return false; const parsed = ipv6BigInt(stripped); if (!parsed) return true; if (parsed.mapped) return unsafeAddress(parsed.mapped); const n = parsed.value as bigint; const prefix = (bits: number) => n >> BigInt(128 - bits); return n === BigInt(0) || n === BigInt(1) || prefix(7) === BigInt(0x7e) || prefix(10) === BigInt(0x3fa) || prefix(8) === BigInt(0xff) || prefix(32) === BigInt(0x20010db8) || prefix(16) === BigInt(0x2001);
}
function unsafeHost(host: string) { const normalized = host.toLowerCase().replace(/\.$/, ""); return normalized === "localhost" || normalized.endsWith(".localhost") || normalized.endsWith(".local") || normalized === "metadata.google.internal"; }
type SafeResponse = { status: number; headers: { get(name: string): string | null }; body: AsyncIterable<Uint8Array> & { destroy?: () => void } };
function requestPinned(url: URL, address: string, timeoutSignal: AbortSignal): Promise<SafeResponse> {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === "https:" ? https : http; const request = transport.request({ hostname: address, port: url.port ? Number(url.port) : undefined, path: `${url.pathname}${url.search}`, method: "GET", headers: { accept: "text/html,application/xhtml+xml,application/json,text/plain;q=0.8", host: url.host }, servername: url.hostname, lookup: (_host, _options, callback) => callback(null, address, net.isIP(address)) }, (response) => resolve({ status: response.statusCode ?? 0, headers: { get: (name) => { const value = response.headers[name.toLowerCase()]; return Array.isArray(value) ? value[0] ?? null : value ?? null; } }, body: response }));
    const abort = () => request.destroy(new AnalyzerUrlSecurityError("Source request timed out.")); if (timeoutSignal.aborted) return abort(); timeoutSignal.addEventListener("abort", abort, { once: true }); request.on("error", reject); request.end();
  });
}
async function resolvePublic(url: URL, timeoutSignal: AbortSignal) { if (!/^https?:$/.test(url.protocol) || url.username || url.password || unsafeHost(url.hostname) || unsafeAddress(url.hostname)) throw new AnalyzerUrlSecurityError("Only public HTTP(S) URLs are allowed."); const addresses = await Promise.race([dns.lookup(url.hostname, { all: true }), new Promise<never>((_, reject) => timeoutSignal.addEventListener("abort", () => reject(new AnalyzerUrlSecurityError("DNS lookup timed out.")), { once: true }))]).catch(() => []); if (!addresses.length || addresses.some(({ address }) => unsafeAddress(address))) throw new AnalyzerUrlSecurityError("The destination could not be verified as public."); return addresses[0]!.address; }
export async function assertSafeAnalyzerUrl(value: string): Promise<URL> { const url = (() => { try { return new URL(value); } catch { throw new AnalyzerUrlSecurityError("URL is invalid."); } })(); const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 8_000); try { await resolvePublic(url, controller.signal); return url; } finally { clearTimeout(timer); } }
export async function fetchAnalyzerText(value: string, timeoutMs = 8_000): Promise<{ url: string; contentType: string; text: string }> {
  let current = new URL(value); const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs); let redirects = 0; let total = 0; const chunks: Buffer[] = [];
  try {
    while (true) {
      const address = await resolvePublic(current, controller.signal); const response = await requestPinned(current, address, controller.signal);
      if (response.status >= 300 && response.status < 400) { response.body.destroy?.(); if (redirects++ >= MAX_REDIRECTS) throw new AnalyzerUrlSecurityError("Too many redirects."); const location = response.headers.get("location"); if (!location) throw new AnalyzerUrlSecurityError("Redirect has no destination."); current = new URL(location, current); continue; }
      if (response.status < 200 || response.status >= 300) { response.body.destroy?.(); throw new AnalyzerUrlSecurityError("Source content is unavailable."); }
      const contentType = response.headers.get("content-type")?.toLowerCase() ?? ""; if (!SAFE_TYPES.some((type) => contentType.startsWith(type))) { response.body.destroy?.(); throw new AnalyzerUrlSecurityError("Source content type is not supported."); }
      for await (const chunk of response.body) { total += chunk.byteLength; if (total > MAX_BYTES) { response.body.destroy?.(); throw new AnalyzerUrlSecurityError("Source content is too large."); } chunks.push(Buffer.from(chunk)); }
      return { url: current.toString(), contentType, text: Buffer.concat(chunks).toString("utf8") };
    }
  } finally { clearTimeout(timer); }
}
