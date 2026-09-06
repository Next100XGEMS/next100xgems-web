import { notFound } from "next/navigation";

import {
  Button,
  Cluster,
  Container,
  DataRow,
  DisclosureLabel,
  Divider,
  EmptyState,
  IconButton,
  InstrumentRule,
  KeyValueRow,
  Metric,
  PageHeader,
  Panel,
  Section,
  SectionHeader,
  Skeleton,
  Stack,
  StatusLabel,
} from "@/components/ui";
import { isDesignSystemAvailable } from "@/lib/design-system";

export const dynamic = "force-dynamic";

const colorSamples = [
  ["Canvas", "var(--n100-canvas)"],
  ["Subtle surface", "var(--n100-surface-subtle)"],
  ["Secondary surface", "var(--n100-surface-secondary)"],
  ["Elevated surface", "var(--n100-surface-elevated)"],
  ["Restrained accent", "var(--n100-accent)"],
  ["Positive", "var(--n100-positive)"],
  ["Warning", "var(--n100-warning)"],
  ["Negative", "var(--n100-negative)"],
] as const;

export default function DesignSystemPage() {
  if (!isDesignSystemAvailable()) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[var(--n100-canvas)]">
      <Container>
        <Section className="pb-8 sm:pb-12">
          <PageHeader
            eyebrow="Local laboratory · Gate 9"
            title="A quieter way to read the market."
            description="A development-only reference for the NEXT100XGEMS visual language: precise enough for intelligence interfaces, editorial enough for context, and restrained enough to earn trust."
          />
          <InstrumentRule className="mt-8 max-w-xl" />
          <div className="mt-8 flex flex-wrap items-center gap-3 border-y border-[var(--n100-border-subtle)] py-4 text-xs text-[var(--n100-text-tertiary)]">
            <span className="font-mono uppercase tracking-[0.12em] text-[var(--n100-accent)]">LOCAL ONLY</span>
            <span aria-hidden="true">/</span>
            <span>Mock content below is visual test data, not product functionality.</span>
          </div>
        </Section>

        <Section density="compact" aria-labelledby="color-heading">
          <SectionHeader eyebrow="01 · Foundation" title="Color and surface hierarchy" description="A near-black canvas, quiet surfaces, and one controlled accent keep attention on meaning rather than decoration." />
          <div id="color-heading" className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {colorSamples.map(([label, color]) => (
              <div key={label} className="flex items-center gap-3 border border-[var(--n100-border-subtle)] bg-[var(--n100-surface-subtle)] p-3">
                <span className="size-8 shrink-0 rounded-[var(--n100-radius-control)] border border-white/10" style={{ backgroundColor: color }} aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm text-[var(--n100-text-primary)]">{label}</p>
                  <p className="mt-0.5 truncate font-mono text-[0.625rem] text-[var(--n100-text-tertiary)]">{color}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section density="compact" aria-labelledby="type-heading">
          <SectionHeader eyebrow="02 · Type" title="Editorial hierarchy, data-native details" description="Geist carries the reading experience; monospace is reserved for values, timestamps, and technical identifiers." />
          <div id="type-heading" className="mt-6 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <Stack gap="lg">
              <div><p className="mb-2 text-[0.625rem] uppercase tracking-[0.16em] text-[var(--n100-text-tertiary)]">Display / headline</p><p className="text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Signal, with context.</p></div>
              <div><p className="mb-2 text-[0.625rem] uppercase tracking-[0.16em] text-[var(--n100-text-tertiary)]">Section title</p><p className="text-2xl font-semibold tracking-[-0.03em]">The evidence layer</p></div>
              <div><p className="mb-2 text-[0.625rem] uppercase tracking-[0.16em] text-[var(--n100-text-tertiary)]">Body</p><p className="max-w-xl text-base leading-7 text-[var(--n100-text-secondary)]">Clear writing gives market data a frame. The interface should make uncertainty legible without turning every nuance into a warning.</p></div>
            </Stack>
            <Panel tone="quiet" family="editorial">
              <Stack gap="md">
                <div><p className="text-[0.625rem] uppercase tracking-[0.16em] text-[var(--n100-text-tertiary)]">Navigation</p><p className="mt-2 text-sm font-medium">Radar · Research · Partners</p></div>
                <Divider />
                <div><p className="text-[0.625rem] uppercase tracking-[0.16em] text-[var(--n100-text-tertiary)]">Technical identifier</p><p className="mt-2 break-all font-mono text-xs text-[var(--n100-text-secondary)]">0x71c7…9a04 · 2026-09-06T12:30Z</p></div>
              </Stack>
            </Panel>
          </div>
        </Section>

        <Section density="compact" aria-labelledby="controls-heading">
          <SectionHeader eyebrow="03 · Controls" title="Quiet controls with clear states" description="Primary actions are reserved for moments that matter. Every control keeps a visible focus ring and a legible disabled state." />
          <div id="controls-heading" className="mt-6 flex flex-wrap items-center gap-3">
            <Button variant="primary">Explore Radar</Button>
            <Button variant="secondary">Read research</Button>
            <Button variant="ghost">View methodology</Button>
            <Button variant="destructive">Archive</Button>
            <Button loading>Saving</Button>
            <Button disabled>Unavailable</Button>
            <IconButton label="Open detail">↗</IconButton>
          </div>
        </Section>

        <Section density="compact" aria-labelledby="surfaces-heading">
          <SectionHeader eyebrow="04 · Surfaces" title="Panels, rules, and information density" description="Containers support hierarchy; they do not replace whitespace, typography, or careful separators." />
          <div id="surfaces-heading" className="mt-6 grid gap-4 lg:grid-cols-3">
            <Panel><p className="text-[0.625rem] uppercase tracking-[0.16em] text-[var(--n100-accent)]">Elevated panel</p><h3 className="mt-3 text-lg font-semibold">A considered surface</h3><p className="mt-2 text-sm leading-6 text-[var(--n100-text-secondary)]">Subtle contrast creates a place for a decision without shouting for attention.</p></Panel>
            <Panel tone="subtle"><p className="text-[0.625rem] uppercase tracking-[0.16em] text-[var(--n100-accent)]">Secondary panel</p><h3 className="mt-3 text-lg font-semibold">A compact grouping</h3><p className="mt-2 text-sm leading-6 text-[var(--n100-text-secondary)]">Useful for related facts, filters, and supporting context.</p></Panel>
            <Panel tone="quiet"><p className="text-[0.625rem] uppercase tracking-[0.16em] text-[var(--n100-accent)]">Quiet panel</p><h3 className="mt-3 text-lg font-semibold">A low-noise note</h3><p className="mt-2 text-sm leading-6 text-[var(--n100-text-secondary)]">A surface can recede when the content needs to lead.</p></Panel>
          </div>
        </Section>

        <Section density="compact" aria-labelledby="data-heading">
          <SectionHeader eyebrow="05 · Data" title="Scannable values and measured emphasis" description="Numeric values use tabular monospace figures; semantic color is used for direction, not decoration." />
          <div id="data-heading" className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
            <Panel family="radar">
              <InstrumentRule className="mb-5" />
              <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4"><Metric label="Price" value="$1.284" /><Metric label="Change" value="+4.8%" tone="positive" detail="24h" /><Metric label="Risk" value="Medium" tone="warning" /><Metric label="Freshness" value="12m" detail="updated" /></div>
            </Panel>
            <Panel tone="subtle">
              <DataRow label="Market cap" value="$184.2M" /><DataRow label="Liquidity" value="$12.8M" /><DataRow label="Volume" value="$8.4M" tone="positive" detail="24h" /><DataRow label="Holder count" value="42,816" />
            </Panel>
          </div>
        </Section>

        <Section density="compact" aria-labelledby="labels-heading">
          <SectionHeader eyebrow="06 · Trust signals" title="Disclosures and evidence labels" description="Commercial labels are deliberately distinct from Radar and evidence signals. The text stays explicit even when color is unavailable." />
          <div id="labels-heading" className="mt-6 grid gap-6 lg:grid-cols-2">
            <Panel family="editorial"><p className="mb-4 text-sm font-medium">Editorial and intelligence</p><Cluster gap="sm"><DisclosureLabel kind="editorial" /><DisclosureLabel kind="ai-assisted" /><StatusLabel kind="radar" /><StatusLabel kind="verified-data" /><StatusLabel kind="strong-signal" /><StatusLabel kind="ai-inference" /><StatusLabel kind="unknown" /></Cluster></Panel>
            <Panel tone="subtle"><p className="mb-4 text-sm font-medium">Commercial disclosure boundary</p><Cluster gap="sm"><DisclosureLabel kind="sponsored" /><DisclosureLabel kind="partner" /><DisclosureLabel kind="advertisement" /><DisclosureLabel kind="ai-assisted" /></Cluster><p className="mt-5 text-sm leading-6 text-[var(--n100-text-secondary)]">SPONSORED remains an explicit commercial disclosure; it never borrows the visual language of organic Radar signals.</p></Panel>
          </div>
        </Section>

        <Section density="compact" aria-labelledby="headers-heading">
          <SectionHeader eyebrow="07 · Composition" title="Headers, rows, and empty states" description="Simple layout patterns cover future editorial and intelligence surfaces without pre-building their product workflows." />
          <div id="headers-heading" className="mt-6 grid gap-4 lg:grid-cols-2">
            <Panel padding="sm" family="editorial"><SectionHeader eyebrow="Research" title="A measured headline" description="Supporting context stays close to the title." action={<Button size="sm" variant="ghost">Open</Button>} /><div className="mt-2"><KeyValueRow label="Classification" value="Editorial" /><KeyValueRow label="Updated" value="12m ago" /></div></Panel>
            <EmptyState title="No reviewed evidence yet" description="A quiet, useful empty state makes absence clear without inventing data." />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-20 w-full" /></div>
        </Section>

        <Section density="compact" aria-labelledby="previews-heading">
          <SectionHeader eyebrow="08 · Visual compositions" title="Small domain previews" description="These are mock compositions only. They contain no database reads, feature-flag mutations, or product behavior." />
          <div id="previews-heading" className="mt-6 grid gap-4 xl:grid-cols-2">
            <Panel family="radar"><Cluster className="justify-between"><div><p className="text-[0.625rem] uppercase tracking-[0.16em] text-[var(--n100-radar)]">Radar · visual test only</p><h3 className="mt-2 text-xl font-semibold tracking-[-0.025em]">Northstar protocol</h3><p className="mt-1 font-mono text-xs text-[var(--n100-text-tertiary)]">Updated 12m ago · sample registry record</p></div><StatusLabel kind="early" /></Cluster><InstrumentRule className="my-5" /><div className="grid grid-cols-2 gap-x-5 gap-y-5 sm:grid-cols-4"><Metric label="Price" value="$0.0184" /><Metric label="Change" value="+8.2%" tone="positive" detail="24h" /><Metric label="Liquidity" value="$2.1M" /><Metric label="Risk" value="High" tone="negative" /></div><div className="mt-6 border-t border-[var(--n100-border-subtle)]/80 pt-4"><p className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[var(--n100-text-tertiary)]">Evidence confidence</p><div className="mt-3 flex flex-wrap gap-2"><StatusLabel kind="verified-data" /><StatusLabel kind="strong-signal" /><StatusLabel kind="ai-inference" /><StatusLabel kind="high-risk" /></div></div><p className="mt-5 text-xs text-[var(--n100-text-tertiary)]">Example data · intelligence context only · no recommendation</p></Panel>
            <Panel family="commercial"><Cluster className="justify-between"><div><DisclosureLabel kind="sponsored" /><p className="mt-3 text-[0.625rem] uppercase tracking-[0.16em] text-[var(--n100-text-tertiary)]">Protocol infrastructure · campaign 01/03</p><h3 className="mt-2 text-xl font-semibold tracking-[-0.025em]">A clearer way to build in public</h3></div><span className="font-mono text-xs text-[var(--n100-text-tertiary)]">PAID</span></Cluster><p className="mt-5 max-w-lg text-sm leading-6 text-[var(--n100-text-secondary)]">A premium native placement can have editorial restraint while remaining unmistakably separate from independent intelligence.</p><div className="mt-6 flex items-center justify-between border-t border-[var(--n100-sponsored)]/20 pt-4"><span className="text-xs text-[var(--n100-text-tertiary)]">Sponsored visual test · infrastructure</span><Button size="sm" variant="secondary">Learn more</Button></div></Panel>
            <Panel family="editorial"><Cluster className="justify-between"><div><DisclosureLabel kind="editorial" /><p className="mt-4 text-[0.625rem] uppercase tracking-[0.16em] text-[var(--n100-text-tertiary)]">Research · visual test only</p><h3 className="mt-2 max-w-xl text-2xl font-semibold leading-tight tracking-[-0.035em]">Reading the liquidity story before the narrative arrives</h3></div></Cluster><div className="mt-5 border-l-2 border-[var(--n100-editorial)]/35 pl-4"><p className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[var(--n100-text-tertiary)]">TL;DR</p><p className="mt-2 max-w-xl text-sm leading-6 text-[var(--n100-text-secondary)]">A short research treatment gives evidence, classification, and timing room to breathe.</p></div><div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--n100-border-subtle)] pt-4 text-xs text-[var(--n100-text-tertiary)]"><span className="font-mono">06 SEP 2026</span><span>Analysis note</span><StatusLabel kind="ai-assisted" /></div></Panel>
            <Panel family="admin"><Cluster className="justify-between"><div><p className="text-[0.625rem] uppercase tracking-[0.16em] text-[var(--n100-info)]">Admin · visual test only</p><h3 className="mt-2 text-xl font-semibold tracking-[-0.025em]">System availability</h3></div><IconButton label="More system options">⋯</IconButton></Cluster><InstrumentRule className="my-5" /><div className="divide-y divide-[var(--n100-border-subtle)]"><div className="flex items-center justify-between py-3"><span className="text-sm text-[var(--n100-text-secondary)]">Radar</span><span className="flex items-center gap-2 font-mono text-xs text-[var(--n100-positive)]"><span className="size-1.5 rounded-full bg-[var(--n100-positive)]" aria-hidden="true" />ON</span></div><div className="flex items-center justify-between py-3"><span className="text-sm text-[var(--n100-text-secondary)]">Research</span><span className="flex items-center gap-2 font-mono text-xs text-[var(--n100-positive)]"><span className="size-1.5 rounded-full bg-[var(--n100-positive)]" aria-hidden="true" />ON</span></div><div className="flex items-center justify-between py-3"><span className="text-sm text-[var(--n100-text-secondary)]">Advertising</span><span className="font-mono text-xs text-[var(--n100-text-tertiary)]">OFF</span></div></div><p className="mt-4 text-xs text-[var(--n100-text-tertiary)]">Static example · no flag connection</p></Panel>
          </div>
        </Section>

        <Section density="compact" className="pb-16 sm:pb-24">
          <Divider />
          <p className="pt-5 text-xs leading-5 text-[var(--n100-text-tertiary)]">Gate 9 laboratory · dark foundation · responsive composition · reduced-motion aware</p>
        </Section>
      </Container>
    </main>
  );
}
