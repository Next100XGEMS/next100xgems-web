import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/authorization", () => ({
  getAuthorizationContext: vi.fn(async () => ({ userId: "00000000-0000-4000-8000-000000000001", roles: ["admin"], permissions: [], supabase: { rpc } })),
}));

import { getAnalyzerSnapshot, runAnalyzer } from "@/lib/token-analyzer/server";

describe("Analyzer server gateway", () => {
  beforeEach(() => rpc.mockReset());

  it("reads state through the trusted RPC and fails closed when disabled", async () => {
    rpc.mockResolvedValue({ data: { enabled: false, public_enabled: false, ai_enabled: false, analysis_count: 0 }, error: null });
    await expect(runAnalyzer({ raw: "0x0000000000000000000000000000000000000001", hintChain: "ethereum" })).rejects.toMatchObject({ code: "FEATURE_DISABLED" });
    expect(rpc).toHaveBeenCalledWith("analyzer_read_state");
  });

  it("persists an authorized run through the named RPC, never a raw table client", async () => {
    rpc.mockImplementation(async (name: string) => name === "analyzer_read_state" ? { data: { enabled: true, public_enabled: false, ai_enabled: false, analysis_count: 0 }, error: null } : { data: { result: { requestId: "durable", status: "INSUFFICIENT_DATA" } }, error: null });
    const result = await runAnalyzer({ raw: "0x0000000000000000000000000000000000000001", hintChain: "ethereum" });
    expect(result.requestId).toBe("durable");
    expect(rpc.mock.calls.some(([name]) => name === "analyzer_submit_run")).toBe(true);
  });

  it("does not convert a state RPC error into ordinary disabled state", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
    await expect(getAnalyzerSnapshot()).rejects.toMatchObject({ code: "PERSISTENCE_FAILURE" });
  });
});
