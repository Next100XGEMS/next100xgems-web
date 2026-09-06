import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import NetworkPageContent from "@/components/network/network-page";
import WorkWithUsPageContent from "@/components/work-with-us/work-with-us-page";

afterEach(() => cleanup());

describe("Gate 15 Network page", () => {
  it("represents the confirmed channels without invented audience proof", () => {
    render(<NetworkPageContent />);

    for (const channel of ["X", "Telegram", "YouTube", "Instagram"]) {
      expect(screen.getAllByText(channel, { exact: true }).length).toBeGreaterThan(0);
    }
    expect(screen.getByText(/media infrastructure, not a social-link page/i)).toBeTruthy();
    expect(screen.getByText(/not assumed to be automatically syndicated/i)).toBeTruthy();
    expect(screen.getByText(/Sponsored ≠ Radar ranking\./)).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Work With Us" }).length).toBeGreaterThan(0);
    expect(screen.queryByText(/followers|engagement|impressions|audience demographics|@\w+/iu)).toBeNull();
    expect(screen.queryByRole("link", { name: "X" })).toBeNull();
  });
});

describe("Gate 15 Work With Us page", () => {
  it("represents confirmed services and campaign types without pricing", () => {
    render(<WorkWithUsPageContent bookingEnabled={false} />);

    for (const service of ["Sponsored Content", "X Campaigns", "Telegram Campaigns", "AMA", "Launch Campaigns", "Content Production", "Multi-platform Distribution"]) {
      expect(screen.getByText(service, { exact: true })).toBeTruthy();
    }
    for (const campaign of ["Project Awareness", "Product / Feature Launch", "Token / Ecosystem Announcement", "AMA / Community Session", "Research / Sponsored Education", "Multi-platform Media Campaign"]) {
      expect(screen.getByText(campaign, { exact: true })).toBeTruthy();
    }
    expect(screen.getByText(/campaign inquiry system is being finalized/i)).toBeTruthy();
    expect(screen.getByText(/no live booking action is active/i)).toBeTruthy();
    expect(screen.getByText(/Payment does not buy analytical influence/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Methodology" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Disclosures" })).toBeTruthy();
    expect(screen.queryByText(/guaranteed visibility|guaranteed conversions|guaranteed investors|go viral guaranteed|100x your marketing/i)).toBeNull();
    expect(screen.queryByText(/\$\s*\d|€\s*\d|price|checkout|CRM/i)).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

