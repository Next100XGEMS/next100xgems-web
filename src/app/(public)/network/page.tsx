import type { Metadata } from "next";

import NetworkPageContent from "@/components/network/network-page";

export const metadata: Metadata = {
  title: "Crypto Media Network",
  description: "The NEXT100XGEMS crypto media network across research, Radar intelligence, editorial content, and crypto-native channel distribution.",
};

export default function NetworkPage() {
  return <NetworkPageContent />;
}
