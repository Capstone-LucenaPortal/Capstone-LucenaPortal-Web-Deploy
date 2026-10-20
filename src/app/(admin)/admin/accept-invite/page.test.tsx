// src/app/(admin)/admin/accept-invite/page.test.tsx
//
// /accept-invite is where SuperStaff's staff-accounts Edge Function sends an
// invited admin (and where it resends recovery links). See
// src/app/(admin)/admin/accept-invite/page.tsx for the three token shapes it accepts.
import { vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AcceptInvitePage from "@/app/(admin)/admin/accept-invite/page";

const replaceMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, refresh: refreshMock }),
}));

const mockSetSession = vi.fn();
const mockExchangeCodeForSession = vi.fn();
const mockVerifyOtp = vi.fn();
const mockGetSession = vi.fn();
const mockUpdateUser = vi.fn();

const mockSupabase = {
  auth: {
    setSession: mockSetSession,
    exchangeCodeForSession: mockExchangeCodeForSession,
    verifyOtp: mockVerifyOtp,
    getSession: mockGetSession,
    updateUser: mockUpdateUser,
  },
};

// vi.mock's first argument must be a relative path, not the `@/...` alias —
// see src/portals/admin/features/auth/hooks/use-auth.test.tsx for why.
vi.mock("../../../../shared/supabase/client", () => ({
  createClient: () => mockSupabase,
}));

function setUrl(pathname: string, search = "", hash = "") {
  window.history.replaceState({}, "", `${pathname}${search}${hash}`);
}

describe("AcceptInvitePage", () => {
  beforeEach(() => {
    replaceMock.mockClear();
    refreshMock.mockClear();
    mockSetSession.mockReset();
    mockExchangeCodeForSession.mockReset();
    mockVerifyOtp.mockReset();
    mockGetSession.mockReset().mockResolvedValue({ data: { session: null } });
    mockUpdateUser.mockReset();
    setUrl("/admin/accept-invite");
  });

  it("exchanges a PKCE code for a session and reaches the ready phase", async () => {
    setUrl("/admin/accept-invite", "?code=pkce-code-123");
    mockExchangeCodeForSession.mockResolvedValue({ error: null });

    render(<AcceptInvitePage />);

    expect(await screen.findByText("Set your password")).toBeInTheDocument();
    expect(mockExchangeCodeForSession).toHaveBeenCalledWith("pkce-code-123");
    expect(screen.getByText(/Set your password for your/)).toHaveTextContent("Admin");
  });

  it("verifies a token_hash with type=recovery for a resent link", async () => {
    setUrl("/admin/accept-invite", "?token_hash=abc123&type=recovery");
    mockVerifyOtp.mockResolvedValue({ error: null });

    render(<AcceptInvitePage />);

    await screen.findByText("Set your password");
    expect(mockVerifyOtp).toHaveBeenCalledWith({
      token_hash: "abc123",
      type: "recovery",
    });
  });

  it("verifies a token_hash with no type as an invite", async () => {
    setUrl("/admin/accept-invite", "?token_hash=abc123");
    mockVerifyOtp.mockResolvedValue({ error: null });

    render(<AcceptInvitePage />);

    await screen.findByText("Set your password");
    expect(mockVerifyOtp).toHaveBeenCalledWith({
      token_hash: "abc123",
      type: "invite",
    });
  });

  it("shows the invalid-link phase when the code exchange fails", async () => {
    setUrl("/admin/accept-invite", "?code=dead-code");
    mockExchangeCodeForSession.mockResolvedValue({
      error: { message: "invalid grant" },
    });

    render(<AcceptInvitePage />);

    expect(
      await screen.findByText("This link is no longer valid"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to sign in" })).toBeInTheDocument();
  });

  it("shows the invalid-link phase when GoTrue reports an error in the URL", async () => {
    setUrl("/admin/accept-invite", "?error=access_denied");

    render(<AcceptInvitePage />);

    expect(
      await screen.findByText("This link is no longer valid"),
    ).toBeInTheDocument();
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
    expect(mockVerifyOtp).not.toHaveBeenCalled();
  });

  it("falls back to an existing session when the URL carries no token", async () => {
    setUrl("/admin/accept-invite");
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: "u1" } } } });

    render(<AcceptInvitePage />);

    await screen.findByText("Set your password");
    expect(mockGetSession).toHaveBeenCalled();
  });

  it("shows the invalid-link phase when there is no token and no session", async () => {
    setUrl("/admin/accept-invite");
    mockGetSession.mockResolvedValue({ data: { session: null } });

    render(<AcceptInvitePage />);

    expect(
      await screen.findByText("This link is no longer valid"),
    ).toBeInTheDocument();
  });

  it("shows the failed phase, not invalid, when checking the link throws", async () => {
    setUrl("/admin/accept-invite", "?code=some-code");
    mockExchangeCodeForSession.mockRejectedValue(new Error("network down"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<AcceptInvitePage />);

    expect(
      await screen.findByText("We could not check your link"),
    ).toBeInTheDocument();
    expect(screen.queryByText("This link is no longer valid")).not.toBeInTheDocument();

    consoleError.mockRestore();
  });

  it("rejects a password mismatch without calling updateUser", async () => {
    setUrl("/admin/accept-invite", "?code=good-code");
    mockExchangeCodeForSession.mockResolvedValue({ error: null });
    const user = userEvent.setup();

    render(<AcceptInvitePage />);
    await screen.findByText("Set your password");

    await user.type(screen.getByLabelText("New password"), "password123");
    await user.type(screen.getByLabelText("Confirm password"), "password124");
    await user.click(screen.getByRole("button", { name: "Set password and continue" }));

    expect(await screen.findByText("The two passwords do not match.")).toBeInTheDocument();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("rejects a too-short password without calling updateUser", async () => {
    setUrl("/admin/accept-invite", "?code=good-code");
    mockExchangeCodeForSession.mockResolvedValue({ error: null });
    const user = userEvent.setup();

    render(<AcceptInvitePage />);
    await screen.findByText("Set your password");

    await user.type(screen.getByLabelText("New password"), "short");
    await user.type(screen.getByLabelText("Confirm password"), "short");
    await user.click(screen.getByRole("button", { name: "Set password and continue" }));

    expect(await screen.findByText("Use at least 8 characters.")).toBeInTheDocument();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("shows the server error and does not redirect when updateUser fails", async () => {
    setUrl("/admin/accept-invite", "?code=good-code");
    mockExchangeCodeForSession.mockResolvedValue({ error: null });
    mockUpdateUser.mockResolvedValue({ error: { message: "Password too weak" } });
    const user = userEvent.setup();

    render(<AcceptInvitePage />);
    await screen.findByText("Set your password");

    await user.type(screen.getByLabelText("New password"), "password123");
    await user.type(screen.getByLabelText("Confirm password"), "password123");
    await user.click(screen.getByRole("button", { name: "Set password and continue" }));

    expect(await screen.findByText("Password too weak")).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("calls updateUser and redirects to /dashboard on success", async () => {
    setUrl("/admin/accept-invite", "?code=good-code");
    mockExchangeCodeForSession.mockResolvedValue({ error: null });
    mockUpdateUser.mockResolvedValue({ error: null });
    const user = userEvent.setup();

    render(<AcceptInvitePage />);
    await screen.findByText("Set your password");

    await user.type(screen.getByLabelText("New password"), "password123");
    await user.type(screen.getByLabelText("Confirm password"), "password123");
    await user.click(screen.getByRole("button", { name: "Set password and continue" }));

    await waitFor(() =>
      expect(mockUpdateUser).toHaveBeenCalledWith({ password: "password123" }),
    );
    expect(replaceMock).toHaveBeenCalledWith("/admin/dashboard");
    expect(refreshMock).toHaveBeenCalled();
  });
});
