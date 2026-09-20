import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/authorization", () => ({
  getAuthorizationContext: vi.fn(async () => ({ userId: "00000000-0000-4000-8000-000000000001", roles: ["admin"], permissions: [], supabase: { rpc } })),
}));

import { getAnalyzerSnapshot, runAnalyzer } from "@/lib/token-analyzer/server";
import fixture from "./fixtures/token-analyzer-contract.json";

describe("Analyzer server gateway", () => {
  beforeEach(() => rpc.mockReset());

  it("reads state through the trusted RPC and fails closed when disabled", async () => {
    rpc.mockResolvedValue({ data: { enabled: false, public_enabled: false, ai_enabled: false, analysis_count: 0 }, error: null });
    await expect(runAnalyzer({ raw: "0x0000000000000000000000000000000000000001", hintChain: "ethereum" })).rejects.toMatchObject({ code: "FEATURE_DISABLED" });
    expect(rpc).toHaveBeenCalledWith("analyzer_read_state");
  });

  it("persists an authorized run through the named RPC, never a raw table client", async () => {
    rpc.mockImplementation(async (name: string) => name === "analyzer_read_state" ? { data: { enabled: true }, error: null } : name === "analyzer_reserve_delivery" ? { data: { status: "NEW", delivery_key: "a".repeat(64), owner_token: "capability", input: fixture.input, resolution: fixture.resolution }, error: null } : { data: { delivery_key: "a".repeat(64), result: { requestId: "durable", status: "INSUFFICIENT_DATA" } }, error: null });
    const result = await runAnalyzer({ raw: "0x0000000000000000000000000000000000000001", hintChain: "ethereum" });
    expect(result.requestId).toBe("durable");
    expect(rpc.mock.calls.map(([name]) => name)).toEqual(["analyzer_read_state", "analyzer_reserve_delivery", "analyzer_complete_delivery", "analyzer_get_delivery_receipt"]);
  });

  it("does not convert a state RPC error into ordinary disabled state", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
    await expect(getAnalyzerSnapshot()).rejects.toMatchObject({ code: "PERSISTENCE_FAILURE" });
  });
});
