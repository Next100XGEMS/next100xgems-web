import { notFound } from "next/navigation";

import ResearchArticlePage from "@/components/research/research-article";
import { researchPreviewArticle } from "@/components/research/research-preview";

export default function ResearchPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <ResearchArticlePage article={researchPreviewArticle} previewLabel="SAMPLE / DEVELOPMENT PREVIEW — NOT PUBLISHED RESEARCH" />;
}
