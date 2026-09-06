import PublicFooter from "./public-footer";
import PublicHeader from "./public-header";

export default function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--n100-canvas)]">
      <PublicHeader />
      <main id="main-content" className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}
