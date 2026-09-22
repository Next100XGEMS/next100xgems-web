import type { Metadata } from "next";

import FinderShell from "@/components/finder/finder-shell";

export const metadata: Metadata = {
  title: "Finder — NEXT100XGEMS",
  description: "Evidence-first token discovery desk. Shell-ready; live Finder data is not connected in this release.",
};

export default function FinderPage() {
  return <FinderShell />;
}
