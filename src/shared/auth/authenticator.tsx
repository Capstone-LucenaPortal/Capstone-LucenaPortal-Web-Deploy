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
import { Fragment, useCallback, useEffect, useId, useRef, useState, type FormEvent, type Ref } from "react";
import { EMPLOYEE_SIGN_IN_PATH } from "@/shared/guard/portals";
import { createClient } from "@/shared/supabase/client";
import { authenticatorCodeErrorMessage } from "@/shared/supabase/sign-in-error";

const PRIMARY_BUTTON =
  "h-12 rounded-md bg-lucena-blue text-[15px] font-semibold text-white hover:bg-lucena-blue-dark disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400";

/**
 * Checks a code against an authenticator. Any space is taken out (some apps
 * show one in the middle), though AuthenticatorCodeField keeps digits only.
 * A right code raises the session to aal2, and a first right code makes an
 * enrolled factor count. Returns the message to show on failure, or null.
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

/** An authenticator code is six digits. */
const AUTHENTICATOR_CODE_LENGTH = 6;

/**
 * A code step: the code it asks for, its check and the check's refusal, the
 * same on every step that asks for one (#159). Spread `field` onto the
 * AuthenticatorCodeField and `button(label)` onto the step's submit button,
 * which stays off until all six digits are in and reads "Checking…" while
 * busy; nothing is sent on the sixth digit by itself. A refused code is
 * cleared, not kept for fixing: codes roll every 30 seconds, so people
 * retype. `notice`, if any, is the error shown on arrival. `held` is the
 * page busy with something else, such as signing out on Cancel: no code is
 * sent then, and the button reads as busy.
 */
export function useAuthenticatorCode({ notice = null, held = false }: { notice?: string | null; held?: boolean } = {}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(notice);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const complete = code.length === AUTHENTICATOR_CODE_LENGTH;
  const off = busy || held;

  /**
   * Checks the code with `verify`, which returns the message to show on
   * failure, or null. A refused code shows its message and empties the boxes,
   * the cursor back in the first one; a right one runs onVerified, the step
   * left busy as it goes on.
   */
  async function submit(verify: (code: string) => Promise<string | null>, onVerified: () => void) {
    if (off) return;
    setError(null);
    setBusy(true);

    const failure = await verify(code);
    if (failure) {
      setError(failure);
      setBusy(false);
      setCode("");
      ref.current?.focus();
      return;
    }
    onVerified();
  }

  return {
    error,
    busy,
    submit,
    /** Empties the boxes and drops the refusal, for leaving the step. */
    reset: () => {
      setCode("");
      setError(null);
    },
    field: { value: code, onChange: setCode, ref },
    button: (label: string) => ({ disabled: off || !complete, children: off ? "Checking…" : label }),
  };
}

/**
 * The code field: six boxes with a dash between each, so the length shows at
 * a glance (#157). One real input lies transparent over the drawn boxes, so
 * the label, phone code suggestions, password managers, paste and screen
 * readers all work on it as on any field; the boxes are aria-hidden. Only
 * digits are kept, at most six, so a pasted "123 456" or "123-456" is 123456.
 */
export function AuthenticatorCodeField({
  value,
  onChange,
  ref,
}: {
  value: string;
  onChange: (value: string) => void;
  ref?: Ref<HTMLInputElement>;
}) {
  const id = useId();
  // The box the next digit goes in; the last one once all six are in.
  const next = Math.min(value.length, AUTHENTICATOR_CODE_LENGTH - 1);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-gray-900">
        Authenticator code
      </label>
      <div className="group relative">
        <div aria-hidden className="flex items-center gap-1">
          {Array.from({ length: AUTHENTICATOR_CODE_LENGTH }, (_, i) => (
            <Fragment key={i}>
              {i > 0 && <span className="shrink-0 text-gray-400">–</span>}
              <span
                className={`flex h-12 min-w-0 flex-1 items-center justify-center rounded-md border border-gray-300 bg-white text-[20px] font-semibold text-gray-900 ${
                  i === next ? "group-focus-within:border-lucena-blue group-focus-within:ring-2 group-focus-within:ring-lucena-blue" : ""
                }`}
              >
                {value[i] ?? ""}
              </span>
            </Fragment>
          ))}
        </div>
        <input
          id={id}
          ref={ref}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          // No maxLength: the browser would cut a pasted "123 456" to
          // "123 45" before onChange could take the space out.
          required
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, AUTHENTICATOR_CODE_LENGTH))}
          // The cursor stays at the end, so a digit always goes in the next
          // empty box and Backspace empties the last filled one. Only a
          // selection of the whole code stands, for pasting over it.
          onSelect={(e) => {
            const input = e.currentTarget;
            const end = input.value.length;
            const atEnd = input.selectionStart === end && input.selectionEnd === end;
            const all = input.selectionStart === 0 && input.selectionEnd === end;
            if (!atEnd && !all) input.setSelectionRange(end, end);
          }}
          // text-base: a smaller font makes iOS zoom in on focus.
          className="absolute inset-0 h-full w-full cursor-text bg-transparent text-base text-transparent caret-transparent outline-none selection:bg-transparent"
        />
      </div>
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
  const code = useAuthenticatorCode();

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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (enrolment.kind !== "ready") return;
    const { factorId } = enrolment;
    void code.submit((value) => verifyAuthenticatorCode(createClient(), factorId, value), onEnrolled);
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
          <AuthenticatorCodeField {...code.field} />
          {code.error && (
            <p role="alert" className="text-[12.5px] text-pretty text-red-600">
              {code.error}
            </p>
          )}
          <button type="submit" className={PRIMARY_BUTTON} {...code.button("Confirm")} />
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
  const code = useAuthenticatorCode({ notice });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void code.submit((value) => verifyAccountAuthenticator(createClient(), value), onVerified);
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
          <AuthenticatorCodeField {...code.field} />
          {code.error && (
            <p role="alert" className="text-[12.5px] text-pretty text-red-600">
              {code.error}
            </p>
          )}
          <button type="submit" className={PRIMARY_BUTTON} {...code.button("Verify")} />
        </form>
      </section>
      <InviteCancel />
    </>
  );
}
