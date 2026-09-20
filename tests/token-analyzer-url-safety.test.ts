import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { AnalyzerUrlSecurityError, assertSafeAnalyzerUrl } from "@/lib/token-analyzer/url-safety";

describe("Analyzer URL safety", () => {
  it.each(["http://0.0.0.0/", "http://127.0.0.1/", "http://[::1]/", "http://[::ffff:127.0.0.1]/", "http://[fe80::1]/", "http://[fe90::1]/", "http://[fc00::1]/"]) ("rejects unsafe literal %s", async (value) => {
    await expect(assertSafeAnalyzerUrl(value)).rejects.toBeInstanceOf(AnalyzerUrlSecurityError);
  });
  it("rejects credentials and unsupported protocols", async () => {
    await expect(assertSafeAnalyzerUrl("https://user:pass@example.com/")).rejects.toBeInstanceOf(AnalyzerUrlSecurityError);
    await expect(assertSafeAnalyzerUrl("file:///etc/passwd")).rejects.toBeInstanceOf(AnalyzerUrlSecurityError);
  });
});
