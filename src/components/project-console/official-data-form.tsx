"use client";

import { useState, useTransition } from "react";

import { Button, Panel } from "@/components/ui";
import {
  PROJECT_FIELD_KEYS,
  PROJECT_FIELD_LABELS,
  type ProjectFieldKey,
  type ProjectFieldValue,
  type ProjectProvenance,
} from "@/lib/projects/types";

import ProvenanceBadge from "./provenance-badge";
import { updateProjectFieldAction } from "@/app/(project-console)/projects/[projectId]/official-data/actions";

function displayValue(value: unknown) {
  if (typeof value === "string") return value;
  if (value == null) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function canEdit(provenance: ProjectProvenance | null) {
  return provenance === null || provenance === "PROJECT_PROVIDED" || provenance === "UNKNOWN";
}

export default function OfficialDataForm({
  projectId,
  fields,
  readOnly = false,
}: {
  projectId: string;
  fields: ProjectFieldValue[];
  readOnly?: boolean;
}) {
  const byKey = new Map(fields.map((field) => [field.fieldKey, field]));
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSave(fieldKey: ProjectFieldKey, formData: FormData) {
    const raw = String(formData.get("value") ?? "").trim();
    setMessage(null);
    startTransition(async () => {
      const result = await updateProjectFieldAction(projectId, fieldKey, raw);
      setMessage(result.ok ? `Saved ${PROJECT_FIELD_LABELS[fieldKey]}.` : result.error);
    });
  }

  return (
    <div className="space-y-4">
      {PROJECT_FIELD_KEYS.map((key) => {
        const existing = byKey.get(key) ?? null;
        const provenance = existing?.provenance ?? null;
        const editable = !readOnly && canEdit(provenance);
        return (
          <Panel key={key} tone="subtle" padding="sm">
            <form
              className="space-y-3"
              action={(formData) => {
                if (!editable) return;
                onSave(key, formData);
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[var(--n100-text-primary)]">
                    {PROJECT_FIELD_LABELS[key]}
                  </p>
                  <p className="mt-1 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-[var(--n100-text-tertiary)]">
                    {key}
                    {existing ? ` · v${existing.version}` : " · empty"}
                  </p>
                </div>
                {provenance ? <ProvenanceBadge provenance={provenance} /> : (
                  <span className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-[var(--n100-text-tertiary)]">
                    Unset
                  </span>
                )}
              </div>
              <label className="block">
                <span className="sr-only">{PROJECT_FIELD_LABELS[key]}</span>
                <input
                  name="value"
                  defaultValue={displayValue(existing?.value)}
                  disabled={!editable || pending}
                  className="w-full rounded-[var(--n100-radius-control)] border border-[var(--n100-border-subtle)] bg-[var(--n100-canvas)] px-3 py-2 text-sm text-[var(--n100-text-primary)] disabled:opacity-60"
                />
              </label>
              {!editable ? (
                <p className="text-xs text-[var(--n100-text-tertiary)]">
                  This field is independently sourced and cannot be overwritten from the Project Console.
                </p>
              ) : (
                <Button type="submit" size="sm" disabled={pending}>
                  {pending ? "Saving…" : "Save project-stated value"}
                </Button>
              )}
            </form>
          </Panel>
        );
      })}
      {message ? <p className="text-sm text-[var(--n100-text-secondary)]">{message}</p> : null}
    </div>
  );
}
