import type { Metadata } from "next";

import RadarPageContent from "@/components/radar/radar-page";
import { getFeatureFlags } from "@/lib/feature-flags/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Radar — NEXT100XGEMS",
  description: "Watch-only market intelligence with evidence, risk context, freshness, and human-reviewed publication.",
};

export default async function RadarPage() {
  const flags = await getFeatureFlags(["radar_enabled"]);
  return <RadarPageContent radarEnabled={flags.radar_enabled ?? false} />;
}
