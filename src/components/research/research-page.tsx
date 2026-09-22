import Link from "next/link";

import { Container, EmptyState, InstrumentRule, Panel, Section, SectionHeader, StatusLabel } from "@/components/ui";

import { researchAnatomy, researchCategories, researchClassifications, type ResearchArticleSummary } from "./research-content";

function SectionMarker({ number, label }: { number: string; label: string }) {
  return <p className="mb-4 font-mono text-[0.625rem] font-semibold uppercase tracking-[0.2em] text-[var(--n100-accent)]">{number} / {label}</p>;
}

function ResearchLink({ children, href, primary = false }: { children: React.ReactNode; href: string; primary?: boolean }) {
  return <Link href={href} className={primary ? "inline-flex min-h-11 items-center justify-center rounded-[var(--n100-radius-control)] bg-[var(--n100-accent)] px-5 text-sm font-semibold text-[var(--n100-accent-ink)] transition-colors hover:bg-[var(--n100-accent-strong)]" : "inline-flex min-h-11 items-center justify-center rounded-[var(--n100-radius-control)] border border-[var(--n100-border-strong)] px-5 text-sm font-semibold text-[var(--n100-text-primary)] transition-colors hover:border-[var(--n100-accent)] hover:text-[var(--n100-accent)]"}>{children}</Link>;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date);
}

function LatestResearch({
  researchEnabled,
  articles,
  loadError,
}: {
  researchEnabled: boolean;
  articles: readonly ResearchArticleSummary[];
  loadError: boolean;
}) {
  const description = loadError
    ? "The public Research library could not be read right now. Please try again later."
    : articles.length > 0
      ? "The latest reviewed Research, presented with its category, classification, author, and publication date."
      : "No published research records are available for this release. The reading architecture is ready without manufacturing article cards, authors, dates, or token claims.";

  return <>
    <SectionHeader eyebrow="04 / Latest Research" title={loadError ? "Research is temporarily unavailable." : articles.length > 0 ? "The latest context, sourced and reviewed." : "A deliberate empty state until the library is ready."} description={description} />
    {articles.length > 0 && researchEnabled && !loadError ? <ul className="mt-8 grid gap-px overflow-hidden border border-[var(--n100-border-subtle)] bg-[var(--n100-border-subtle)] md:grid-cols-2">{articles.map((article) => <li key={article.id} className="bg-[var(--n100-canvas)] p-6"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[var(--n100-accent)]">{article.category}</span><StatusLabel kind={article.classification} />{article.aiAssisted ? <StatusLabel kind="ai-assisted" /> : null}</div><h2 className="mt-5 text-xl font-semibold tracking-[-0.03em] text-[var(--n100-text-primary)]"><Link href={`/research/${article.slug}`} className="hover:text-[var(--n100-accent)]">{article.title}</Link></h2>{article.dek ? <p className="mt-3 text-sm leading-6 text-[var(--n100-text-secondary)]">{article.dek}</p> : null}{article.tldr ? <p className="mt-4 text-sm leading-6 text-[var(--n100-text-primary)]">{article.tldr}</p> : null}<div className="mt-6 flex flex-wrap gap-x-4 gap-y-2 border-t border-[var(--n100-border-subtle)] pt-4 text-xs text-[var(--n100-text-tertiary)]"><span>By {article.author.name}</span><span>Published {formatDate(article.publishedAt)}</span></div></li>)}</ul> : <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-stretch"><EmptyState title={loadError ? "Research library unavailable." : "No research has been published yet."} description={loadError ? "The page remains available, but published records could not be confirmed. No article content was presented." : "When reviewed research is available, articles will appear here with category, classification, sources, and disclosure context."} /><Panel tone="subtle" padding="lg"><p className="font-mono text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[var(--n100-text-tertiary)]">Library status</p><p className="mt-5 text-sm leading-6 text-[var(--n100-text-secondary)]">{!researchEnabled ? "Research publishing is not currently active. This page explains the product without implying published work." : loadError ? "Published availability could not be confirmed from the public Research projection." : "Research structure is ready for a sourced library; no article records are rendered."}</p></Panel></div>}
  </>;
}

export default function ResearchPageContent({
  researchEnabled,
  publishedArticles = [],
  researchLoadError = false,
}: {
  researchEnabled: boolean;
  publishedArticles?: readonly ResearchArticleSummary[];
  researchLoadError?: boolean;
}) {
  return (
    <>
      <Section className="border-b border-[var(--n100-border-subtle)]">
        <Container size="wide" className="py-20 sm:py-28">
          <div className="grid gap-12 lg:grid-cols-[1fr_0.7fr] lg:items-end lg:gap-20">
            <div>
              <SectionMarker number="01" label="First-party research" />
              <h1 className="max-w-4xl text-4xl font-semibold leading-[1.02] tracking-[-0.055em] text-[var(--n100-text-primary)] sm:text-6xl">Research that gives signals a frame.</h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-[var(--n100-text-secondary)] sm:text-lg">NEXT100XGEMS Research brings first-party crypto research, market intelligence, and editorial analysis into a publication-style reading experience.</p>
            </div>
            <Panel family="editorial" padding="lg">
              <StatusLabel kind="editorial" />
              <p className="mt-5 text-lg leading-7 text-[var(--n100-text-primary)]">Evidence, interpretation, and uncertainty kept distinct.</p>
              <InstrumentRule className="mt-6" />
            </Panel>
          </div>
        </Container>
      </Section>

      <Section id="categories">
        <Container size="wide">
          <SectionHeader eyebrow="02 / Research categories" title="A publication rail for different kinds of context." description="Categories are presentation-level concepts ready to map to real research records later. No category counts or publication history are implied." />
          <ul className="mt-8 grid gap-px overflow-hidden border border-[var(--n100-border-subtle)] bg-[var(--n100-border-subtle)] sm:grid-cols-2 lg:grid-cols-4">{researchCategories.map(([category, description], index) => <li key={category} className="bg-[var(--n100-canvas)] p-6 sm:min-h-48"><p className="font-mono text-xs text-[var(--n100-accent)]">0{index + 1}</p><h2 className="mt-7 text-lg font-semibold tracking-[-0.025em] text-[var(--n100-text-primary)]">{category}</h2><p className="mt-3 text-sm leading-6 text-[var(--n100-text-secondary)]">{description}</p></li>)}</ul>
        </Container>
      </Section>

      <Section id="article-standard" className="border-y border-[var(--n100-border-subtle)] bg-[var(--n100-surface-subtle)]">
        <Container size="wide">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:gap-20">
            <div>
              <SectionMarker number="03" label="Research standard" />
              <h2 className="text-3xl font-semibold tracking-[-0.045em] text-[var(--n100-text-primary)] sm:text-4xl">An article should show how it got there.</h2>
              <p className="mt-5 max-w-xl text-sm leading-6 text-[var(--n100-text-secondary)]">The article presentation is designed for a readable argument: a concise orientation, sourceable context, analysis, sources, and clear disclosure.</p>
            </div>
            <Panel family="editorial" padding="lg">
              <div className="flex flex-wrap gap-2"><StatusLabel kind="editorial" /><StatusLabel kind="ai-assisted" /><StatusLabel kind="sponsored" /></div>
              <ul className="mt-6 divide-y divide-[var(--n100-border-subtle)] border-y border-[var(--n100-border-subtle)]">{researchAnatomy.map(([label, description]) => <li key={label} className="grid gap-2 py-4 sm:grid-cols-[7rem_1fr] sm:gap-6"><span className="font-mono text-xs font-semibold text-[var(--n100-text-primary)]">{label}</span><span className="text-sm leading-6 text-[var(--n100-text-secondary)]">{description}</span></li>)}</ul>
            </Panel>
          </div>
        </Container>
      </Section>

      <Section id="latest-research">
        <Container size="wide">
          <LatestResearch researchEnabled={researchEnabled} articles={publishedArticles} loadError={researchLoadError} />
        </Container>
      </Section>

      <Section id="classifications" className="border-y border-[var(--n100-border-subtle)] bg-[var(--n100-surface-secondary)]/35">
        <Container size="wide">
          <SectionHeader eyebrow="05 / Classifications" title="Labels with different jobs." description="A Research article has a primary classification. AI assistance may coexist with Editorial, Sponsored, or Partner content and is not a synonym for paid content." />
          <ul className="mt-8 divide-y divide-[var(--n100-border-subtle)] border-y border-[var(--n100-border-subtle)]">{researchClassifications.map(([kind, label, description]) => <li key={label} className="grid gap-4 py-5 sm:grid-cols-[10rem_1fr] sm:items-center"><StatusLabel kind={kind === "ai-assisted" ? kind : kind} /><p className="max-w-3xl text-sm leading-6 text-[var(--n100-text-secondary)]">{description}</p></li>)}</ul>
        </Container>
      </Section>

      <Section id="methodology">
        <Container size="wide">
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel family="editorial" padding="lg">
              <SectionMarker number="06" label="Methodology connection" />
              <h2 className="text-2xl font-semibold tracking-[-0.035em] text-[var(--n100-text-primary)]">Research should make its method inspectable.</h2>
              <p className="mt-5 text-sm leading-6 text-[var(--n100-text-secondary)]">Research distinguishes sourceable information, analytical interpretation, AI assistance, and commercial relationships. Read the methodology for the broader evidence and review principles.</p>
              <div className="mt-6 flex flex-wrap gap-3"><ResearchLink href="/methodology">Read Methodology</ResearchLink><ResearchLink href="/disclosures">Read Disclosures</ResearchLink></div>
            </Panel>
            <Panel tone="subtle" padding="lg">
              <SectionMarker number="07" label="Research + Radar" />
              <h2 className="text-2xl font-semibold tracking-[-0.035em] text-[var(--n100-text-primary)]">Radar surfaces intelligence. Research investigates context.</h2>
              <p className="mt-5 text-sm leading-6 text-[var(--n100-text-secondary)]">A Research article may reference Radar data where it is relevant, but Research remains a separate editorial/research product. An article is not a buy or sell signal.</p>
              <div className="mt-6 flex flex-wrap gap-2"><StatusLabel kind="radar" /><StatusLabel kind="editorial" /></div>
            </Panel>
          </div>
        </Container>
      </Section>

      <Section className="border-b border-[var(--n100-border-subtle)] bg-[var(--n100-surface-subtle)]">
        <Container size="reading" className="text-center">
          <SectionMarker number="08" label="Research standard" />
          <h2 className="text-3xl font-semibold tracking-[-0.045em] text-[var(--n100-text-primary)] sm:text-4xl">Read the context before the conclusion.</h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-[var(--n100-text-secondary)]">The public library will grow from sourced, reviewed work. Until then, the standards remain visible and the empty state stays honest.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3"><ResearchLink href="/methodology" primary>Explore Methodology</ResearchLink><ResearchLink href="/disclosures">Read Disclosures</ResearchLink></div>
        </Container>
      </Section>
    </>
  );
}
