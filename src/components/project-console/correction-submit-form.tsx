"use client";

import { useState, useTransition } from "react";

import { submitProjectCorrectionAction } from "@/app/(project-console)/projects/[projectId]/corrections/actions";
import { Button, Panel } from "@/components/ui";
import {
  PROJECT_FIELD_KEYS,
  PROJECT_FIELD_LABELS,
} from "@/lib/projects/types";

export default function CorrectionSubmitForm({
  projectId,
  readOnly = false,
}: {
  projectId: string;
  readOnly?: boolean;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    if (readOnly) return;
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await submitProjectCorrectionAction({
        projectId,
        fieldKey: String(formData.get("fieldKey") ?? ""),
        proposedValue: String(formData.get("proposedValue") ?? ""),
        rationale: String(formData.get("rationale") ?? ""),
      });
      if (result.ok) {
        setMessage(`Correction submitted (${result.correctionId}). Staff review is required before any field apply.`);
      } else {
        setError(result.error);
      }
    });
  }

  if (readOnly) {
    return (
      <Panel tone="quiet" padding="sm">
        <p className="text-sm text-[var(--n100-text-secondary)]">
          Correction submit requires project_editor or project_owner. Viewers can read Official Data only.
        </p>
      </Panel>
    );
  }

  return (
    <Panel tone="subtle" padding="sm">
      <form className="space-y-4" action={onSubmit}>
        <p className="text-sm text-[var(--n100-text-secondary)]">
          Propose a factual correction against allowlisted Official Data fields only.
          Score, risk, organic rank, evidence, and other intelligence keys are rejected
          at submit and again at staff approve.
        </p>
        <label className="block space-y-1">
          <span className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[var(--n100-text-tertiary)]">
            Field
          </span>
          <select
            name="fieldKey"
            required
            disabled={pending}
            defaultValue="website"
            className="w-full rounded-[var(--n100-radius-control)] border border-[var(--n100-border-subtle)] bg-[var(--n100-canvas)] px-3 py-2 text-sm text-[var(--n100-text-primary)] disabled:opacity-60"
          >
            {PROJECT_FIELD_KEYS.map((key) => (
              <option key={key} value={key}>
                {PROJECT_FIELD_LABELS[key]} ({key})
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[var(--n100-text-tertiary)]">
            Proposed value
          </span>
          <input
            name="proposedValue"
            required
            disabled={pending}
            className="w-full rounded-[var(--n100-radius-control)] border border-[var(--n100-border-subtle)] bg-[var(--n100-canvas)] px-3 py-2 text-sm text-[var(--n100-text-primary)] disabled:opacity-60"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[var(--n100-text-tertiary)]">
            Rationale
          </span>
          <textarea
            name="rationale"
            required
            rows={4}
            disabled={pending}
            className="w-full rounded-[var(--n100-radius-control)] border border-[var(--n100-border-subtle)] bg-[var(--n100-canvas)] px-3 py-2 text-sm text-[var(--n100-text-primary)] disabled:opacity-60"
          />
        </label>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Submitting…" : "Submit correction"}
        </Button>
        {message ? <p className="text-sm text-[var(--n100-text-secondary)]">{message}</p> : null}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
      </form>
    </Panel>
  );
}
