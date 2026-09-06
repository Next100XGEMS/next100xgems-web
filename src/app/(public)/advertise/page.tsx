import type { Metadata } from "next";

import AdvertisePageContent from "@/components/advertise/advertise-page";
import { getFeatureFlags } from "@/lib/feature-flags/server";

export const metadata: Metadata = {
  title: "Advertise — NEXT100XGEMS",
  description: "Disclosed crypto advertising, sponsored media, and crypto-native audience distribution through NEXT100XGEMS inventory.",
};

export default async function AdvertisePage() {
  const flags = await getFeatureFlags(["advertising_enabled"]);

  return <AdvertisePageContent advertisingEnabled={flags.advertising_enabled ?? false} />;
}
