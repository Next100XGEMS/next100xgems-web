import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockNotFound } = vi.hoisted(() => ({ mockNotFound: vi.fn() }));

vi.mock("next/navigation", () => ({ notFound: mockNotFound }));

import DesignSystemPage from "@/app/design-system/page";
import { Button, DisclosureLabel, StatusLabel } from "@/components/ui";
import { isDesignSystemAvailable } from "@/lib/design-system";

describe("Gate 9 design foundation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("keeps the laboratory unavailable in production", () => {
    expect(isDesignSystemAvailable("production")).toBe(false);
    expect(isDesignSystemAvailable("development")).toBe(true);

    vi.stubEnv("NODE_ENV", "production");
    DesignSystemPage();
    expect(mockNotFound).toHaveBeenCalledOnce();
  });

  it("renders important control and disclosure variants", () => {
    render(
      <div>
        <Button variant="primary">Primary action</Button>
        <Button variant="ghost">Quiet action</Button>
        <DisclosureLabel kind="sponsored" />
        <StatusLabel kind="verified-data" />
      </div>,
    );

    expect(screen.getByRole("button", { name: "Primary action" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Quiet action" })).toBeTruthy();
    expect(screen.getByText("SPONSORED")).toBeTruthy();
    expect(screen.getByText("VERIFIED DATA")).toBeTruthy();
  });

  it("keeps the lab free of product data fetching and public navigation", () => {
    const source = readFileSync(resolve(process.cwd(), "src/app/design-system/page.tsx"), "utf8");

    expect(source).toContain("visual test only");
    expect(source).toContain("isDesignSystemAvailable");
    expect(source).not.toContain("createClient");
    expect(source).not.toContain("feature_flags");
    expect(source).not.toContain("<nav");
  });
});
