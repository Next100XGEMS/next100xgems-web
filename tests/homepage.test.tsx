import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import Homepage from "@/components/home/homepage";

afterEach(() => cleanup());

const enabledFlags = {
  radarEnabled: false,
  researchEnabled: false,
  featuredPartnersEnabled: true,
  newsletterEnabled: false,
};

describe("Gate 13 homepage", () => {
  it("renders one primary positioning heading and both core CTAs", () => {
    render(<Homepage flags={enabledFlags} />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { name: /crypto moves fast/i })).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Explore Radar" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Work With Us" }).length).toBeGreaterThan(0);
  });

  it("keeps intelligence, commercial, and editorial boundaries visible", () => {
    render(<Homepage flags={enabledFlags} />);

    expect(screen.getByText(/human review occurs before public publication/i)).toBeTruthy();
    expect(screen.getByText("Sponsored ≠ Radar ranking.")).toBeTruthy();
    expect(screen.getAllByText("SPONSORED").length).toBeGreaterThan(0);
    expect(screen.getAllByText("PARTNER").length).toBeGreaterThan(0);
    expect(screen.getByText(/do not influence Radar rankings/i)).toBeTruthy();
  });

  it("does not introduce promises, fabricated proof, or a non-functional newsletter form", () => {
    render(<Homepage flags={enabledFlags} />);

    expect(screen.queryByText(/automatic (buy|sell)|guaranteed (return|outcome)|find the next 100x/i)).toBeNull();
    expect(screen.getByText("Proof, not promises.")).toBeTruthy();
    expect(screen.getByText(/no verified partner records/i)).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText(/\b(?:500k|million|roas)\b/iu)).toBeNull();
  });

  it("suppresses featured partners when its public flag is unavailable", () => {
    render(<Homepage flags={{ ...enabledFlags, featuredPartnersEnabled: false }} />);

    expect(screen.queryByRole("heading", { name: /featured partners/i })).toBeNull();
  });

  it("is mounted inside the approved public shell route group", () => {
    const pageSource = readFileSync(resolve(process.cwd(), "src/app/(public)/page.tsx"), "utf8");
    const layoutSource = readFileSync(resolve(process.cwd(), "src/app/(public)/layout.tsx"), "utf8");

    expect(pageSource).toContain("getFeatureFlags");
    expect(pageSource).toContain("<Homepage");
    expect(layoutSource).toContain("PublicShell");
  });
});
