import Link from "next/link";

import { Container, InstrumentRule, Panel, Section, SectionHeader, StatusLabel } from "@/components/ui";

import { campaignTypes, commercialServices, engagementStages, sponsorReviewReasons } from "@/components/commercial/commercial-content";

function SectionMarker({ number, label }: { number: string; label: string }) {
  return <p className="mb-4 font-mono text-[0.625rem] font-semibold uppercase tracking-[0.2em] text-[var(--n100-accent)]">{number} / {label}</p>;
}

function WorkLink({ children, href, variant = "secondary" }: { children: React.ReactNode; href: string; variant?: "primary" | "secondary" }) {
  return <Link href={href} className={variant === "primary" ? "inline-flex min-h-11 items-center justify-center rounded-[var(--n100-radius-control)] bg-[var(--n100-accent)] px-5 text-sm font-semibold text-[#11201a] transition-colors hover:bg-[var(--n100-accent-strong)]" : "inline-flex min-h-11 items-center justify-center rounded-[var(--n100-radius-control)] border border-[var(--n100-border-strong)] px-5 text-sm font-semibold text-[var(--n100-text-primary)] transition-colors hover:border-[var(--n100-accent)] hover:text-[var(--n100-accent)]"}>{children}</Link>;
}

export default function WorkWithUsPageContent({ bookingEnabled }: { bookingEnabled: boolean }) {
  return (
    <>
      <Section className="border-b border-[var(--n100-border-subtle)] bg-[var(--n100-surface-commercial)]">
        <Container size="wide" className="py-20 sm:py-28">
          <div className="grid gap-12 lg:grid-cols-[1fr_0.7fr] lg:items-end lg:gap-20">
            <div>
              <SectionMarker number="01" label="Commercial pathway" />
              <h1 className="max-w-4xl text-4xl font-semibold leading-[1.02] tracking-[-0.055em] text-[var(--n100-text-primary)] sm:text-6xl">Reach crypto-native audiences with context.</h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-[var(--n100-text-secondary)] sm:text-lg">Work with NEXT100XGEMS through clearly disclosed media, intelligence-adjacent inventory, and multi-platform distribution.</p>
              <div className="mt-8 flex flex-wrap gap-3"><WorkLink href="#inquiry" variant="primary">Start an Inquiry</WorkLink><WorkLink href="/advertise">Advertise</WorkLink></div>
            </div>
            <Panel family="commercial" padding="lg">
              <div className="flex flex-wrap gap-2"><StatusLabel kind="sponsored" /><StatusLabel kind="partner" /></div>
              <p className="mt-5 text-lg leading-7 text-[var(--n100-text-primary)]">A commercial path that stays separate from Radar and independent research.</p>
              <InstrumentRule className="mt-6" />
            </Panel>
          </div>
        </Container>
      </Section>

      <Section id="services">
        <Container size="wide">
          <SectionHeader eyebrow="02 / Services" title="Useful campaign building blocks." description="The right scope depends on the project, audience, content, and applicable channels. Pricing and package commitments are not published here." />
          <div className="mt-8 divide-y divide-[var(--n100-border-subtle)] border-y border-[var(--n100-border-subtle)]">
            {commercialServices.map(([service, purpose, deliverable], index) => <article key={service} className="grid gap-4 py-5 lg:grid-cols-[2fr_3fr_2fr] lg:items-start lg:gap-8"><div className="flex gap-3"><span className="font-mono text-xs text-[var(--n100-accent)]">0{index + 1}</span><h3 className="text-sm font-semibold text-[var(--n100-text-primary)]">{service}</h3></div><p className="text-sm leading-6 text-[var(--n100-text-secondary)]">{purpose}</p><p className="text-xs leading-5 text-[var(--n100-text-tertiary)]">{deliverable}</p></article>)}
          </div>
        </Container>
      </Section>

      <Section id="campaign-types" className="bg-[var(--n100-surface-subtle)]">
        <Container size="wide">
          <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:items-center lg:gap-20">
            <div>
              <SectionMarker number="03" label="Campaign types" />
              <h2 className="text-3xl font-semibold tracking-[-0.045em] text-[var(--n100-text-primary)] sm:text-4xl">Start with the moment you need to explain.</h2>
              <p className="mt-5 max-w-xl text-sm leading-6 text-[var(--n100-text-secondary)]">A campaign intent helps define the content, channel mix, and disclosure treatment. It does not imply endorsement or favorable organic coverage.</p>
            </div>
            <Panel tone="subtle" padding="lg">
              <ul className="grid gap-x-8 sm:grid-cols-2">{campaignTypes.map((type) => <li key={type} className="border-b border-[var(--n100-border-subtle)] py-4 text-sm text-[var(--n100-text-primary)]">{type}</li>)}</ul>
            </Panel>
          </div>
        </Container>
      </Section>

      <Section id="engagement-process">
        <Container size="wide">
          <SectionHeader eyebrow="04 / How engagement works" title="A clear path from inquiry to delivery." description="The final scope, channels, timing, deliverables, and reporting expectations are agreed before production begins." />
          <ol className="mt-8 grid gap-px overflow-hidden border border-[var(--n100-border-subtle)] bg-[var(--n100-border-subtle)] sm:grid-cols-2 lg:grid-cols-3">
            {engagementStages.map(([number, label, description]) => <li key={number} className="bg-[var(--n100-canvas)] p-5 sm:min-h-44"><p className="font-mono text-xs text-[var(--n100-accent)]">{number}</p><h3 className="mt-7 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--n100-text-primary)]">{label}</h3><p className="mt-3 text-sm leading-5 text-[var(--n100-text-tertiary)]">{description}</p></li>)}
          </ol>
          <p className="mt-6 text-sm text-[var(--n100-text-tertiary)]">A live reporting dashboard is not represented as available in this foundation.</p>
        </Container>
      </Section>

      <Section id="sponsor-review" className="border-y border-[var(--n100-border-subtle)] bg-[var(--n100-surface-secondary)]/35">
        <Container size="wide">
          <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-start lg:gap-16">
            <div>
              <SectionMarker number="05" label="Sponsor quality review" />
              <h2 className="text-3xl font-semibold tracking-[-0.045em] text-[var(--n100-text-primary)] sm:text-4xl">Commercial work is subject to review.</h2>
              <p className="mt-5 max-w-xl text-sm leading-6 text-[var(--n100-text-secondary)]">Campaigns may be declined when the claims, destination, or creative create unreasonable risk for audiences or the network.</p>
            </div>
            <Panel tone="subtle" padding="lg"><ul className="space-y-4">{sponsorReviewReasons.map((reason) => <li key={reason} className="border-l-2 border-[var(--n100-border-strong)] pl-4 text-sm leading-6 text-[var(--n100-text-secondary)]">{reason}</li>)}</ul></Panel>
          </div>
        </Container>
      </Section>

      <Section id="disclosure-trust">
        <Container size="wide">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:gap-20">
            <div>
              <SectionMarker number="06" label="Disclosure & trust" />
              <h2 className="text-3xl font-semibold tracking-[-0.045em] text-[var(--n100-text-primary)] sm:text-4xl">Commercial activity stays legible.</h2>
              <p className="mt-5 text-sm leading-6 text-[var(--n100-text-secondary)]">SPONSORED means paid placement or content. PARTNER means a commercial relationship. EDITORIAL remains independent. RADAR is intelligence-system output.</p>
            </div>
            <Panel family="commercial" padding="lg">
              <div className="flex flex-wrap gap-2"><StatusLabel kind="sponsored" /><StatusLabel kind="partner" /><StatusLabel kind="editorial" /><StatusLabel kind="radar" /></div>
              <p className="mt-6 text-xl font-semibold tracking-[-0.03em] text-[var(--n100-text-primary)]">Payment does not buy analytical influence.</p>
              <p className="mt-3 text-sm leading-6 text-[var(--n100-text-secondary)]">Paid distribution cannot change Radar scores, rankings, risk ratings, organic trending status, or independent editorial conclusions.</p>
              <div className="mt-6 flex flex-wrap gap-4"><Link className="text-sm font-semibold text-[var(--n100-text-primary)] underline decoration-[var(--n100-border-strong)] underline-offset-4 hover:text-[var(--n100-accent)]" href="/methodology">Methodology</Link><Link className="text-sm font-semibold text-[var(--n100-text-primary)] underline decoration-[var(--n100-border-strong)] underline-offset-4 hover:text-[var(--n100-accent)]" href="/disclosures">Disclosures</Link></div>
            </Panel>
          </div>
        </Container>
      </Section>

      <Section id="inquiry" className="bg-[var(--n100-surface-commercial)]">
        <Container size="wide">
          <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-end lg:gap-20">
            <div>
              <SectionMarker number="07" label="Inquiry options" />
              <h2 className="text-3xl font-semibold tracking-[-0.045em] text-[var(--n100-text-primary)] sm:text-4xl">Bring the context. We can shape the path.</h2>
              <p className="mt-5 max-w-xl text-sm leading-6 text-[var(--n100-text-secondary)]">Choose the kind of conversation that best matches the moment. No contact data is collected by this page.</p>
            </div>
            <Panel family="commercial" padding="lg">
              <div className="divide-y divide-[var(--n100-sponsored)]/20">{["Partnership Inquiry", "Campaign Consultation", "AMA / Launch Planning"].map((option) => <div key={option} className="flex items-center justify-between gap-4 py-4"><span className="text-sm font-medium text-[var(--n100-text-primary)]">{option}</span><span className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-[var(--n100-text-tertiary)]">INQUIRY PATH</span></div>)}</div>
              <p className="mt-6 border-t border-[var(--n100-sponsored)]/20 pt-5 text-sm leading-6 text-[var(--n100-text-tertiary)]">{bookingEnabled ? "A future booking provider can connect to this path. No live booking action is active here." : "Campaign inquiry system is being finalized. No live booking action is active here."}</p>
            </Panel>
          </div>
        </Container>
      </Section>

      <Section className="border-b border-[var(--n100-border-subtle)]">
        <Container size="reading" className="text-center">
          <SectionMarker number="08" label="Next step" />
          <h2 className="text-3xl font-semibold tracking-[-0.045em] text-[var(--n100-text-primary)] sm:text-4xl">Make the message clearer.</h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-[var(--n100-text-secondary)]">For a serious project, a useful first conversation starts with the audience, the moment, the claim, and the proof behind it.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3"><WorkLink href="#inquiry" variant="primary">Start an Inquiry</WorkLink><WorkLink href="/methodology">Review Methodology</WorkLink></div>
        </Container>
      </Section>
    </>
  );
}

