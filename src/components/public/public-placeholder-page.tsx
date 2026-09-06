import { Container, InstrumentRule, PageHeader, Panel, Section } from "@/components/ui";

export default function PublicPlaceholderPage({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <Section>
        <Container>
          <PageHeader eyebrow={eyebrow} title={title} description={description} />
          <InstrumentRule className="mt-8 max-w-xl" />
          <Panel className="mt-10 max-w-2xl" family="editorial" padding="lg">
            <p className="font-mono text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-[var(--n100-accent)]">Public foundation</p>
            <p className="mt-4 text-sm leading-6 text-[var(--n100-text-secondary)]">This surface is structurally ready. Its product content and workflows arrive in a later phase.</p>
          </Panel>
        </Container>
      </Section>
    </div>
  );
}
