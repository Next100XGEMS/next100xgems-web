import Link from "next/link";

import { Container, Panel, Section, StatusLabel } from "@/components/ui";

import type { ResearchArticle, ResearchEvidenceKind } from "./research-content";
import { serializeResearchStructuredData } from "./research-content";

const evidenceLabels: Record<ResearchEvidenceKind, string> = {
  "verified-data": "VERIFIED DATA",
  "strong-signal": "STRONG SIGNAL",
  "ai-inference": "AI INFERENCE",
  unknown: "CONTEXT",
};

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date);
}

function safeExternalHref(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function ArticleClassification({ article }: { article: ResearchArticle }) {
  return <div className="flex flex-wrap gap-2"><StatusLabel kind={article.classification} />{article.aiAssisted ? <StatusLabel kind="ai-assisted" /> : null}{article.radarContext ? <StatusLabel kind="radar" /> : null}</div>;
}

function ArticleSources({ article }: { article: ResearchArticle }) {
  if (article.sources.length === 0) {
    return <p className="text-sm leading-6 text-[var(--n100-text-tertiary)]">No sources are attached to this presentation.</p>;
  }

  return <ol className="divide-y divide-[var(--n100-border-subtle)] border-y border-[var(--n100-border-subtle)]">{article.sources.map((source) => { const href = safeExternalHref(source.url); return <li key={`${source.publisher}-${source.title}`} className="py-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">{href ? <a href={href} target="_blank" rel="noreferrer noopener" aria-label={`${source.title} (opens in a new tab)`} className="text-sm font-medium text-[var(--n100-text-primary)] underline decoration-[var(--n100-border-strong)] underline-offset-4 hover:text-[var(--n100-accent)]">{source.title}</a> : <span className="text-sm font-medium text-[var(--n100-text-primary)]">{source.title}</span>}<span className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-[var(--n100-text-tertiary)]">{source.publisher}</span></div><p className="mt-2 text-xs text-[var(--n100-text-tertiary)]">{source.publishedAt ? `Published ${formatDate(source.publishedAt)}` : "Publication date not supplied"}{source.accessedAt ? ` · Accessed ${formatDate(source.accessedAt)}` : ""}</p></li>; })}</ol>;
}

function ArticleRelatedContent({ article }: { article: ResearchArticle }) {
  const hasResearch = Boolean(article.relatedResearch?.length);
  const hasTokens = Boolean(article.relatedTokens?.length);
  if (!hasResearch && !hasTokens) return null;

  return <Section density="compact" className="border-t border-[var(--n100-border-subtle)]"><Container size="reading"><div className="grid gap-8 sm:grid-cols-2">{hasResearch ? <div><h2 className="text-lg font-semibold text-[var(--n100-text-primary)]">Related Research</h2><ul className="mt-4 space-y-3">{article.relatedResearch?.map((item) => <li key={item.slug}><Link href={`/research/${item.slug}`} className="text-sm text-[var(--n100-text-secondary)] underline decoration-[var(--n100-border-strong)] underline-offset-4 hover:text-[var(--n100-accent)]">{item.title}</Link><p className="mt-1 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-[var(--n100-text-tertiary)]">{item.category}</p></li>)}</ul></div> : null}{hasTokens ? <div><h2 className="text-lg font-semibold text-[var(--n100-text-primary)]">Related Tokens</h2><ul className="mt-4 space-y-3">{article.relatedTokens?.map((token) => <li key={`${token.chain}-${token.symbol}-${token.contract ?? token.name}`} className="text-sm text-[var(--n100-text-secondary)]">{token.href ? <Link href={token.href} className="font-medium text-[var(--n100-text-primary)] underline decoration-[var(--n100-border-strong)] underline-offset-4 hover:text-[var(--n100-accent)]">{token.symbol} · {token.name}</Link> : <span className="font-medium text-[var(--n100-text-primary)]">{token.symbol} · {token.name}</span>}<p className="mt-1 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-[var(--n100-text-tertiary)]">{token.chain}{token.contract ? ` · ${token.contract}` : ""}</p></li>)}</ul><p className="mt-4 text-xs leading-5 text-[var(--n100-text-tertiary)]">Related token context is not a buy or sell recommendation.</p></div> : null}</div></Container></Section>;
}

export default function ResearchArticlePage({ article, previewLabel }: { article: ResearchArticle; previewLabel?: string }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeResearchStructuredData(article) }} />
      {previewLabel ? <div className="border-b border-amber-400/30 bg-amber-400/10 px-4 py-3 text-center font-mono text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-amber-200">{previewLabel}</div> : null}
      <article aria-labelledby="research-article-title">
        <Section className="border-b border-[var(--n100-border-subtle)]">
          <Container size="reading" className="py-16 sm:py-24">
            <header>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-3"><span className="font-mono text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-[var(--n100-accent)]">{article.category}</span><ArticleClassification article={article} /></div>
              <h1 id="research-article-title" className="mt-7 text-4xl font-semibold leading-[1.04] tracking-[-0.055em] text-[var(--n100-text-primary)] sm:text-6xl">{article.title}</h1>
              {article.dek ? <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--n100-text-secondary)]">{article.dek}</p> : null}
              <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 border-t border-[var(--n100-border-subtle)] pt-5 text-xs text-[var(--n100-text-tertiary)]"><span>By {article.author.name}{article.author.role ? ` · ${article.author.role}` : ""}</span><span>Published {formatDate(article.publishedAt)}</span>{article.updatedAt ? <span>Updated {formatDate(article.updatedAt)}</span> : null}</div>
              <Panel family={article.classification === "editorial" ? "editorial" : "commercial"} padding="md" className="mt-8"><p className="text-sm leading-6 text-[var(--n100-text-secondary)]">{article.disclosure}</p></Panel>
            </header>
          </Container>
        </Section>

        <Section density="compact" className="bg-[var(--n100-surface-subtle)]">
          <Container size="reading">
            <section aria-labelledby="article-tldr"><p className="font-mono text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-[var(--n100-editorial)]">TL;DR</p><h2 id="article-tldr" className="sr-only">TL;DR</h2><p className="mt-3 max-w-2xl text-base leading-7 text-[var(--n100-text-primary)]">{article.tldr}</p></section>
          </Container>
        </Section>

        <Section density="compact">
          <Container size="reading">
            <section aria-labelledby="article-key-facts"><h2 id="article-key-facts" className="text-xl font-semibold tracking-[-0.025em] text-[var(--n100-text-primary)]">Key Facts</h2><dl className="mt-5 divide-y divide-[var(--n100-border-subtle)] border-y border-[var(--n100-border-subtle)]">{article.keyFacts.map((fact) => <div key={fact.label} className="grid gap-2 py-4 sm:grid-cols-[10rem_1fr] sm:gap-6"><dt className="text-sm font-medium text-[var(--n100-text-primary)]">{fact.label}{fact.evidence ? <span className="mt-1 block font-mono text-[0.625rem] uppercase tracking-[0.12em] text-[var(--n100-text-tertiary)]">{evidenceLabels[fact.evidence]}</span> : null}</dt><dd className="text-sm leading-6 text-[var(--n100-text-secondary)]">{fact.detail}</dd></div>)}</dl></section>
          </Container>
        </Section>

        <Section>
          <Container size="reading">
            <section aria-labelledby="article-analysis"><h2 id="article-analysis" className="text-2xl font-semibold tracking-[-0.035em] text-[var(--n100-text-primary)]">Analysis</h2><div className="mt-8 space-y-10">{article.sections.map((section) => <section key={section.heading} aria-labelledby={`section-${section.heading.toLowerCase().replaceAll(" ", "-")}`}><h3 id={`section-${section.heading.toLowerCase().replaceAll(" ", "-")}`} className="text-xl font-semibold tracking-[-0.025em] text-[var(--n100-text-primary)]">{section.heading}</h3><div className="mt-4 space-y-4 text-base leading-8 text-[var(--n100-text-secondary)]">{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>{section.pullQuote ? <p className="mt-6 border-l-2 border-[var(--n100-editorial)] pl-5 text-lg font-medium leading-7 text-[var(--n100-text-primary)]">{section.pullQuote}</p> : null}</section>)}</div></section>
            {article.dataEmbeds?.length ? <div className="mt-12 space-y-4">{article.dataEmbeds.map((embed) => <Panel key={embed.label} tone="quiet" padding="lg"><p className="font-mono text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[var(--n100-text-tertiary)]">Data / chart embed area</p><h3 className="mt-3 text-lg font-semibold text-[var(--n100-text-primary)]">{embed.label}</h3><p className="mt-2 text-sm leading-6 text-[var(--n100-text-secondary)]">{embed.description}</p></Panel>)}</div> : null}
          </Container>
        </Section>

        <Section density="compact" className="border-t border-[var(--n100-border-subtle)] bg-[var(--n100-surface-subtle)]">
          <Container size="reading"><section aria-labelledby="article-sources"><h2 id="article-sources" className="text-xl font-semibold tracking-[-0.025em] text-[var(--n100-text-primary)]">Sources</h2><p className="mt-2 text-sm leading-6 text-[var(--n100-text-tertiary)]">Source links are supplied by the article data and are opened separately from the reading flow.</p><div className="mt-5"><ArticleSources article={article} /></div></section></Container>
        </Section>

        <Section density="compact">
          <Container size="reading"><section aria-labelledby="article-disclosure"><h2 id="article-disclosure" className="text-xl font-semibold tracking-[-0.025em] text-[var(--n100-text-primary)]">Disclosure</h2><p className="mt-4 text-sm leading-6 text-[var(--n100-text-secondary)]">{article.disclosure}</p>{article.radarContext ? <p className="mt-4 border-l-2 border-[var(--n100-radar)]/50 pl-4 text-sm leading-6 text-[var(--n100-text-tertiary)]">Radar context is referenced as intelligence context, not as a replacement for Research classification.</p> : null}</section></Container>
        </Section>
      </article>
      <ArticleRelatedContent article={article} />
      <Section density="compact" className="border-t border-[var(--n100-border-subtle)]"><Container size="reading" className="flex flex-wrap items-center justify-between gap-4"><p className="text-sm text-[var(--n100-text-tertiary)]">Research is informational context, not a guaranteed outcome.</p><Link href="/research" className="text-sm font-semibold text-[var(--n100-text-primary)] underline decoration-[var(--n100-border-strong)] underline-offset-4 hover:text-[var(--n100-accent)]">Back to Research</Link></Container></Section>
    </>
  );
}
