import type { Metadata } from "next";

import Homepage from "@/components/home/homepage";
import { getFeatureFlags } from "@/lib/feature-flags/server";

export const metadata: Metadata = {
  title: "Crypto Intelligence + Crypto Media",
  description: "AI-assisted market intelligence, first-party research, and crypto-native media with clear sourcing, risk context, and commercial disclosures.",
};

export default async function HomePage() {
  const flags = await getFeatureFlags([
    "radar_enabled",
    "research_enabled",
    "featured_partners_enabled",
    "newsletter_enabled",
  ]);

  return (
    <Homepage
      flags={{
        radarEnabled: flags.radar_enabled ?? false,
        researchEnabled: flags.research_enabled ?? false,
        featuredPartnersEnabled: flags.featured_partners_enabled ?? false,
        newsletterEnabled: flags.newsletter_enabled ?? false,
      }}
    />
  );
}
