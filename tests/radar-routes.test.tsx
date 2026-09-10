import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { mockGetFeatureFlags, mockNotFound } = vi.hoisted(() => ({
  mockGetFeatureFlags: vi.fn(),
  mockNotFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }),
}));

vi.mock("@/lib/feature-flags/server", () => ({ getFeatureFlags: mockGetFeatureFlags }));
vi.mock("next/navigation", () => ({ notFound: mockNotFound }));

import RadarPage from "@/app/(public)/radar/page";
import RadarPreviewPage from "@/app/(public)/radar-preview/page";
import RadarPreviewTokenPage from "@/app/(public)/radar-preview/[token]/page";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("Gate 19B Radar routes", () => {
  it("uses radar_enabled for the public state without querying Radar records", async () => {
    mockGetFeatureFlags.mockResolvedValue({ radar_enabled: false });

    render(await RadarPage());

    expect(screen.getByText(/Radar public feed is currently not active/i)).toBeTruthy();
    expect(mockGetFeatureFlags).toHaveBeenCalledWith(["radar_enabled"]);
  });

  it("keeps the preview route development-only", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(() => RadarPreviewPage()).toThrow("NEXT_NOT_FOUND");
    expect(mockNotFound).toHaveBeenCalledOnce();
  });

  it("keeps the synthetic detail route development-only and rejects unknown fixtures", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(RadarPreviewTokenPage({ params: Promise.resolve({ token: "sample-token-a" }) })).rejects.toThrow("NEXT_NOT_FOUND");

    vi.stubEnv("NODE_ENV", "test");
    await expect(RadarPreviewTokenPage({ params: Promise.resolve({ token: "not-a-fixture" }) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mockNotFound).toHaveBeenCalledTimes(2);
  });
});
