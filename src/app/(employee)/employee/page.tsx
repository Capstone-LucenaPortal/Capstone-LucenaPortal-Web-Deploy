"use client";

// The one sign-in for every City employee (ADR 0009). It takes email and
// password, reads the account's role from my_staff_profile, then asks for the
// authenticator code, or makes an account with none enrol one, and sends the
// person to their own Portal's home (src/shared/guard/portals.ts). The four
// old `<prefix>/login` addresses, the signed-out guard, the idle sign-out and
// a password-only (aal1) session on any Portal page all land here.
//
// It uses the shared staff session cookie (ADR 0004), never the citizen one
// (ADR 0007), so a citizen signed in on the citizen site keeps that session.

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useId, useState, type FormEvent } from "react";
import {
  ACCOUNT_UNCHECKED,
  AuthenticatorCodeField,
  AuthenticatorEnrolment,
  verifyAccountAuthenticator,
} from "@/shared/auth/authenticator";
import { IDLE_SIGNOUT_REASON, judgeEmployee, type EmployeeVerdict } from "@/shared/guard/decide";
import { CITIZEN_PORTAL_PATH, portalHome, type StaffRole } from "@/shared/guard/portals";
import { createClient } from "@/shared/supabase/client";
import { signInErrorMessage } from "@/shared/supabase/sign-in-error";
// The idle clock is one cookie shared by every Portal, so Staff's restart is
// every Portal's.
import { restartIdleClock } from "@/portals/staff/lib/supabase/idle-timeout";

const PRIMARY_BUTTON =
  "h-12 rounded-md bg-lucena-blue text-[15px] font-semibold text-white hover:bg-lucena-blue-dark disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400";

const FIELD =
  "h-11 rounded-md border border-gray-300 px-3 text-sm text-gray-900 focus-visible:border-lucena-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lucena-blue";

type Refusal =
  | { kind: "message"; text: string }
  | { kind: "not-an-employee" };

const DEACTIVATED = "Your account has been deactivated. Contact your Super Staff to have it reactivated.";
const UNCHECKED = ACCOUNT_UNCHECKED;

/** Where a City employee's sign-in stands, past the verdict. */
type Step = { kind: "password" } | { kind: "code"; role: StaffRole } | { kind: "enrol"; role: StaffRole };

/** Where an active account goes once its password is in. */
type AfterPassword = { kind: "home"; role: StaffRole } | Exclude<Step, { kind: "password" }>;

/**
 * The step after an active account's verdict, by the session's assurance
 * level: code-verified goes home, an enrolled account gives its code, one
 * with no authenticator enrols. Null when the level cannot be read.
 */
async function nextStep(
  supabase: ReturnType<typeof createClient>,
  role: StaffRole,
): Promise<AfterPassword | null> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return null;
  if (data.currentLevel === "aal2") return { kind: "home", role };
  return data.nextLevel === "aal2" ? { kind: "code", role } : { kind: "enrol", role };
}

/** The verdict of a my_staff_profile read, or null when the read failed. */
async function readVerdict(supabase: ReturnType<typeof createClient>): Promise<EmployeeVerdict | null> {
  const { data, error } = await supabase.from("my_staff_profile").select("role, status").maybeSingle();
  return error ? null : judgeEmployee(data ?? null);
}

// useSearchParams() needs a Suspense boundary, or the build refuses to
// prerender the page.
export default function EmployeeSignInPage() {
  return (
    <Suspense>
      <EmployeeSignIn />
    </Suspense>
  );
}

function EmployeeSignIn() {
  const router = useRouter();
  const idleSignOut = useSearchParams().get("reason") === IDLE_SIGNOUT_REASON;
  const emailId = useId();
  const passwordId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<Step>({ kind: "password" });
  const [error, setError] = useState<Refusal | null>(null);
  const [busy, setBusy] = useState(false);
  // Held until the session already in this browser, if any, has been looked
  // at, so a signed-in employee is not shown the form on their way home.
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    // A City employee already signed in goes straight to their home, or, if
    // only the password was given (the guard sends such a session here), on
    // to the code or enrolment. Any other session found here (a deactivated
    // account, a failed read) is not this page's to end: it is shown the
    // form, session kept. An idle one is ended by the guard on arrival at
    // that home.
    async function check() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        const verdict = await readVerdict(supabase);
        if (verdict?.kind === "allow") {
          const next = await nextStep(supabase, verdict.role);
          if (next?.kind === "home") {
            router.replace(portalHome(next.role));
            return;
          }
          if (next && active) setStep(next);
        }
      }
      if (active) setChecked(true);
    }

    check().catch(() => {
      if (active) setChecked(true);
    });
    return () => {
      active = false;
    };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // A second click mid-flight would fire a second signInWithPassword
    // round-trip against Supabase Auth's rate limits.
    if (busy) return;
    setError(null);
    setBusy(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (signInError) {
      // Never Supabase's raw message: see signInErrorMessage.
      setError({ kind: "message", text: signInErrorMessage(signInError) });
      setBusy(false);
      return;
    }

    // The account is judged before any code is asked, so a citizen or a
    // deactivated account is never asked to enrol.
    const verdict = await readVerdict(supabase).catch(() => null);
    const next = verdict?.kind === "allow" ? await nextStep(supabase, verdict.role).catch(() => null) : null;

    if (next?.kind === "home") {
      goHome(next.role);
      return;
    }
    if (next) {
      setPassword("");
      setStep(next);
      setBusy(false);
      return;
    }

    // The session this page just created is not left behind for an account
    // it refuses, or whose sign-in cannot go on. Local scope: the person's
    // sessions elsewhere are not ours to end.
    await supabase.auth.signOut({ scope: "local" });
    // An active account here is one whose assurance level could not be read.
    setError(
      verdict === null || verdict.kind === "allow"
        ? { kind: "message", text: UNCHECKED }
        : verdict.kind === "deactivated"
          ? { kind: "message", text: DEACTIVATED }
          : { kind: "not-an-employee" },
    );
    setBusy(false);
  }

  function goHome(role: StaffRole) {
    // A fresh idle clock, started only now the code is in: the stale one left
    // by an earlier session in this browser would otherwise end the new
    // session on its first request. It also drops the old clock offset, so
    // the request guard measures it again.
    restartIdleClock(Date.now());
    // The session cookie is set; refresh() makes the server layout re-read
    // my_staff_profile instead of serving a cached anonymous render.
    router.replace(portalHome(role));
    router.refresh();
  }

  async function handleCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || step.kind !== "code") return;
    setError(null);
    setBusy(true);

    const failure = await verifyAccountAuthenticator(createClient(), code);
    if (failure) {
      // A wrong code stays on this step: the password was right.
      setError({ kind: "message", text: failure });
      setBusy(false);
      return;
    }
    goHome(step.role);
  }

  // Cancel at the code or enrolment step: the password-only session is
  // ended (local scope), so another person can sign in on a shared computer.
  async function handleCancel() {
    setBusy(true);
    await createClient().auth.signOut({ scope: "local" });
    setEmail("");
    setPassword("");
    setCode("");
    setError(null);
    setStep({ kind: "password" });
    setBusy(false);
  }

  if (!checked) return null;

  const errorAlert = error && (
    <p role="alert" className="text-[12.5px] text-pretty text-red-600">
      {error.kind === "message" ? (
        error.text
      ) : (
        <>
          This sign-in is for City employees. If you are a resident, use the citizen portal instead.{" "}
          <a href={CITIZEN_PORTAL_PATH} className="font-semibold text-lucena-blue underline">
            Go to the citizen portal
          </a>
        </>
      )}
    </p>
  );

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- a small static seal, as on the Admin sign-in */}
          <img src="/lucena-seal.png" alt="Official seal of the City of Lucena" className="h-11 w-11 shrink-0 object-contain" />
          <div>
            <h1 className="text-[17px] leading-tight font-bold text-gray-900">City employee sign-in</h1>
            <p className="text-[12.5px] text-gray-500">Lucena City Portal</p>
          </div>
        </div>

        {idleSignOut && (
          <p role="status" className="mt-4 text-[12.5px] text-gray-600">
            You were signed out after a period of inactivity.
          </p>
        )}

        {step.kind === "password" && (
          <form className="mt-5 flex flex-col gap-3" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={emailId} className="text-[13px] font-medium text-gray-900">
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
              <label htmlFor={passwordId} className="text-[13px] font-medium text-gray-900">
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

            {errorAlert}

            <button type="submit" disabled={busy} className={`mt-1 ${PRIMARY_BUTTON}`}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        )}

        {step.kind === "code" && (
          <form className="mt-5 flex flex-col gap-3" onSubmit={handleCode}>
            <p className="text-[12.5px] text-pretty text-gray-600">
              Enter the 6-digit code from your authenticator app.
            </p>
            <AuthenticatorCodeField value={code} onChange={setCode} />
            {errorAlert}
            <button type="submit" disabled={busy} className={`mt-1 ${PRIMARY_BUTTON}`}>
              {busy ? "Checking…" : "Verify"}
            </button>
          </form>
        )}

        {step.kind === "enrol" && (
          <div className="mt-5">
            <AuthenticatorEnrolment onEnrolled={() => goHome(step.role)} />
          </div>
        )}

        {step.kind !== "password" && (
          <button
            type="button"
            onClick={() => void handleCancel()}
            disabled={busy}
            className="mt-2 h-10 w-full rounded-md text-[14px] font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        )}

        <p className="mt-4 text-[12px] text-pretty text-gray-500">
          Your account is created for you by the city. If you cannot get in, ask your Super Staff
          to send a new sign-in link.
        </p>
      </div>
    </main>
  );
}
