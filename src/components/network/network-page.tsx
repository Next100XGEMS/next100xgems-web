import Link from "next/link";

import { Container, InstrumentRule, Panel, Section, SectionHeader, StatusLabel } from "@/components/ui";

import { commercialContentTypes, networkChannels, networkFlow, organicContentTypes } from "@/components/commercial/commercial-content";

function SectionMarker({ number, label }: { number: string; label: string }) {
  return <p className="mb-4 font-mono text-[0.625rem] font-semibold uppercase tracking-[0.2em] text-[var(--n100-accent)]">{number} / {label}</p>;
}

function NetworkLink({ children, href }: { children: React.ReactNode; href: string }) {
  return <Link href={href} className="inline-flex min-h-10 items-center justify-center rounded-[var(--n100-radius-control)] border border-[var(--n100-border-strong)] px-4 text-sm font-semibold text-[var(--n100-text-primary)] transition-colors hover:border-[var(--n100-accent)] hover:text-[var(--n100-accent)]">{children}</Link>;
}

export default function NetworkPageContent() {
  return (
    <>
      <Section className="border-b border-[var(--n100-border-subtle)]">
        <Container size="wide">
          <div className="grid gap-10 lg:grid-cols-[1fr_0.7fr] lg:items-end lg:gap-20">
            <div>
              <SectionMarker number="01" label="Crypto media network" />
              <h1 className="max-w-4xl text-4xl font-semibold leading-[1.02] tracking-[-0.055em] text-[var(--n100-text-primary)] sm:text-6xl">A crypto-native network for context that travels.</h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-[var(--n100-text-secondary)] sm:text-lg">NEXT100XGEMS brings research, Radar intelligence, editorial content, and disclosed commercial campaigns into a distribution network built for crypto-native channels.</p>
            </div>
            <Panel tone="subtle" padding="lg">
              <p className="font-mono text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-[var(--n100-text-tertiary)]">Network principle</p>
              <p className="mt-4 text-lg leading-7 text-[var(--n100-text-primary)]">Distribution can widen context. It cannot change the conclusion.</p>
              <InstrumentRule className="mt-6" />
            </Panel>
          </div>
        </Container>
      </Section>

      <Section id="channel-network">
        <Container size="wide">
          <SectionHeader eyebrow="02 / Channel network" title="Media infrastructure, not a social-link page." description="These are confirmed channel types. Their role is described without invented handles, URLs, audience numbers, or posting promises." />
          <div className="mt-8 grid gap-px overflow-hidden border border-[var(--n100-border-subtle)] bg-[var(--n100-border-subtle)] sm:grid-cols-2">
            {networkChannels.map(([channel, description], index) => <article key={channel} className="bg-[var(--n100-canvas)] p-6 sm:min-h-44"><div className="flex items-center justify-between gap-4"><h3 className="text-xl font-semibold tracking-[-0.03em] text-[var(--n100-text-primary)]">{channel}</h3><span className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-[var(--n100-text-tertiary)]">CHANNEL 0{index + 1}</span></div><p className="mt-5 max-w-sm text-sm leading-6 text-[var(--n100-text-secondary)]">{description}</p></article>)}
          </div>
        </Container>
      </Section>

      <Section id="content-flow" className="border-y border-[var(--n100-border-subtle)] bg-[var(--n100-surface-subtle)]">
        <Container size="wide">
          <SectionHeader eyebrow="03 / Content flow" title="A path from signal to conversation." description="The flow is conceptual. Content is not assumed to be automatically syndicated across every channel." />
          <ol className="mt-8 grid gap-px overflow-hidden border border-[var(--n100-border-subtle)] bg-[var(--n100-border-subtle)] sm:grid-cols-2 lg:grid-cols-4">
            {networkFlow.map(([number, label, description]) => <li key={number} className="bg-[var(--n100-canvas)] p-5 sm:min-h-48"><p className="font-mono text-xs text-[var(--n100-accent)]">{number}</p><h3 className="mt-7 text-sm font-semibold uppercase tracking-[0.13em] text-[var(--n100-text-primary)]">{label}</h3><p className="mt-3 text-sm leading-5 text-[var(--n100-text-tertiary)]">{description}</p></li>)}
          </ol>
        </Container>
      </Section>

      <Section id="content-types">
        <Container size="wide">
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel family="editorial" padding="lg">
              <SectionMarker number="04" label="Organic content" />
              <h2 className="text-2xl font-semibold tracking-[-0.035em] text-[var(--n100-text-primary)]">Intelligence and editorial work.</h2>
              <ul className="mt-6 divide-y divide-[var(--n100-border-subtle)] border-y border-[var(--n100-border-subtle)]">{organicContentTypes.map((type) => <li key={type} className="py-3 text-sm text-[var(--n100-text-secondary)]">{type}</li>)}</ul>
            </Panel>
            <Panel family="commercial" padding="lg">
              <SectionMarker number="05" label="Commercial content" />
              <h2 className="text-2xl font-semibold tracking-[-0.035em] text-[var(--n100-text-primary)]">Paid work with visible labels.</h2>
              <div className="mt-6 flex flex-wrap gap-2"><StatusLabel kind="sponsored" /><StatusLabel kind="advertisement" /><StatusLabel kind="partner" /></div>
              <ul className="mt-6 divide-y divide-[var(--n100-sponsored)]/20 border-y border-[var(--n100-sponsored)]/20">{commercialContentTypes.map((type) => <li key={type} className="py-3 text-sm text-[var(--n100-text-secondary)]">{type}</li>)}</ul>
              <p className="mt-5 text-xs leading-5 text-[var(--n100-text-tertiary)]">Commercial distribution is distinct from organic editorial and Radar intelligence.</p>
            </Panel>
          </div>
        </Container>
      </Section>

      <Section id="intelligence-distribution" className="bg-[var(--n100-surface-secondary)]/35">
        <Container size="wide">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:gap-20">
            <div>
              <SectionMarker number="06" label="Intelligence + distribution" />
              <h2 className="text-3xl font-semibold tracking-[-0.045em] text-[var(--n100-text-primary)] sm:text-4xl">The network carries the work. It does not rewrite it.</h2>
              <p className="mt-5 max-w-xl text-sm leading-6 text-[var(--n100-text-secondary)]">Radar detects and organizes market context. Research and Editorial explain it. Distribution gives each layer a route to an audience without collapsing their roles.</p>
            </div>
            <Panel tone="subtle" padding="lg">
              <div className="grid gap-5 sm:grid-cols-3">
                <div><StatusLabel kind="radar" /><p className="mt-3 text-sm leading-5 text-[var(--n100-text-tertiary)]">Intelligence and detection.</p></div>
                <div><StatusLabel kind="editorial" /><p className="mt-3 text-sm leading-5 text-[var(--n100-text-tertiary)]">Independent explanation.</p></div>
                <div><StatusLabel kind="sponsored" /><p className="mt-3 text-sm leading-5 text-[var(--n100-text-tertiary)]">Paid distribution, labeled.</p></div>
              </div>
              <p className="mt-7 border-t border-[var(--n100-border-subtle)] pt-5 text-xl font-semibold tracking-[-0.03em] text-[var(--n100-text-primary)]">Sponsored ≠ Radar ranking.</p>
            </Panel>
          </div>
        </Container>
      </Section>

      <Section id="commercial-boundary" className="bg-[var(--n100-surface-commercial)]">
        <Container size="wide">
          <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-end lg:gap-20">
            <div>
              <SectionMarker number="07" label="Commercial boundary" />
              <h2 className="max-w-2xl text-3xl font-semibold tracking-[-0.045em] text-[var(--n100-text-primary)] sm:text-5xl">Paid campaigns may receive distribution across applicable channels.</h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--n100-text-secondary)]">Payment does not buy a Radar score, Radar ranking, independent editorial conclusion, risk rating, or organic trending status.</p>
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end"><StatusLabel kind="sponsored" /><StatusLabel kind="partner" /><StatusLabel kind="radar" /></div>
          </div>
          <div className="mt-8 flex flex-wrap gap-3"><NetworkLink href="/methodology">Read Methodology</NetworkLink><NetworkLink href="/work-with-us">Work With Us</NetworkLink></div>
        </Container>
      </Section>
    </>
  );
}

