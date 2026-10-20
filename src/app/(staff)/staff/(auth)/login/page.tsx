"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { Button } from "@/portals/staff/components/ui/button";
import { Card } from "@/portals/staff/components/ui/card";
import { Input } from "@/portals/staff/components/ui/input";
import { createClient } from "@/shared/supabase/client";
import { signInErrorMessage } from "@/shared/supabase/sign-in-error";
import { IDLE_SIGNOUT_REASON, IDLE_TIMEOUT_MS, restartIdleClock } from "@/portals/staff/lib/supabase/idle-timeout";

// useSearchParams() needs a Suspense boundary, or the build refuses to
// prerender the page.
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const idleSignOut = useSearchParams().get("reason") === IDLE_SIGNOUT_REASON;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (signInError) {
      setError(signInErrorMessage(signInError));
      setBusy(false);
      return;
    }

    // A fresh idle clock: the stale one left by an earlier session in this
    // browser would otherwise end the new session on its first request.
    // It also drops the old clock offset, so the request guard measures it again.
    restartIdleClock(Date.now());

    // The session cookie is set; refresh() makes the server layout re-read
    // my_staff_profile instead of serving a cached anonymous render.
    router.replace("/staff/dashboard");
    router.refresh();
  }

  return (
    <Card className="w-full max-w-sm p-8">
      <h1 className="text-2xl font-bold text-lucena-blue">Staff sign in</h1>
      {idleSignOut && (
        <p role="status" className="mt-2 text-sm text-gray-600">
          You were signed out after {IDLE_TIMEOUT_MS / 60_000} minutes of inactivity.
        </p>
      )}
      <form className="mt-4 flex flex-col gap-3" onSubmit={handleSubmit}>
        <Input
          type="email"
          aria-label="Email"
          placeholder="Email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          type="password"
          aria-label="Password"
          placeholder="Password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </Card>
  );
}
