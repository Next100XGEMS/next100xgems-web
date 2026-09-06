import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreateClient, mockFrom } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: mockCreateClient,
}));

import {
  getFeatureFlag,
  getFeatureFlags,
  getSystemFeatureFlags,
  isFeatureEnabled,
  type FeatureFlagKey,
} from "@/lib/feature-flags/server";

function mockQuery(data: unknown, error: unknown = null) {
  const query = {
    select: vi.fn(() => query),
    in: vi.fn(async () => ({ data, error })),
  };
  mockFrom.mockReturnValue(query);
}

describe("server feature flags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SUPABASE_URL", "https://supabase.example.test");
    vi.stubEnv("SUPABASE_SECRET_KEY", "server-only-test-secret");
    mockCreateClient.mockReturnValue({ from: mockFrom });
  });

  it("returns a known enabled flag", async () => {
    mockQuery([{ key: "radar_enabled", enabled: true, configuration: null }]);

    await expect(getFeatureFlag("radar_enabled")).resolves.toEqual({
      key: "radar_enabled",
      enabled: true,
    });
    await expect(isFeatureEnabled("radar_enabled")).resolves.toBe(true);
  });

  it("returns a known disabled flag", async () => {
    mockQuery([{ key: "research_enabled", enabled: false, configuration: null }]);

    await expect(isFeatureEnabled("research_enabled")).resolves.toBe(false);
  });

  it("ignores unknown keys at runtime", async () => {
    await expect(getFeatureFlag("unsupported" as FeatureFlagKey)).resolves.toBeNull();
    await expect(isFeatureEnabled("unsupported" as FeatureFlagKey)).resolves.toBe(false);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("uses safe defaults when a row is missing", async () => {
    mockQuery([]);

    await expect(isFeatureEnabled("radar_auto_publish")).resolves.toBe(false);
    await expect(isFeatureEnabled("maintenance_mode")).resolves.toBe(true);
  });

  it("does not enable a flag from malformed database values", async () => {
    mockQuery([
      { key: "radar_auto_publish", enabled: "true", configuration: null },
      { key: "radar_enabled", enabled: true, configuration: [] },
    ]);

    await expect(isFeatureEnabled("radar_auto_publish")).resolves.toBe(false);
    await expect(isFeatureEnabled("radar_enabled")).resolves.toBe(false);
  });

  it("fails conservatively when the database read fails", async () => {
    mockQuery(null, new Error("database unavailable"));

    await expect(isFeatureEnabled("radar_enabled")).resolves.toBe(false);
    await expect(isFeatureEnabled("maintenance_mode")).resolves.toBe(true);
  });

  it("returns only the requested typed boolean outcomes", async () => {
    mockQuery([
      { key: "radar_enabled", enabled: true, configuration: { internal: "hidden" } },
      { key: "research_enabled", enabled: false, configuration: null },
    ]);

    await expect(getFeatureFlags(["radar_enabled", "research_enabled"])).resolves.toEqual({
      radar_enabled: true,
      research_enabled: false,
    });
    await expect(getSystemFeatureFlags()).resolves.toEqual({
      radar_enabled: true,
      research_enabled: false,
      advertising_enabled: false,
      featured_partners_enabled: false,
      booking_enabled: false,
      newsletter_enabled: false,
      maintenance_mode: true,
      radar_auto_publish: false,
    });
  });

  it("keeps the privileged client and database metadata out of browser code", async () => {
    const source = await import("node:fs").then(({ readFileSync }) =>
      readFileSync("src/lib/feature-flags/server.ts", "utf8"),
    );

    expect(source).toContain('import "server-only"');
    expect(source).toContain("SUPABASE_SECRET_KEY");
    expect(source).not.toContain("updated_by");
    expect(source).not.toContain("export function setFeatureFlag");
  });
});
