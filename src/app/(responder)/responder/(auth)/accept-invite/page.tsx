"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type FormEvent } from "react";
import { createClient } from "@/shared/supabase/client";
import { restartIdleClock } from "@/portals/responder/lib/supabase/idle-timeout";

const MIN_PASSWORD = 8;

const FIELD =
  "h-11 rounded-md border border-gray-300 px-3 text-sm text-gray-900";
const CARD = "w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6";
const BACK =
  "flex h-12 items-center justify-center rounded-md border border-gray-300 bg-white text-[15px] font-semibold text-gray-900 hover:bg-gray-50";

// "invalid" means the link itself is spent or expired — a fact we learned from
// GoTrue. "failed" means we never got an answer, which is a different problem
// and deserves different advice: telling someone their link is dead when their
// connection dropped sends them to ask for a replacement they do not need.
type Phase = "verifying" | "ready" | "invalid" | "failed";

export default function AcceptInvitePage() {
  const router = useRouter();
  const passwordId = useId();
  const confirmId = useId();
  const [phase, setPhase] = useState<Phase>("verifying");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    async function establishSession() {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const params = new URLSearchParams(window.location.search);

      // GoTrue reports a dead or already-used link in the fragment.
      if (hash.get("error") || params.get("error")) return false;

      // Shape 1: implicit flow — the tokens arrive in the fragment.
      //
      // This MUST be done by hand. detectSessionInUrl does not help:
      // @supabase/ssr's createBrowserClient hard-codes flowType:'pkce' (after
      // spreading options, so it cannot be overridden), and auth-js refuses an
      // implicit callback on a pkce client — _getSessionFromURL throws
      // "Not a valid PKCE flow url." and _initialize swallows it. The result
      // is no session and an unconsumed fragment.
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (sessionError) return false;
        // Drop the tokens from the address bar so a refresh, a bookmark or a
        // pasted URL cannot replay them.
        window.history.replaceState({}, "", window.location.pathname);
        return true;
      }

      // Shape 2: PKCE.
      const code = params.get("code");
      if (code) {
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);
        return !exchangeError;
      }

      // Shape 3: token hash.
      const tokenHash = params.get("token_hash");
      if (tokenHash) {
        // An invite and a recovery link land here identically apart from this
        // type. Read it rather than assuming: a resent link is recovery.
        const type = params.get("type") === "recovery" ? "recovery" : "invite";
        const { error: otpError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type,
        });
        return !otpError;
      }

      // No token in the URL. Only now does an existing session count — it
      // covers a client that already consumed the link itself.
      const { data: existing } = await supabase.auth.getSession();
      return Boolean(existing.session);
    }

    // The .catch is not decoration. auth-js throws rather than returning
    // { error } for several failures — a flow-state mismatch, a request that
    // dies mid-verify — and a rejection with no handler leaves `phase` on
    // "verifying" forever. The user then stares at "Checking your invite…"
    // with no message, no recovery, and nothing in the UI to act on.
    void establishSession()
      .then((ok) => setPhase(ok ? "ready" : "invalid"))
      .catch((cause) => {
        console.error("accept-invite: could not check the link", cause);
        setPhase("failed");
      });
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD) {
      setError(`Use at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }

    setBusy(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setBusy(false);
      return;
    }

    // A fresh idle clock: the stale one left by an earlier session in this
    // browser would otherwise end the new session on its first request.
    // It also drops the old clock offset, so the request guard measures it
    // again.
    restartIdleClock(Date.now());

    // updateUser leaves them signed in, so they go straight through the portal
    // gate rather than back to /login.
    router.replace("/responder/pool");
    router.refresh();
  }

  if (phase === "verifying") {
    return (
      <div className={CARD}>
        <p className="text-[13px] text-gray-600">Checking your invite…</p>
      </div>
    );
  }

  if (phase === "failed") {
    return (
      <div className={CARD}>
        <h1 className="text-[17px] leading-tight font-bold text-gray-900">
          We could not check your link
        </h1>
        {/* Deliberately does not say the link is dead — we do not know that.
            Opening it again costs nothing if it is still good, and a link is
            single-use, so we must not send people to burn a replacement on
            what may have been a dropped connection. */}
        <p className="mt-2.5 text-[13px] text-pretty text-gray-600">
          Something went wrong while checking it — this may be a connection
          problem rather than a dead link. Open the link from your email again.
          If it still fails, ask your Super Staff to send a new one.
        </p>
        <div className="mt-5">
          <a href="/responder/login" className={BACK}>
            Back to sign in
          </a>
        </div>
      </div>
    );
  }

  if (phase === "invalid") {
    return (
      <div className={CARD}>
        {/* The single-use warning is here because opening the link on a second
            device — a phone that cannot reach the portal, a mail scanner that
            pre-fetches it — spends it before the browser that needs it
            arrives, and that is not obvious to the person. */}
        <h1 className="text-[17px] leading-tight font-bold text-gray-900">
          This link is no longer valid
        </h1>
        <p className="mt-2.5 text-[13px] text-pretty text-gray-600">
          Sign-in links can only be opened once, and they expire. If you opened
          it on another device first, that used it up. Ask your Super Staff to
          send a new one. If your account is already set up, sign in normally
          instead.
        </p>
        <div className="mt-5">
          <a href="/responder/login" className={BACK}>
            Back to sign in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className={CARD}>
      <h1 className="text-[17px] leading-tight font-bold text-gray-900">
        Set your password
      </h1>
      <p className="mt-1.5 text-[13px] text-pretty text-gray-600">
        Choose a password for your Responder account. Nobody else will know it.
      </p>

      <form className="mt-4 flex flex-col gap-3" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={passwordId}
            className="text-[13px] font-medium text-gray-900"
          >
            New password
          </label>
          <input
            id={passwordId}
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={FIELD}
          />
          <span className="text-[11.5px] text-gray-500">
            At least {MIN_PASSWORD} characters
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={confirmId}
            className="text-[13px] font-medium text-gray-900"
          >
            Confirm password
          </label>
          <input
            id={confirmId}
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
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
          {busy ? "Saving…" : "Set password and continue"}
        </button>
      </form>
    </div>
  );
}
