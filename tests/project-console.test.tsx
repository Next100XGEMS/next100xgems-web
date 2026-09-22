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

describe("project claim and correction submit surfaces", () => {
  it("gates claim submit page on project_claims_enabled and identity", () => {
    const page = readFileSync(
      resolve(process.cwd(), "src/app/(public)/projects/claim/page.tsx"),
      "utf8",
    );
    const actions = readFileSync(
      resolve(process.cwd(), "src/app/(public)/projects/claim/actions.ts"),
      "utf8",
    );
    expect(page).toContain('isFeatureEnabled("project_claims_enabled")');
    expect(page).toContain("notFound()");
    expect(page).toContain("requireIdentity()");
    expect(actions).toContain('rpc("submit_project_claim"');
    expect(actions).toContain("website_url");
    expect(actions).toContain("token_mint");
    expect(actions).toContain("proof_url");
    expect(actions).toContain("contact_email");
    expect(actions).toContain("notes");
    expect(actions).not.toMatch(/\bscore\b|\brisk\b|organic_rank|evidence/);
  });

  it("gates correction submit page on project_corrections_enabled and calls RPC", () => {
    const page = readFileSync(
      resolve(process.cwd(), "src/app/(project-console)/projects/[projectId]/corrections/page.tsx"),
      "utf8",
    );
    const actions = readFileSync(
      resolve(
        process.cwd(),
        "src/app/(project-console)/projects/[projectId]/corrections/actions.ts",
      ),
      "utf8",
    );
    expect(page).toContain('isFeatureEnabled("project_corrections_enabled")');
    expect(page).toContain("notFound()");
    expect(actions).toContain('rpc("submit_project_correction"');
    expect(actions).toContain("isProjectFieldKey");
    expect(actions).toMatch(/forbidden|not allowlisted/i);
  });

  it("keeps nine primary nav sections and links corrections from Official Data", () => {
    const items = getProjectConsoleNav("11111111-1111-4111-8111-111111111111");
    expect(items).toHaveLength(9);
    expect(items.map((item) => item.segment)).not.toContain("corrections");

    const officialData = readFileSync(
      resolve(process.cwd(), "src/app/(project-console)/projects/[projectId]/official-data/page.tsx"),
      "utf8",
    );
    expect(officialData).toContain("/corrections");
    expect(officialData).toContain('isFeatureEnabled("project_corrections_enabled")');
  });

  it("fail-closes Data Center RPC on project_console_enabled in follow-up migration", () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "supabase/migrations/20260922000007_project_console_flag_data_center.sql",
      ),
      "utf8",
    );
    expect(migration).toContain("private.project_console_enabled()");
    expect(migration).toContain("Project console is not available");
    expect(migration).toContain("set_project_field_value");
    expect(migration).toContain("55000");
  });
});
