"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui";

export default function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleLogout() {
    setPending(true);
    setErrorMessage(null);
    const { error } = await createClient().auth.signOut();
    if (error) {
      setErrorMessage("Unable to sign out. Please try again.");
      setPending(false);
      return;
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button variant="ghost" size="sm" loading={pending} onClick={handleLogout}>
        Sign out
      </Button>
      {errorMessage ? <p className="text-xs text-[var(--n100-negative)]">{errorMessage}</p> : null}
    </div>
  );
}
