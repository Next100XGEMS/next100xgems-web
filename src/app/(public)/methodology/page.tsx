import type { Metadata } from "next";

import MethodologyPageContent from "@/components/trust/methodology-page";

export const metadata: Metadata = {
  title: "NEXT100XGEMS Methodology",
  description: "How NEXT100XGEMS Radar evaluates market intelligence, evidence, AI assistance, human review, freshness, limitations, and commercial independence.",
};

export default function MethodologyPage() {
  return <MethodologyPageContent />;
}
