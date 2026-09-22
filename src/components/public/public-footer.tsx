import Link from "next/link";

const footerGroups = [
  {
    label: "Product",
    links: [["Radar", "/radar"], ["Finder", "/finder"], ["Research", "/research"]],
  },
  {
    label: "Company / Network",
    links: [["Network", "/network"], ["Work With Us", "/work-with-us"]],
  },
  {
    label: "Commercial",
    links: [["Partners", "/partners"], ["Advertise", "/advertise"]],
  },
  {
    label: "Trust",
    links: [["Methodology", "/methodology"], ["Disclosures", "/disclosures"]],
  },
] as const;

export default function PublicFooter() {
  return (
    <footer className="border-t border-[var(--n100-border-subtle)] bg-[var(--n100-surface-subtle)]">
      <div className="mx-auto w-full max-w-[var(--n100-content-max)] px-[var(--n100-gutter)] py-12 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-[1.5fr_2fr]">
          <div className="max-w-sm">
            <p className="font-mono text-[0.7rem] font-semibold tracking-[0.16em] text-[var(--n100-text-primary)]">NEXT100XGEMS</p>
            <p className="mt-4 text-sm leading-6 text-[var(--n100-text-secondary)]">Crypto intelligence and media with clear context.</p>
            <p className="mt-5 text-xs leading-5 text-[var(--n100-text-tertiary)]">Information and research only. NEXT100XGEMS does not guarantee investment outcomes.</p>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
            {footerGroups.map((group) => (
              <div key={group.label}>
                <p className="font-mono text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[var(--n100-text-tertiary)]">{group.label}</p>
                <ul className="mt-4 space-y-3 text-sm">
                  {group.links.map(([label, href]) => <li key={href}><Link className="text-[var(--n100-text-secondary)] hover:text-[var(--n100-text-primary)]" href={href}>{label}</Link></li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-[var(--n100-border-subtle)] pt-5 text-[0.625rem] uppercase tracking-[0.14em] text-[var(--n100-text-tertiary)] sm:flex-row sm:items-center sm:justify-between">
          <span>Crypto Intelligence + Crypto Media</span>
          <span>Public foundation · Phase 2</span>
        </div>
      </div>
    </footer>
  );
}
