"use client";

import { useState, useTransition } from "react";

import { submitProjectClaimAction } from "@/app/(public)/projects/claim/actions";
import { Button, Panel } from "@/components/ui";

export default function ClaimSubmitForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await submitProjectClaimAction({
        proposedSlug: String(formData.get("proposedSlug") ?? ""),
        proposedDisplayName: String(formData.get("proposedDisplayName") ?? ""),
        websiteUrl: String(formData.get("websiteUrl") ?? ""),
        tokenMint: String(formData.get("tokenMint") ?? ""),
        proofUrl: String(formData.get("proofUrl") ?? ""),
        contactEmail: String(formData.get("contactEmail") ?? ""),
        notes: String(formData.get("notes") ?? ""),
      });
      if (result.ok) {
        setMessage(`Claim submitted (${result.claimId}). Staff will review it; approval grants project_owner only.`);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Panel tone="subtle" padding="lg">
      <form className="space-y-4" action={onSubmit}>
        <p className="text-sm text-[var(--n100-text-secondary)]">
          Submit an ownership or listing claim. Payload fields are allowlisted only
          (website, token mint, proof URL, contact email, notes). Score, risk, organic
          rank, and evidence are never accepted. Approval does not grant staff Admin and
          does not control Radar or Analyzer.
        </p>
        <label className="block space-y-1">
          <span className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[var(--n100-text-tertiary)]">
            Proposed slug
          </span>
          <input
            name="proposedSlug"
            required
            disabled={pending}
            placeholder="example-project"
            className="w-full rounded-[var(--n100-radius-control)] border border-[var(--n100-border-subtle)] bg-[var(--n100-canvas)] px-3 py-2 text-sm text-[var(--n100-text-primary)] disabled:opacity-60"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[var(--n100-text-tertiary)]">
            Proposed display name
          </span>
          <input
            name="proposedDisplayName"
            required
            disabled={pending}
            className="w-full rounded-[var(--n100-radius-control)] border border-[var(--n100-border-subtle)] bg-[var(--n100-canvas)] px-3 py-2 text-sm text-[var(--n100-text-primary)] disabled:opacity-60"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[var(--n100-text-tertiary)]">
            Website URL
          </span>
          <input
            name="websiteUrl"
            disabled={pending}
            className="w-full rounded-[var(--n100-radius-control)] border border-[var(--n100-border-subtle)] bg-[var(--n100-canvas)] px-3 py-2 text-sm text-[var(--n100-text-primary)] disabled:opacity-60"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[var(--n100-text-tertiary)]">
            Token mint
          </span>
          <input
            name="tokenMint"
            disabled={pending}
            className="w-full rounded-[var(--n100-radius-control)] border border-[var(--n100-border-subtle)] bg-[var(--n100-canvas)] px-3 py-2 text-sm text-[var(--n100-text-primary)] disabled:opacity-60"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[var(--n100-text-tertiary)]">
            Proof URL
          </span>
          <input
            name="proofUrl"
            disabled={pending}
            className="w-full rounded-[var(--n100-radius-control)] border border-[var(--n100-border-subtle)] bg-[var(--n100-canvas)] px-3 py-2 text-sm text-[var(--n100-text-primary)] disabled:opacity-60"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[var(--n100-text-tertiary)]">
            Contact email
          </span>
          <input
            name="contactEmail"
            type="email"
            disabled={pending}
            className="w-full rounded-[var(--n100-radius-control)] border border-[var(--n100-border-subtle)] bg-[var(--n100-canvas)] px-3 py-2 text-sm text-[var(--n100-text-primary)] disabled:opacity-60"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[var(--n100-text-tertiary)]">
            Notes
          </span>
          <textarea
            name="notes"
            rows={4}
            disabled={pending}
            className="w-full rounded-[var(--n100-radius-control)] border border-[var(--n100-border-subtle)] bg-[var(--n100-canvas)] px-3 py-2 text-sm text-[var(--n100-text-primary)] disabled:opacity-60"
          />
        </label>
        <Button type="submit" disabled={pending}>
          {pending ? "Submitting…" : "Submit claim"}
        </Button>
        {message ? <p className="text-sm text-[var(--n100-text-secondary)]">{message}</p> : null}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
      </form>
    </Panel>
  );
}
