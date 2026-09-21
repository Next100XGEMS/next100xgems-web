import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { getProjectConsoleNav } from "@/components/project-console/navigation";

describe("project console shells", () => {
  it("exposes all nine console sections", () => {
    const items = getProjectConsoleNav("11111111-1111-4111-8111-111111111111");
    expect(items.map((item) => item.label)).toEqual([
      "Overview",
      "Profile",
      "Official Data",
      "Announcements",
      "Analytics",
      "Campaigns",
      "Team",
      "Media Kit",
      "Settings",
    ]);
  });

  it("keeps analytics and campaigns truthful empty copy", () => {
    const root = resolve(process.cwd());
    const analytics = readFileSync(
      resolve(root, "src/app/(project-console)/projects/[projectId]/analytics/page.tsx"),
      "utf8",
    );
    const campaigns = readFileSync(
      resolve(root, "src/app/(project-console)/projects/[projectId]/campaigns/page.tsx"),
      "utf8",
    );

    expect(analytics).toContain("Analytics not available yet");
    expect(analytics).not.toMatch(/\b\d{2,}%|\bMAU\b|\bARR\b/i);
    expect(campaigns).toContain("not available yet");
    expect(campaigns).toContain("Campaign Studio is not available yet");
  });

  it("gates the console layout on project_console_enabled and identity", () => {
    const layout = readFileSync(
      resolve(process.cwd(), "src/app/(project-console)/layout.tsx"),
      "utf8",
    );
    expect(layout).toContain('isFeatureEnabled("project_console_enabled")');
    expect(layout).toContain("notFound()");
    expect(layout).toContain("requireIdentity()");
  });

  it("does not introduce Campaign Studio routes", () => {
    const appRoot = resolve(process.cwd(), "src/app");
    const found: string[] = [];
    function walk(dir: string) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const next = resolve(dir, entry.name);
        if (entry.isDirectory()) walk(next);
        else if (/campaign-studio/i.test(next)) found.push(next);
      }
    }
    walk(appRoot);
    expect(found).toEqual([]);
    expect(existsSync(resolve(process.cwd(), "src/app/(project-console)/projects/[projectId]/campaigns/page.tsx"))).toBe(true);
  });
});
