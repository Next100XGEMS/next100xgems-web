import Link from "next/link";

import { Container, InstrumentRule, Panel, Section, SectionHeader, StatusLabel } from "@/components/ui";

import { advertisingFormats, advertisingInventoryCategories, advertisingPlacements, creativeStandards, plannedReportingMetrics } from "@/components/commercial/commercial-content";

function SectionMarker({ number, label }: { number: string; label: string }) {
  return <p className="mb-4 font-mono text-[0.625rem] font-semibold uppercase tracking-[0.2em] text-[var(--n100-accent)]">{number} / {label}</p>;
}

function AdvertiseLink({ children, href, primary = false }: { children: React.ReactNode; href: string; primary?: boolean }) {
  return <Link href={href} className={primary ? "inline-flex min-h-11 items-center justify-center rounded-[var(--n100-radius-control)] bg-[var(--n100-accent)] px-5 text-sm font-semibold text-[var(--n100-accent-ink)] transition-colors hover:bg-[var(--n100-accent-strong)]" : "inline-flex min-h-11 items-center justify-center rounded-[var(--n100-radius-control)] border border-[var(--n100-border-strong)] px-5 text-sm font-semibold text-[var(--n100-text-primary)] transition-colors hover:border-[var(--n100-accent)] hover:text-[var(--n100-accent)]"}>{children}</Link>;
}

export default function AdvertisePageContent({ advertisingEnabled }: { advertisingEnabled: boolean }) {
  return (
    <>
      <Section className="border-b border-[var(--n100-border-subtle)] bg-[var(--n100-surface-commercial)]">
        <Container size="wide" className="py-20 sm:py-28">
          <div className="grid gap-12 lg:grid-cols-[1fr_0.7fr] lg:items-end lg:gap-20">
            <div>
              <SectionMarker number="01" label="Crypto advertising" />
              <h1 className="max-w-4xl text-4xl font-semibold leading-[1.02] tracking-[-0.055em] text-[var(--n100-text-primary)] sm:text-6xl">Reach crypto-native audiences through disclosed media.</h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-[var(--n100-text-secondary)] sm:text-lg">NEXT100XGEMS can shape sponsored placements around research, market intelligence, Radar-adjacent context, partner inventory, and network distribution without selling analytical influence.</p>
            </div>
            <Panel family="commercial" padding="lg">
              <div className="flex flex-wrap gap-2"><StatusLabel kind="sponsored" /><StatusLabel kind="advertisement" /></div>
              <p className="mt-5 text-2xl font-semibold tracking-[-0.04em] text-[var(--n100-text-primary)]">Buy visibility, not influence.</p>
              <InstrumentRule className="mt-6" />
            </Panel>
          </div>
        </Container>
      </Section>

      <Section id="principle">
        <Container size="wide">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:gap-20">
            <div>
              <SectionMarker number="02" label="Advertising principle" />
              <h2 className="text-3xl font-semibold tracking-[-0.045em] text-[var(--n100-text-primary)] sm:text-5xl">Paid placement can purchase distribution. It cannot purchase the conclusion.</h2>
            </div>
            <Panel family="commercial" padding="lg">
              <p className="text-lg leading-7 text-[var(--n100-text-primary)]">Payment does not buy:</p>
              <ul className="mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-2">{["Radar Score", "Radar ranking", "Risk rating", "Organic trending status", "Positive research conclusion", "Favorable editorial conclusion"].map((item) => <li key={item} className="border-l-2 border-[var(--n100-sponsored)]/60 pl-3 text-sm text-[var(--n100-text-secondary)]">{item}</li>)}</ul>
            </Panel>
          </div>
        </Container>
      </Section>

      <Section id="inventory" className="border-y border-[var(--n100-border-subtle)] bg-[var(--n100-surface-subtle)]">
        <Container size="wide">
          <SectionHeader eyebrow="03 / Inventory categories" title="A media model organized around context." description="These categories describe the approved inventory model. They are not a live availability feed, and no pricing or placement commitment is published here." />
          <div className="mt-8 divide-y divide-[var(--n100-border-subtle)] border-y border-[var(--n100-border-subtle)]">{advertisingInventoryCategories.map(([category, description, codes], index) => <div key={category} className="grid gap-3 py-5 sm:grid-cols-[1fr_2fr_auto] sm:items-baseline sm:gap-8"><div className="flex gap-3"><span className="font-mono text-xs text-[var(--n100-accent)]">0{index + 1}</span><h3 className="text-sm font-semibold text-[var(--n100-text-primary)]">{category}</h3></div><p className="text-sm leading-6 text-[var(--n100-text-secondary)]">{description}</p><span className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-[var(--n100-text-tertiary)]">{codes}</span></div>)}</div>
          <p className="mt-5 text-sm leading-6 text-[var(--n100-text-tertiary)]">{advertisingEnabled ? "Campaign availability is scoped per request; no live inventory feed is represented." : "Advertising is not currently active. This informational page does not imply that inventory is accepting or running campaigns."}</p>
        </Container>
      </Section>

      <Section id="formats">
        <Container size="wide">
          <SectionHeader eyebrow="04 / Ad formats" title="Three clear format families." description="Every paid placement remains visibly labeled and distinguishable from Radar, Research, Editorial, and organic trending status." />
          <div className="mt-8 grid gap-px overflow-hidden border border-[var(--n100-border-subtle)] bg-[var(--n100-border-subtle)] lg:grid-cols-3">{advertisingFormats.map(([title, description], index) => <article key={title} className="bg-[var(--n100-canvas)] p-6 sm:min-h-52"><div className="flex items-center justify-between gap-4"><StatusLabel kind="sponsored" /><span className="font-mono text-xs text-[var(--n100-accent)]">0{index + 1}</span></div><h3 className="mt-6 text-lg font-semibold tracking-[-0.025em] text-[var(--n100-text-primary)]">{title}</h3><p className="mt-3 text-sm leading-6 text-[var(--n100-text-secondary)]">{description}</p></article>)}</div>
          <Panel tone="subtle" padding="md" className="mt-6">
            <div className="flex flex-wrap items-center gap-2"><StatusLabel kind="sponsored" /><span className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-[var(--n100-text-tertiary)]">Example identity only</span></div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2"><div className="border border-[var(--n100-border-subtle)] p-4"><p className="text-sm font-semibold text-[var(--n100-text-primary)]">PROJECT</p><p className="mt-2 text-xs text-[var(--n100-text-tertiary)]">A generic example native sponsored card.</p></div><div className="border border-[var(--n100-border-subtle)] p-4"><p className="text-sm font-semibold text-[var(--n100-text-primary)]">Market Overview presented by PROJECT</p><p className="mt-2 text-xs text-[var(--n100-text-tertiary)]">A generic section-sponsorship example, not a live placement.</p></div></div>
          </Panel>
        </Container>
      </Section>

      <Section id="placements" className="bg-[var(--n100-surface-secondary)]/35">
        <Container size="wide">
          <SectionHeader eyebrow="05 / Placement inventory" title="Placement names that keep the scope legible." description="Internal placement codes are shown as reference points for a future media-kit conversation. Availability and pricing remain to be scoped." />
          <div className="mt-8 overflow-hidden border border-[var(--n100-border-subtle)]"><div className="hidden grid-cols-[0.8fr_0.5fr_1.7fr] gap-6 border-b border-[var(--n100-border-subtle)] bg-[var(--n100-surface-subtle)] px-5 py-3 text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[var(--n100-text-tertiary)] sm:grid"><span>Surface</span><span>Code</span><span>Placement</span></div><ul>{advertisingPlacements.map(([surface, code, placement]) => <li key={code} className="grid gap-1 border-b border-[var(--n100-border-subtle)] px-5 py-4 last:border-b-0 sm:grid-cols-[0.8fr_0.5fr_1.7fr] sm:gap-6"><span className="text-sm text-[var(--n100-text-secondary)]">{surface}</span><span className="font-mono text-xs text-[var(--n100-accent)]">{code}</span><span className="text-sm font-medium text-[var(--n100-text-primary)]">{placement}</span></li>)}</ul></div>
        </Container>
      </Section>

      <Section id="workflow">
        <Container size="wide">
          <SectionHeader eyebrow="06 / Campaign workflow" title="A clear path from request to report." description="The final placement, timing, deliverables, and disclosure are agreed before production begins. No live advertiser dashboard is represented here." />
          <ol className="mt-8 grid gap-px overflow-hidden border border-[var(--n100-border-subtle)] bg-[var(--n100-border-subtle)] sm:grid-cols-2 lg:grid-cols-3">{[["01", "REQUEST", "Share project and campaign context."], ["02", "REVIEW", "Review fit, claims, links, creative needs, and inventory."], ["03", "PLAN", "Agree placement, timing, deliverables, and disclosure."], ["04", "CREATIVE", "Prepare and review sponsored assets."], ["05", "RUN", "Run the approved campaign through agreed inventory and channels."], ["06", "REPORT", "Where supported, summarize delivery results in context."]].map(([number, label, description]) => <li key={number} className="bg-[var(--n100-canvas)] p-5 sm:min-h-44"><p className="font-mono text-xs text-[var(--n100-accent)]">{number}</p><h3 className="mt-7 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--n100-text-primary)]">{label}</h3><p className="mt-3 text-sm leading-5 text-[var(--n100-text-tertiary)]">{description}</p></li>)}</ol>
        </Container>
      </Section>

      <Section id="reporting" className="border-y border-[var(--n100-border-subtle)] bg-[var(--n100-surface-subtle)]">
        <Container size="wide">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:gap-20">
            <div>
              <SectionMarker number="07" label="Measurement direction" />
              <h2 className="text-3xl font-semibold tracking-[-0.045em] text-[var(--n100-text-primary)] sm:text-4xl">Reporting is planned, not overstated.</h2>
              <p className="mt-5 max-w-xl text-sm leading-6 text-[var(--n100-text-secondary)]">Campaign reporting is designed to support the following context where measurement is available. These capabilities are not represented as live analytics in this foundation.</p>
            </div>
            <Panel tone="subtle" padding="lg">
              <p className="font-mono text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[var(--n100-text-tertiary)]">Planned reporting supports</p>
              <ul className="mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-2">{plannedReportingMetrics.map((metric) => <li key={metric} className="border-b border-[var(--n100-border-subtle)] py-3 text-sm text-[var(--n100-text-secondary)]">{metric}</li>)}</ul>
              <p className="mt-5 text-sm leading-6 text-[var(--n100-text-tertiary)]">No example numbers, guaranteed reach, guaranteed clicks, guaranteed investors, or guaranteed conversions are presented.</p>
            </Panel>
          </div>
        </Container>
      </Section>

      <Section id="standards">
        <Container size="wide">
          <div className="grid gap-8 lg:grid-cols-2 lg:gap-16">
            <div>
              <SectionMarker number="08" label="Creative and UX standards" />
              <h2 className="text-3xl font-semibold tracking-[-0.045em] text-[var(--n100-text-primary)] sm:text-4xl">Restrained advertising keeps trust visible.</h2>
              <p className="mt-5 max-w-xl text-sm leading-6 text-[var(--n100-text-secondary)]">Paid content should be useful, legible, and proportionate to the surrounding experience. It should never borrow the authority of intelligence output.</p>
            </div>
            <Panel tone="subtle" padding="lg"><ul className="space-y-4">{creativeStandards.map((standard) => <li key={standard} className="border-l-2 border-[var(--n100-border-strong)] pl-4 text-sm leading-6 text-[var(--n100-text-secondary)]">{standard}</li>)}</ul></Panel>
          </div>
        </Container>
      </Section>

      <Section id="boundary" className="bg-[var(--n100-surface-commercial)]">
        <Container size="wide">
          <div className="grid gap-10 lg:grid-cols-[1fr_0.85fr] lg:items-end lg:gap-20">
            <div>
              <SectionMarker number="09" label="Trust boundary" />
              <h2 className="max-w-2xl text-3xl font-semibold tracking-[-0.045em] text-[var(--n100-text-primary)] sm:text-5xl">Sponsored is not Radar. Advertising is not Editorial.</h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--n100-text-secondary)]">Every paid placement is disclosed. Commercial activity can widen distribution, but it cannot rewrite intelligence, research, risk assessment, or independent conclusions.</p>
            </div>
            <Panel family="commercial" padding="lg"><div className="flex flex-wrap gap-2"><StatusLabel kind="sponsored" /><StatusLabel kind="advertisement" /><StatusLabel kind="editorial" /><StatusLabel kind="radar" /></div><p className="mt-6 text-xl font-semibold tracking-[-0.03em] text-[var(--n100-text-primary)]">Visibility can be purchased. Intelligence cannot.</p></Panel>
          </div>
        </Container>
      </Section>

      <Section className="border-b border-[var(--n100-border-subtle)]">
        <Container size="reading" className="text-center">
          <SectionMarker number="10" label="Campaign path" />
          <h2 className="text-3xl font-semibold tracking-[-0.045em] text-[var(--n100-text-primary)] sm:text-4xl">Scope a campaign with the right context.</h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-[var(--n100-text-secondary)]">Request a conversation through the existing Work With Us inquiry path. No campaign submission or payment action is active on this page.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3"><AdvertiseLink href="/work-with-us#inquiry" primary>Request Campaign</AdvertiseLink><AdvertiseLink href="/work-with-us">Work With Us</AdvertiseLink></div>
        </Container>
      </Section>
    </>
  );
}
