// src/app/(admin)/admin/login/page.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "@/app/(admin)/admin/login/page";
import { vi } from "vitest";
import { AuthApiError, AuthError, AuthRetryableFetchError } from "@supabase/supabase-js";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const signInMock = vi.fn();
let mockSession: { user: { id: string } } | null = null;
let mockIsLoading = false;

// See the note in src/portals/admin/features/auth/hooks/use-auth.test.tsx: vi.mock's first
// argument must be a relative path, not the `@/...` alias, since it is a
// plain string rather than an import specifier the SWC alias transform rewrites.
vi.mock("../../../../portals/admin/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({
    session: mockSession,
    profile: null,
    isLoading: mockIsLoading,
    isAdmin: false,
    isDeactivated: false,
    signIn: signInMock,
    signOut: vi.fn(),
  }),
}));

function renderLoginPage() {
  return render(<LoginPage />);
}

describe("LoginPage", () => {
  beforeEach(() => {
    pushMock.mockClear();
    signInMock.mockReset();
    mockSession = null;
    mockIsLoading = false;
  });

  it("renders the Lucena City header and an email field, with no demo-credentials hint", async () => {
    renderLoginPage();
    expect(await screen.findByText("Welcome Back")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
    expect(screen.queryByText(/demo credentials/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/admin \/ admin123/)).not.toBeInTheDocument();
  });

  it("shows a fixed generic error, never Supabase's raw message, on invalid credentials", async () => {
    // Different raw messages for "no such user" vs. "wrong password" would
    // let an attacker enumerate which emails have accounts. The UI must
    // show one fixed string for every credential failure.
    signInMock.mockResolvedValue({
      error: new AuthApiError("Invalid login credentials", 400, "invalid_credentials"),
    });
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(await screen.findByLabelText("Email"), "admin@lucena.local");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    expect(await screen.findByText("Incorrect email or password.")).toBeInTheDocument();
    expect(screen.queryByText("Invalid login credentials")).not.toBeInTheDocument();
    expect(signInMock).toHaveBeenCalledWith("admin@lucena.local", "wrong-password");
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("shows the same generic error for a different underlying Supabase message", async () => {
    signInMock.mockResolvedValue({
      error: new AuthApiError("User not found", 400, "user_not_found"),
    });
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(await screen.findByLabelText("Email"), "nobody@lucena.local");
    await user.type(screen.getByLabelText("Password"), "whatever");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    expect(await screen.findByText("Incorrect email or password.")).toBeInTheDocument();
  });

  // ISO-9: offline, or with the auth server down, the admin was told their
  // password was wrong, and retyped it or asked for a reset.
  it("blames the connection, not the credentials, when offline", async () => {
    signInMock.mockResolvedValue({ error: new AuthRetryableFetchError("Failed to fetch", 0) });
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(await screen.findByLabelText("Email"), "admin@lucena.local");
    await user.type(screen.getByLabelText("Password"), "pw");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    // An alert, so a screen reader announces it like the other employee logins.
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Cannot reach the server. Check your connection and try again.",
    );
    expect(alert).not.toHaveTextContent(/password/i);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("awaits signIn and redirects to /dashboard on valid credentials", async () => {
    signInMock.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(await screen.findByLabelText("Email"), "dev.admin@lucena.local");
    await user.type(screen.getByLabelText("Password"), "DevAdmin!2026");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    expect(signInMock).toHaveBeenCalledWith("dev.admin@lucena.local", "DevAdmin!2026");
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/admin/dashboard"));
  });

  it("redirects an already-authenticated visitor to /dashboard without flashing the form", async () => {
    mockSession = { user: { id: "user-1" } };
    renderLoginPage();
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/admin/dashboard"));
    expect(screen.queryByText("Welcome Back")).not.toBeInTheDocument();
  });

  // Security-hardening round: the fields used to be submittable empty (the
  // browser fired a signIn("", "") round-trip) and carried no autocomplete
  // hints, so password managers could not tell this login apart from a
  // generic form.
  it("marks both fields required with autocomplete hints", async () => {
    renderLoginPage();
    const email = await screen.findByLabelText("Email");
    const password = screen.getByLabelText("Password");
    expect(email).toBeRequired();
    expect(email).toHaveAttribute("autocomplete", "email");
    expect(password).toBeRequired();
    expect(password).toHaveAttribute("autocomplete", "current-password");
  });

  it("disables the submit button while signIn is in flight, then re-enables on error", async () => {
    let resolveSignIn!: (value: { error: AuthError | null }) => void;
    signInMock.mockImplementation(
      () => new Promise<{ error: AuthError | null }>((resolve) => (resolveSignIn = resolve)),
    );
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(await screen.findByLabelText("Email"), "admin@lucena.local");
    await user.type(screen.getByLabelText("Password"), "pw");
    await user.click(screen.getByRole("button", { name: /sign/i }));

    expect(screen.getByRole("button", { name: /sign/i })).toBeDisabled();

    resolveSignIn({
      error: new AuthApiError("Invalid login credentials", 400, "invalid_credentials"),
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Sign In" })).toBeEnabled(),
    );
  });

  it("trims surrounding whitespace from the email before signing in", async () => {
    signInMock.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(await screen.findByLabelText("Email"), "  admin@lucena.local  ");
    await user.type(screen.getByLabelText("Password"), "pw");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() =>
      expect(signInMock).toHaveBeenCalledWith("admin@lucena.local", "pw"),
    );
  });

  it("lowercases the email before signing in, for case-insensitive matching", async () => {
    signInMock.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(await screen.findByLabelText("Email"), "Admin@Lucena.Local");
    await user.type(screen.getByLabelText("Password"), "pw");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() =>
      expect(signInMock).toHaveBeenCalledWith("admin@lucena.local", "pw"),
    );
  });
});
