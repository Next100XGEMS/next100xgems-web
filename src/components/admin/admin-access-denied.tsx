import LogoutButton from "@/app/admin/logout-button";

export default function AdminAccessDenied({ message = "Your account does not have the required active Admin access." }: { message?: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--n100-canvas)] px-[var(--n100-gutter)] py-12">
      <div className="w-full max-w-lg border border-[var(--n100-border-subtle)] bg-[var(--n100-surface-elevated)] p-6 sm:p-8">
        <p className="text-[0.625rem] font-semibold uppercase tracking-[0.2em] text-[var(--n100-accent)]">NEXT100XGEMS · PRIVATE</p>
        <h1 className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-[var(--n100-text-primary)]">Access unavailable</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--n100-text-secondary)]">{message}</p>
        <div className="mt-6">
          <LogoutButton />
        </div>
      </div>
    </main>
  );
}
