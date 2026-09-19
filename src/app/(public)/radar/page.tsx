import type { Metadata } from "next";

import RadarPageContent from "@/components/radar/radar-page";
import { getPublicRadarList } from "@/lib/radar/public";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Radar — NEXT100XGEMS",
  description: "Watch-only market intelligence with evidence, risk context, freshness, and human-reviewed publication.",
};

export default async function RadarPage() {
  const feed = await getPublicRadarList();
  return <RadarPageContent feed={feed} />;
}
