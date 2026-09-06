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

import { commercialServices, contentClassifications } from "./trust-content";

function SectionMarker({ number, label }: { number: string; label: string }) {
  return (
    <p className="mb-4 font-mono text-[0.625rem] font-semibold uppercase tracking-[0.2em] text-[var(--n100-accent)]">
      {number} / {label}
    </p>
  );
}

function DisclosureLink({ children, href }: { children: React.ReactNode; href: string }) {
  return <Link href={href} className="text-sm font-semibold text-[var(--n100-text-primary)] underline decoration-[var(--n100-border-strong)] underline-offset-4 hover:text-[var(--n100-accent)] hover:decoration-[var(--n100-accent)]">{children}</Link>;
}

function ClassificationLabel({ kind }: { kind: StatusKind }) {
  return kind === "radar" ? <StatusLabel kind={kind} /> : <DisclosureLabel kind={kind as DisclosureKind} />;
}

export default function DisclosuresPageContent() {
  return (
    <>
      <Section className="border-b border-[var(--n100-border-subtle)]">
        <Container size="reading">
          <SectionMarker number="01" label="Public disclosures" />
          <h1 className="text-4xl font-semibold leading-[1.02] tracking-[-0.055em] text-[var(--n100-text-primary)] sm:text-6xl">Clarity about what you are reading.</h1>
          <p className="mt-6 text-base leading-7 text-[var(--n100-text-secondary)] sm:text-lg">NEXT100XGEMS publishes crypto intelligence, research, media, and commercial content for informational purposes. This page explains the important distinctions and limitations in plain English.</p>
          <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[var(--n100-text-tertiary)]"><a href="#risk-disclosure" className="hover:text-[var(--n100-accent)]">Risk</a><a href="#commercial-disclosure" className="hover:text-[var(--n100-accent)]">Commercial</a><a href="#content-classifications" className="hover:text-[var(--n100-accent)]">Classifications</a><a href="#user-responsibility" className="hover:text-[var(--n100-accent)]">User responsibility</a></div>
        </Container>
      </Section>

      <Section id="informational-purpose">
        <Container size="wide">
          <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:gap-20">
            <div>
              <SectionMarker number="02" label="Informational purpose" />
              <h2 className="text-3xl font-semibold tracking-[-0.045em] text-[var(--n100-text-primary)] sm:text-4xl">Information to help you investigate.</h2>
            </div>
            <p className="text-base leading-7 text-[var(--n100-text-secondary)]">NEXT100XGEMS content is not guaranteed personalized financial advice. It is intended to give readers market context, research, and disclosed media information to support their own evaluation.</p>
          </div>
        </Container>
      </Section>

      <Section id="risk-disclosure" className="bg-[var(--n100-surface-subtle)]">
        <Container size="wide">
          <SectionHeader eyebrow="03 / Risk disclosure" title="Crypto risk is real, material, and changing." description="Crypto assets can be extremely volatile. Users can lose substantial or all of their capital." />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[
            "New and memecoin markets may carry elevated liquidity, manipulation, and technical risks.",
            "Past performance does not guarantee future results.",
            "A review label does not remove market or project risk.",
            "Consider your own circumstances and risk tolerance before acting.",
          ].map((item, index) => <div key={item} className="border-t-2 border-[var(--n100-border-strong)] pt-4"><p className="font-mono text-xs text-[var(--n100-accent)]">0{index + 1}</p><p className="mt-3 text-sm leading-6 text-[var(--n100-text-secondary)]">{item}</p></div>)}</div>
        </Container>
      </Section>

      <Section id="commercial-disclosure" className="bg-[var(--n100-surface-commercial)]">
        <Container size="wide">
          <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:items-center lg:gap-20">
            <div>
              <SectionMarker number="04" label="Commercial disclosure" />
              <h2 className="text-3xl font-semibold tracking-[-0.045em] text-[var(--n100-text-primary)] sm:text-4xl">Paid relationships are labeled, not hidden.</h2>
              <p className="mt-5 text-sm leading-6 text-[var(--n100-text-secondary)]">NEXT100XGEMS may receive compensation for the following disclosed commercial services:</p>
            </div>
            <Panel family="commercial" padding="lg">
              <div className="flex flex-wrap gap-2">{commercialServices.map((service) => <span key={service} className="border border-[var(--n100-sponsored)]/35 px-3 py-2 text-xs font-medium text-[var(--n100-text-primary)]">{service}</span>)}</div>
              <p className="mt-7 border-t border-[var(--n100-sponsored)]/20 pt-5 text-base font-semibold leading-7 text-[var(--n100-text-primary)]">Compensation does not control independent Radar or editorial conclusions.</p>
              <p className="mt-3 text-sm leading-6 text-[var(--n100-text-tertiary)]">Featured Partners, Sponsored material, and Advertisements are distinct from independent research and Radar intelligence.</p>
            </Panel>
          </div>
        </Container>
      </Section>

      <Section id="content-classifications">
        <Container size="wide">
          <SectionHeader eyebrow="05 / Content classifications" title="Labels with different jobs." description="Classification tells you what relationship or production method is present. No label should be inferred only from color." />
          <div className="mt-8 divide-y divide-[var(--n100-border-subtle)] border-y border-[var(--n100-border-subtle)]">{contentClassifications.map(([kind, label, description]) => <div key={label} className="grid gap-4 py-5 sm:grid-cols-[10rem_1fr] sm:items-center"><ClassificationLabel kind={kind} /><p className="max-w-3xl text-sm leading-6 text-[var(--n100-text-secondary)]">{description}</p></div>)}</div>
        </Container>
      </Section>

      <Section id="ai-third-party" className="border-y border-[var(--n100-border-subtle)] bg-[var(--n100-surface-secondary)]/35">
        <Container size="wide">
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel family="editorial" padding="lg">
              <SectionMarker number="06" label="AI-assisted content" />
              <h2 className="text-2xl font-semibold tracking-[-0.035em] text-[var(--n100-text-primary)]">AI assistance is identified, not overstated.</h2>
              <p className="mt-5 text-sm leading-6 text-[var(--n100-text-secondary)]">AI may contribute to organizing, summarizing, comparing, or producing analysis. AI-assisted content does not guarantee correctness and does not replace sourceable information or human judgment.</p>
            </Panel>
            <Panel tone="subtle" padding="lg">
              <SectionMarker number="07" label="Third-party information" />
              <h2 className="text-2xl font-semibold tracking-[-0.035em] text-[var(--n100-text-primary)]">Sources can change.</h2>
              <p className="mt-5 text-sm leading-6 text-[var(--n100-text-secondary)]">External data and source material may be wrong, delayed, unavailable, or changed. A link to an external site does not automatically mean NEXT100XGEMS endorses it.</p>
            </Panel>
          </div>
        </Container>
      </Section>

      <Section id="no-guarantees">
        <Container size="reading">
          <SectionHeader eyebrow="08 / No guarantees" title="Context is not certainty." description="NEXT100XGEMS does not guarantee accuracy, completeness, timeliness, future performance, investment outcome, or the success of a token or project." />
          <div className="mt-7 border-l-2 border-[var(--n100-accent)] pl-5 text-base leading-7 text-[var(--n100-text-secondary)]">Radar is not a promise, a price target, or a substitute for evaluating information independently.</div>
        </Container>
      </Section>

      <Section id="user-responsibility" className="bg-[var(--n100-surface-subtle)]">
        <Container size="wide">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
            <div>
              <SectionMarker number="09" label="User responsibility" />
              <h2 className="text-3xl font-semibold tracking-[-0.045em] text-[var(--n100-text-primary)] sm:text-4xl">Keep your own chain of verification.</h2>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2">{["Verify critical information.", "Review official sources.", "Assess risk independently.", "Consider professional advice where appropriate to your circumstances."].map((item) => <li key={item} className="border-b border-[var(--n100-border-subtle)] pb-4 text-sm leading-6 text-[var(--n100-text-secondary)]">{item}</li>)}</ul>
          </div>
        </Container>
      </Section>

      <Section id="updates-contact" className="border-b border-[var(--n100-border-subtle)]">
        <Container size="wide">
          <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:gap-20">
            <div>
              <SectionMarker number="10" label="Updates & transparency path" />
              <h2 className="text-3xl font-semibold tracking-[-0.045em] text-[var(--n100-text-primary)] sm:text-4xl">Material context should stay visible.</h2>
              <p className="mt-5 text-sm leading-6 text-[var(--n100-text-secondary)]">When material information changes, the relevant content should be corrected or updated in context. This page describes that principle without presenting a formal corrections policy.</p>
            </div>
            <Panel tone="subtle" padding="lg">
              <p className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-[var(--n100-text-tertiary)]">Commercial transparency path</p>
              <p className="mt-4 text-sm leading-6 text-[var(--n100-text-secondary)]">For commercial relationships and clearly disclosed media opportunities, use the public Work With Us and Advertise paths.</p>
              <InstrumentRule className="mt-6" />
              <div className="mt-6 flex flex-wrap gap-4"><DisclosureLink href="/work-with-us">Work With Us</DisclosureLink><DisclosureLink href="/advertise">Advertise</DisclosureLink><DisclosureLink href="/methodology">Methodology</DisclosureLink></div>
            </Panel>
          </div>
        </Container>
      </Section>
    </>
  );
}
