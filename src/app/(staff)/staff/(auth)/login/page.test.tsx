import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";
import LoginPage from "./page";
import { LAST_ACTIVITY_COOKIE } from "@/portals/staff/lib/supabase/idle-timeout";

const signInWithPassword = vi.fn();
const replace = vi.fn();
const refresh = vi.fn();
let searchParams = new URLSearchParams();

vi.mock("@/shared/supabase/client", () => ({
  createClient: () => ({ auth: { signInWithPassword } }),
}));

// The role of the account already signed in to this browser (issue #19);
// use-signed-in-staff-role.test.ts covers how it is read.
let signedInAs: string | null = null;

vi.mock("@/shared/supabase/use-signed-in-staff-role", () => ({
  useSignedInStaffRole: () => signedInAs,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
  useSearchParams: () => searchParams,
}));

beforeEach(() => {
  vi.clearAllMocks();
  signedInAs = null;
  searchParams = new URLSearchParams();
  document.cookie = `${LAST_ACTIVITY_COOKIE}=1; Path=/`;
});

async function fillAndSubmit() {
  const user = userEvent.setup();
  // By accessible name, not placeholder: a placeholder is not a label (SCRUM-155).
  await user.type(screen.getByLabelText("Email"), "Juan@Lucena.Gov ");
  await user.type(screen.getByLabelText("Password"), "hunter2");
  await user.click(screen.getByRole("button", { name: /sign in/i }));
}

describe("LoginPage", () => {
  it("normalises the email before sending it", async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    render(<LoginPage />);
    await fillAndSubmit();

    // Trimmed and lowercased: GoTrue treats addresses case-sensitively on
    // lookup, so a capitalised address would fail to match a real account.
    await waitFor(() =>
      expect(signInWithPassword).toHaveBeenCalledWith({
        email: "juan@lucena.gov",
        password: "hunter2",
      }),
    );
  });

  it("sends the user to the dashboard and refreshes on success", async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    render(<LoginPage />);
    await fillAndSubmit();

    // refresh() forces the server layout to re-read my_staff_profile instead
    // of serving a cached anonymous render.
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/staff/dashboard"));
    expect(refresh).toHaveBeenCalled();
  });

  it("shows one generic message for any credential failure", async () => {
    signInWithPassword.mockResolvedValue({
      error: new AuthApiError("Invalid login credentials", 400, "invalid_credentials"),
    });
    render(<LoginPage />);
    await fillAndSubmit();

    // Distinguishing "no such account" from "wrong password" tells an attacker
    // which employee emails are real.
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Incorrect email or password.",
    );
    expect(replace).not.toHaveBeenCalled();
  });

  // ISO-9: offline, or with the auth server down, the staff member was told
  // their password was wrong, and retyped it or asked for a reset.
  // Status 0 is a fetch that threw (offline); 503 is a gateway with the auth
  // server down. Neither reached the credential check.
  it.each([
    ["Failed to fetch", 0],
    ["Service Unavailable", 503],
  ])("blames the connection, not the credentials, on %s (%i)", async (message, status) => {
    signInWithPassword.mockResolvedValue({
      error: new AuthRetryableFetchError(message, status),
    });
    render(<LoginPage />);
    await fillAndSubmit();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Cannot reach the server. Check your connection and try again.",
    );
    expect(alert).not.toHaveTextContent(/password/i);
    expect(replace).not.toHaveBeenCalled();
  });

  // The limit applies whether or not the email exists, so naming it gives
  // nothing away about the account.
  it("says to wait, not that the credentials are wrong, when rate-limited", async () => {
    signInWithPassword.mockResolvedValue({
      error: new AuthApiError("Request rate limit reached", 429, "over_request_rate_limit"),
    });
    render(<LoginPage />);
    await fillAndSubmit();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Too many attempts. Wait a minute and try again.");
    expect(alert).not.toHaveTextContent(/password/i);
    expect(replace).not.toHaveBeenCalled();
  });

  // Without this, the stale clock left by an earlier session in the same
  // browser would end the new one on its first request.
  it("restarts the idle clock on success", async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    render(<LoginPage />);
    await fillAndSubmit();

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/staff/dashboard"));
    expect(document.cookie).not.toContain(`${LAST_ACTIVITY_COOKIE}=1;`);
    expect(document.cookie).toMatch(new RegExp(`${LAST_ACTIVITY_COOKIE}=\\d{13}`));
  });

  it("says why when the session ended for inactivity", () => {
    searchParams = new URLSearchParams("reason=idle");
    render(<LoginPage />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "You were signed out after 15 minutes of inactivity.",
    );
  });

  it("says nothing extra on an ordinary visit", () => {
    render(<LoginPage />);

    expect(screen.queryByRole("status")).toBeNull();
  });

  // Issue #19: another Portal's account is shown this form with its session
  // kept, so the form says who is signed in and links back to their Portal.
  it("says who is signed in, with a link to their portal", () => {
    signedInAs = "responder";
    render(<LoginPage />);

    expect(screen.getByText(/you are signed in with a Responder account\./i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to the Responder portal" })).toHaveAttribute("href", "/responder");
  });

  it("says nothing about a session when no staff account is signed in", () => {
    render(<LoginPage />);

    expect(screen.queryByText(/you are signed in/i)).not.toBeInTheDocument();
  });
});
