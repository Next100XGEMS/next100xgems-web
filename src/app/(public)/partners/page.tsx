import type { Metadata } from "next";

import PartnersPageContent from "@/components/partners/partners-page";
import { getFeatureFlags } from "@/lib/feature-flags/server";

export const metadata: Metadata = {
  title: "Featured Partners — NEXT100XGEMS",
  description: "NEXT100XGEMS Featured Partners: clearly disclosed crypto project partnerships with commercial boundaries separate from Radar and independent research.",
};

export default async function PartnersPage() {
  const flags = await getFeatureFlags(["featured_partners_enabled"]);

  return <PartnersPageContent featuredPartnersEnabled={flags.featured_partners_enabled ?? false} />;
}
