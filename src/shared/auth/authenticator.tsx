"use client";

// The authenticator (TOTP) steps of a City employee's sign-in (ADR 0009): the
// code field, its check, and enrolment for an account with none. Enrolment is
// one shared step: /employee shows it to a signed-in account with no
// authenticator, and each accept-invite page shows it after the password. An
// account that has one gives its code on accept-invite before the password.
//
// All of it runs on the shared staff session (ADR 0004). One verified TOTP
// factor per account; no SMS.

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { EMPLOYEE_SIGN_IN_PATH } from "@/shared/guard/portals";
import { createClient } from "@/shared/supabase/client";
import { authenticatorCodeErrorMessage } from "@/shared/supabase/sign-in-error";

const FIELD =
  "h-11 rounded-md border border-gray-300 px-3 text-sm text-gray-900 focus-visible:border-lucena-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lucena-blue";

const PRIMARY_BUTTON =
  "h-12 rounded-md bg-lucena-blue text-[15px] font-semibold text-white hover:bg-lucena-blue-dark disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400";

/**
 * Checks a code against an authenticator, as typed (the space some apps show
 * in the middle is taken out). A right code raises the session to aal2, and
 * a first right code makes an enrolled factor count. Returns the message to
 * show on failure, or null.
 */
export async function verifyAuthenticatorCode(
  supabase: ReturnType<typeof createClient>,
  factorId: string,
  code: string,
): Promise<string | null> {
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.replace(/\s/g, "") });
  return error ? authenticatorCodeErrorMessage(error) : null;
}

/** For a lookup that failed before any code was checked. */
export const ACCOUNT_UNCHECKED = "Could not check your account. Try again.";

/**
 * Checks a code against the signed-in account's one verified authenticator
 * (enrolment keeps it to one), for an account that already has it. A failed
 * lookup never reached the code, so it is not called a wrong one. Returns the
 * message to show on failure, or null.
 */
export async function verifyAccountAuthenticator(
  supabase: ReturnType<typeof createClient>,
  code: string,
): Promise<string | null> {
  const { data: factors, error } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp[0];
  if (error || !factor) return ACCOUNT_UNCHECKED;
  return verifyAuthenticatorCode(supabase, factor.id, code);
}

/** Where accept-invite starts once the link's session is in. */
export type BeforeInvitePassword = "code" | "password";

/**
 * What comes before the password on accept-invite. An account that already
 * has an authenticator (a resent recovery link) gives its code first: the
 * auth server will not change its password from a password-only session
 * (insufficient_aal), and a code-verified one always can (#87). A level that
 * cannot be read leaves the password first.
 */
export async function stepBeforeInvitePassword(
  supabase: ReturnType<typeof createClient>,
): Promise<BeforeInvitePassword> {
  try {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !data) return "password";
    return data.currentLevel === "aal1" && data.nextLevel === "aal2" ? "code" : "password";
  } catch {
    return "password";
  }
}

/** Where accept-invite goes once the password is set. */
export type AfterInvitePassword = "enrol" | "sign-in" | "home";

/**
 * What follows the password on accept-invite, by the session's assurance
 * level: an account with no authenticator enrols there; a code-verified
 * session (an account that gave its code first) goes home. An account still
 * password-only with an authenticator, or a level that cannot be read, is
 * left to /employee, never enrolled a second time.
 */
export async function stepAfterInvitePassword(
  supabase: ReturnType<typeof createClient>,
): Promise<AfterInvitePassword> {
  try {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !data) return "sign-in";
    if (data.currentLevel === "aal2") return "home";
    return data.nextLevel === "aal2" ? "sign-in" : "enrol";
  } catch {
    return "sign-in";
  }
}

export function AuthenticatorCodeField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-gray-900">
        Authenticator code
      </label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        // Room for "123 456".
        maxLength={7}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${FIELD} tracking-[0.2em]`}
      />
    </div>
  );
}

type Enrolment =
  | { kind: "starting" }
  | { kind: "failed" }
  | { kind: "ready"; factorId: string; qrCode: string; secret: string };

/**
 * Enrols an authenticator for the signed-in account: shows the QR code and
 * the secret as text, then confirms a first code before the factor counts.
 * Any unverified factor left by an abandoned attempt is removed first, so a
 * restart is clean. Once confirmed the session is code-verified (aal2) and
 * onEnrolled runs.
 */
export function AuthenticatorEnrolment({ onEnrolled }: { onEnrolled: () => void }) {
  const [enrolment, setEnrolment] = useState<Enrolment>({ kind: "starting" });
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const start = useCallback(async () => {
    setEnrolment({ kind: "starting" });
    const supabase = createClient();
    try {
      const { data: listed, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) throw listError;
      for (const stale of listed.all.filter((factor) => factor.status === "unverified")) {
        const { error: unenrolError } = await supabase.auth.mfa.unenroll({ factorId: stale.id });
        if (unenrolError) throw unenrolError;
      }
      const { data, error: enrolError } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (enrolError) throw enrolError;
      setEnrolment({ kind: "ready", factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
    } catch {
      setEnrolment({ kind: "failed" });
    }
  }, []);

  // Once per mount: React's development double-mount would otherwise start
  // two enrolments, each removing the other's factor.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void start();
  }, [start]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || enrolment.kind !== "ready") return;
    setError(null);
    setBusy(true);

    const failure = await verifyAuthenticatorCode(createClient(), enrolment.factorId, code);
    if (failure) {
      setError(failure);
      setBusy(false);
      return;
    }
    onEnrolled();
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[15px] font-semibold text-gray-900">Set up your authenticator</h2>
      <p className="text-[12.5px] text-pretty text-gray-600">
        Your account needs an authenticator app before you can go on. Scan this QR code with an app
        such as Google Authenticator or Microsoft Authenticator.
      </p>

      {enrolment.kind === "starting" && (
        <p role="status" className="text-[12.5px] text-gray-500">
          Preparing your authenticator…
        </p>
      )}

      {enrolment.kind === "failed" && (
        <div className="flex flex-col gap-2">
          <p role="alert" className="text-[12.5px] text-pretty text-red-600">
            Could not start setting up your authenticator. Check your connection.
          </p>
          <button
            type="button"
            onClick={() => void start()}
            className="h-10 rounded-md border border-gray-300 text-[14px] font-medium text-gray-900 hover:bg-gray-50"
          >
            Try again
          </button>
        </div>
      )}

      {enrolment.kind === "ready" && (
        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          {/* eslint-disable-next-line @next/next/no-img-element -- an SVG data URL from the auth server */}
          <img
            src={enrolment.qrCode}
            alt="QR code for your authenticator app"
            className="mx-auto h-44 w-44 rounded-md border border-gray-200 bg-white p-2"
          />
          <div className="flex flex-col gap-1">
            <p className="text-[12.5px] text-gray-600">Can&apos;t scan it? Enter this key in the app instead:</p>
            <code className="rounded-md bg-gray-100 px-3 py-2 text-[13px] break-all text-gray-900 select-all">
              {enrolment.secret}
            </code>
          </div>
          <p className="text-[12.5px] text-gray-600">Then enter the 6-digit code the app shows.</p>
          <AuthenticatorCodeField value={code} onChange={setCode} />
          {error && (
            <p role="alert" className="text-[12.5px] text-pretty text-red-600">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy} className={PRIMARY_BUTTON}>
            {busy ? "Checking…" : "Confirm"}
          </button>
        </form>
      )}
    </section>
  );
}

/**
 * The way out of accept-invite's code and enrolment steps. It ends the
 * password-only session in this browser (local scope), so on a shared
 * computer the next person at /employee is not handed this account, and goes
 * to /employee: the link is spent, and the next sign-in asks again.
 */
function InviteCancel() {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  async function handleCancel() {
    setLeaving(true);
    await createClient().auth.signOut({ scope: "local" });
    router.replace(EMPLOYEE_SIGN_IN_PATH);
  }

  return (
    <button
      type="button"
      onClick={() => void handleCancel()}
      disabled={leaving}
      className="mt-2 h-10 w-full rounded-md text-[14px] font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed"
    >
      Cancel
    </button>
  );
}

/** Enrolment on accept-invite, with a way out (see InviteCancel). */
export function InviteEnrolment({ onEnrolled }: { onEnrolled: () => void }) {
  return (
    <>
      <AuthenticatorEnrolment onEnrolled={onEnrolled} />
      <InviteCancel />
    </>
  );
}

/**
 * The code step on accept-invite, for an account that already has an
 * authenticator: a right code raises the session to aal2, so the password
 * that follows can be set, and onVerified runs. A wrong code stays here.
 * notice, if any, says why the person was sent back here.
 */
export function InviteAuthenticatorCode({
  notice = null,
  onVerified,
}: {
  notice?: string | null;
  onVerified: () => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(notice);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);

    const failure = await verifyAccountAuthenticator(createClient(), code);
    if (failure) {
      setError(failure);
      setBusy(false);
      return;
    }
    onVerified();
  }

  return (
    <>
      <section className="flex flex-col gap-3">
        <h2 className="text-[15px] font-semibold text-gray-900">Enter your authenticator code</h2>
        <p className="text-[12.5px] text-pretty text-gray-600">
          Your account already has an authenticator. Enter the 6-digit code from your app, then
          set your new password.
        </p>
        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <AuthenticatorCodeField value={code} onChange={setCode} />
          {error && (
            <p role="alert" className="text-[12.5px] text-pretty text-red-600">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy} className={PRIMARY_BUTTON}>
            {busy ? "Checking…" : "Verify"}
          </button>
        </form>
      </section>
      <InviteCancel />
    </>
  );
}
