import type { Metadata } from "next";

import ResearchPageContent from "@/components/research/research-page";
import type { ResearchArticleSummary } from "@/components/research/research-content";
import { getFeatureFlags } from "@/lib/feature-flags/server";
import { readPublicResearchPage } from "@/lib/research/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Research — NEXT100XGEMS",
  description: "First-party crypto research, market intelligence, and editorial analysis from NEXT100XGEMS.",
};

export default async function ResearchPage() {
  const flags = await getFeatureFlags(["research_enabled"]);
  const researchEnabled = flags.research_enabled ?? false;
  let publishedArticles: ResearchArticleSummary[] = [];
  let researchLoadError = false;

  if (researchEnabled) {
    try {
      publishedArticles = await readPublicResearchPage();
    } catch {
      researchLoadError = true;
    }
  }

  return <ResearchPageContent researchEnabled={researchEnabled} publishedArticles={publishedArticles} researchLoadError={researchLoadError} />;
}
