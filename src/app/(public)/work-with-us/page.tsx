import type { Metadata } from "next";

import WorkWithUsPageContent from "@/components/work-with-us/work-with-us-page";
import { getFeatureFlags } from "@/lib/feature-flags/server";

export const metadata: Metadata = {
  title: "Work With Us — Crypto Media Campaigns",
  description: "Clearly disclosed sponsored crypto content, AMA, launch campaigns, and multi-platform distribution with NEXT100XGEMS.",
};

export default async function WorkWithUsPage() {
  const flags = await getFeatureFlags(["booking_enabled"]);

  return <WorkWithUsPageContent bookingEnabled={flags.booking_enabled ?? false} />;
}
