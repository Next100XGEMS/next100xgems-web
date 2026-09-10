import { notFound } from "next/navigation";

import { RadarDetailPageContent } from "@/components/radar/radar-presentation";
import { getRadarFixture } from "@/lib/radar/fixtures";

export const dynamic = "force-dynamic";

export default async function RadarPreviewTokenPage({ params }: { params: Promise<{ token: string }> }) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const fixture = getRadarFixture((await params).token);
  if (!fixture) {
    notFound();
  }

  return <RadarDetailPageContent fixture={fixture} />;
}
