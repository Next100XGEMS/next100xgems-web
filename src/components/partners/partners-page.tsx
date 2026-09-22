import Link from "next/link";

import { Container, EmptyState, InstrumentRule, Panel, Section, SectionHeader, StatusLabel } from "@/components/ui";

import { partnerReviewPrinciples, partnerVisibilityOptions, sponsorReviewReasons } from "@/components/commercial/commercial-content";

function SectionMarker({ number, label }: { number: string; label: string }) {
  return <p className="mb-4 font-mono text-[0.625rem] font-semibold uppercase tracking-[0.2em] text-[var(--n100-accent)]">{number} / {label}</p>;
}

function PartnerLink({ children, href, primary = false }: { children: React.ReactNode; href: string; primary?: boolean }) {
  return <Link href={href} className={primary ? "inline-flex min-h-11 items-center justify-center rounded-[var(--n100-radius-control)] bg-[var(--n100-accent)] px-5 text-sm font-semibold text-[var(--n100-accent-ink)] transition-colors hover:bg-[var(--n100-accent-strong)]" : "inline-flex min-h-11 items-center justify-center rounded-[var(--n100-radius-control)] border border-[var(--n100-border-strong)] px-5 text-sm font-semibold text-[var(--n100-text-primary)] transition-colors hover:border-[var(--n100-accent)] hover:text-[var(--n100-accent)]"}>{children}</Link>;
}

export default function PartnersPageContent({ featuredPartnersEnabled }: { featuredPartnersEnabled: boolean }) {
  return (
    <>
      <Section className="border-b border-[var(--n100-border-subtle)] bg-[var(--n100-surface-commercial)]">
        <Container size="wide" className="py-20 sm:py-28">
          <div className="grid gap-12 lg:grid-cols-[1fr_0.7fr] lg:items-end lg:gap-20">
            <div>
              <SectionMarker number="01" label="Featured Partners" />
              <h1 className="max-w-4xl text-4xl font-semibold leading-[1.02] tracking-[-0.055em] text-[var(--n100-text-primary)] sm:text-6xl">Longer-term commercial relationships, clearly disclosed.</h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-[var(--n100-text-secondary)] sm:text-lg">Featured Partners is a commercial relationship program for selected project collaborations. It is separate from advertising placements, editorial coverage, Radar intelligence, and research conclusions.</p>
            </div>
            <Panel family="commercial" padding="lg">
              <div className="flex flex-wrap gap-2"><StatusLabel kind="partner" /><StatusLabel kind="sponsored" /></div>
              <p className="mt-5 text-lg leading-7 text-[var(--n100-text-primary)]">Commercial relationship ≠ analytical endorsement.</p>
              <InstrumentRule className="mt-6" />
            </Panel>
          </div>
        </Container>
      </Section>

      <Section id="definition">
        <Container size="wide">
          <SectionHeader eyebrow="02 / Program definition" title="What a Featured Partner is." description="A Featured Partner is a longer-term commercial relationship with visible PARTNER treatment and an agreed scope of visibility." />
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <Panel tone="subtle" padding="lg">
              <h2 className="text-2xl font-semibold tracking-[-0.035em] text-[var(--n100-text-primary)]">A relationship layer.</h2>
              <p className="mt-4 text-sm leading-6 text-[var(--n100-text-secondary)]">The program can give an eligible project a consistent commercial presence across applicable NEXT100XGEMS surfaces. It does not create a project record, investment approval, or editorial shortcut.</p>
              <div className="mt-6 flex flex-wrap gap-2"><StatusLabel kind="partner" /><StatusLabel kind="advertisement" /><StatusLabel kind="editorial" /><StatusLabel kind="radar" /></div>
            </Panel>
            <Panel tone="subtle" padding="lg">
              <h2 className="text-2xl font-semibold tracking-[-0.035em] text-[var(--n100-text-primary)]">What it is not.</h2>
              <ul className="mt-5 divide-y divide-[var(--n100-border-subtle)] border-y border-[var(--n100-border-subtle)]">{["Advertising inventory for a single campaign", "Independent editorial coverage", "Radar intelligence or a Radar ranking", "A verified or approved investment label"].map((item) => <li key={item} className="py-3 text-sm text-[var(--n100-text-secondary)]">{item}</li>)}</ul>
            </Panel>
          </div>
        </Container>
      </Section>

      <Section id="visibility" className="border-y border-[var(--n100-border-subtle)] bg-[var(--n100-surface-subtle)]">
        <Container size="wide">
          <SectionHeader eyebrow="03 / Visibility and format" title="Possible visibility, scoped to the relationship." description="These are conceptual program surfaces. A relationship may receive some of them, not all of them, based on the agreed scope and applicable availability." />
          <ul className="mt-8 divide-y divide-[var(--n100-border-subtle)] border-y border-[var(--n100-border-subtle)]">{partnerVisibilityOptions.map(([title, description], index) => <li key={title} className="grid gap-3 py-5 sm:grid-cols-[1.1fr_1.9fr] sm:gap-8"><div className="flex gap-3"><span className="font-mono text-xs text-[var(--n100-accent)]">0{index + 1}</span><h3 className="text-sm font-semibold text-[var(--n100-text-primary)]">{title}</h3></div><p className="text-sm leading-6 text-[var(--n100-text-secondary)]">{description}</p></li>)}</ul>
        </Container>
      </Section>

      <Section id="profile-concept">
        <Container size="wide">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:gap-20">
            <div>
              <SectionMarker number="04" label="Future profile concept" />
              <h2 className="text-3xl font-semibold tracking-[-0.045em] text-[var(--n100-text-primary)] sm:text-4xl">Useful context without borrowed credibility.</h2>
              <p className="mt-5 max-w-xl text-sm leading-6 text-[var(--n100-text-secondary)]">Future profiles may collect the facts and commercial context a reader needs to understand the relationship. They will not be presented as certification or investment due diligence.</p>
            </div>
            <Panel tone="subtle" padding="lg">
              <dl className="divide-y divide-[var(--n100-border-subtle)] border-y border-[var(--n100-border-subtle)]">{[["Project overview", "A concise description supplied and reviewed for the relationship."], ["Official links", "Relevant destinations identified as official, where applicable."], ["Campaign context", "The commercial work or scope connected to the relationship."], ["Related coverage", "Applicable sponsored material, kept separate from independent work."], ["Disclosure", "Visible PARTNER treatment wherever the relationship is presented."]].map(([term, detail]) => <div key={term} className="grid gap-1 py-4 sm:grid-cols-[0.9fr_1.5fr] sm:gap-6"><dt className="text-sm font-medium text-[var(--n100-text-primary)]">{term}</dt><dd className="text-sm leading-6 text-[var(--n100-text-tertiary)]">{detail}</dd></div>)}</dl>
            </Panel>
          </div>
        </Container>
      </Section>

      <Section id="independence" className="bg-[var(--n100-surface-secondary)]/35">
        <Container size="wide">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-20">
            <div>
              <SectionMarker number="05" label="Commercial independence" />
              <h2 className="text-3xl font-semibold tracking-[-0.045em] text-[var(--n100-text-primary)] sm:text-5xl">Visibility can be purchased. Intelligence cannot.</h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-[var(--n100-text-secondary)]">Featured Partners do not influence Radar output, independent research, or organic editorial work.</p>
            </div>
            <Panel family="commercial" padding="lg">
              <p className="text-xl font-semibold tracking-[-0.03em] text-[var(--n100-text-primary)]">Commercial relationship ≠ analytical endorsement.</p>
              <ul className="mt-6 divide-y divide-[var(--n100-sponsored)]/20 border-y border-[var(--n100-sponsored)]/20">{["Radar Score", "Radar ranking", "Radar risk assessment", "Organic trending status", "Independent research conclusions", "Independent editorial conclusions"].map((item) => <li key={item} className="flex items-center justify-between gap-4 py-3 text-sm text-[var(--n100-text-secondary)]"><span>{item}</span><span className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-[var(--n100-sponsored)]">NOT FOR SALE</span></li>)}</ul>
              <p className="mt-5 text-sm font-semibold leading-6 text-[var(--n100-text-primary)]">Featured Partners do not become verified, trusted, or approved investments through this program.</p>
            </Panel>
          </div>
        </Container>
      </Section>

      <Section id="current-state">
        <Container size="wide">
          <SectionHeader eyebrow="06 / Current partners" title="A deliberate empty state." description="No verified partner records are available for this release. The program explanation remains available without inventing a partner directory." />
          <div className="mt-8 grid gap-6 lg:grid-cols-[1.25fr_0.75fr] lg:items-stretch">
            <EmptyState title="No Featured Partners are currently published." description="When a relationship is ready to be presented, it will be labeled PARTNER and described with its applicable commercial context." />
            <Panel tone="subtle" padding="lg">
              <StatusLabel kind="partner" />
              <p className="mt-5 text-sm leading-6 text-[var(--n100-text-secondary)]">{featuredPartnersEnabled ? "The program is configured for future availability, but no partner records are currently published." : "Featured Partner inventory is not currently active. This informational page does not imply active partner availability."}</p>
            </Panel>
          </div>
        </Container>
      </Section>

      <Section id="review" className="border-y border-[var(--n100-border-subtle)] bg-[var(--n100-surface-subtle)]">
        <Container size="wide">
          <div className="grid gap-8 lg:grid-cols-2 lg:gap-16">
            <div>
              <SectionMarker number="07" label="Partner review principles" />
              <h2 className="text-3xl font-semibold tracking-[-0.045em] text-[var(--n100-text-primary)] sm:text-4xl">Commercial fit is reviewed before visibility.</h2>
              <p className="mt-5 max-w-xl text-sm leading-6 text-[var(--n100-text-secondary)]">Review is a commercial safety and fit check. It is not a certification, investment recommendation, or substitute for independent due diligence.</p>
              <ul className="mt-6 space-y-3">{partnerReviewPrinciples.map((item) => <li key={item} className="border-l-2 border-[var(--n100-border-strong)] pl-4 text-sm leading-6 text-[var(--n100-text-secondary)]">{item}</li>)}</ul>
            </div>
            <Panel tone="subtle" padding="lg">
              <h3 className="text-lg font-semibold text-[var(--n100-text-primary)]">Obvious exclusions</h3>
              <ul className="mt-5 space-y-4">{sponsorReviewReasons.map((reason) => <li key={reason} className="text-sm leading-6 text-[var(--n100-text-secondary)]">{reason}</li>)}</ul>
            </Panel>
          </div>
        </Container>
      </Section>

      <Section className="border-b border-[var(--n100-border-subtle)] bg-[var(--n100-surface-commercial)]">
        <Container size="reading" className="text-center">
          <SectionMarker number="08" label="Next step" />
          <h2 className="text-3xl font-semibold tracking-[-0.045em] text-[var(--n100-text-primary)] sm:text-4xl">Build a relationship with clear terms.</h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-[var(--n100-text-secondary)]">Discuss a potential partnership or review the available sponsored media pathway. No partner profile or campaign is created by this page.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3"><PartnerLink href="/work-with-us" primary>Work With Us</PartnerLink><PartnerLink href="/advertise">Advertise</PartnerLink></div>
        </Container>
      </Section>
    </>
  );
}
