import { notFound } from "next/navigation";

import { RadarPreviewPageContent } from "@/components/radar/radar-presentation";

export const dynamic = "force-dynamic";

export default function RadarPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <RadarPreviewPageContent />;
}
