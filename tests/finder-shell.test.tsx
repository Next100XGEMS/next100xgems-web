import { readdirSync, readFileSync } from "node:fs";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FINDER_BATCH1_CAPABILITIES } from "@/components/finder/finder-contracts";
import { FINDER_COPY } from "@/components/finder/finder-copy";
import FinderShell from "@/components/finder/finder-shell";
import { CommandSearch, DataTable } from "@/components/product-experience";
import { EmptyState } from "@/components/ui";

afterEach(() => cleanup());

describe("Finder product shell (PE V2 batch 1)", () => {
  it("binds FINDER_BATCH1_CAPABILITIES as the honest surface contract", () => {
    expect(FINDER_BATCH1_CAPABILITIES).toEqual({
      search: "UNAVAILABLE",
      filters: "UNAVAILABLE",
      sort: "UNAVAILABLE",
      savedViews: "UNAVAILABLE",
      watchlist: "COMING_SOON",
      publicAnalyzer: "FEATURE_DISABLED",
      sponsored: "NOT_CONFIGURED",
      results: "EMPTY",
    });
  });

  it("renders command bar, filters affordance, and honest empty results without fabricated rows", () => {
    render(<FinderShell />);

    expect(screen.getByLabelText("Search tokens")).toBeTruthy();
    expect(screen.getByPlaceholderText(FINDER_COPY.searchPlaceholder)).toBeTruthy();
    expect(screen.getByText(FINDER_COPY.searchHelper)).toBeTruthy();
    expect(screen.getByText(FINDER_COPY.filtersHelper)).toBeTruthy();
    // Desktop + mobile both mount the honest EmptyState (responsive dual paint).
    expect(screen.getAllByText(FINDER_COPY.resultsEmptyTitle).length).toBeGreaterThan(0);
    expect(screen.getAllByText(FINDER_COPY.resultsEmptyDescription).length).toBeGreaterThan(0);
    const results = screen.getByLabelText("Finder results");
    expect(results.getAttribute("data-finder-results-state")).toBe("EMPTY");
    // No fabricated discovery rows — table body stays empty; chrome filters may mention chain names.
    expect(within(results).queryByRole("row")).toBeNull();
    expect(screen.queryByText(/market cap|followers|guaranteed/i)).toBeNull();
    expect(screen.queryByText("Sponsored")).toBeNull();
  });

  it("keeps Watch and Analyze visible but disabled with honest capability labels", () => {
    render(<FinderShell />);

    const watchButtons = screen.getAllByRole("button", { name: /Watch/i });
    const analyzeButtons = screen.getAllByRole("button", { name: /Analyze/i });
    expect(watchButtons.length).toBeGreaterThan(0);
    expect(analyzeButtons.length).toBeGreaterThan(0);
    for (const button of [...watchButtons, ...analyzeButtons]) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
    }
    expect(screen.getAllByText("COMING_SOON").length).toBeGreaterThan(0);
    expect(screen.getAllByText("FEATURE_DISABLED").length).toBeGreaterThan(0);
    expect(screen.getAllByText(FINDER_COPY.watchHelper).length).toBeGreaterThan(0);
    expect(screen.getAllByText(FINDER_COPY.analyzeHelper).length).toBeGreaterThan(0);
  });

  it("does not feed PublicRadar, Analyzer, or Finder API/persistence into the shell", () => {
    const files = readdirSync("src/components/finder");
    const source = [
      ...files.map((f) => readFileSync(`src/components/finder/${f}`, "utf8")),
      readFileSync("src/app/(public)/finder/page.tsx", "utf8"),
    ].join("\n");

    // Imports / calls only — comments may name forbidden symbols for honesty docs.
    expect(source).not.toMatch(/from\s+["']@\/lib\/radar/);
    expect(source).not.toMatch(/from\s+["']@\/components\/radar/);
    expect(source).not.toMatch(/import\s+.*PublicRadar/);
    expect(source).not.toMatch(/getPublicRadarList\s*\(/);
    expect(source).not.toMatch(/from\s+["']@\/lib\/token-analyzer/);
    expect(source).not.toMatch(/from\s+["']@\/lib\/supabase/);
    expect(source).not.toMatch(/createClient\s*\(/);
    expect(source).not.toMatch(/from\(["'`]finder_/);
    expect(source).not.toMatch(/\/api\/finder/);
    expect(source).toMatch(/FINDER_BATCH1_CAPABILITIES/);
  });

  it("opens mobile filter sheet with unavailable labeling", () => {
    render(<FinderShell />);

    const filtersTriggers = screen.getAllByRole("button", { name: /Filters/i });
    const mobileTrigger = filtersTriggers.find((el) => el.textContent?.includes("UNAVAILABLE"));
    expect(mobileTrigger).toBeTruthy();
    fireEvent.click(mobileTrigger!);
    expect(screen.getByRole("dialog", { name: "Filters" })).toBeTruthy();
    expect(
      within(screen.getByRole("dialog", { name: "Filters" })).getByText(FINDER_COPY.filtersHelper),
    ).toBeTruthy();
  });
});

describe("Product experience primitives smoke", () => {
  it("renders CommandSearch disabled chrome", () => {
    render(
      <CommandSearch
        placeholder={FINDER_COPY.searchPlaceholder}
        helperText={FINDER_COPY.searchHelper}
        availabilityLabel="UNAVAILABLE"
        disabled
        aria-label="Search tokens"
      />,
    );
    expect(screen.getByLabelText("Search tokens")).toBeTruthy();
    expect(screen.getByText("UNAVAILABLE")).toBeTruthy();
  });

  it("renders DataTable empty slot without inventing rows", () => {
    render(
      <DataTable
        columns={[{ id: "a", header: "A", render: () => "x" }]}
        rows={[]}
        getRowId={() => "x"}
        empty={<EmptyState title="No Finder results yet" description="shell" />}
      />,
    );
    expect(screen.getByText("No Finder results yet")).toBeTruthy();
    expect(screen.queryByRole("row")).toBeNull();
  });
});
