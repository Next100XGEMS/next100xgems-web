import { Container, InstrumentRule, PageHeader, Panel, Section } from "@/components/ui";

export default function PublicFoundationPage() {
  return (
    <Section>
      <Container>
        <PageHeader
          eyebrow="NEXT100XGEMS · Public foundation"
          title="Crypto intelligence + media."
          description="The reusable public shell is in place. The full homepage follows in the next gate."
        />
        <InstrumentRule className="mt-8 max-w-xl" />
        <Panel className="mt-10 max-w-2xl" family="radar" padding="lg">
          <p className="font-mono text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-[var(--n100-radar)]">Shell verified</p>
          <p className="mt-4 text-sm leading-6 text-[var(--n100-text-secondary)]">Navigation, page structure, responsive behavior, and trust-oriented disclosure patterns are ready for future public page gates.</p>
        </Panel>
      </Container>
    </Section>
  );
}
