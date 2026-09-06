import { Suspense } from "react";

import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <Suspense fallback={<p className="text-sm text-gray-600">Loading sign in…</p>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
