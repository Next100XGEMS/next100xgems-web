import "server-only";
import dns from "node:dns/promises";

export class AnalyzerUrlSecurityError extends Error { constructor(message: string) { super(message); this.name = "AnalyzerUrlSecurityError"; } }
const MAX_BYTES = 1_000_000;
const SAFE_TYPES = ["text/", "application/json", "application/xml", "application/xhtml+xml"];
function isPrivate(host: string, address?: string) {
  const value = (address ?? host).toLowerCase();
  if (value === "localhost" || value.endsWith(".localhost") || value.endsWith(".local") || value === "metadata.google.internal") return true;
  if (/^(127\.|10\.|192\.168\.|169\.254\.)/.test(value)) return true;
  const match = value.match(/^172\.(\d+)\./); if (match && Number(match[1]) >= 16 && Number(match[1]) <= 31) return true;
  if (value === "::1" || value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe80:")) return true;
  return false;
}

export async function assertSafeAnalyzerUrl(value: string): Promise<URL> {
  let url: URL;
  try { url = new URL(value); } catch { throw new AnalyzerUrlSecurityError("URL is invalid."); }
  if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.port && !/^\d{1,5}$/.test(url.port)) throw new AnalyzerUrlSecurityError("Only public HTTP(S) URLs are allowed.");
  if (isPrivate(url.hostname)) throw new AnalyzerUrlSecurityError("Private and local destinations are blocked.");
  const addresses = await dns.lookup(url.hostname, { all: true }).catch(() => []);
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivate(url.hostname, address))) throw new AnalyzerUrlSecurityError("The destination could not be verified as public.");
  return url;
}

export async function fetchAnalyzerText(value: string, timeoutMs = 8_000): Promise<{ url: string; contentType: string; text: string }> {
  let current = await assertSafeAnalyzerUrl(value);
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try { response = await fetch(current, { redirect: "manual", signal: controller.signal, headers: { accept: "text/html,application/xhtml+xml,application/json,text/plain;q=0.8" } }); } finally { clearTimeout(timer); }
    if (response.status >= 300 && response.status < 400) { const location = response.headers.get("location"); if (!location) throw new AnalyzerUrlSecurityError("Redirect has no destination."); current = await assertSafeAnalyzerUrl(new URL(location, current).toString()); continue; }
    if (!response.ok) throw new AnalyzerUrlSecurityError("Source content is unavailable.");
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!SAFE_TYPES.some((type) => contentType.startsWith(type))) throw new AnalyzerUrlSecurityError("Source content type is not supported.");
    const length = Number(response.headers.get("content-length") ?? 0); if (length > MAX_BYTES) throw new AnalyzerUrlSecurityError("Source content is too large.");
    const text = await response.text(); if (Buffer.byteLength(text, "utf8") > MAX_BYTES) throw new AnalyzerUrlSecurityError("Source content is too large.");
    return { url: current.toString(), contentType, text };
  }
  throw new AnalyzerUrlSecurityError("Too many redirects.");
}
