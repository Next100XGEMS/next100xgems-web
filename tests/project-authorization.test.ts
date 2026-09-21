import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetClaims, mockFrom, mockMaybeSingle } = vi.hoisted(() => {
  const mockMaybeSingle = vi.fn();
  const mockFrom = vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: mockMaybeSingle,
        })),
      })),
    })),
  }));
  return {
    mockGetClaims: vi.fn(),
    mockFrom,
    mockMaybeSingle,
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getClaims: mockGetClaims },
    from: mockFrom,
  })),
}));

import { AuthorizationError } from "@/lib/auth/authorization";
import {
  projectRoleSatisfies,
  requireProjectAccess,
} from "@/lib/projects/authorization";
import {
  PROJECT_PROVENANCE,
  PROJECT_WORKFLOW_STATES,
  isProjectFieldKey,
} from "@/lib/projects/types";

describe("project platform authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps project roles orthogonal to staff Admin", () => {
    expect(projectRoleSatisfies("project_owner", "project_viewer")).toBe(true);
    expect(projectRoleSatisfies("project_viewer", "project_owner")).toBe(false);
    expect(projectRoleSatisfies("project_editor", "project_editor")).toBe(true);
  });

  it("denies users without project membership even if they could be staff elsewhere", async () => {
    mockGetClaims.mockResolvedValue({
      data: { claims: { sub: "staff-user" } },
      error: null,
    });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(requireProjectAccess("project-1", "project_viewer")).rejects.toMatchObject({
      status: 403,
    });
  });

  it("allows a project_editor for editor-level access and denies viewer escalation", async () => {
    mockGetClaims.mockResolvedValue({
      data: { claims: { sub: "member-user" } },
      error: null,
    });
    mockMaybeSingle.mockResolvedValue({
      data: { role: "project_viewer" },
      error: null,
    });

    await expect(requireProjectAccess("project-1", "project_editor")).rejects.toBeInstanceOf(
      AuthorizationError,
    );

    mockMaybeSingle.mockResolvedValue({
      data: { role: "project_editor" },
      error: null,
    });

    await expect(requireProjectAccess("project-1", "project_editor")).resolves.toMatchObject({
      userId: "member-user",
      projectId: "project-1",
      role: "project_editor",
    });
  });

  it("locks provenance and workflow enums to the Phase 1 contract", () => {
    expect(PROJECT_PROVENANCE).toEqual([
      "PROJECT_PROVIDED",
      "INDEPENDENTLY_VERIFIED",
      "PROVIDER_DERIVED",
      "AI_INFERENCE",
      "UNKNOWN",
    ]);
    expect(PROJECT_WORKFLOW_STATES).toEqual([
      "SUBMITTED",
      "UNDER_REVIEW",
      "APPROVED",
      "REJECTED",
    ]);
    expect(isProjectFieldKey("website")).toBe(true);
    expect(isProjectFieldKey("score")).toBe(false);
    expect(isProjectFieldKey("organic_rank")).toBe(false);
  });
});
