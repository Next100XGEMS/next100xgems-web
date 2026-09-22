import Link from "next/link";

import { Container, DataValue, EmptyState, Panel, Section, StatusLabel } from "@/components/ui";
import type { PublicRadarFeed, PublicRadarRecord } from "@/lib/radar/public";

const statusKind = { EARLY: "early", TRENDING: "trending", HIGH_RISK: "high-risk" } as const;

const evidenceKindMap = {
  VERIFIED_DATA: "verified-data",
  STRONG_SIGNAL: "strong-signal",
  AI_INFERENCE: "ai-inference",
  UNKNOWN: "unknown",
} as const;

function FreshnessChip({ state }: { state: PublicRadarRecord["freshnessState"] }) {
  const tone =
    state === "FRESH"
      ? "border-[var(--n100-positive)]/40 text-[var(--n100-positive)]"
      : "border-[var(--n100-warning)]/45 text-[var(--n100-warning)]";
  return (
    <span
      className={`inline-flex min-h-6 items-center rounded-[var(--n100-radius-control)] border px-2 py-1 font-mono text-[0.625rem] font-semibold uppercase tracking-[0.13em] ${tone}`}
    >
      {state}
    </span>
  );
}

function evidenceSummary(record: PublicRadarRecord) {
  if (record.evidence.length === 0) return "UNKNOWN";
  const counts = record.evidence.reduce<Record<string, number>>((acc, item) => {
    acc[item.classification] = (acc[item.classification] ?? 0) + 1;
    return acc;
  }, {});
  const primary =
    (["VERIFIED_DATA", "STRONG_SIGNAL", "AI_INFERENCE", "UNKNOWN"] as const).find((key) => counts[key]) ?? "UNKNOWN";
  return { primary, count: record.evidence.length };
}

function PublicRadarInstrumentRow({ record }: { record: PublicRadarRecord }) {
  const evidence = evidenceSummary(record);
  const evidenceLabel = typeof evidence === "string" ? evidence : evidence.primary.replaceAll("_", " ");
  const evidenceCount = typeof evidence === "string" ? 0 : evidence.count;
  const evidenceKind =
    typeof evidence === "string" ? "unknown" : evidenceKindMap[evidence.primary as keyof typeof evidenceKindMap];

  return (
    <article className="border-t border-[var(--n100-border-subtle)] first:border-t-0">
      {/* Desktop instrument row */}
      <div className="hidden gap-4 px-4 py-4 lg:grid lg:grid-cols-[minmax(12rem,1.4fr)_7rem_6.5rem_5.5rem_minmax(8rem,1fr)_minmax(7rem,0.9fr)_6rem] lg:items-center">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-[var(--n100-text-primary)]">
            {record.name || record.symbol || "Published Radar record"}
          </h3>
          <p className="mt-1 truncate font-mono text-[0.625rem] text-[var(--n100-text-tertiary)]">
            {record.symbol ? `$${record.symbol} · ` : ""}
            {record.chain} · {record.contractAddress}
          </p>
        </div>
        <div>
          <StatusLabel kind={statusKind[record.analyticalStatus]} />
        </div>
        <div>
          <FreshnessChip state={record.freshnessState} />
        </div>
        <div>
          <DataValue value={record.score ?? "—"} className="text-base font-semibold" />
          <p className="mt-0.5 font-mono text-[0.55rem] uppercase tracking-[0.12em] text-[var(--n100-text-tertiary)]">
            Score
          </p>
        </div>
        <div className="min-w-0">
          <p className="font-mono text-[0.55rem] uppercase tracking-[0.12em] text-[var(--n100-text-tertiary)]">Risk</p>
          <p
            className={`mt-1 truncate text-xs leading-5 ${
              record.analyticalStatus === "HIGH_RISK"
                ? "text-[var(--n100-negative)]"
                : "text-[var(--n100-text-secondary)]"
            }`}
          >
            {record.riskSummary || "No risk summary published"}
          </p>
        </div>
        <div className="min-w-0">
          <p className="font-mono text-[0.55rem] uppercase tracking-[0.12em] text-[var(--n100-text-tertiary)]">
            Evidence
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <StatusLabel kind={evidenceKind} />
            <span className="font-mono text-[0.625rem] tabular-nums text-[var(--n100-text-tertiary)]">
              {evidenceCount === 0 ? "0 items" : `${evidenceCount} item${evidenceCount === 1 ? "" : "s"}`}
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="font-mono text-[0.625rem] tabular-nums text-[var(--n100-text-secondary)]">
            {record.methodologyVersion ?? "—"}
          </p>
          <p className="mt-0.5 font-mono text-[0.55rem] uppercase tracking-[0.12em] text-[var(--n100-text-tertiary)]">
            Method
          </p>
        </div>
      </div>

      {/* Mobile denser card */}
      <div className="space-y-4 px-4 py-4 lg:hidden">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusLabel kind={statusKind[record.analyticalStatus]} />
              <FreshnessChip state={record.freshnessState} />
            </div>
            <h3 className="mt-3 break-words text-base font-semibold text-[var(--n100-text-primary)]">
              {record.name || record.symbol || "Published Radar record"}
            </h3>
            <p className="mt-1 break-words font-mono text-[0.625rem] leading-5 text-[var(--n100-text-tertiary)]">
              {record.symbol ? `$${record.symbol} · ` : ""}
              {record.chain} · {record.contractAddress}
            </p>
          </div>
          <div className="text-right">
            <DataValue value={record.score ?? "—"} className="text-xl font-semibold" />
            <p className="mt-0.5 font-mono text-[0.55rem] uppercase tracking-[0.12em] text-[var(--n100-text-tertiary)]">
              Radar Score
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 border-t border-[var(--n100-border-subtle)] pt-3">
          <div>
            <p className="font-mono text-[0.55rem] uppercase tracking-[0.12em] text-[var(--n100-text-tertiary)]">Risk</p>
            <p
              className={`mt-1 text-xs leading-5 ${
                record.analyticalStatus === "HIGH_RISK"
                  ? "text-[var(--n100-negative)]"
                  : "text-[var(--n100-text-secondary)]"
              }`}
            >
              {record.riskSummary || "No risk summary published"}
            </p>
          </div>
          <div>
            <p className="font-mono text-[0.55rem] uppercase tracking-[0.12em] text-[var(--n100-text-tertiary)]">
              Evidence
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <StatusLabel kind={evidenceKind} />
              <span className="font-mono text-[0.625rem] tabular-nums text-[var(--n100-text-tertiary)]">
                {evidenceCount === 0 ? "UNKNOWN · 0" : evidenceLabel}
              </span>
            </div>
          </div>
        </div>
        {record.whyOnRadar ? (
          <p className="text-xs leading-5 text-[var(--n100-text-secondary)]">{record.whyOnRadar}</p>
        ) : null}
      </div>

      {(record.whyOnRadar || record.disclosure || record.publicNote) && (
        <div className="hidden border-t border-[var(--n100-border-subtle)]/60 px-4 pb-4 lg:block">
          {record.whyOnRadar ? (
            <p className="text-xs leading-5 text-[var(--n100-text-secondary)]">{record.whyOnRadar}</p>
          ) : null}
          <p className="mt-2 text-[0.625rem] leading-4 text-[var(--n100-text-tertiary)]">
            {record.disclosure || "Published from a reviewed Radar snapshot."}
          </p>
          {record.publicNote ? (
            <p className="mt-1 text-xs italic leading-5 text-[var(--n100-text-tertiary)]">{record.publicNote}</p>
          ) : null}
        </div>
      )}
    </article>
  );
}

export default function PublicRadarList({ feed }: { feed: PublicRadarFeed }) {
  return (
    <Section className="border-y border-[var(--n100-border-subtle)] bg-[var(--n100-surface-secondary)]/35">
      <Container size="wide">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-[var(--n100-radar)]">
              Published Radar · instrument panel
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-[var(--n100-text-primary)]">
              Approved intelligence, with its context intact.
            </h2>
          </div>
          <Link
            className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--n100-accent)] underline underline-offset-4"
            href="/methodology"
          >
            Methodology
          </Link>
        </div>

        {feed.state === "READY" ? (
          <Panel family="radar" padding="sm" className="mt-7 overflow-hidden">
            <div
              className="hidden gap-4 border-b border-[var(--n100-radar)]/25 px-4 pb-3 font-mono text-[0.55rem] uppercase tracking-[0.14em] text-[var(--n100-text-tertiary)] lg:grid lg:grid-cols-[minmax(12rem,1.4fr)_7rem_6.5rem_5.5rem_minmax(8rem,1fr)_minmax(7rem,0.9fr)_6rem]"
              aria-hidden="true"
            >
              <span>Identity</span>
              <span>Status</span>
              <span>Freshness</span>
              <span>Score</span>
              <span>Risk</span>
              <span>Evidence</span>
              <span className="text-right">Method</span>
            </div>
            <div role="list" aria-label="Published Radar records">
              {feed.records.map((record) => (
                <PublicRadarInstrumentRow key={record.tokenId} record={record} />
              ))}
            </div>
          </Panel>
        ) : (
          <Panel family="radar" padding="lg" className="mt-7">
            <EmptyState
              title={feed.state === "UNAVAILABLE" ? "TEMPORARILY UNAVAILABLE" : "NO PUBLISHED RECORDS"}
              description={
                feed.state === "UNAVAILABLE"
                  ? "The public Radar projection could not be read right now. No private analysis data is exposed as a fallback."
                  : "No approved, non-expired Radar publication is available for the public feed yet. Empty is not zero, and UNKNOWN is not safe."
              }
            />
          </Panel>
        )}
      </Container>
    </Section>
  );
}
