"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useId, useState, type FormEvent } from "react";
import { createClient } from "@/shared/supabase/client";
import { signInErrorMessage } from "@/shared/supabase/sign-in-error";
import { IDLE_SIGNOUT_REASON, IDLE_TIMEOUT_MS, restartIdleClock } from "@/portals/responder/lib/supabase/idle-timeout";

const FIELD =
  "h-11 rounded-md border border-gray-300 px-3 text-sm text-gray-900";

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
  const emailId = useId();
  const passwordId = useId();
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
    // It also drops the old clock offset, so the request guard measures it
    // again.
    restartIdleClock(Date.now());

    // The session cookie is set; refresh() makes the server layout re-read
    // my_staff_profile instead of serving a cached anonymous render.
    router.replace("/responder/pool");
    router.refresh();
  }

  return (
    <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full bg-lucena-blue text-xs font-bold text-white"
        >
          LC
        </span>
        <div>
          <h1 className="text-[17px] leading-tight font-bold text-gray-900">
            Responder sign in
          </h1>
          <p className="text-[12.5px] text-gray-500">Lucena City Portal</p>
        </div>
      </div>

      {idleSignOut && (
        <p role="status" className="mt-4 text-[12.5px] text-gray-600">
          You were signed out after {IDLE_TIMEOUT_MS / 60_000} minutes of inactivity.
        </p>
      )}

      <form className="mt-5 flex flex-col gap-3" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={emailId}
            className="text-[13px] font-medium text-gray-900"
          >
            Email
          </label>
          <input
            id={emailId}
            type="email"
            autoComplete="username"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={FIELD}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={passwordId}
            className="text-[13px] font-medium text-gray-900"
          >
            Password
          </label>
          <input
            id={passwordId}
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={FIELD}
          />
        </div>

        {error && (
          <p role="alert" className="text-[12.5px] text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-1 h-12 rounded-md bg-lucena-blue text-[15px] font-semibold text-white hover:bg-lucena-blue-dark disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-4 text-[12px] text-pretty text-gray-500">
        Your account is created for you by the city. If you cannot get in, ask
        your Super Staff to send a new sign-in link.
      </p>
    </div>
  );
}
