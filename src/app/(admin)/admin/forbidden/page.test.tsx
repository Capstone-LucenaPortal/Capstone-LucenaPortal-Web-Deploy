// src/app/(admin)/admin/forbidden/page.test.tsx
//
// /forbidden is where the shared request guard sends an authenticated
// non-admin (see src/shared/guard/decide.ts). It shows the same
// AccessRefusal screen as the (admin) layout's client-side gate — both call
// decideRoleAccess on the same profile — so the two gates cannot drift apart.
import { vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ForbiddenPage from "@/app/(admin)/admin/forbidden/page";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const mockSignOut = vi.fn();
const mockSupabase = { auth: { signOut: mockSignOut } };

// vi.mock's first argument is a plain string, not an import specifier, so
// it must be a relative path rather than the `@/...` alias the SWC transform
// rewrites — see src/portals/admin/features/auth/hooks/use-auth.test.tsx.
vi.mock("../../../../shared/supabase/client", () => ({
  createClient: () => mockSupabase,
}));

type MockSession = { user: { id: string } } | null;
type MockProfile = { role: string | null; status: string | null } | null;

let mockSession: MockSession = null;
let mockIsLoading = false;
let mockIsAdmin = false;
let mockProfile: MockProfile = null;

vi.mock("../../../../portals/admin/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({
    session: mockSession,
    profile: mockProfile,
    isLoading: mockIsLoading,
    isAdmin: mockIsAdmin,
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));

describe("ForbiddenPage", () => {
  beforeEach(() => {
    pushMock.mockClear();
    mockSignOut.mockClear().mockResolvedValue({ error: null });
    mockSession = { user: { id: "user-1" } };
    mockIsLoading = false;
    mockIsAdmin = false;
    mockProfile = { role: "super_staff", status: "active" };
  });

  it("shows the wrong-portal message, with a link to the account's own portal, for a non-admin staff account", () => {
    render(<ForbiddenPage />);
    expect(screen.getByText(/wrong portal/i)).toBeInTheDocument();
    expect(
      screen.getByText(/you are signed in with a Super Staff account\. use the Super Staff portal instead\./i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to the Super Staff portal" })).toHaveAttribute(
      "href",
      "/super-staff",
    );
  });

  it("shows the not-an-employee message, with a citizen portal link, for an account with no staff profile", () => {
    mockProfile = null;
    render(<ForbiddenPage />);
    expect(screen.getByText(/this portal is for city employees/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to the citizen portal" })).toHaveAttribute("href", "/");
  });

  it("shows the deactivated message, naming Super Staff (not 'system administrator'), for a deactivated admin", () => {
    mockProfile = { role: "admin", status: "inactive" };
    render(<ForbiddenPage />);
    expect(screen.getByText(/your account has been deactivated/i)).toBeInTheDocument();
    expect(screen.getByText(/contact your super staff to have it reactivated/i)).toBeInTheDocument();
    expect(screen.queryByText(/system administrator/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/wrong portal/i)).not.toBeInTheDocument();
  });

  // Issue #19: every Portal shares one session, so signing it out here (and
  // supabase-js signs out every device by default) ended the account's own
  // Portal too. Only a deactivated account is signed out, in this browser only.
  it("keeps the session of another Portal's account, with no sign-out message", async () => {
    render(<ForbiddenPage />);
    await Promise.resolve();
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(screen.queryByText(/sign you out|signed out/i)).not.toBeInTheDocument();
  });

  it("keeps a citizen's session", () => {
    mockProfile = null;
    render(<ForbiddenPage />);
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("signs a deactivated admin out of this browser only, as soon as the refusal screen mounts", () => {
    mockProfile = { role: "admin", status: "inactive" };
    render(<ForbiddenPage />);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockSignOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("shows a link back to sign in", () => {
    render(<ForbiddenPage />);
    expect(screen.getByRole("link", { name: "Back to sign in" })).toHaveAttribute(
      "href",
      "/admin/login",
    );
  });

  it("sends an active admin back to the dashboard instead of showing a refusal", () => {
    mockIsAdmin = true;
    mockProfile = { role: "admin", status: "active" };
    render(<ForbiddenPage />);
    expect(pushMock).toHaveBeenCalledWith("/admin/dashboard");
    expect(screen.queryByText(/wrong portal/i)).not.toBeInTheDocument();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("redirects to /login when there is no session", () => {
    mockSession = null;
    render(<ForbiddenPage />);
    expect(pushMock).toHaveBeenCalledWith("/admin/login");
  });

  it("renders nothing while auth state is loading", () => {
    mockIsLoading = true;
    const { container } = render(<ForbiddenPage />);
    expect(container).toBeEmptyDOMElement();
  });

  // Regression guard: AccessRefusal's auto sign-out of a deactivated admin
  // feeds a real SIGNED_OUT event back into AuthProvider (the browser
  // Supabase client is a singleton), which drops `session` (and `profile`)
  // to null a moment after this page first renders the refusal. That must not swap the
  // screen for a redirect to /login, and must not change the message by
  // recomputing decideRoleAccess against the now-null profile.
  it("keeps the refusal screen on screen — not a /login redirect — after sign-out clears the session mid-render", () => {
    mockProfile = { role: "admin", status: "inactive" };
    const { rerender } = render(<ForbiddenPage />);
    expect(screen.getByText(/your account has been deactivated/i)).toBeInTheDocument();

    // Simulate the SIGNED_OUT event's downstream effect on AuthProvider.
    mockSession = null;
    mockProfile = null;
    rerender(<ForbiddenPage />);

    expect(screen.getByText(/your account has been deactivated/i)).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalledWith("/admin/login");
  });

  it("shows the signed-out confirmation once sign-out actually succeeds", async () => {
    mockProfile = { role: "admin", status: "inactive" };
    mockSignOut.mockResolvedValue({ error: null });
    render(<ForbiddenPage />);
    expect(await screen.findByText(/you have been signed out of this portal/i)).toBeInTheDocument();
  });

  it("does not claim the user was signed out when sign-out fails, and shows a fallback instead", async () => {
    mockProfile = { role: "admin", status: "inactive" };
    mockSignOut.mockResolvedValue({ error: { message: "network error" } });
    render(<ForbiddenPage />);
    expect(await screen.findByText(/could not sign you out/i)).toBeInTheDocument();
    expect(screen.queryByText(/you have been signed out of this portal/i)).not.toBeInTheDocument();
  });
});
