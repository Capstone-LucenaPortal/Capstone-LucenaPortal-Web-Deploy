import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";
import { LoginForm } from "./login-form";
import { LAST_ACTIVITY_COOKIE } from "@/portals/super-staff/lib/supabase/idle-timeout";

// The idle-timeout half of SCRUM-152 on the sign-in screen. The server page
// (src/app/(super-staff)/super-staff/(auth)/login/page.tsx) reads ?reason=idle
// and passes it down.

const signInWithPassword = vi.fn();
const replace = vi.fn();
const refresh = vi.fn();

vi.mock("@/shared/supabase/client", () => ({
  createClient: () => ({ auth: { signInWithPassword } }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  document.cookie = `${LAST_ACTIVITY_COOKIE}=1; Path=/`;
});

async function fillAndSubmit() {
  const user = userEvent.setup();
  // By accessible name, not placeholder: a placeholder is not a label (SCRUM-155).
  await user.type(screen.getByLabelText("Email"), "admin@lucena.gov");
  await user.type(screen.getByLabelText("Password"), "secret-password");
  await user.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("LoginForm", () => {
  it("shows one generic message for a credential failure", async () => {
    signInWithPassword.mockResolvedValue({
      error: new AuthApiError("Invalid login credentials", 400, "invalid_credentials"),
    });
    render(<LoginForm />);
    await fillAndSubmit();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Incorrect email or password.");
    expect(alert).not.toHaveTextContent("Invalid login credentials");
    expect(replace).not.toHaveBeenCalled();
  });

  // ISO-9: offline, the official was told their password was wrong.
  it("blames the connection, not the credentials, when offline", async () => {
    signInWithPassword.mockResolvedValue({
      error: new AuthRetryableFetchError("Failed to fetch", 0),
    });
    render(<LoginForm />);
    await fillAndSubmit();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Cannot reach the server. Check your connection and try again.",
    );
    expect(alert).not.toHaveTextContent(/password/i);
    expect(replace).not.toHaveBeenCalled();
  });

  // Without this, the stale clock left by an earlier session in the same
  // browser would end the new one on its first request.
  it("restarts the idle clock on success", async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    render(<LoginForm />);
    await fillAndSubmit();

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/super-staff/accounts"));
    expect(document.cookie).not.toContain(`${LAST_ACTIVITY_COOKIE}=1;`);
    expect(document.cookie).toMatch(new RegExp(`${LAST_ACTIVITY_COOKIE}=\\d{13}`));
  });

  it("says why when the session ended for inactivity", () => {
    render(<LoginForm idleSignOut />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "You were signed out after 15 minutes of inactivity.",
    );
  });

  it("says nothing extra on an ordinary visit", () => {
    render(<LoginForm />);

    expect(screen.queryByRole("status")).toBeNull();
  });
});
