"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui";

import {
  approveProjectCorrectionAction,
  rejectProjectCorrectionAction,
  startProjectCorrectionReviewAction,
} from "./actions";

export default function CorrectionReviewControls({
  correctionId,
  state,
}: {
  correctionId: string;
  state: string;
}) {
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      {state === "SUBMITTED" ? (
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await startProjectCorrectionReviewAction(correctionId);
              setMessage(result.ok ? "Moved to UNDER_REVIEW." : result.error);
            })
          }
        >
          Start review
        </Button>
      ) : null}
      {state === "UNDER_REVIEW" ? (
        <>
          <label className="block">
            <span className="mb-1 block text-xs text-[var(--n100-text-tertiary)]">Review note</span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              className="w-full rounded-[var(--n100-radius-control)] border border-[var(--n100-border-subtle)] bg-[var(--n100-canvas)] px-3 py-2 text-sm"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await approveProjectCorrectionAction(correctionId, note);
                  setMessage(result.ok ? "Correction approved." : result.error);
                })
              }
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await rejectProjectCorrectionAction(correctionId, note);
                  setMessage(result.ok ? "Correction rejected." : result.error);
                })
              }
            >
              Reject
            </Button>
          </div>
        </>
      ) : null}
      {message ? <p className="text-xs text-[var(--n100-text-secondary)]">{message}</p> : null}
    </div>
  );
}
