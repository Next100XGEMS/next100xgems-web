import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { fireEvent, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
}));

import { AdminMobileNavigation } from "@/components/admin/admin-navigation";
import { getAdminNavigation } from "@/components/admin/navigation";
import type { Permission, RoleKey } from "@/lib/auth/authorization";

function navLabels(roles: RoleKey[], permissions: Permission[]) {
  return getAdminNavigation(permissions, roles).flatMap((group) => group.items.map((item) => item.label));
}

describe("Gate 10 Admin shell", () => {
  it("filters navigation by authoritative role capabilities", () => {
    const viewerLabels = navLabels(
      ["viewer"],
      ["admin.enter", "profile.read.self", "research.read.published", "partners.read.active"],
    );
    const operatorLabels = navLabels(
      ["admin"],
      [
        "admin.enter",
        "profile.read.self",
        "identity.read.directory",
        "configuration.read",
        "research.read.all",
        "partners.read.all",
        "commercial.read",
        "leads.read",
        "radar.read.analysis",
        "radar.read.review",
      ],
    );
    const commercialLabels = navLabels(
      ["ad_manager"],
      ["admin.enter", "profile.read.self", "partners.read.all", "commercial.read", "leads.read"],
    );

    expect(viewerLabels).toEqual(["Overview", "Research", "Featured Partners"]);
    expect(viewerLabels).not.toContain("Radar");
    expect(viewerLabels).not.toContain("Sponsors");
    expect(operatorLabels).toContain("Feature Flags");
    expect(operatorLabels).toContain("Users & Roles");
    expect(operatorLabels).toContain("Audit Logs");
    expect(commercialLabels).toContain("Leads");
    expect(commercialLabels).toContain("Campaigns");
    expect(commercialLabels).not.toContain("Research");
  });

  it("marks unresolved operator modules as planned instead of linking them", () => {
    const groups = getAdminNavigation(["admin.enter", "configuration.read"], ["admin"]);
    const bookings = groups.flatMap((group) => group.items).find((item) => item.label === "Bookings");

    expect(bookings).toMatchObject({ href: "/admin/bookings", planned: true });
  });

  it("provides an accessible mobile navigation disclosure", () => {
    const groups = getAdminNavigation(["admin.enter", "research.read.all"], ["editor"]);
    render(<AdminMobileNavigation groups={groups} />);

    const trigger = screen.getByRole("button", { name: "Sections" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("navigation", { name: "Admin sections" })).toBeNull();

    fireEvent.click(trigger);

    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("navigation", { name: "Admin sections" })).toBeTruthy();
  });

  it("keeps child routes behind the shared Admin authorization boundary", () => {
    const layoutSource = readFileSync(resolve(process.cwd(), "src/app/admin/layout.tsx"), "utf8");

    expect(layoutSource).toContain("requireAdminAccess");
    expect(layoutSource).toContain("getLoginRedirect");
    expect(layoutSource).toContain("AdminAccessDenied");
  });

  it("keeps Feature Flags and placeholders read-only", () => {
    const flagsSource = readFileSync(resolve(process.cwd(), "src/app/admin/feature-flags/page.tsx"), "utf8");
    const placeholderSource = readFileSync(resolve(process.cwd(), "src/components/admin/admin-placeholder-page.tsx"), "utf8");

    expect(flagsSource).toContain("getSystemFeatureFlags");
    expect(flagsSource).not.toContain("setFeatureFlag");
    expect(flagsSource).not.toContain("<button");
    expect(placeholderSource).toContain("FOUNDATION ONLY");
    expect(placeholderSource).toContain("no records, controls, or mutation paths");
  });
});
