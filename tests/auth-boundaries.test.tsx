import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetClaims, mockRpc, mockSignOut, mockReplace, mockRefresh } = vi.hoisted(() => ({
  mockGetClaims: vi.fn(),
  mockRpc: vi.fn(),
  mockSignOut: vi.fn(),
  mockReplace: vi.fn(),
  mockRefresh: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getClaims: mockGetClaims },
    rpc: mockRpc,
  })),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    auth: { signOut: mockSignOut },
  })),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, refresh: mockRefresh }),
}));

import {
  getLoginRedirect,
  getSafeNextPath,
  hasVerifiedClaims,
} from "@/lib/auth/redirects";
import { AuthorizationError, requireAdminAccess } from "@/lib/auth/authorization";
import LogoutButton from "@/app/admin/logout-button";

describe("authentication boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unsafe login return paths", () => {
    expect(getSafeNextPath("https://example.com" )).toBe("/admin");
    expect(getSafeNextPath("//example.com")).toBe("/admin");
    expect(getSafeNextPath("/\\example.invalid")).toBe("/admin");
    expect(getSafeNextPath("/admin/../login")).toBe("/admin");
    expect(getSafeNextPath("/admin/%2e%2e/login")).toBe("/admin");
    expect(getSafeNextPath("/admin/%2E%2E/%6Cogin")).toBe("/admin");
    expect(getSafeNextPath("/")).toBe("/admin");
    expect(getSafeNextPath("/admin/reports")).toBe("/admin/reports");
    expect(getSafeNextPath("/admin/reports?tab=security#members")).toBe(
      "/admin/reports?tab=security#members",
    );
    expect(getSafeNextPath("/projects/abc")).toBe("/projects/abc");
    expect(getSafeNextPath("/projects")).toBe("/projects");
    expect(getLoginRedirect("/admin")).toBe("/login?next=%2Fadmin");
  });

  it("keeps the Next.js Proxy beside src/app and wires session refresh", () => {
    const root = resolve(process.cwd());
    const proxyPath = resolve(root, "src/proxy.ts");
    const proxySource = readFileSync(proxyPath, "utf8");
    const sessionSource = readFileSync(resolve(root, "src/lib/supabase/proxy.ts"), "utf8");

    expect(existsSync(proxyPath)).toBe(true);
    expect(existsSync(resolve(root, "proxy.ts"))).toBe(false);
    expect(proxySource).toContain('from "@/lib/supabase/proxy"');
    expect(proxySource).toContain("updateSession(request)");
    expect(sessionSource).toContain("createServerClient");
    expect(sessionSource).toContain("supabase.auth.getClaims()");
    expect(sessionSource).toContain("setAll(cookiesToSet, headers)");
    expect(sessionSource).toContain("request.cookies.set(name, value)");
    expect(sessionSource).toContain("response.cookies.set(name, value, options)");
    expect(sessionSource).toContain("Object.entries(headers)");
    expect(sessionSource).toContain("response.headers.set(name, value)");
  });

  it("requires a verified subject before treating claims as authenticated", () => {
    expect(hasVerifiedClaims(null)).toBe(false);
    expect(hasVerifiedClaims({})).toBe(false);
    expect(hasVerifiedClaims({ sub: "user-id" })).toBe(true);
  });

  it("denies an authenticated user without active application membership", async () => {
    mockGetClaims.mockResolvedValue({
      data: { claims: { sub: "no-role-user" } },
      error: null,
    });
    mockRpc.mockResolvedValue({
      data: [{ user_id: "no-role-user", role_keys: [] }],
      error: null,
    });

    await expect(requireAdminAccess()).rejects.toMatchObject({
      status: 403,
    });
  });

  it("allows an active application member through the admin guard", async () => {
    mockGetClaims.mockResolvedValue({
      data: { claims: { sub: "active-viewer" } },
      error: null,
    });
    mockRpc.mockResolvedValue({
      data: [{ user_id: "active-viewer", role_keys: ["viewer"] }],
      error: null,
    });

    await expect(requireAdminAccess()).resolves.toMatchObject({
      userId: "active-viewer",
      roles: ["viewer"],
    });
  });

  it("fails closed when authorization infrastructure is unavailable", async () => {
    mockGetClaims.mockResolvedValue({
      data: { claims: { sub: "active-user" } },
      error: null,
    });
    mockRpc.mockResolvedValue({ data: null, error: new Error("temporary failure") });

    await expect(requireAdminAccess()).rejects.toMatchObject({
      status: 503,
    } satisfies Partial<AuthorizationError>);
  });

  it("navigates only after successful logout", async () => {
    mockSignOut.mockResolvedValue({ error: null });
    render(<LogoutButton />);

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login"));
    expect(mockRefresh).toHaveBeenCalledOnce();
  });

  it("keeps the current session view in place when logout fails", async () => {
    mockSignOut.mockResolvedValue({ error: new Error("provider failure") });
    render(<LogoutButton />);

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(await screen.findByText("Unable to sign out. Please try again.")).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("keeps the secret-key name out of browser client code", () => {
    const browserClient = readFileSync(
      resolve(process.cwd(), "src/lib/supabase/client.ts"),
      "utf8",
    );

    expect(browserClient).not.toContain("SUPABASE_SECRET_KEY");
    expect(browserClient).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});
