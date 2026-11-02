// A newly invited City employee sets up their authenticator on accept-invite,
// right after the password (ADR 0009, #82), so their first sign-in is already
// protected. The four staff-side pages are near-copies, so one table runs
// them all, rendered with the Supabase auth client stubbed. The stub keeps
// the one session the link opened (password-only, aal1) and its account's
// factors, as the auth server would: a right code raises it to aal2, and a
// password change on an account with an authenticator needs aal2 (#87).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthApiError, type AuthError } from "@supabase/supabase-js";
import AdminAcceptInvitePage from "@/app/(admin)/admin/accept-invite/page";
import StaffAcceptInvitePage from "@/app/(staff)/staff/(auth)/accept-invite/page";
import SuperStaffAcceptInvitePage from "@/app/(super-staff)/super-staff/(auth)/accept-invite/page";
import ResponderAcceptInvitePage from "@/app/(responder)/responder/(auth)/accept-invite/page";
import { LAST_ACTIVITY_COOKIE } from "@/shared/guard/idle-clock";

type Factor = { id: string; status: "verified" | "unverified" };

const CODE = "123456";

let signedIn = true;
let aal: "aal1" | "aal2" = "aal1";
let factors: Factor[] = [];
let enrolments = 0;
let passwordSet: string | null = null;
let aalReadable = true;
let updateUserRefusal: AuthError | null = null;

const hasAuthenticator = () => factors.some((f) => f.status === "verified");

const replace = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));

// vi.mock's first argument must be a relative path, not the `@/...` alias —
// see src/portals/admin/features/auth/hooks/use-auth.test.tsx for why.
vi.mock("../supabase/client", () => ({
  createClient: () => ({
    auth: {
      exchangeCodeForSession: async () => ({ error: null }),
      updateUser: async ({ password }: { password: string }) => {
        if (updateUserRefusal) return { data: { user: null }, error: updateUserRefusal };
        if (aal === "aal1" && hasAuthenticator()) {
          const error = new AuthApiError(
            "AAL2 session is required to update email or password when MFA is enabled.",
            401,
            "insufficient_aal",
          );
          return { data: { user: null }, error };
        }
        passwordSet = password;
        return { data: { user: {} }, error: null };
      },
      signOut: async () => {
        signedIn = false;
        return { error: null };
      },
      mfa: {
        getAuthenticatorAssuranceLevel: async () =>
          aalReadable
            ? { data: { currentLevel: aal, nextLevel: hasAuthenticator() ? "aal2" : "aal1" }, error: null }
            : { data: null, error: new AuthApiError("Service Unavailable", 503, undefined) },
        listFactors: async () => {
          const all = factors.map((f) => ({ ...f, factor_type: "totp" }));
          return { data: { all, totp: all.filter((f) => f.status === "verified"), phone: [] }, error: null };
        },
        unenroll: async ({ factorId }: { factorId: string }) => {
          factors = factors.filter((f) => f.id !== factorId);
          return { data: { id: factorId }, error: null };
        },
        enroll: async () => {
          enrolments += 1;
          const id = `factor-${enrolments}`;
          factors.push({ id, status: "unverified" });
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
          const factor = factors.find((f) => f.id === factorId);
          if (!factor || code !== CODE) {
            return { data: null, error: new AuthApiError("Invalid TOTP code entered", 422, "mfa_verification_failed") };
          }
          factor.status = "verified";
          aal = "aal2";
          return { data: {}, error: null };
        },
      },
    },
  }),
}));

const PAGES = [
  { portal: "Admin", path: "/admin/accept-invite", home: "/admin/dashboard", idle: false, Page: AdminAcceptInvitePage },
  { portal: "Staff", path: "/staff/accept-invite", home: "/staff/dashboard", idle: true, Page: StaffAcceptInvitePage },
  { portal: "Super Staff", path: "/super-staff/accept-invite", home: "/super-staff/accounts", idle: true, Page: SuperStaffAcceptInvitePage },
  { portal: "Responder", path: "/responder/accept-invite", home: "/responder/pool", idle: true, Page: ResponderAcceptInvitePage },
];

describe.each(PAGES)("$portal accept-invite: enrolling an authenticator", ({ path, home, idle, Page }) => {
  beforeEach(() => {
    vi.clearAllMocks();
    signedIn = true;
    aal = "aal1";
    factors = [];
    enrolments = 0;
    passwordSet = null;
    aalReadable = true;
    updateUserRefusal = null;
    document.cookie = `${LAST_ACTIVITY_COOKIE}=1; Path=/`;
    window.history.replaceState({}, "", `${path}?code=good-code`);
  });

  async function setPassword() {
    const user = userEvent.setup({ delay: null });
    await screen.findByText("Set your password");

    await user.type(screen.getByLabelText("New password"), "lucena2026");
    await user.type(screen.getByLabelText("Confirm password"), "lucena2026");
    await user.click(screen.getByRole("button", { name: "Set password and continue" }));
  }

  async function enterCode(code: string, button = "Confirm") {
    const user = userEvent.setup({ delay: null });
    const field = await screen.findByLabelText("Authenticator code");
    await user.clear(field);
    await user.type(field, code);
    await user.click(screen.getByRole("button", { name: button }));
  }

  it(`goes from the password into enrolment, and a confirmed code lands on ${home}`, async () => {
    render(<Page />);
    await setPassword();

    expect(await screen.findByText("Set up your authenticator")).toBeInTheDocument();
    expect(await screen.findByAltText("QR code for your authenticator app")).toBeInTheDocument();
    expect(screen.getByText("SECRET1KEY")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();

    await enterCode(CODE);

    await waitFor(() => expect(replace).toHaveBeenCalledWith(home));
    expect(refresh).toHaveBeenCalled();
    expect(factors).toEqual([{ id: "factor-1", status: "verified" }]);
    expect(aal).toBe("aal2");
  });

  it("keeps a wrong confirming code on the enrolment step, nowhere to go yet", async () => {
    render(<Page />);
    await setPassword();
    await enterCode("000000");

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Set up your authenticator")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
    expect(factors).toEqual([{ id: "factor-1", status: "unverified" }]);
  });

  // On a shared computer, an abandoned enrolment would otherwise leave the
  // password-only session for the next person at /employee to enrol into.
  it("signs out of this browser on Cancel at enrolment and goes to /employee, nothing enrolled", async () => {
    render(<Page />);
    await setPassword();
    await screen.findByLabelText("Authenticator code");

    await userEvent.setup({ delay: null }).click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/employee"));
    expect(signedIn).toBe(false);
    expect(replace).not.toHaveBeenCalledWith(home);
    expect(factors.some((f) => f.status === "verified")).toBe(false);
  });

  // Super-staff's resend sends an existing account a recovery link to this
  // same page; that account already has an authenticator, and the auth server
  // will not change its password until the code is in (#87).
  describe("an account that already has an authenticator (a resent link)", () => {
    beforeEach(() => {
      factors = [{ id: "existing", status: "verified" }];
    });

    it(`asks for the code before the password, then lands on ${home} without enrolling`, async () => {
      render(<Page />);

      expect(await screen.findByLabelText("Authenticator code")).toBeInTheDocument();
      expect(screen.queryByText("Set your password")).not.toBeInTheDocument();

      await enterCode(CODE, "Verify");
      await setPassword();

      await waitFor(() => expect(replace).toHaveBeenCalledWith(home));
      expect(replace).not.toHaveBeenCalledWith("/employee");
      expect(passwordSet).toBe("lucena2026");
      expect(enrolments).toBe(0);
      expect(factors).toEqual([{ id: "existing", status: "verified" }]);
    });

    it("keeps a wrong code on the code step with its own message, the password step not shown", async () => {
      render(<Page />);
      await enterCode("000000", "Verify");

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "That code didn't match. Check your authenticator app and try again.",
      );
      expect(screen.getByLabelText("Authenticator code")).toBeInTheDocument();
      expect(screen.queryByText("Set your password")).not.toBeInTheDocument();
      expect(aal).toBe("aal1");
      expect(replace).not.toHaveBeenCalled();
    });

    it("signs out of this browser on Cancel at the code step and goes to /employee", async () => {
      render(<Page />);
      await screen.findByLabelText("Authenticator code");

      await userEvent.setup({ delay: null }).click(screen.getByRole("button", { name: "Cancel" }));

      await waitFor(() => expect(replace).toHaveBeenCalledWith("/employee"));
      expect(signedIn).toBe(false);
      expect(passwordSet).toBeNull();
    });

    // A level that cannot be read leaves the password first; the auth server
    // then refuses it, and the page goes back for the code.
    it("goes back to the code step, in plain words, when the password is refused for want of the code", async () => {
      aalReadable = false;
      render(<Page />);
      await setPassword();

      expect(await screen.findByLabelText("Authenticator code")).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Enter your authenticator code before setting a new password.",
      );
      expect(screen.queryByText(/AAL2/)).not.toBeInTheDocument();
      expect(passwordSet).toBeNull();
    });
  });

  it.each([
    [
      new AuthApiError("New password should be different from the old password.", 422, "same_password"),
      "Choose a password different from your current one.",
    ],
    [
      new AuthApiError("User not allowed", 403, "not_admin"),
      "Could not set your password. Try again, or ask your Super Staff to send a new link.",
    ],
  ])("shows plain copy, never Supabase's message, for a refused password ($message)", async (refusal, copy) => {
    updateUserRefusal = refusal;
    render(<Page />);
    await setPassword();

    expect(await screen.findByRole("alert")).toHaveTextContent(copy);
    expect(screen.queryByText(refusal.message)).not.toBeInTheDocument();
    expect(screen.getByText("Set your password")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it.runIf(idle)("restarts the idle clock once the code is entered, not at the password", async () => {
    render(<Page />);
    await setPassword();
    await screen.findByLabelText("Authenticator code");
    expect(document.cookie).toContain(`${LAST_ACTIVITY_COOKIE}=1`);

    await enterCode(CODE);

    await waitFor(() => expect(replace).toHaveBeenCalledWith(home));
    expect(document.cookie).toMatch(new RegExp(`${LAST_ACTIVITY_COOKIE}=\\d{13}`));
  });
});
