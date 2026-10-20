import { render, screen, within } from "@testing-library/react";
import AdminLayout from "@/app/(admin)/admin/(shell)/layout";
import { vi } from "vitest";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => "/admin/dashboard",
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
let mockProfile: MockProfile = null;

vi.mock("../../../../portals/admin/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({
    session: mockSession,
    profile: mockProfile,
    isLoading: mockIsLoading,
    isAdmin: mockProfile?.role === "admin" && mockProfile?.status === "active",
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));

function renderLayout() {
  return render(
    <AdminLayout>
      <p>protected content</p>
    </AdminLayout>
  );
}

describe("AdminLayout auth guard", () => {
  beforeEach(() => {
    pushMock.mockClear();
    mockSignOut.mockClear().mockResolvedValue({ error: null });
    mockSession = null;
    mockIsLoading = false;
    mockProfile = null;
  });

  it("renders nothing while the session is loading", () => {
    mockIsLoading = true;
    const { container } = renderLayout();
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("protected content")).not.toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("redirects to /login when there is no session", () => {
    mockSession = null;
    renderLayout();
    expect(pushMock).toHaveBeenCalledWith("/admin/login");
    expect(screen.queryByText("protected content")).not.toBeInTheDocument();
  });

  it("renders the sidebar and children for an active admin", () => {
    mockSession = { user: { id: "user-1" } };
    mockProfile = { role: "admin", status: "active" };
    renderLayout();
    expect(screen.getByText("protected content")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  // Task 3.5: a <main> landmark with id="main" is what the skip link below
  // targets, and is what lets assistive tech jump straight to page content
  // instead of walking the sidebar nav on every page.
  it("renders the content inside a <main id=\"main\"> landmark for an active admin", () => {
    mockSession = { user: { id: "user-1" } };
    mockProfile = { role: "admin", status: "active" };
    renderLayout();
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main");
    expect(within(main).getByText("protected content")).toBeInTheDocument();
  });

  // Task 3.5: the skip link must be reachable (an <a href="#main">) and must
  // be the first focusable element in the authorized layout — ahead of the
  // sidebar's hamburger button / nav links / logout — so it's the first Tab
  // stop on every admin page.
  it("renders a skip-to-content link, pointing at #main, ahead of the sidebar's controls in the DOM for an active admin", () => {
    mockSession = { user: { id: "user-1" } };
    mockProfile = { role: "admin", status: "active" };
    renderLayout();
    const skipLink = screen.getByRole("link", { name: "Skip to content" });
    expect(skipLink).toHaveAttribute("href", "#main");

    const focusable = screen
      .getAllByRole("link")
      .concat(screen.getAllByRole("button"))
      .filter((el) => document.body.contains(el));
    // compareDocumentPosition: DOCUMENT_POSITION_FOLLOWING (4) means the
    // other node comes after this one — i.e. skipLink is first in the DOM
    // relative to every other link/button the layout renders.
    for (const el of focusable) {
      if (el === skipLink) continue;
      expect(skipLink.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  // Task 3.5: neither refusal screen renders the skip link or the <main>
  // landmark — both belong to the authorized branch only (the AccessRefusal
  // screen has its own, much simpler, tree).
  it("does not render a skip link or a <main> landmark on the not-authorised screen", () => {
    mockSession = { user: { id: "user-2" } };
    mockProfile = { role: "staff", status: "active" };
    renderLayout();
    expect(screen.queryByRole("link", { name: "Skip to content" })).not.toBeInTheDocument();
    expect(screen.queryByRole("main")).not.toBeInTheDocument();
  });

  it("shows the wrong-portal message, with a link to the account's own portal, for a signed-in non-admin", () => {
    mockSession = { user: { id: "user-2" } };
    mockProfile = { role: "staff", status: "active" };
    renderLayout();
    expect(screen.getByText(/wrong portal/i)).toBeInTheDocument();
    expect(
      screen.getByText(/your account is a staff account\. sign in at the staff portal instead\./i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to the Staff portal" })).toBeInTheDocument();
    expect(screen.queryByText("protected content")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Dashboard" })).not.toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("shows the deactivated message, naming Super Staff, distinct from the wrong-portal message, for a deactivated admin", () => {
    mockSession = { user: { id: "user-3" } };
    mockProfile = { role: "admin", status: "inactive" };
    renderLayout();
    expect(screen.getByText(/your account has been deactivated/i)).toBeInTheDocument();
    expect(screen.getByText(/contact your super staff to have it reactivated/i)).toBeInTheDocument();
    expect(screen.queryByText(/system administrator/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/wrong portal/i)).not.toBeInTheDocument();
    expect(screen.queryByText("protected content")).not.toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("shows the not-an-employee message for a signed-in account with no staff profile", () => {
    mockSession = { user: { id: "user-4" } };
    mockProfile = null;
    renderLayout();
    expect(screen.getByText(/this portal is for city employees/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to the citizen portal" })).toBeInTheDocument();
  });

  // Regression guard: a refused session used to stay alive until a manual
  // "Sign out" click. AccessRefusal now clears it itself on mount, so a
  // wrong-role or deactivated account can never keep a live session in a
  // portal it does not belong to.
  it("signs the session out as soon as a refusal screen mounts", () => {
    mockSession = { user: { id: "user-2" } };
    mockProfile = { role: "staff", status: "active" };
    renderLayout();
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it("shows a link back to sign in from every refusal screen", () => {
    mockSession = { user: { id: "user-3" } };
    mockProfile = { role: "admin", status: "inactive" };
    renderLayout();
    expect(screen.getByRole("link", { name: "Back to sign in" })).toHaveAttribute(
      "href",
      "/admin/login",
    );
  });

  // Regression guard: AccessRefusal's auto sign-out feeds a real SIGNED_OUT
  // event back into AuthProvider (the browser Supabase client is a
  // singleton), which drops `session` (and `profile`) to null a moment
  // after this layout first renders the refusal. That must not swap the
  // screen for a redirect to /login, and must not change the message by
  // recomputing decideRoleAccess against the now-null profile.
  it("keeps the refusal screen on screen — not a /login redirect — after sign-out clears the session mid-render", () => {
    mockSession = { user: { id: "user-2" } };
    mockProfile = { role: "staff", status: "active" };
    const { rerender } = renderLayout();
    expect(screen.getByText(/wrong portal/i)).toBeInTheDocument();
    expect(
      screen.getByText(/your account is a staff account\. sign in at the staff portal instead\./i),
    ).toBeInTheDocument();

    // Simulate the SIGNED_OUT event's downstream effect on AuthProvider.
    mockSession = null;
    mockProfile = null;
    rerender(
      <AdminLayout>
        <p>protected content</p>
      </AdminLayout>,
    );

    expect(screen.getByText(/wrong portal/i)).toBeInTheDocument();
    expect(
      screen.getByText(/your account is a staff account\. sign in at the staff portal instead\./i),
    ).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalledWith("/admin/login");
  });

  it("shows the signed-out confirmation once sign-out actually succeeds", async () => {
    mockSession = { user: { id: "user-2" } };
    mockProfile = { role: "staff", status: "active" };
    mockSignOut.mockResolvedValue({ error: null });
    renderLayout();
    expect(await screen.findByText(/you have been signed out of this portal/i)).toBeInTheDocument();
  });

  it("does not claim the user was signed out when sign-out fails, and shows a fallback instead", async () => {
    mockSession = { user: { id: "user-2" } };
    mockProfile = { role: "staff", status: "active" };
    mockSignOut.mockResolvedValue({ error: { message: "network error" } });
    renderLayout();
    expect(await screen.findByText(/could not sign you out/i)).toBeInTheDocument();
    expect(screen.queryByText(/you have been signed out of this portal/i)).not.toBeInTheDocument();
  });
});
