// src/app/(admin)/admin/accept-invite/page.tsx
"use client";

// Landing page for the link SuperStaff's staff-accounts Edge Function sends
// when it invites a new admin (redirectTo: `${PORTAL_URL_ADMIN}/accept-invite`)
// and when it resends a recovery link to an existing one. The visitor has no
// session yet, so the shared request guard (src/shared/guard/decide.ts)
// exempts this path from both the authentication gate and the role gate.
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/portals/admin/components/ui/button";
import { createClient } from "@/shared/supabase/client";

const MIN_PASSWORD = 8;

// "invalid" means the link itself is spent or expired — a fact we learned from
// GoTrue. "failed" means we never got an answer, which is a different problem
// and deserves different advice: telling someone their link is dead when their
// connection dropped sends them to ask for a replacement they do not need.
type Phase = "verifying" | "ready" | "invalid" | "failed";

export default function AcceptInvitePage() {
  const router = useRouter();
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
        const { error: setError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (setError) return false;
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

    // updateUser leaves them signed in, so they go straight through the
    // portal gate rather than back to /login.
    router.replace("/admin/dashboard");
    router.refresh();
  }

  let content: React.ReactNode;

  if (phase === "verifying") {
    content = <p className="text-sm text-gray-600">Checking your invite…</p>;
  } else if (phase === "failed") {
    content = (
      <>
        <h1 className="text-xl font-bold text-gray-900">
          We could not check your link
        </h1>
        {/* Deliberately does not say the link is dead — we do not know that.
            Opening it again costs nothing if it is still good, and a link is
            single-use, so we must not send people to burn a replacement on
            what may have been a dropped connection. */}
        <p className="mt-3 text-sm text-gray-500">
          Something went wrong while checking it — this may be a connection
          problem rather than a dead link. Open the link from your email
          again. If it still fails, ask your Super Staff to send a new one.
        </p>
        <div className="mt-6">
          <a href="/admin/login">
            <Button variant="secondary">Back to sign in</Button>
          </a>
        </div>
      </>
    );
  } else if (phase === "invalid") {
    content = (
      <>
        {/* The single-use warning is here because opening the link on a
            second device — a phone that cannot reach the portal, a mail
            scanner that pre-fetches it — spends it before the browser that
            needs it arrives, and that is not obvious to the person. */}
        <h1 className="text-xl font-bold text-gray-900">
          This link is no longer valid
        </h1>
        <p className="mt-3 text-sm text-gray-500">
          Sign-in links can only be opened once, and they expire. If you
          opened it on another device first, that used it up. Ask your
          Super Staff to send a new one. If your account is already set up,
          sign in normally instead.
        </p>
        <div className="mt-6">
          <a href="/admin/login">
            <Button variant="secondary">Back to sign in</Button>
          </a>
        </div>
      </>
    );
  } else {
    content = (
      <>
        <h1 className="text-xl font-bold text-gray-900">Set your password</h1>
        <p className="mt-2 text-sm text-gray-500">
          Set your password for your <strong>Admin</strong> account. Nobody
          else will know it.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
              New password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="New password"
              required
              autoComplete="new-password"
              className="w-full rounded-none border border-gray-300 px-3 py-2 text-sm focus:border-blue-900 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="confirm" className="mb-1 block text-sm font-medium text-gray-700">
              Confirm password
            </label>
            <input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              placeholder="Confirm password"
              required
              autoComplete="new-password"
              className="w-full rounded-none border border-gray-300 px-3 py-2 text-sm focus:border-blue-900 focus:outline-none"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Saving…" : "Set password and continue"}
          </Button>
        </form>
      </>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-none bg-white shadow-2xl">
        <div className="flex items-center gap-4 bg-blue-900 px-6 py-5">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-none bg-white p-1">
            <img
              src="/lucena-seal.png"
              alt="Official seal of the City of Lucena"
              className="h-full w-full object-contain"
            />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-blue-200">
              City Government of
            </p>
            <p className="text-xl font-bold leading-tight text-white">Lucena City</p>
            <p className="text-xs text-blue-100">Admin Portal</p>
          </div>
        </div>
        <div aria-hidden className="h-1 bg-yellow-500" />

        <div className="px-6 py-6">{content}</div>
      </div>
    </main>
  );
}
