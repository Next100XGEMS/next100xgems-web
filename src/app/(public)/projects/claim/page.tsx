import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import ClaimSubmitForm from "@/components/projects/claim-submit-form";
import { Container, InstrumentRule, PageHeader, Section } from "@/components/ui";
import { AuthorizationError, requireIdentity } from "@/lib/auth/authorization";
import { getLoginRedirect } from "@/lib/auth/redirects";
import { isFeatureEnabled } from "@/lib/feature-flags/server";

export const metadata: Metadata = {
  title: "Claim a project — NEXT100XGEMS",
  description:
    "Submit an ownership or listing claim. Allowlisted fields only; approval grants project_owner membership, never staff Admin or intelligence control.",
};

export const dynamic = "force-dynamic";

export default async function ProjectClaimPage() {
  if (!(await isFeatureEnabled("project_claims_enabled"))) {
    notFound();
  }

  try {
    await requireIdentity();
  } catch (error) {
    if (error instanceof AuthorizationError && error.status === 401) {
      redirect(getLoginRedirect("/projects/claim"));
    }
    throw error;
  }

  return (
    <Section>
      <Container>
        <PageHeader
          eyebrow="Projects · Claims"
          title="Claim a project"
          description="Authenticated ownership and listing claims. Payload is allowlisted. Paid placement never implies verified status or organic rank."
        />
        <InstrumentRule className="mt-8 max-w-xl" />
        <div className="mt-10 max-w-2xl">
          <ClaimSubmitForm />
        </div>
      </Container>
    </Section>
  );
}
