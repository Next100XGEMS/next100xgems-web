import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreateClient, mockRequireAdminAccess, mockRpc } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockRequireAdminAccess: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: mockCreateClient,
}));
vi.mock("@/lib/auth/authorization", () => ({
  requireAdminAccess: mockRequireAdminAccess,
}));

import {
  AuditWriteError,
  writeAuditEvent,
} from "@/lib/audit/server";

const actorId = "00000000-0000-4000-8000-000000000001";
const resourceId = "00000000-0000-4000-8000-000000000002";

describe("server audit writer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SUPABASE_URL", "https://supabase.example.test");
    vi.stubEnv("SUPABASE_SECRET_KEY", "server-only-test-secret");
    mockRequireAdminAccess.mockResolvedValue({ userId: actorId, roles: ["admin"] });
    mockCreateClient.mockReturnValue({ rpc: mockRpc });
    mockRpc.mockResolvedValue({ data: "00000000-0000-4000-8000-000000000003", error: null });
  });

  it("derives the actor and sends a narrow sanitized event payload", async () => {
    const receipt = await writeAuditEvent({
      action: "feature_flag.updated",
      resourceType: "feature_flag",
      resourceId,
      previousState: { enabled: false, password: "do-not-store" },
      resultingState: { enabled: true, access_token: "do-not-store" },
      metadata: { reason: "operator", secret: "do-not-store", safe: "kept" },
    });

    expect(mockRequireAdminAccess).toHaveBeenCalledOnce();
    expect(mockRpc).toHaveBeenCalledWith("write_audit_event", {
      p_actor_kind: "USER",
      p_actor_id: actorId,
      p_action: "feature_flag.updated",
      p_resource_type: "feature_flag",
      p_resource_id: resourceId,
      p_previous_state: { enabled: false, password: "[REDACTED]" },
      p_resulting_state: { enabled: true, access_token: "[REDACTED]" },
      p_metadata: { reason: "operator", secret: "[REDACTED]", safe: "kept" },
    });
    expect(receipt).toEqual({
      id: "00000000-0000-4000-8000-000000000003",
      actorId,
      action: "feature_flag.updated",
      resourceType: "feature_flag",
      resourceId,
    });
  });

  it("does not accept an actor id from event input", async () => {
    await writeAuditEvent({
      action: "article.updated",
      resourceType: "article",
      resourceId,
      metadata: { actorUserId: "00000000-0000-4000-8000-000000000099" },
    });

    expect(mockRpc.mock.calls[0][1].p_actor_id).toBe(actorId);
  });

  it("fails without an active trusted actor", async () => {
    mockRequireAdminAccess.mockRejectedValue(new Error("not authorized"));

    await expect(
      writeAuditEvent({
        action: "role.assigned",
        resourceType: "role",
        resourceId,
      }),
    ).rejects.toThrow("not authorized");
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("fails safely when audit persistence fails", async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error("database failure") });

    await expect(
      writeAuditEvent({
        action: "radar.reviewed",
        resourceType: "radar_review",
        resourceId,
      }),
    ).rejects.toBeInstanceOf(AuditWriteError);
    await expect(
      writeAuditEvent({
        action: "radar.reviewed",
        resourceType: "radar_review",
        resourceId,
      }),
    ).rejects.not.toThrow("database failure");
  });

  it("is server-only and does not define product mutation helpers", () => {
    const source = readFileSync("src/lib/audit/server.ts", "utf8");

    expect(source).toContain('import "server-only"');
    expect(source).toContain("SUPABASE_SECRET_KEY");
    expect(source).not.toContain("update(\"feature_flags\")");
    expect(source).not.toContain("insert(\"articles\")");
    expect(source).not.toContain("actorUserId");
  });
});
