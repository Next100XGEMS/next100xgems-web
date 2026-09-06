import type { Metadata } from "next";

import ResearchPageContent from "@/components/research/research-page";
import { getFeatureFlags } from "@/lib/feature-flags/server";

export const metadata: Metadata = {
  title: "Research — NEXT100XGEMS",
  description: "First-party crypto research, market intelligence, and editorial analysis from NEXT100XGEMS.",
};

export default async function ResearchPage() {
  const flags = await getFeatureFlags(["research_enabled"]);

  return <ResearchPageContent researchEnabled={flags.research_enabled ?? false} />;
}
