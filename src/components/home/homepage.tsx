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

import {
  distributionChannels,
  intelligenceLabels,
  methodologyRows,
  radarDimensions,
  radarStages,
  researchPillars,
  trustSignals,
} from "./homepage-content";

export type HomepageFlags = {
  radarEnabled: boolean;
  researchEnabled: boolean;
  featuredPartnersEnabled: boolean;
  newsletterEnabled: boolean;
};

function HomeLink({
  children,
  href,
  variant = "secondary",
}: {
  children: React.ReactNode;
  href: string;
  variant?: "primary" | "secondary";
}) {
  return (
    <Link
      href={href}
      className={
        variant === "primary"
          ? "inline-flex min-h-11 items-center justify-center rounded-[var(--n100-radius-control)] bg-[var(--n100-accent)] px-5 text-sm font-semibold text-[var(--n100-accent-ink)] transition-colors hover:bg-[var(--n100-accent-strong)]"
          : "inline-flex min-h-11 items-center justify-center rounded-[var(--n100-radius-control)] border border-[var(--n100-border-strong)] px-5 text-sm font-semibold text-[var(--n100-text-primary)] transition-colors hover:border-[var(--n100-accent)] hover:text-[var(--n100-accent)]"
      }
    >
      {children}
    </Link>
  );
}

function SectionMarker({ number, label }: { number: string; label: string }) {
  return (
    <p className="mb-4 font-mono text-[0.625rem] font-semibold uppercase tracking-[0.2em] text-[var(--n100-accent)]">
      {number} / {label}
    </p>
  );
}

function Hero() {
  return (
    <section aria-labelledby="hero-heading" className="border-b border-[var(--n100-border-subtle)]">
      <Container size="wide" className="py-14 sm:py-20 lg:py-24">
        <div className="grid items-end gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)] lg:gap-16">
          <div>
            <SectionMarker number="01" label="Intelligence desk" />
            <h1
              id="hero-heading"
              className="max-w-4xl text-4xl font-semibold leading-[0.98] tracking-[-0.065em] text-[var(--n100-text-primary)] sm:text-6xl lg:text-7xl"
            >
              Crypto moves fast.
              <span className="mt-2 block text-[var(--n100-accent)]">Your intelligence should stay sourced.</span>
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-7 text-[var(--n100-text-secondary)] sm:text-lg">
              NEXT100XGEMS is a premium financial intelligence terminal × crypto publication: Radar for reviewable market
              context, Research for editorial frame, and commercial inventory kept visibly apart.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <HomeLink href="/radar" variant="primary">
                Open Radar
              </HomeLink>
              <HomeLink href="/methodology">Methodology</HomeLink>
            </div>
            <p className="mt-5 max-w-xl text-xs leading-5 text-[var(--n100-text-tertiary)]">
              Watch-only intelligence. No fabricated metrics. Public publishing remains subject to human review.
            </p>
          </div>

          <Panel family="radar" padding="lg" className="relative overflow-hidden">
            <div className="flex items-center justify-between gap-4 border-b border-[var(--n100-radar)]/20 pb-4">
              <div>
                <p className="font-mono text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-[var(--n100-radar)]">
                  Desk · operating frame
                </p>
                <p className="mt-2 text-sm font-medium text-[var(--n100-text-primary)]">Evidence before verdict.</p>
              </div>
              <StatusLabel kind="radar" />
            </div>
            <div className="py-7">
              <div className="flex flex-wrap items-center gap-2 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-[var(--n100-text-secondary)]">
                <span>Discover</span>
                <span className="text-[var(--n100-accent)]">→</span>
                <span>Review</span>
                <span className="text-[var(--n100-accent)]">→</span>
                <span>Context</span>
              </div>
              <InstrumentRule className="mt-5" />
            </div>
            <dl className="grid gap-4 border-t border-[var(--n100-border-subtle)] pt-5 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[var(--n100-text-tertiary)]">Operating mode</dt>
                <dd className="mt-1 text-[var(--n100-text-primary)]">Human-reviewed</dd>
              </div>
              <div>
                <dt className="text-[var(--n100-text-tertiary)]">Publication</dt>
                <dd className="mt-1 text-[var(--n100-text-primary)]">Not automatic by default</dd>
              </div>
            </dl>
          </Panel>
        </div>
      </Container>
    </section>
  );
}

function DeskModules({
  radarEnabled,
  researchEnabled,
  featuredPartnersEnabled,
}: {
  radarEnabled: boolean;
  researchEnabled: boolean;
  featuredPartnersEnabled: boolean;
}) {
  return (
    <section aria-label="Intelligence desk modules" className="border-b border-[var(--n100-border-subtle)] bg-[var(--n100-surface-subtle)]">
      <Container size="wide" className="py-8 sm:py-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-[var(--n100-text-tertiary)]">
              02 / Desk modules
            </p>
            <h2 className="mt-2 text-lg font-semibold tracking-[-0.02em] text-[var(--n100-text-primary)] sm:text-xl">
              Radar · Research · Commercial — kept distinct.
            </h2>
          </div>
          <p className="max-w-md text-xs leading-5 text-[var(--n100-text-tertiary)]">
            Organic intelligence and paid inventory never share the same visual lane.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-12">
          {/* Radar pulse strip */}
          <Panel family="radar" padding="md" className="lg:col-span-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-[var(--n100-radar)]">
                  Radar pulse
                </p>
                <h3 className="mt-2 text-base font-semibold text-[var(--n100-text-primary)]">Watch-only instrument strip</h3>
              </div>
              <StatusLabel kind="radar" />
            </div>
            <ol className="mt-5 grid grid-cols-5 gap-1 border-t border-[var(--n100-radar)]/25 pt-4">
              {radarStages.map((stage) => (
                <li key={stage.number} className="min-w-0">
                  <p className="font-mono text-[0.55rem] text-[var(--n100-radar)]">{stage.number}</p>
                  <p className="mt-1 truncate text-[0.55rem] font-semibold uppercase tracking-[0.1em] text-[var(--n100-text-primary)]">
                    {stage.label}
                  </p>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-xs leading-5 text-[var(--n100-text-secondary)]">
              {radarEnabled
                ? "Approved Radar records carry status, freshness, risk, and evidence — never a silent fill."
                : "The public Radar feed is not presented as live on this desk. No invented scores or charts."}
            </p>
            <div className="mt-4">
              <HomeLink href="/radar">Explore Radar</HomeLink>
            </div>
          </Panel>

          {/* Research strip */}
          <Panel family="editorial" padding="md" className="lg:col-span-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-[var(--n100-editorial)]">
                  Research strip
                </p>
                <h3 className="mt-2 text-base font-semibold text-[var(--n100-text-primary)]">Editorial frame for signals</h3>
              </div>
              <DisclosureLabel kind="editorial" />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-[var(--n100-border-subtle)] pt-4">
              {["TL;DR", "KEY FACTS", "SOURCES", "DISCLOSURE"].map((item) => (
                <p key={item} className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-[var(--n100-text-secondary)]">
                  {item}
                </p>
              ))}
            </div>
            <p className="mt-4 text-xs leading-5 text-[var(--n100-text-secondary)]">
              {researchEnabled
                ? "Publication anatomy is ready; this desk does not invent article metrics."
                : "The editorial library is not presented as published here."}
            </p>
            <div className="mt-4">
              <HomeLink href="/research">Explore Research</HomeLink>
            </div>
          </Panel>

          {/* Commercial rail — SPONSORED */}
          <Panel family="commercial" padding="md" className="lg:col-span-3" aria-label="Sponsored commercial rail">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="font-mono text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-[var(--n100-sponsored)]">
                Commercial rail
              </p>
              <DisclosureLabel kind="sponsored" />
            </div>
            <h3 className="mt-3 text-base font-semibold text-[var(--n100-text-primary)]">SPONSORED ≠ organic</h3>
            <p className="mt-3 text-xs leading-5 text-[var(--n100-text-secondary)]">
              Paid inventory is warmer, labeled, and firewalled from Radar rankings and independent research conclusions.
            </p>
            <p className="mt-4 border-t border-[var(--n100-sponsored)]/25 pt-3 text-[0.625rem] leading-4 text-[var(--n100-text-tertiary)]">
              {featuredPartnersEnabled
                ? "No verified partner records are featured in this release."
                : "Featured Partners surface is gated; no client logos or traffic claims."}
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <HomeLink href="/work-with-us" variant="primary">
                Work With Us
              </HomeLink>
              <HomeLink href="/partners">Partners</HomeLink>
            </div>
          </Panel>
        </div>
      </Container>
    </section>
  );
}

function TrustBand() {
  return (
    <section aria-label="Trust network" className="border-b border-[var(--n100-border-subtle)]">
      <Container size="wide" className="py-6 sm:py-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
          <div className="max-w-sm">
            <p className="font-mono text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-[var(--n100-text-tertiary)]">
              03 / Trust network
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--n100-text-secondary)]">
              One intelligence practice, distributed through confirmed crypto-native channel types.
            </p>
          </div>
          <div
            className="flex flex-wrap gap-x-5 gap-y-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--n100-text-primary)]"
            aria-label="Confirmed distribution channel types"
          >
            {distributionChannels.map((channel) => (
              <span key={channel}>{channel}</span>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-[var(--n100-text-tertiary)]">
            {trustSignals.map((signal) => (
              <span key={signal}>{signal}</span>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}

function RadarSection({ enabled }: { enabled: boolean }) {
  return (
    <Section aria-labelledby="radar-heading">
      <Container size="wide">
        <SectionHeader
          eyebrow="04 / Radar intelligence"
          title="Next100XGEMS Radar"
          description="A watch-only intelligence product that surfaces market activity, signals, and risk context without disguising uncertainty as a verdict."
          action={<HomeLink href="/radar">Explore Radar</HomeLink>}
        />
        <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Panel family="radar" padding="lg" className="flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-[var(--n100-radar)]">
                    Intelligence workflow
                  </p>
                  <h3
                    id="radar-heading"
                    className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-[var(--n100-text-primary)]"
                  >
                    From signal to sourceable context.
                  </h3>
                </div>
                <StatusLabel kind="verified-data" />
              </div>
              <p className="mt-5 max-w-xl text-sm leading-6 text-[var(--n100-text-secondary)]">
                Radar brings evidence, model-assisted interpretation, freshness, and risk context into one reviewable
                surface.
              </p>
            </div>
            <div className="mt-10 grid gap-3 sm:grid-cols-5">
              {radarStages.map((stage, index) => (
                <div
                  key={stage.number}
                  className="relative border-t border-[var(--n100-radar)]/40 pt-3 sm:border-l sm:border-t-0 sm:pl-3"
                >
                  {index < radarStages.length - 1 ? (
                    <span aria-hidden="true" className="absolute right-[-0.55rem] top-[-0.25rem] hidden text-[var(--n100-radar)] sm:block">
                      →
                    </span>
                  ) : null}
                  <p className="font-mono text-[0.625rem] text-[var(--n100-radar)]">{stage.number}</p>
                  <p className="mt-2 text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-[var(--n100-text-primary)]">
                    {stage.label}
                  </p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel family="editorial" padding="lg">
            <p className="font-mono text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-[var(--n100-text-tertiary)]">
              Evidence states
            </p>
            <h3 className="mt-3 text-xl font-semibold tracking-[-0.03em] text-[var(--n100-text-primary)]">
              Evidence is not a verdict.
            </h3>
            <div className="mt-6 space-y-4">
              {intelligenceLabels.map(([kind, , description]) => (
                <div
                  key={kind}
                  className="flex items-start gap-3 border-b border-[var(--n100-border-subtle)]/80 pb-4 last:border-0 last:pb-0"
                >
                  <StatusLabel kind={kind} />
                  <p className="text-sm leading-5 text-[var(--n100-text-secondary)]">{description}</p>
                </div>
              ))}
            </div>
            <p className="mt-7 border-t border-[var(--n100-border-subtle)] pt-5 text-xs leading-5 text-[var(--n100-text-tertiary)]">
              {enabled
                ? "Radar intelligence is presented with review status, sources, freshness, and risk context."
                : "The public Radar feed is not presented as live here. Its publishing path remains staged behind review and availability controls."}
            </p>
          </Panel>
        </div>
      </Container>
    </Section>
  );
}

function RadarProcess() {
  return (
    <section
      aria-labelledby="process-heading"
      className="border-y border-[var(--n100-border-subtle)] bg-[var(--n100-surface-secondary)]/35"
    >
      <Container size="wide" className="py-14 sm:py-16">
        <div className="max-w-2xl">
          <SectionMarker number="05" label="How Radar works" />
          <h2
            id="process-heading"
            className="text-3xl font-semibold tracking-[-0.045em] text-[var(--n100-text-primary)] sm:text-4xl"
          >
            A process designed to keep uncertainty visible.
          </h2>
          <p className="mt-4 text-sm leading-6 text-[var(--n100-text-secondary)]">
            The system can detect and analyze automatically. Automatic public publishing is not the default.
          </p>
        </div>
        <ol className="mt-10 grid gap-px overflow-hidden border border-[var(--n100-border-subtle)] bg-[var(--n100-border-subtle)] sm:grid-cols-2 lg:grid-cols-5">
          {radarStages.map((stage) => (
            <li key={stage.number} className="bg-[var(--n100-canvas)] p-5 sm:min-h-44">
              <p className="font-mono text-xs text-[var(--n100-accent)]">{stage.number}</p>
              <h3 className="mt-7 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--n100-text-primary)]">
                {stage.label}
              </h3>
              <p className="mt-3 text-sm leading-5 text-[var(--n100-text-tertiary)]">{stage.description}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

function ResearchSection({ enabled }: { enabled: boolean }) {
  return (
    <Section aria-labelledby="research-heading">
      <Container size="wide">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div>
            <SectionMarker number="06" label="First-party research" />
            <h2
              id="research-heading"
              className="max-w-xl text-3xl font-semibold tracking-[-0.045em] text-[var(--n100-text-primary)] sm:text-4xl"
            >
              Research that gives signals a frame.
            </h2>
            <p className="mt-5 max-w-xl text-sm leading-6 text-[var(--n100-text-secondary)]">
              A publication-style layer for explaining what happened, what matters, and what remains uncertain. Every
              article should make its evidence and limits easy to find.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <HomeLink href="/research">Explore Research</HomeLink>
            </div>
            <p className="mt-5 max-w-md text-xs leading-5 text-[var(--n100-text-tertiary)]">
              {enabled
                ? "The editorial structure is ready for a sourced research library; no article records are rendered on this page."
                : "The editorial library is not presented as published here. Its release remains tied to sourcing and review readiness."}
            </p>
          </div>
          <Panel family="editorial" padding="lg">
            <div className="flex items-center justify-between gap-4 border-b border-[var(--n100-border-subtle)] pb-5">
              <div>
                <p className="font-mono text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-[var(--n100-editorial)]">
                  Editorial anatomy
                </p>
                <h3 className="mt-3 text-xl font-semibold tracking-[-0.03em] text-[var(--n100-text-primary)]">
                  A clear path through the argument.
                </h3>
              </div>
              <DisclosureLabel kind="editorial" />
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="border-l-2 border-[var(--n100-editorial)]/40 pl-4">
                <p className="font-mono text-xs text-[var(--n100-text-primary)]">TL;DR</p>
                <p className="mt-2 text-sm leading-5 text-[var(--n100-text-tertiary)]">The conclusion before the detail.</p>
              </div>
              <div className="border-l-2 border-[var(--n100-editorial)]/40 pl-4">
                <p className="font-mono text-xs text-[var(--n100-text-primary)]">KEY FACTS</p>
                <p className="mt-2 text-sm leading-5 text-[var(--n100-text-tertiary)]">The observations that support it.</p>
              </div>
              <div className="border-l-2 border-[var(--n100-editorial)]/40 pl-4">
                <p className="font-mono text-xs text-[var(--n100-text-primary)]">SOURCES</p>
                <p className="mt-2 text-sm leading-5 text-[var(--n100-text-tertiary)]">A trail back to the evidence.</p>
              </div>
              <div className="border-l-2 border-[var(--n100-editorial)]/40 pl-4">
                <p className="font-mono text-xs text-[var(--n100-text-primary)]">DISCLOSURE</p>
                <p className="mt-2 text-sm leading-5 text-[var(--n100-text-tertiary)]">
                  The relationship and limits in plain sight.
                </p>
              </div>
            </div>
            <div className="mt-8 border-t border-[var(--n100-border-subtle)] pt-5">
              <p className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-[var(--n100-text-tertiary)]">
                Research pillars
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {researchPillars.map(([label, description]) => (
                  <div key={label}>
                    <p className="text-sm font-medium text-[var(--n100-text-primary)]">{label}</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--n100-text-tertiary)]">{description}</p>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </div>
      </Container>
    </Section>
  );
}

function IntelligenceSection() {
  return (
    <Section aria-label="Market intelligence" className="bg-[var(--n100-surface-subtle)]">
      <Container size="wide">
        <SectionHeader
          eyebrow="07 / Market intelligence"
          title="The dimensions behind the signal."
          description="NEXT100XGEMS evaluates market activity through several lenses, keeping measurable evidence separate from interpretation."
        />
        <div className="mt-8 grid gap-x-8 gap-y-0 sm:grid-cols-2 lg:grid-cols-3">
          {radarDimensions.map(([label, description], index) => (
            <div key={label} className="border-b border-[var(--n100-border-subtle)] py-5">
              <p className="font-mono text-[0.625rem] text-[var(--n100-accent)]">0{index + 1}</p>
              <h3 className="mt-3 text-sm font-semibold text-[var(--n100-text-primary)]">{label}</h3>
              <p className="mt-2 text-sm leading-5 text-[var(--n100-text-tertiary)]">{description}</p>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}

function FeaturedPartnersSection() {
  return (
    <Section aria-labelledby="partners-heading">
      <Container size="wide">
        <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:items-end">
          <div>
            <SectionMarker number="08" label="Commercial relationships" />
            <h2
              id="partners-heading"
              className="text-3xl font-semibold tracking-[-0.045em] text-[var(--n100-text-primary)] sm:text-4xl"
            >
              Featured Partners, clearly separated.
            </h2>
          </div>
          <Panel family="commercial" padding="lg">
            <div className="flex flex-wrap gap-2">
              <DisclosureLabel kind="partner" />
              <DisclosureLabel kind="sponsored" />
            </div>
            <h3 className="mt-5 text-xl font-semibold tracking-[-0.03em] text-[var(--n100-text-primary)]">
              A commercial program without editorial shortcuts.
            </h3>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--n100-text-secondary)]">
              There are no verified partner records to feature in this release. When relationships are presented, they
              will be labeled as commercial and kept distinct from independent work.
            </p>
            <p className="mt-5 border-t border-[var(--n100-sponsored)]/20 pt-5 text-sm leading-6 text-[var(--n100-text-tertiary)]">
              Featured Partners do not influence Radar rankings, Radar scores, risk assessments, or independent research
              conclusions.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <HomeLink href="/partners">Explore Partners</HomeLink>
              <HomeLink href="/work-with-us">Work With Us</HomeLink>
            </div>
          </Panel>
        </div>
      </Container>
    </Section>
  );
}

function WorkWithUsSection() {
  return (
    <section
      aria-labelledby="work-heading"
      className="border-y border-[var(--n100-border-subtle)] bg-[var(--n100-surface-commercial)]"
    >
      <Container size="wide" className="py-14 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-3xl">
            <div className="mb-4 flex flex-wrap gap-2">
              <DisclosureLabel kind="sponsored" />
              <DisclosureLabel kind="advertisement" />
            </div>
            <SectionMarker number="09" label="For crypto projects" />
            <h2
              id="work-heading"
              className="text-3xl font-semibold tracking-[-0.045em] text-[var(--n100-text-primary)] sm:text-5xl"
            >
              Reach crypto-native audiences with context.
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--n100-text-secondary)]">
              Work with NEXT100XGEMS through clearly disclosed media, intelligence-adjacent inventory, and multi-platform
              distribution.
            </p>
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--n100-text-tertiary)]">
              <span>Sponsored Content</span>
              <span>Campaigns</span>
              <span>AMA</span>
              <span>Social Distribution</span>
              <span>Content Production</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 lg:justify-end">
            <HomeLink href="/work-with-us" variant="primary">
              Work With Us
            </HomeLink>
            <HomeLink href="/advertise">Advertise</HomeLink>
          </div>
        </div>
      </Container>
    </section>
  );
}

function ProofSection() {
  return (
    <Section aria-labelledby="proof-heading">
      <Container size="wide">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
          <div>
            <SectionMarker number="10" label="Proof standard" />
            <h2
              id="proof-heading"
              className="text-3xl font-semibold tracking-[-0.045em] text-[var(--n100-text-primary)] sm:text-4xl"
            >
              Proof, not promises.
            </h2>
            <p className="mt-5 max-w-md text-sm leading-6 text-[var(--n100-text-secondary)]">
              Case studies will be published only when campaign outcomes can be sourced, checked, and understood in
              context.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <Panel family="editorial" padding="lg">
              <p className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-[var(--n100-editorial)]">
                What belongs here
              </p>
              <h3 className="mt-4 text-lg font-semibold text-[var(--n100-text-primary)]">Sourceable outcomes.</h3>
              <p className="mt-3 text-sm leading-6 text-[var(--n100-text-tertiary)]">
                Clear scope, defined inputs, verifiable results, and enough context for a reader to judge the work.
              </p>
            </Panel>
            <Panel tone="quiet" padding="lg">
              <p className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-[var(--n100-text-tertiary)]">
                What does not belong here
              </p>
              <h3 className="mt-4 text-lg font-semibold text-[var(--n100-text-primary)]">Uncheckable performance claims.</h3>
              <p className="mt-3 text-sm leading-6 text-[var(--n100-text-tertiary)]">
                No invented reach, clicks, returns, funds raised, or anonymous success stories.
              </p>
            </Panel>
          </div>
        </div>
      </Container>
    </Section>
  );
}

function NetworkSection() {
  return (
    <Section aria-labelledby="network-heading" className="bg-[var(--n100-surface-subtle)]">
      <Container size="wide">
        <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div>
            <SectionMarker number="11" label="Distribution network" />
            <h2
              id="network-heading"
              className="text-3xl font-semibold tracking-[-0.045em] text-[var(--n100-text-primary)] sm:text-4xl"
            >
              Research and distribution in the same network.
            </h2>
            <p className="mt-5 max-w-xl text-sm leading-6 text-[var(--n100-text-secondary)]">
              The public network spans confirmed channel types so useful context can travel in the places crypto-native
              audiences already spend time.
            </p>
            <div className="mt-7">
              <HomeLink href="/network">Explore Network</HomeLink>
            </div>
          </div>
          <Panel tone="subtle" padding="lg">
            <p className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-[var(--n100-text-tertiary)]">
              Confirmed channel types
            </p>
            <div className="mt-6 divide-y divide-[var(--n100-border-subtle)]">
              {distributionChannels.map((channel, index) => (
                <div key={channel} className="flex items-center justify-between py-4">
                  <span className="text-lg font-medium text-[var(--n100-text-primary)]">{channel}</span>
                  <span className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-[var(--n100-text-tertiary)]">
                    CHANNEL 0{index + 1}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-5 text-xs leading-5 text-[var(--n100-text-tertiary)]">
              No follower counts or unverified social URLs are presented here.
            </p>
          </Panel>
        </div>
      </Container>
    </Section>
  );
}

function MethodologySection() {
  return (
    <Section aria-label="Methodology and transparency">
      <Container size="wide">
        <SectionHeader
          eyebrow="12 / Methodology & transparency"
          title="Different work. Different labels."
          description="The reader should always be able to tell whether something is Radar intelligence, independent editorial, or a commercial relationship."
        />
        <div className="mt-8 grid gap-0 border border-[var(--n100-border-subtle)]">
          {methodologyRows.map(([kind, label, description]) => (
            <div
              key={label}
              className="grid gap-4 border-b border-[var(--n100-border-subtle)] p-5 last:border-b-0 sm:grid-cols-[10rem_1fr] sm:items-start sm:p-6"
            >
              <div>
                <StatusLabel kind={kind} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[var(--n100-text-primary)]">{label}</h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--n100-text-secondary)]">{description}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8 flex flex-col gap-5 border-l-2 border-[var(--n100-accent)] pl-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
          <p className="text-xl font-semibold tracking-[-0.03em] text-[var(--n100-text-primary)]">
            Sponsored ≠ Radar ranking.
          </p>
          <div className="flex flex-wrap gap-3">
            <HomeLink href="/methodology">Read Methodology</HomeLink>
            <HomeLink href="/disclosures">Disclosures</HomeLink>
          </div>
        </div>
      </Container>
    </Section>
  );
}

function AlertsSection({ enabled }: { enabled: boolean }) {
  return (
    <section
      aria-labelledby="alerts-heading"
      className="border-t border-[var(--n100-border-subtle)] bg-[var(--n100-surface-secondary)]/35"
    >
      <Container size="reading" className="py-14 text-center sm:py-16">
        <SectionMarker number="13" label="Alerts" />
        <h2
          id="alerts-heading"
          className="text-2xl font-semibold tracking-[-0.04em] text-[var(--n100-text-primary)] sm:text-3xl"
        >
          Useful updates, when the delivery path is ready.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-[var(--n100-text-secondary)]">
          Research alerts, Radar updates, and market intelligence belong here. No subscription form is active until a
          delivery provider and privacy path are confirmed.
        </p>
        <p className="mt-5 font-mono text-[0.625rem] uppercase tracking-[0.16em] text-[var(--n100-text-tertiary)]">
          {enabled ? "Alerts proposition prepared" : "Alerts proposition only"}
        </p>
      </Container>
    </section>
  );
}

export default function Homepage({ flags }: { flags: HomepageFlags }) {
  return (
    <>
      <Hero />
      <DeskModules
        radarEnabled={flags.radarEnabled}
        researchEnabled={flags.researchEnabled}
        featuredPartnersEnabled={flags.featuredPartnersEnabled}
      />
      <TrustBand />
      <RadarSection enabled={flags.radarEnabled} />
      <RadarProcess />
      <ResearchSection enabled={flags.researchEnabled} />
      <IntelligenceSection />
      {flags.featuredPartnersEnabled ? <FeaturedPartnersSection /> : null}
      <WorkWithUsSection />
      <ProofSection />
      <NetworkSection />
      <MethodologySection />
      <AlertsSection enabled={flags.newsletterEnabled} />
    </>
  );
}
