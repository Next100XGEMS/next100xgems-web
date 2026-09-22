"use server";

import { revalidatePath } from "next/cache";

import { AuthorizationError, requireIdentity } from "@/lib/auth/authorization";
import { isFeatureEnabled } from "@/lib/feature-flags/server";

export type ClaimSubmitResult =
  | { ok: true; claimId: string }
  | { ok: false; error: string };

const ALLOWED_PAYLOAD_KEYS = [
  "website_url",
  "token_mint",
  "proof_url",
  "contact_email",
  "notes",
] as const;

type AllowedPayloadKey = (typeof ALLOWED_PAYLOAD_KEYS)[number];

function buildPayload(form: {
  websiteUrl: string;
  tokenMint: string;
  proofUrl: string;
  contactEmail: string;
  notes: string;
}): Record<AllowedPayloadKey, string> | { error: string } {
  const payload: Partial<Record<AllowedPayloadKey, string>> = {};
  const websiteUrl = form.websiteUrl.trim();
  const tokenMint = form.tokenMint.trim();
  const proofUrl = form.proofUrl.trim();
  const contactEmail = form.contactEmail.trim();
  const notes = form.notes.trim();

  if (websiteUrl) payload.website_url = websiteUrl;
  if (tokenMint) payload.token_mint = tokenMint;
  if (proofUrl) payload.proof_url = proofUrl;
  if (contactEmail) payload.contact_email = contactEmail;
  if (notes) payload.notes = notes;

  // Defense-in-depth: never forward keys outside the allowlist.
  for (const key of Object.keys(payload)) {
    if (!(ALLOWED_PAYLOAD_KEYS as readonly string[]).includes(key)) {
      return { error: "Claim payload contains a disallowed field." };
    }
  }

  return payload as Record<AllowedPayloadKey, string>;
}

export async function submitProjectClaimAction(input: {
  proposedSlug: string;
  proposedDisplayName: string;
  websiteUrl: string;
  tokenMint: string;
  proofUrl: string;
  contactEmail: string;
  notes: string;
}): Promise<ClaimSubmitResult> {
  try {
    if (!(await isFeatureEnabled("project_claims_enabled"))) {
      return { ok: false, error: "Project claims are not available." };
    }

    const slug = input.proposedSlug.trim().toLowerCase();
    const displayName = input.proposedDisplayName.trim();
    if (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 80) {
      return { ok: false, error: "Enter a valid slug (lowercase letters, numbers, hyphens)." };
    }
    if (!displayName || displayName.length > 200) {
      return { ok: false, error: "Enter a display name (1–200 characters)." };
    }

    const payloadOrError = buildPayload(input);
    if ("error" in payloadOrError) {
      return { ok: false, error: payloadOrError.error };
    }

    const { supabase } = await requireIdentity();
    const { data, error } = await supabase.rpc("submit_project_claim", {
      p_proposed_slug: slug,
      p_proposed_display_name: displayName,
      p_payload: payloadOrError,
      p_project_id: null,
    });

    if (error) {
      const message = error.message ?? "";
      if (/invalid claim payload/i.test(message)) {
        return { ok: false, error: "Claim payload was rejected. Only allowlisted fields are accepted." };
      }
      if (/not available/i.test(message)) {
        return { ok: false, error: "Project claims are not available." };
      }
      if (/too many open claims/i.test(message)) {
        return { ok: false, error: "You already have too many open claims." };
      }
      return { ok: false, error: "The claim could not be submitted." };
    }

    const claimId =
      data && typeof data === "object" && "claim_id" in data && typeof (data as { claim_id: unknown }).claim_id === "string"
        ? (data as { claim_id: string }).claim_id
        : null;

    if (!claimId) {
      return { ok: false, error: "The claim could not be submitted." };
    }

    revalidatePath("/projects/claim");
    return { ok: true, claimId };
  } catch (error) {
    if (error instanceof AuthorizationError && error.status === 401) {
      return { ok: false, error: "Sign in is required to submit a claim." };
    }
    return { ok: false, error: "Project claims are temporarily unavailable." };
  }
}
