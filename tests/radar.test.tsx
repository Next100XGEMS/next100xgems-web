import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import RadarPageContent from "@/components/radar/radar-page";
import { RadarDetailPageContent, RadarPreviewPageContent } from "@/components/radar/radar-presentation";
import { getRadarFixture } from "@/lib/radar/fixtures";

afterEach(() => cleanup());

describe("Gate 19B public Radar page", () => {
  it("positions Radar as watch-only intelligence with an honest inactive state", () => {
    render(<RadarPageContent feed={{ state: "UNAVAILABLE", records: [] }} />);

    expect(screen.getByRole("heading", { name: /market intelligence before the noise/i, level: 1 })).toBeTruthy();
    expect(screen.getByText(/Radar public data is temporarily unavailable/i)).toBeTruthy();
    expect(screen.getByText(/human review remains required/i)).toBeTruthy();
    expect(screen.getByText("VERIFIED DATA")).toBeTruthy();
    expect(screen.getAllByText("UNKNOWN").length).toBeGreaterThan(0);
    expect(screen.getByText("Sponsored ≠ Radar ranking.")).toBeTruthy();
    expect(screen.queryByText("TOKEN A")).toBeNull();
    expect(screen.getByText(/Private analysis rows and development fixtures are never used/i)).toBeTruthy();
  });

  it("keeps enabled state truthful without fabricating a feed", () => {
    render(<RadarPageContent feed={{ state: "EMPTY", records: [] }} />);

    expect(screen.getByText(/No approved Radar records are published yet/i)).toBeTruthy();
    expect(screen.queryByRole("article")).toBeNull();
    expect(screen.queryByText(/sample data/i)).toBeNull();
  });
});

describe("Gate 19B development Radar preview", () => {
  it("renders visibly synthetic list data and all evidence states", () => {
    render(<RadarPreviewPageContent />);

    expect(screen.getByRole("heading", { name: /sample intelligence surface/i, level: 1 })).toBeTruthy();
    expect(screen.getAllByText(/DEVELOPMENT PREVIEW · SAMPLE DATA/i).length).toBeGreaterThan(1);
    expect(screen.getByText("TOKEN A")).toBeTruthy();
    expect(screen.getByText("TOKEN B")).toBeTruthy();
    expect(screen.getAllByText("Radar Score · SAMPLE").length).toBeGreaterThan(1);
    expect(screen.getAllByText("HIGH RISK").length).toBeGreaterThan(0);
    expect(screen.getAllByText("UNKNOWN").length).toBeGreaterThan(0);
    expect(screen.getByText("STALE")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders synthetic detail without action controls or real identity", () => {
    const fixture = getRadarFixture("sample-token-a");
    if (!fixture) throw new Error("fixture missing");

    render(<RadarDetailPageContent fixture={fixture} />);

    expect(screen.getByRole("heading", { name: /TOKEN A/i, level: 1 })).toBeTruthy();
    expect(screen.getByText("SAMPLE-ONLY-A")).toBeTruthy();
    expect(screen.getByText("Current sample context")).toBeTruthy();
    expect(screen.getByText("Risk context")).toBeTruthy();
    expect(screen.getByText("Review state")).toBeTruthy();
    expect(screen.getAllByText(/provider unavailable/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/not a probability, forecast, or recommendation/i)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText(/ethereum|bitcoin|solana|0x[a-f0-9]{10,}/i)).toBeNull();
  });
});
