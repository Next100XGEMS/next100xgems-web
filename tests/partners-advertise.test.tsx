import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import AdvertisePageContent from "@/components/advertise/advertise-page";
import PartnersPageContent from "@/components/partners/partners-page";

afterEach(() => cleanup());

describe("Gate 16 Partners page", () => {
  it("defines Featured Partners as disclosed commercial relationships without invented records", () => {
    render(<PartnersPageContent featuredPartnersEnabled={false} />);

    expect(screen.getByRole("heading", { name: /longer-term commercial relationships/i, level: 1 })).toBeTruthy();
    expect(screen.getAllByText(/commercial relationship ≠ analytical endorsement/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/no featured partners are currently published/i)).toBeTruthy();
    expect(screen.getByText(/featured partner inventory is not currently active/i)).toBeTruthy();
    for (const item of ["Radar Score", "Radar ranking", "Radar risk assessment", "Organic trending status", "Independent research conclusions", "Independent editorial conclusions"]) {
      expect(screen.getByText(item, { exact: true })).toBeTruthy();
    }
    expect(screen.getByRole("link", { name: "Work With Us" })).toBeTruthy();
    expect(screen.queryAllByRole("article")).toHaveLength(0);
    expect(screen.queryByText("PROJECT", { exact: true })).toBeNull();
  });
});

describe("Gate 16 Advertise page", () => {
  it("describes disclosed inventory without pricing, live analytics, or purchased influence", () => {
    render(<AdvertisePageContent advertisingEnabled={false} />);

    for (const format of ["Native Sponsored Cards", "Contextual Display Placements", "Section Sponsorships"]) {
      expect(screen.getByText(format, { exact: true })).toBeTruthy();
    }
    for (const category of ["Homepage", "Research", "Radar-adjacent", "Featured Partners", "Social / Network Distribution"]) {
      expect(screen.getAllByText(category, { exact: true }).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText("SPONSORED", { exact: true }).length).toBeGreaterThan(0);
    expect(screen.getByText(/buy visibility, not influence/i)).toBeTruthy();
    expect(screen.getByText(/advertising is not currently active/i)).toBeTruthy();
    expect(screen.getByText(/no example numbers, guaranteed reach, guaranteed clicks, guaranteed investors, or guaranteed conversions/i)).toBeTruthy();
    expect(screen.queryAllByText(/\$\s*\d|€\s*\d|CPM|from \$|checkout/i)).toHaveLength(0);
    expect(screen.getByRole("link", { name: "Request Campaign" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Work With Us" })).toBeTruthy();
  });
});
