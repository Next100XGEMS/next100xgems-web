import Link from "next/link";

import {
  Container,
  DisclosureLabel,
  InstrumentRule,
  Panel,
  Section,
  SectionHeader,
  StatusLabel,
} from "@/components/ui";
import type { StatusKind } from "@/components/ui";

type DisclosureKind = "editorial" | "sponsored" | "partner" | "advertisement" | "ai-assisted";

import {
  contentClassifications,
  evidenceFramework,
  methodologyPrinciples,
  radarDataCategories,
  radarPipeline,
  radarStatuses,
} from "./trust-content";

function SectionMarker({ number, label }: { number: string; label: string }) {
  return (
    <p className="mb-4 font-mono text-[0.625rem] font-semibold uppercase tracking-[0.2em] text-[var(--n100-accent)]">
      {number} / {label}
    </p>
  );
}

function TrustLink({ children, href }: { children: React.ReactNode; href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-10 items-center justify-center rounded-[var(--n100-radius-control)] border border-[var(--n100-border-strong)] px-4 text-sm font-semibold text-[var(--n100-text-primary)] transition-colors hover:border-[var(--n100-accent)] hover:text-[var(--n100-accent)]"
    >
      {children}
    </Link>
  );
}

function ClassificationLabel({ kind }: { kind: StatusKind }) {
  return kind === "radar" ? <StatusLabel kind={kind} /> : <DisclosureLabel kind={kind as DisclosureKind} />;
}

const methodologyContents = [
  ["Introduction", "methodology-introduction"],
  ["What Radar does", "what-radar-does"],
  ["Pipeline", "radar-pipeline"],
  ["Evidence", "evidence-framework"],
  ["Data categories", "data-categories"],
  ["AI assistance", "ai-assisted-analysis"],
  ["Human review", "human-review"],
  ["Status principles", "status-principles"],
  ["Freshness", "freshness-sources"],
  ["Limitations", "limitations"],
  ["Independence", "commercial-independence"],
  ["What Radar does not do", "radar-does-not"],
] as const;

export default function MethodologyPageContent() {
  return (
    <>
      <Section className="border-b border-[var(--n100-border-subtle)]">
        <Container size="wide">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end lg:gap-20">
            <div>
              <SectionMarker number="01" label="Public trust layer" />
              <h1 className="max-w-4xl text-4xl font-semibold leading-[1.02] tracking-[-0.055em] text-[var(--n100-text-primary)] sm:text-6xl">How NEXT100XGEMS evaluates market intelligence.</h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-[var(--n100-text-secondary)] sm:text-lg">This page explains how structured market information, AI-assisted analysis, and human editorial judgment fit together—and where the limits remain.</p>
            </div>
            <Panel tone="subtle" padding="md">
              <p className="font-mono text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-[var(--n100-text-tertiary)]">Method in brief</p>
              <p className="mt-4 text-sm leading-6 text-[var(--n100-text-secondary)]">Evidence is organized before interpretation. Interpretation is labeled before publication.</p>
              <InstrumentRule className="mt-6" />
            </Panel>
          </div>
          <nav aria-label="Methodology contents" className="mt-12 border-t border-[var(--n100-border-subtle)] pt-5">
            <p className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-[var(--n100-text-tertiary)]">On this page</p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[var(--n100-text-secondary)]">
              {methodologyContents.map(([label, id]) => <a key={id} className="underline decoration-[var(--n100-border-strong)] underline-offset-4 transition-colors hover:text-[var(--n100-accent)] hover:decoration-[var(--n100-accent)]" href={`#${id}`}>{label}</a>)}
            </div>
          </nav>
        </Container>
      </Section>

      <Section id="methodology-introduction">
        <Container size="reading">
          <SectionHeader eyebrow="02 / Introduction" title="A methodology is a map, not a forecast." description="NEXT100XGEMS combines structured market intelligence, first-party research, and human review to help readers understand what a signal means, what supports it, and what is still uncertain." />
          <p className="mt-7 text-base leading-7 text-[var(--n100-text-secondary)]">The purpose is clarity. Radar organizes activity and context for review; Research explains evidence and implications; commercial material is labeled separately. None of these layers predicts returns or removes the need for independent judgment.</p>
        </Container>
      </Section>

      <Section id="what-radar-does" className="bg-[var(--n100-surface-subtle)]">
        <Container size="wide">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start lg:gap-20">
            <div>
              <SectionMarker number="03" label="What Radar does" />
              <h2 className="max-w-xl text-3xl font-semibold tracking-[-0.045em] text-[var(--n100-text-primary)] sm:text-4xl">Radar turns activity into a reviewable intelligence surface.</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ["Discover", "Find relevant market activity and signals."],
                ["Filter", "Reduce obvious low-quality or risky candidates with deterministic checks."],
                ["Evaluate", "Organize market, on-chain, narrative, momentum, and risk context where available."],
                ["Publish", "Present approved intelligence with evidence, freshness, and disclosure."],
              ].map(([title, description]) => <div key={title} className="border-l-2 border-[var(--n100-radar)]/45 pl-4"><h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--n100-text-primary)]">{title}</h3><p className="mt-2 text-sm leading-6 text-[var(--n100-text-tertiary)]">{description}</p></div>)}
            </div>
          </div>
          <p className="mt-10 border-l-2 border-[var(--n100-accent)] pl-5 text-base font-medium leading-7 text-[var(--n100-text-primary)]">Radar does not automatically tell users to buy. It is an intelligence and publishing workflow, not a trading system.</p>
        </Container>
      </Section>

      <Section id="radar-pipeline">
        <Container size="wide">
          <SectionHeader eyebrow="04 / Radar pipeline" title="Discover → Filter → Analyze → Review → Publish" description="The stages are sequential in principle, even when the underlying detection and analysis are assisted by automation." />
          <ol className="mt-8 grid gap-px overflow-hidden border border-[var(--n100-border-subtle)] bg-[var(--n100-border-subtle)] sm:grid-cols-2 lg:grid-cols-5">
            {radarPipeline.map(([number, label, description]) => <li key={number} className="bg-[var(--n100-canvas)] p-5 sm:min-h-48"><p className="font-mono text-xs text-[var(--n100-accent)]">{number}</p><h3 className="mt-8 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--n100-text-primary)]">{label}</h3><p className="mt-3 text-sm leading-5 text-[var(--n100-text-tertiary)]">{description}</p></li>)}
          </ol>
          <p className="mt-6 text-sm font-medium text-[var(--n100-text-primary)]">Automatic public publishing is OFF by default in the initial production policy.</p>
        </Container>
      </Section>

      <Section id="evidence-framework" className="bg-[var(--n100-surface-subtle)]">
        <Container size="wide">
          <SectionHeader eyebrow="05 / Evidence framework" title="Know what is observed, inferred, and unknown." description="These labels describe the relationship between a statement and the information supporting it. They are not commercial labels." />
          <div className="mt-8 divide-y divide-[var(--n100-border-subtle)] border-y border-[var(--n100-border-subtle)]">
            {evidenceFramework.map(([kind, label, description]) => <div key={label} className="grid gap-4 py-5 sm:grid-cols-[11rem_1fr] sm:items-center"><StatusLabel kind={kind} /><p className="max-w-3xl text-sm leading-6 text-[var(--n100-text-secondary)]">{description}</p></div>)}
          </div>
        </Container>
      </Section>

      <Section id="data-categories">
        <Container size="wide">
          <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:gap-20">
            <div>
              <SectionMarker number="06" label="Data / signal categories" />
              <h2 className="text-3xl font-semibold tracking-[-0.045em] text-[var(--n100-text-primary)] sm:text-4xl">Several lenses, never one magic number.</h2>
              <p className="mt-5 text-sm leading-6 text-[var(--n100-text-secondary)]">Radar may evaluate the following categories when relevant. Coverage varies by chain, token, source, and data availability; no category is guaranteed for every asset.</p>
            </div>
            <dl className="grid gap-x-8 sm:grid-cols-2">
              {radarDataCategories.map(([label, description], index) => <div key={label} className="border-b border-[var(--n100-border-subtle)] py-4"><dt className="flex gap-3 text-sm font-medium text-[var(--n100-text-primary)]"><span className="font-mono text-xs text-[var(--n100-accent)]">0{index + 1}</span>{label}</dt><dd className="mt-2 pl-7 text-xs leading-5 text-[var(--n100-text-tertiary)]">{description}</dd></div>)}
            </dl>
          </div>
        </Container>
      </Section>

      <Section id="ai-assisted-analysis" className="border-y border-[var(--n100-border-subtle)] bg-[var(--n100-surface-secondary)]/35">
        <Container size="wide">
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel family="editorial" padding="lg">
              <SectionMarker number="07" label="AI-assisted analysis" />
              <h2 className="text-2xl font-semibold tracking-[-0.035em] text-[var(--n100-text-primary)]">AI helps organize context.</h2>
              <ul className="mt-6 space-y-3 text-sm leading-6 text-[var(--n100-text-secondary)]"><li>Organizing information and comparing signals.</li><li>Summarizing source material and identifying patterns.</li><li>Generating structured analytical assistance.</li></ul>
              <p className="mt-7 border-t border-[var(--n100-border-subtle)] pt-5 text-sm font-medium leading-6 text-[var(--n100-text-primary)]">AI does not guarantee correctness, replace verified source data, or independently determine an investment decision.</p>
            </Panel>
            <Panel family="radar" padding="lg" id="human-review">
              <SectionMarker number="08" label="Human review" />
              <h2 className="text-2xl font-semibold tracking-[-0.035em] text-[var(--n100-text-primary)]">Publication adds a human checkpoint.</h2>
              <p className="mt-5 text-sm leading-6 text-[var(--n100-text-secondary)]">Reviewers may review, reject, hide, request reanalysis, or add editorial context before public Radar publication.</p>
              <p className="mt-5 text-sm leading-6 text-[var(--n100-text-secondary)]">They do not manually alter the system-calculated Radar Score simply to change a conclusion. Human review improves accountability; it does not remove all risk or error.</p>
            </Panel>
          </div>
        </Container>
      </Section>

      <Section id="status-principles">
        <Container size="wide">
          <SectionHeader eyebrow="09 / Scoring & status principles" title="A score organizes context; it does not promise an outcome." description="Radar Scores and statuses are intended to organize relative signal quality and risk context. Exact weighting may evolve as the system is empirically validated." />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {radarStatuses.map(([kind, label, description]) => <Panel key={label} tone="quiet" padding="md"><StatusLabel kind={kind} /><p className="mt-4 text-sm leading-6 text-[var(--n100-text-secondary)]">{description}</p></Panel>)}
          </div>
          <p className="mt-7 text-sm leading-6 text-[var(--n100-text-tertiary)]">A Radar Score or status is not a price target, guaranteed forecast, buy recommendation, or promise of future performance.</p>
        </Container>
      </Section>

      <Section id="freshness-sources" className="bg-[var(--n100-surface-subtle)]">
        <Container size="wide">
          <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:gap-20">
            <div>
              <SectionMarker number="10" label="Freshness & sources" />
              <h2 className="text-3xl font-semibold tracking-[-0.045em] text-[var(--n100-text-primary)] sm:text-4xl">Context changes as markets change.</h2>
              <p className="mt-5 text-sm leading-6 text-[var(--n100-text-secondary)]">Crypto conditions move quickly. Where appropriate, displayed intelligence should carry an updated, refreshed, or freshness timestamp and point readers toward the underlying source or context.</p>
            </div>
            <Panel tone="subtle" padding="lg">
              <p className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-[var(--n100-text-tertiary)]">Coverage principle</p>
              <p className="mt-4 text-lg leading-7 text-[var(--n100-text-primary)]">Source availability varies. “Fresh” describes an update context, not a universal promise of real-time coverage.</p>
              <InstrumentRule className="mt-7" />
            </Panel>
          </div>
        </Container>
      </Section>

      <Section id="limitations">
        <Container size="reading">
          <SectionHeader eyebrow="11 / Limitations" title="Useful context still has limits." description="The following constraints are part of the methodology, not footnotes added after the fact." />
          <ul className="mt-7 grid gap-x-8 gap-y-4 sm:grid-cols-2">{[
            "Crypto markets are highly volatile.",
            "Data may be delayed, incomplete, or unavailable.",
            "Smart-contract and on-chain interpretation can be imperfect.",
            "Social and narrative signals are noisy.",
            "AI-assisted analysis can be wrong.",
            "New assets may have limited history.",
            "Third-party data availability can change.",
            "Human review does not remove all risk.",
          ].map((item) => <li key={item} className="border-l border-[var(--n100-border-strong)] pl-4 text-sm leading-6 text-[var(--n100-text-secondary)]">{item}</li>)}</ul>
        </Container>
      </Section>

      <Section id="commercial-independence" className="bg-[var(--n100-surface-commercial)]">
        <Container size="wide">
          <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:items-center lg:gap-20">
            <div>
              <SectionMarker number="12" label="Commercial independence" />
              <h2 className="text-3xl font-semibold tracking-[-0.045em] text-[var(--n100-text-primary)] sm:text-5xl">Sponsored ≠ Radar ranking.</h2>
              <p className="mt-5 text-sm leading-6 text-[var(--n100-text-secondary)]">Paid relationships cannot purchase a Radar score, ranking, risk rating, organic trending status, or favorable independent conclusion.</p>
            </div>
            <div className="grid gap-px border border-[var(--n100-sponsored)]/25 bg-[var(--n100-sponsored)]/25 sm:grid-cols-2">
              {contentClassifications.slice(0, 4).map(([kind, label, description]) => <div key={label} className="bg-[var(--n100-surface-commercial)] p-5"><ClassificationLabel kind={kind} /><p className="mt-3 text-sm leading-6 text-[var(--n100-text-secondary)]">{description}</p></div>)}
            </div>
          </div>
          <div className="mt-10 flex flex-wrap gap-3"><TrustLink href="/disclosures">Read Disclosures</TrustLink><TrustLink href="/methodology#radar-pipeline">Review the Pipeline</TrustLink></div>
        </Container>
      </Section>

      <Section id="radar-does-not" className="border-b border-[var(--n100-border-subtle)]">
        <Container size="wide">
          <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:gap-20">
            <div>
              <SectionMarker number="13" label="Boundary" />
              <h2 className="text-3xl font-semibold tracking-[-0.045em] text-[var(--n100-text-primary)] sm:text-4xl">What Radar does not do.</h2>
            </div>
            <div>
              <p className="max-w-2xl text-base leading-7 text-[var(--n100-text-secondary)]">Radar does not hold user funds, custody wallets, store private keys, sign transactions, automatically buy, automatically sell, execute trades, guarantee returns, or provide personalized guaranteed investment outcomes.</p>
              <div className="mt-8 flex flex-wrap gap-3">{methodologyPrinciples.map((principle) => <span key={principle} className="border border-[var(--n100-border-subtle)] px-3 py-2 text-xs text-[var(--n100-text-tertiary)]">{principle}</span>)}</div>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
