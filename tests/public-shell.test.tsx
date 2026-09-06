import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import PublicFooter from "@/components/public/public-footer";
import PublicHeader from "@/components/public/public-header";
import PublicPlaceholderPage from "@/components/public/public-placeholder-page";

vi.mock("next/navigation", () => ({
  usePathname: () => "/research",
}));

afterEach(() => cleanup());

describe("public shell", () => {
  it("renders primary navigation and the Work With Us CTA without private links", () => {
    render(<PublicHeader />);

    const navigation = screen.getByRole("navigation", { name: "Primary navigation" });
    for (const label of ["Radar", "Research", "Partners", "Advertise", "Network"]) {
      expect(within(navigation).getByRole("link", { name: label })).toBeTruthy();
    }
    expect(screen.getAllByRole("link", { name: "Work With Us" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "Admin" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Design system" })).toBeNull();
    expect(within(navigation).getByRole("link", { name: "Research" }).getAttribute("aria-current")).toBe("page");
  });

  it("provides accessible mobile navigation semantics and close behavior", () => {
    render(<PublicHeader />);

    const trigger = screen.getByRole("button", { name: "Open navigation" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(trigger.getAttribute("aria-controls")).toBe("public-mobile-navigation");

    fireEvent.click(trigger);
    expect(screen.getByRole("button", { name: "Close navigation" }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("navigation", { name: "Mobile navigation" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Close navigation" }));
    expect(screen.getByRole("button", { name: "Open navigation" })).toBeTruthy();
  });

  it("renders public placeholder structure without invented records or statistics", () => {
    render(<PublicPlaceholderPage eyebrow="Radar" title="Radar" description="A future public intelligence surface." />);

    expect(screen.getByRole("heading", { name: "Radar" })).toBeTruthy();
    expect(screen.getByText("Public foundation")).toBeTruthy();
    expect(screen.queryByText(/followers|market cap|million|%|1,000/iu)).toBeNull();
  });

  it("keeps methodology and disclosures in the footer", () => {
    render(<PublicFooter />);

    expect(screen.getByRole("link", { name: "Methodology" }).getAttribute("href")).toBe("/methodology");
    expect(screen.getByRole("link", { name: "Disclosures" }).getAttribute("href")).toBe("/disclosures");
    expect(screen.getByText(/does not guarantee investment outcomes/i)).toBeTruthy();
  });
});
