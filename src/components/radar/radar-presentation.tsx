import Link from "next/link";

import { Container, DataValue, InstrumentRule, Panel, Section, SectionHeader, StatusLabel } from "@/components/ui";
import { radarFixtures } from "@/lib/radar/fixtures";
import type { RadarFixture, RadarFixtureEvidence, RadarFixtureMetric, RadarFreshness, RadarEvidenceKind, RadarFixtureStatus } from "@/lib/radar/fixtures";

const statusKind: Record<RadarFixtureStatus, "early" | "trending" | "high-risk"> = {
  EARLY: "early",
  TRENDING: "trending",
  HIGH_RISK: "high-risk",
};

const evidenceKind: Record<RadarEvidenceKind, "verified-data" | "strong-signal" | "ai-inference" | "unknown"> = {
  "VERIFIED DATA": "verified-data",
  "STRONG SIGNAL": "strong-signal",
  "AI INFERENCE": "ai-inference",
  UNKNOWN: "unknown",
};

const freshnessTone: Record<RadarFreshness, string> = {
  FRESH: "border-[var(--n100-positive)]/40 bg-[var(--n100-positive)]/8 text-[var(--n100-positive)]",
  AGING: "border-[var(--n100-warning)]/45 bg-[var(--n100-warning)]/8 text-[var(--n100-warning)]",
  STALE: "border-[var(--n100-negative)]/40 bg-[var(--n100-negative)]/8 text-[var(--n100-negative)]",
  UNKNOWN: "border-[var(--n100-unknown)]/40 bg-[var(--n100-unknown)]/8 text-[var(--n100-unknown)]",
};

export function RadarStatus({ status }: { status: RadarFixtureStatus }) {
  return <StatusLabel kind={statusKind[status]} />;
}

export function RadarFreshness({ state, context }: { state: RadarFreshness; context?: string }) {
  return (
    <span className={`inline-flex min-h-6 items-center rounded-[var(--n100-radius-control)] border px-2 py-1 text-[0.625rem] font-semibold tracking-[0.13em] ${freshnessTone[state]}`}>
      <span>{state}</span>{context ? <span className="sr-only"> — {context}</span> : null}
    </span>
  );
}

function FixtureLabel() {
  return <span className="inline-flex items-center border border-[var(--n100-radar)]/50 bg-[var(--n100-radar)]/10 px-2 py-1 font-mono text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[var(--n100-radar)]">DEVELOPMENT PREVIEW · SAMPLE DATA</span>;
}

function RadarMetricList({ metrics }: { metrics: readonly RadarFixtureMetric[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {metrics.map((metric) => (
        <div key={metric.label} className="min-w-0 border-l border-[var(--n100-radar)]/35 pl-3">
          <p className="text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-[var(--n100-text-tertiary)]">{metric.label}</p>
          <p className={`mt-2 font-mono text-sm ${metric.state === "unknown" || metric.state === "unsupported" ? "text-[var(--n100-unknown)]" : metric.state === "stale" ? "text-[var(--n100-negative)]" : "text-[var(--n100-text-primary)]"}`}>{metric.value}</p>
          <p className="mt-1 text-xs leading-5 text-[var(--n100-text-tertiary)]">{metric.context}</p>
        </div>
      ))}
    </div>
  );
}

export function RadarEvidenceItem({ evidence }: { evidence: RadarFixtureEvidence }) {
  return (
    <div className="border-b border-[var(--n100-border-subtle)]/80 pb-4 last:border-0 last:pb-0">
      <StatusLabel kind={evidenceKind[evidence.kind]} />
      <p className="mt-3 text-sm font-medium text-[var(--n100-text-primary)]">{evidence.label}</p>
      <p className="mt-1 text-sm leading-6 text-[var(--n100-text-secondary)]">{evidence.context}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2"><RadarFreshness state={evidence.freshness} /><p className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-[var(--n100-text-tertiary)]">{evidence.provenance}</p></div>
    </div>
  );
}

export function RadarScore({ score, methodologyVersion, compact = false }: { score: string; methodologyVersion: string; compact?: boolean }) {
  return (
    <div className="border-l-2 border-[var(--n100-radar)] pl-4">
      <p className="font-mono text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[var(--n100-radar)]">Radar Score · SAMPLE</p>
      <div className="mt-2 flex flex-wrap items-baseline gap-3"><DataValue value={score} className={`${compact ? "text-2xl" : "text-3xl"} font-semibold`} /><span className="text-xs text-[var(--n100-text-tertiary)]">contextual sample value</span></div>
      <p className="mt-2 text-xs leading-5 text-[var(--n100-text-tertiary)]">Methodology {methodologyVersion}. This is not a probability, forecast, or recommendation.</p>
    </div>
  );
}

export function RadarSummaryRail({ fixture }: { fixture: RadarFixture }) {
  return (
    <Panel family="radar" padding="md" className="min-w-0">
      <p className="font-mono text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[var(--n100-radar)]">Current sample context</p>
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-5 lg:grid-cols-2 xl:grid-cols-5">
        <div><p className="font-mono text-[0.625rem] uppercase tracking-[0.13em] text-[var(--n100-text-tertiary)]">Status</p><div className="mt-2"><RadarStatus status={fixture.status} /></div></div>
        <div><p className="font-mono text-[0.625rem] uppercase tracking-[0.13em] text-[var(--n100-text-tertiary)]">Freshness</p><div className="mt-2"><RadarFreshness state={fixture.freshness} /></div></div>
        <div><p className="font-mono text-[0.625rem] uppercase tracking-[0.13em] text-[var(--n100-text-tertiary)]">Risk context</p><p className={`mt-2 text-sm font-semibold ${fixture.status === "HIGH_RISK" ? "text-[var(--n100-negative)]" : "text-[var(--n100-text-primary)]"}`}>{fixture.riskPosture}</p></div>
        <div><p className="font-mono text-[0.625rem] uppercase tracking-[0.13em] text-[var(--n100-text-tertiary)]">Radar Score</p><p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-[var(--n100-text-primary)]">{fixture.score}</p><p className="mt-1 text-[0.625rem] text-[var(--n100-text-tertiary)]">SAMPLE · {fixture.methodologyVersion}</p></div>
        <div><p className="font-mono text-[0.625rem] uppercase tracking-[0.13em] text-[var(--n100-text-tertiary)]">Review state</p><p className="mt-2 text-sm font-medium text-[var(--n100-text-primary)]">{fixture.publicationState}</p><p className="mt-1 text-xs text-[var(--n100-text-tertiary)]">Human review remains required.</p></div>
      </div>
      <p className="mt-5 border-t border-[var(--n100-border-subtle)]/80 pt-4 text-xs leading-5 text-[var(--n100-text-tertiary)]">Sample score only. It is not a probability, forecast, or recommendation.</p>
    </Panel>
  );
}

export function RadarFixtureListItem({ fixture }: { fixture: RadarFixture }) {
  return (
    <article className="border-t border-[var(--n100-border-subtle)] py-6 first:border-t-0">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><FixtureLabel /><RadarStatus status={fixture.status} /><RadarFreshness state={fixture.freshness} context={fixture.freshnessContext} /></div>
          <h3 className="mt-4 text-xl font-semibold tracking-[-0.03em] text-[var(--n100-text-primary)]">{fixture.tokenLabel} <span className="text-[var(--n100-text-tertiary)]">· {fixture.displayName}</span></h3>
          <p className="mt-2 break-words font-mono text-xs text-[var(--n100-text-tertiary)]">{fixture.chain} · {fixture.contract}</p>
        </div>
        <div className="flex shrink-0 flex-col gap-3 border-l border-[var(--n100-border-strong)]/70 pl-4 lg:w-52"><div><p className="font-mono text-[0.625rem] uppercase tracking-[0.13em] text-[var(--n100-text-tertiary)]">Risk context</p><p className={`mt-1 text-sm font-semibold ${fixture.status === "HIGH_RISK" ? "text-[var(--n100-negative)]" : "text-[var(--n100-text-primary)]"}`}>{fixture.riskPosture}</p></div><RadarScore score={fixture.score} methodologyVersion={fixture.methodologyVersion} compact /><Link className="text-xs font-semibold text-[var(--n100-accent)] underline decoration-[var(--n100-accent)]/40 underline-offset-4 hover:text-[var(--n100-text-primary)]" href={`/radar-preview/${fixture.slug}`}>View sample detail</Link></div>
      </div>
      <p className="mt-5 max-w-2xl text-sm leading-6 text-[var(--n100-text-secondary)]">{fixture.whyOnRadar[0]}. <span className="text-[var(--n100-text-tertiary)]">{fixture.providerState}</span></p>
      <div className="mt-5"><RadarMetricList metrics={fixture.marketMetrics} /></div>
      <div className="mt-6 flex flex-wrap gap-2" aria-label="Sample evidence states">
        {fixture.evidence.map((item) => <StatusLabel key={`${fixture.slug}-${item.kind}`} kind={evidenceKind[item.kind]} />)}
      </div>
    </article>
  );
}

export function RadarPreviewPageContent() {
  return (
    <div>
      <Section className="pb-10 sm:pb-14"><Container size="wide"><div className="max-w-4xl"><FixtureLabel /><p className="mt-6 font-mono text-[0.625rem] font-semibold uppercase tracking-[0.2em] text-[var(--n100-accent)]">Radar interface laboratory</p><h1 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-[var(--n100-text-primary)] sm:text-6xl">A sample intelligence surface, not a live feed.</h1><p className="mt-6 max-w-2xl text-base leading-7 text-[var(--n100-text-secondary)] sm:text-lg">This development-only preview exercises how future reviewed Radar intelligence could be scanned, explained, and sourced. Every identity and value below is fictional sample data.</p></div><InstrumentRule className="mt-10" /></Container></Section>
      <Section className="border-y border-[var(--n100-border-subtle)] bg-[var(--n100-surface-secondary)]/30" density="compact"><Container size="wide"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-mono text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[var(--n100-radar)]">Sample publication shape</p><p className="mt-2 text-sm leading-6 text-[var(--n100-text-secondary)]">Synthetic records demonstrate status, score, freshness, evidence, and provider uncertainty.</p></div><p className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--n100-text-tertiary)]">No database records · no live providers</p></div></Container></Section>
      <Section><Container size="wide"><SectionHeader eyebrow="01 / Sample Radar list" title="Reviewable context, arranged for scanning." description="The future list can be dense without becoming a screener: identity, status, freshness, evidence quality, and risk context stay visible together." /><div className="mt-8"><Panel family="radar" padding="lg">{radarFixtures.map((fixture) => <RadarFixtureListItem key={fixture.slug} fixture={fixture} />)}</Panel></div></Container></Section>
      <Section className="border-y border-[var(--n100-border-subtle)] bg-[var(--n100-surface-subtle)]"><Container size="wide"><SectionHeader eyebrow="02 / Preview boundaries" title="What this preview deliberately does not do." description="The sample surface has no publication authority, trading controls, wallet actions, or production data path." /><div className="mt-8 grid gap-4 sm:grid-cols-3">{["No live token records", "No provider connections", "No execution controls"].map((item) => <Panel key={item} tone="quiet" padding="md"><p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[var(--n100-text-primary)]">{item}</p><p className="mt-3 text-sm leading-6 text-[var(--n100-text-tertiary)]">Reserved for a later, separately validated gate.</p></Panel>)}</div></Container></Section>
    </div>
  );
}

export function RadarDetailPageContent({ fixture }: { fixture: RadarFixture }) {
  return (
    <div>
      <Section className="py-8 sm:py-10"><Container size="wide"><div className="grid gap-5 lg:grid-cols-[0.82fr_1.18fr] lg:items-start"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><FixtureLabel /></div><p className="mt-5 font-mono text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-[var(--n100-accent)]">Sample token detail · development only</p><h1 className="mt-3 break-words text-3xl font-semibold tracking-[-0.045em] text-[var(--n100-text-primary)] sm:text-4xl">{fixture.tokenLabel}<span className="text-[var(--n100-text-tertiary)]"> · {fixture.displayName}</span></h1><p className="mt-4 break-words font-mono text-xs leading-6 text-[var(--n100-text-tertiary)]">{fixture.chain} · <span title={fixture.contract}>{fixture.contract}</span></p><p className="mt-4 max-w-xl text-sm leading-6 text-[var(--n100-text-secondary)]">{fixture.editorialNote}</p></div><RadarSummaryRail fixture={fixture} /></div><InstrumentRule className="mt-7" /></Container></Section>
      <Section className="py-6 sm:py-8"><Container size="wide"><Panel padding="md"><SectionHeader eyebrow="01 / Core observations" title="Time belongs beside the number." description={fixture.freshnessContext} /><div className="mt-6"><RadarMetricList metrics={[...fixture.marketMetrics, ...fixture.onChainMetrics].slice(0, 6)} /></div></Panel></Container></Section>
      <Section className="border-y border-[var(--n100-border-subtle)] bg-[var(--n100-surface-secondary)]/30"><Container size="wide"><div className="grid gap-6 lg:grid-cols-2"><Panel padding="lg"><SectionHeader eyebrow="02 / Evidence" title="Evidence is not a verdict." description="Sourceable inputs, derived signals, model-assisted context, and unknowns remain visibly distinct." /><div className="mt-7 space-y-5">{fixture.evidence.map((item) => <RadarEvidenceItem key={`${item.kind}-${item.label}`} evidence={item} />)}</div></Panel><Panel family="radar" padding="lg"><SectionHeader eyebrow="03 / Risk context" title="Risk stays in the frame." description="The detail surface does not collapse context into a binary safe/unsafe label." /><ul className="mt-7 space-y-3">{fixture.risks.map((risk) => <li key={risk} className="border-l-2 border-[var(--n100-negative)]/55 pl-4 text-sm leading-6 text-[var(--n100-text-secondary)]">{risk}</li>)}</ul><div className="mt-8 border-t border-[var(--n100-border-subtle)]/80 pt-6"><p className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-[var(--n100-text-tertiary)]">Why this sample appears</p><ul className="mt-3 space-y-2">{fixture.whyOnRadar.map((reason) => <li key={reason} className="text-sm leading-6 text-[var(--n100-text-secondary)]">{reason}</li>)}</ul></div></Panel></div></Container></Section>
      <Section><Container size="wide"><div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]"><Panel padding="lg"><SectionHeader eyebrow="04 / Provenance" title="Sources and provider state." description={fixture.providerState} /><div className="mt-6 divide-y divide-[var(--n100-border-subtle)]">{fixture.sources.map((source) => <div key={source.label} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"><span className="text-sm text-[var(--n100-text-secondary)]">{source.label}</span><span className="font-mono text-[0.625rem] uppercase tracking-[0.13em] text-[var(--n100-text-tertiary)]">{source.state}</span></div>)}</div></Panel><Panel tone="quiet" padding="lg"><p className="font-mono text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[var(--n100-accent)]">Transparency</p><p className="mt-3 text-sm leading-6 text-[var(--n100-text-secondary)]">Sample methodology {fixture.methodologyVersion}. Review the public principles before interpreting any future Radar record.</p><div className="mt-6 flex flex-wrap gap-4 text-sm"><Link className="text-[var(--n100-accent)] underline underline-offset-4" href="/methodology">Read Methodology</Link><Link className="text-[var(--n100-accent)] underline underline-offset-4" href="/disclosures">Read Disclosures</Link></div></Panel></div></Container></Section>
      <Section className="border-t border-[var(--n100-border-subtle)]"><Container size="reading"><p className="text-sm leading-6 text-[var(--n100-text-tertiary)]">Development preview only. This sample does not represent a live asset, public recommendation, financial outcome, or published Radar record.</p><Link className="mt-5 inline-flex text-sm font-semibold text-[var(--n100-accent)] underline underline-offset-4" href="/radar-preview">Back to sample list</Link></Container></Section>
    </div>
  );
}
