import type { ProjectProvenance } from "@/lib/projects/types";

const labels: Record<ProjectProvenance, string> = {
  PROJECT_PROVIDED: "PROJECT STATED",
  INDEPENDENTLY_VERIFIED: "INDEPENDENTLY VERIFIED",
  PROVIDER_DERIVED: "PROVIDER DERIVED",
  AI_INFERENCE: "AI INFERENCE",
  UNKNOWN: "UNKNOWN",
};

const tones: Record<ProjectProvenance, string> = {
  PROJECT_PROVIDED: "border-[var(--n100-info)]/35 bg-[var(--n100-info)]/8 text-[var(--n100-info)]",
  INDEPENDENTLY_VERIFIED:
    "border-[var(--n100-verified-data)]/40 bg-[var(--n100-verified-data)]/8 text-[var(--n100-verified-data)]",
  PROVIDER_DERIVED: "border-[var(--n100-radar)]/35 bg-[var(--n100-radar)]/8 text-[var(--n100-radar)]",
  AI_INFERENCE:
    "border-[var(--n100-ai-inference)]/35 bg-[var(--n100-ai-inference)]/8 text-[var(--n100-ai-inference)]",
  UNKNOWN: "border-[var(--n100-unknown)]/30 bg-[var(--n100-unknown)]/8 text-[var(--n100-unknown)]",
};

export default function ProvenanceBadge({ provenance }: { provenance: ProjectProvenance }) {
  return (
    <span
      className={`inline-flex min-h-6 items-center rounded-[var(--n100-radius-control)] border px-2 py-1 text-[0.625rem] font-semibold tracking-[0.13em] ${tones[provenance]}`}
    >
      {labels[provenance]}
    </span>
  );
}
