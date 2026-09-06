import type { Metadata } from "next";

import DisclosuresPageContent from "@/components/trust/disclosures-page";

export const metadata: Metadata = {
  title: "Disclosures & Risk — NEXT100XGEMS",
  description: "NEXT100XGEMS informational-purpose, risk, commercial, content-classification, AI-assisted, and user-responsibility disclosures.",
};

export default function DisclosuresPage() {
  return <DisclosuresPageContent />;
}
