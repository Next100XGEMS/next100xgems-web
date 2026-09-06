"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { getSafeNextPath } from "@/lib/auth/redirects";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const { error: signInError } = await createClient().auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError("Unable to sign in with those credentials.");
      setPending(false);
      return;
    }

    router.replace(getSafeNextPath(searchParams.get("next")));
    router.refresh();
  }

  return (
    <section className="w-full max-w-sm space-y-6">
      <div>
        <p className="text-sm text-gray-500">NEXT100XGEMS</p>
        <h1 className="mt-2 text-2xl font-semibold">Admin sign in</h1>
        <p className="mt-2 text-sm text-gray-600">
          This private entry point is for approved team members.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block text-sm font-medium" htmlFor="email">
          Email
          <input
            className="mt-1 block w-full rounded border border-gray-300 p-2"
            id="email"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </label>

        <label className="block text-sm font-medium" htmlFor="password">
          Password
          <input
            className="mt-1 block w-full rounded border border-gray-300 p-2"
            id="password"
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>

        {error ? <p className="text-sm text-red-700">{error}</p> : null}

        <button
          className="w-full rounded bg-black px-4 py-2 text-white disabled:opacity-50"
          disabled={pending}
          type="submit"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </section>
  );
}
