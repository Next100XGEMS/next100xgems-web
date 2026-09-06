import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import DisclosuresPageContent from "@/components/trust/disclosures-page";
import MethodologyPageContent from "@/components/trust/methodology-page";

afterEach(() => cleanup());

describe("Gate 14 trust pages", () => {
  it("explains the Radar pipeline, evidence, review, and independence principles", () => {
    render(<MethodologyPageContent />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: /how NEXT100XGEMS evaluates market intelligence/i })).toBeTruthy();
    expect(screen.getByText("Discover → Filter → Analyze → Review → Publish")).toBeTruthy();
    expect(screen.getByText(/automatic public publishing is OFF by default/i)).toBeTruthy();
    for (const label of ["VERIFIED DATA", "STRONG SIGNAL", "AI INFERENCE", "UNKNOWN"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.getByText(/human review improves accountability/i)).toBeTruthy();
    expect(screen.getByText(/AI does not guarantee correctness/i)).toBeTruthy();
    expect(screen.getByText(/Sponsored ≠ Radar ranking\./)).toBeTruthy();
    expect(screen.getByText(/not a price target, guaranteed forecast, buy recommendation/i)).toBeTruthy();
    expect(screen.queryByText(/guaranteed alpha|guaranteed gem|risk-free|sure win/i)).toBeNull();
  });

  it("explains informational purpose, risk, commercial relationships, and classifications", () => {
    render(<DisclosuresPageContent />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: /clarity about what you are reading/i })).toBeTruthy();
    expect(screen.getByText(/informational purposes/i)).toBeTruthy();
    expect(screen.getByText(/extremely volatile/i)).toBeTruthy();
    expect(screen.getByText(/substantial or all of their capital/i)).toBeTruthy();
    expect(screen.getByText(/may receive compensation/i)).toBeTruthy();
    for (const label of ["RADAR", "EDITORIAL", "SPONSORED", "PARTNER", "ADVERTISEMENT", "AI-ASSISTED"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.getByText(/does not guarantee accuracy, completeness, timeliness/i)).toBeTruthy();
    expect(screen.getByText(/Compensation does not control independent Radar or editorial conclusions/i)).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText(/guaranteed alpha|guaranteed gem|risk-free|sure win/i)).toBeNull();
  });
});

