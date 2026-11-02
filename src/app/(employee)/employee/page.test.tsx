import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthApiError, AuthRetryableFetchError, type AuthError } from "@supabase/supabase-js";
import EmployeeSignInPage from "./page";
import { LAST_ACTIVITY_COOKIE } from "@/shared/guard/idle-clock";

// The one City employee sign-in (ADR 0009, #80, #81), rendered with the
// Supabase auth client stubbed. The stub keeps one session, as the staff
// cookie would, and each account's authenticator factors, as the auth server
// would: a password sign-in opens a password-only (aal1) session, a right
// code raises it to aal2, a sign-out ends it, and my_staff_profile answers
// for whoever holds it.

type Row = { role: string | null; status: string | null } | null;
type Factor = { id: string; status: "verified" | "unverified" };

const CODE = "123456";

let session: { account: string; aal: "aal1" | "aal2" } | null = null;
let accounts: Record<string, Row> = {};
let factors: Record<string, Factor[]> = {};
let signInError: AuthError | null = null;
let verifyError: AuthError | null = null;
let profileReadFails = false;
let enrolFails = false;
let enrolments = 0;

const replace = vi.fn();
const refresh = vi.fn();
let reason: string | null = null;

function factorsOf(account: string) {
  return (factors[account] ??= []);
}

vi.mock("@/shared/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: async () => ({ data: { session } }),
      signInWithPassword: async ({ email }: { email: string }) => {
        if (signInError) return { data: { session: null }, error: signInError };
        session = { account: email, aal: "aal1" };
        return { data: { session }, error: null };
      },
      signOut: async () => {
        session = null;
        return { error: null };
      },
      mfa: {
        getAuthenticatorAssuranceLevel: async () => {
          if (!session) return { data: { currentLevel: null, nextLevel: null }, error: null };
          const enrolled = factorsOf(session.account).some((f) => f.status === "verified");
          return { data: { currentLevel: session.aal, nextLevel: enrolled ? "aal2" : "aal1" }, error: null };
        },
        listFactors: async () => {
          const all = session ? factorsOf(session.account) : [];
          const totp = all.filter((f) => f.status === "verified").map((f) => ({ ...f, factor_type: "totp" }));
          return { data: { all: all.map((f) => ({ ...f, factor_type: "totp" })), totp, phone: [] }, error: null };
        },
        unenroll: async ({ factorId }: { factorId: string }) => {
          const account = session!.account;
          factors[account] = factorsOf(account).filter((f) => f.id !== factorId);
          return { data: { id: factorId }, error: null };
        },
        enroll: async () => {
          if (enrolFails) return { data: null, error: new AuthRetryableFetchError("Failed to fetch", 0) };
          enrolments += 1;
          const id = `factor-${enrolments}`;
          factorsOf(session!.account).push({ id, status: "unverified" });
          return {
            data: {
              id,
              type: "totp",
              totp: { qr_code: `data:image/svg+xml;utf-8,<svg id="${id}"/>`, secret: `SECRET${enrolments}KEY`, uri: "otpauth://totp/x" },
            },
            error: null,
          };
        },
        challengeAndVerify: async ({ factorId, code }: { factorId: string; code: string }) => {
          if (verifyError) return { data: null, error: verifyError };
          const factor = factorsOf(session!.account).find((f) => f.id === factorId);
          if (!factor || code !== CODE) {
            return { data: null, error: new AuthApiError("Invalid TOTP code entered", 422, "mfa_verification_failed") };
          }
          factor.status = "verified";
          session!.aal = "aal2";
          return { data: {}, error: null };
        },
      },
    },
    from: (view: string) => ({
      select: () => ({
        maybeSingle: async () => {
          if (view !== "my_staff_profile") throw new Error(`unexpected view ${view}`);
          if (profileReadFails) return { data: null, error: { message: "timeout" } };
          return { data: session ? (accounts[session.account] ?? null) : null, error: null };
        },
      }),
    }),
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
  useSearchParams: () => new URLSearchParams(reason ? { reason } : {}),
}));

const enrolled = (): Factor[] => [{ id: "phone", status: "verified" }];

beforeEach(() => {
  vi.clearAllMocks();
  session = null;
  accounts = {
    "staff@lucena.gov": { role: "staff", status: "active" },
    "super@lucena.gov": { role: "super_staff", status: "active" },
    "responder@lucena.gov": { role: "responder", status: "active" },
    "admin@lucena.gov": { role: "admin", status: "active" },
    "new@lucena.gov": { role: "staff", status: "active" },
    "gone@lucena.gov": { role: "staff", status: "inactive" },
    "resident@example.com": null,
  };
  factors = {
    "staff@lucena.gov": enrolled(),
    "super@lucena.gov": enrolled(),
    "responder@lucena.gov": enrolled(),
    "admin@lucena.gov": enrolled(),
    "gone@lucena.gov": enrolled(),
  };
  signInError = null;
  verifyError = null;
  profileReadFails = false;
  enrolFails = false;
  enrolments = 0;
  reason = null;
  document.cookie = `${LAST_ACTIVITY_COOKIE}=1; Path=/`;
});

async function signInAs(email: string) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText("Email"), email);
  await user.type(screen.getByLabelText("Password"), "secret-password1");
  await user.click(screen.getByRole("button", { name: "Sign in" }));
}

async function enterCode(code: string, button: "Verify" | "Confirm" = "Verify") {
  const user = userEvent.setup();
  const field = await screen.findByLabelText("Authenticator code");
  await user.clear(field);
  await user.type(field, code);
  await user.click(screen.getByRole("button", { name: button }));
}

describe("/employee — signing in with password and code", () => {
  it.each([
    ["staff@lucena.gov", "/staff/dashboard"],
    ["super@lucena.gov", "/super-staff/accounts"],
    ["responder@lucena.gov", "/responder/pool"],
    ["admin@lucena.gov", "/admin/dashboard"],
  ])("sends %s, once the code is entered, to their own Portal's home, %s", async (email, home) => {
    render(<EmployeeSignInPage />);
    await signInAs(email);

    expect(await screen.findByText("Enter the 6-digit code from your authenticator app.")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();

    await enterCode(CODE);

    await waitFor(() => expect(replace).toHaveBeenCalledWith(home));
    expect(session?.aal).toBe("aal2");
  });

  it("matches the email whatever its case or spacing", async () => {
    render(<EmployeeSignInPage />);
    await signInAs("  Staff@Lucena.gov ");
    await enterCode(CODE);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/staff/dashboard"));
  });

  it("takes a code typed with a space in the middle, as some apps show it", async () => {
    render(<EmployeeSignInPage />);
    await signInAs("staff@lucena.gov");
    await enterCode("123 456");

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/staff/dashboard"));
  });

  // Without this, the stale clock left by an earlier session in the same
  // browser would end the new one on its first request. It starts with the
  // code, not the password.
  it("restarts the idle clock once the code is entered, not before", async () => {
    render(<EmployeeSignInPage />);
    await signInAs("responder@lucena.gov");

    await screen.findByLabelText("Authenticator code");
    expect(document.cookie).toContain(`${LAST_ACTIVITY_COOKIE}=1`);

    await enterCode(CODE);

    await waitFor(() => expect(replace).toHaveBeenCalled());
    expect(document.cookie).not.toContain(`${LAST_ACTIVITY_COOKIE}=1;`);
    expect(document.cookie).toMatch(new RegExp(`${LAST_ACTIVITY_COOKIE}=\\d{13}`));
  });

  it("keeps a wrong code on the code step with its own message", async () => {
    render(<EmployeeSignInPage />);
    await signInAs("staff@lucena.gov");
    await enterCode("000000");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That code didn't match. Check your authenticator app and try again.",
    );
    expect(screen.getByLabelText("Authenticator code")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
    expect(session?.aal).toBe("aal1");

    await enterCode(CODE);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/staff/dashboard"));
  });

  it.each([
    ["offline", new AuthRetryableFetchError("Failed to fetch", 0), "Cannot reach the server. Check your connection and try again."],
    ["rate-limited", new AuthApiError("Too many requests", 429, "over_request_rate_limit"), "Too many attempts. Wait a minute and try again."],
  ])("says so when the code cannot be checked (%s), still on the code step", async (_name, error, message) => {
    render(<EmployeeSignInPage />);
    await signInAs("staff@lucena.gov");
    verifyError = error;
    await enterCode(CODE);

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByLabelText("Authenticator code")).toBeInTheDocument();
  });

  it("signs out on Cancel at the code step, back to an empty form", async () => {
    render(<EmployeeSignInPage />);
    await signInAs("staff@lucena.gov");
    await screen.findByLabelText("Authenticator code");

    await userEvent.setup().click(screen.getByRole("button", { name: "Cancel" }));

    expect(await screen.findByLabelText("Email")).toHaveValue("");
    expect(screen.getByLabelText("Password")).toHaveValue("");
    expect(screen.queryByLabelText("Authenticator code")).toBeNull();
    expect(session).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("/employee — enrolling an authenticator", () => {
  it("makes an account with no authenticator enrol before it goes on: QR code, text secret, a confirming code", async () => {
    render(<EmployeeSignInPage />);
    await signInAs("new@lucena.gov");

    expect(await screen.findByRole("heading", { name: "Set up your authenticator" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "QR code for your authenticator app" })).toHaveAttribute(
      "src",
      'data:image/svg+xml;utf-8,<svg id="factor-1"/>',
    );
    expect(screen.getByText("SECRET1KEY")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
    // Not yet a factor that counts.
    expect(factors["new@lucena.gov"]).toEqual([{ id: "factor-1", status: "unverified" }]);

    await enterCode(CODE, "Confirm");

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/staff/dashboard"));
    expect(factors["new@lucena.gov"]).toEqual([{ id: "factor-1", status: "verified" }]);
    expect(session?.aal).toBe("aal2");
    expect(document.cookie).toMatch(new RegExp(`${LAST_ACTIVITY_COOKIE}=\\d{13}`));
  });

  it("keeps a wrong confirming code on the enrolment step, factor unverified", async () => {
    render(<EmployeeSignInPage />);
    await signInAs("new@lucena.gov");
    await enterCode("999999", "Confirm");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That code didn't match. Check your authenticator app and try again.",
    );
    expect(screen.getByText("SECRET1KEY")).toBeInTheDocument();
    expect(factors["new@lucena.gov"]).toEqual([{ id: "factor-1", status: "unverified" }]);
    expect(replace).not.toHaveBeenCalled();
  });

  it("restarts an abandoned enrolment cleanly: the stale factor is removed, one verified factor left", async () => {
    factors["new@lucena.gov"] = [{ id: "abandoned", status: "unverified" }];
    render(<EmployeeSignInPage />);
    await signInAs("new@lucena.gov");

    expect(await screen.findByText("SECRET1KEY")).toBeInTheDocument();
    expect(factors["new@lucena.gov"]).toEqual([{ id: "factor-1", status: "unverified" }]);

    await enterCode(CODE, "Confirm");

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/staff/dashboard"));
    expect(factors["new@lucena.gov"]).toEqual([{ id: "factor-1", status: "verified" }]);
  });

  it("starts afresh after leaving enrolment halfway and coming back", async () => {
    const first = render(<EmployeeSignInPage />);
    await signInAs("new@lucena.gov");
    expect(await screen.findByText("SECRET1KEY")).toBeInTheDocument();
    first.unmount();

    // The password-only session is still in the browser.
    render(<EmployeeSignInPage />);

    expect(await screen.findByText("SECRET2KEY")).toBeInTheDocument();
    expect(factors["new@lucena.gov"]).toEqual([{ id: "factor-2", status: "unverified" }]);

    await enterCode(CODE, "Confirm");
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/staff/dashboard"));
    expect(factors["new@lucena.gov"]).toEqual([{ id: "factor-2", status: "verified" }]);
  });

  it("offers to try again when enrolment cannot start", async () => {
    enrolFails = true;
    render(<EmployeeSignInPage />);
    await signInAs("new@lucena.gov");

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not start setting up your authenticator.");

    enrolFails = false;
    await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("SECRET1KEY")).toBeInTheDocument();
  });

  it("signs out on Cancel at the enrolment step", async () => {
    render(<EmployeeSignInPage />);
    await signInAs("new@lucena.gov");
    await screen.findByText("SECRET1KEY");

    await userEvent.setup().click(screen.getByRole("button", { name: "Cancel" }));

    expect(await screen.findByLabelText("Email")).toBeInTheDocument();
    expect(session).toBeNull();
  });
});

describe("/employee — refusals", () => {
  it("tells a deactivated account so, before any code, and does not leave it signed in", async () => {
    render(<EmployeeSignInPage />);
    await signInAs("gone@lucena.gov");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your account has been deactivated. Contact your Super Staff to have it reactivated.",
    );
    expect(screen.queryByLabelText("Authenticator code")).toBeNull();
    expect(session).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it("tells a citizen account this sign-in is for City employees, never asks it to enrol, and does not leave it signed in", async () => {
    render(<EmployeeSignInPage />);
    await signInAs("resident@example.com");

    expect(await screen.findByRole("alert")).toHaveTextContent("This sign-in is for City employees.");
    expect(screen.getByRole("link", { name: "Go to the citizen portal" })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("heading", { name: "Set up your authenticator" })).toBeNull();
    expect(factors["resident@example.com"]).toBeUndefined();
    expect(session).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  // A failed read is not an answer: neither route the account nor call it a
  // citizen. The fresh session is ended so nothing is left half signed in.
  it("says it could not check the account when the profile cannot be read", async () => {
    profileReadFails = true;
    render(<EmployeeSignInPage />);
    await signInAs("staff@lucena.gov");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not check your account. Try again.",
    );
    expect(session).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("/employee — sign-in errors, as on the Portal logins", () => {
  it.each([
    [
      "incorrect credentials",
      new AuthApiError("Invalid login credentials", 400, "invalid_credentials"),
      "Incorrect email or password.",
    ],
    [
      "offline",
      new AuthRetryableFetchError("Failed to fetch", 0),
      "Cannot reach the server. Check your connection and try again.",
    ],
    [
      "rate-limited",
      new AuthApiError("Request rate limit reached", 429, "over_request_rate_limit"),
      "Too many attempts. Wait a minute and try again.",
    ],
  ])("shows the %s message", async (_name, error, message) => {
    signInError = error;
    render(<EmployeeSignInPage />);
    await signInAs("staff@lucena.gov");

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("/employee — arriving", () => {
  it("says why when the session ended for inactivity", async () => {
    reason = "idle";
    render(<EmployeeSignInPage />);

    expect(await screen.findByRole("status")).toHaveTextContent(
      "You were signed out after a period of inactivity.",
    );
  });

  it("says nothing extra on an ordinary visit", async () => {
    render(<EmployeeSignInPage />);

    await screen.findByLabelText("Email");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("sends a City employee who has entered their code straight to their home", async () => {
    session = { account: "super@lucena.gov", aal: "aal2" };
    render(<EmployeeSignInPage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/super-staff/accounts"));
    expect(screen.queryByLabelText("Email")).toBeNull();
  });

  // The guard sends a password-only session here to finish (#81).
  it("asks a password-only session of an enrolled account for its code", async () => {
    session = { account: "staff@lucena.gov", aal: "aal1" };
    render(<EmployeeSignInPage />);

    expect(await screen.findByLabelText("Authenticator code")).toBeInTheDocument();
    expect(screen.queryByLabelText("Email")).toBeNull();

    await enterCode(CODE);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/staff/dashboard"));
  });

  it("makes a password-only session with no authenticator enrol", async () => {
    session = { account: "new@lucena.gov", aal: "aal1" };
    render(<EmployeeSignInPage />);

    expect(await screen.findByRole("heading", { name: "Set up your authenticator" })).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  // Only a session this page created is ended; one found here is kept.
  it("shows the form to a deactivated account already signed in, session kept", async () => {
    session = { account: "gone@lucena.gov", aal: "aal2" };
    render(<EmployeeSignInPage />);

    expect(await screen.findByLabelText("Email")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
    expect(session).not.toBeNull();
  });
});
