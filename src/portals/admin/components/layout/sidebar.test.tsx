import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sidebar } from "@/portals/admin/components/layout/sidebar";
import { vi } from "vitest";

const pushMock = vi.fn();
const replaceMock = vi.fn();
const refreshMock = vi.fn();
// Mutable so the route-change-closes-drawer test can simulate navigation by
// changing this between renders/rerenders, the same way mockProfile below is
// used to vary useAuth's return value per test.
let mockPathname = "/admin/dashboard";

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: pushMock, replace: replaceMock, refresh: refreshMock }),
}));

const signOutMock = vi.fn();
let mockProfile: { full_name: string | null; email: string | null } | null = null;

// See src/portals/admin/features/auth/hooks/use-auth.test.tsx: vi.mock's first argument is a
// plain string, not an import specifier, so it must be a relative path
// rather than the `@/...` alias the SWC transform rewrites.
vi.mock("../../features/auth/hooks/use-auth", () => ({
  useAuth: () => ({
    session: { user: { id: "user-1" } },
    profile: mockProfile,
    isLoading: false,
    isAdmin: true,
    isDeactivated: false,
    signIn: vi.fn(),
    signOut: signOutMock,
  }),
}));

function renderSidebar() {
  return render(<Sidebar />);
}

async function openDrawer(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Open navigation menu" }));
  return screen.getByTestId("mobile-nav-drawer");
}

afterEach(() => {
  // Guard against a test leaving the real document body locked if an
  // assertion throws mid-test.
  document.body.style.overflow = "";
});

describe("Sidebar", () => {
  beforeEach(() => {
    pushMock.mockClear();
    replaceMock.mockClear();
    refreshMock.mockClear();
    signOutMock.mockClear();
    signOutMock.mockResolvedValue({ error: null });
    mockProfile = null;
    mockPathname = "/admin/dashboard";
  });

  it("renders all five admin nav items and excludes News Management", () => {
    renderSidebar();
    for (const label of ["Dashboard", "Yellow Card", "Incident Reports", "Convention Center", "SLA Reports"]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
    expect(screen.queryByText("News Management")).not.toBeInTheDocument();
  });

  it("highlights the active route", () => {
    renderSidebar();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveClass("border-blue-900", "bg-blue-50");
  });

  // Task 3.5: aria-current="page" is the programmatic signal screen readers
  // use for "this is the current nav item" — the visual highlight above
  // (border/bg classes) carries no information to assistive tech on its own.
  it("marks the active nav link with aria-current=page and every other link with no aria-current attribute", () => {
    renderSidebar();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    for (const label of ["Yellow Card", "Incident Reports", "Convention Center", "SLA Reports"]) {
      expect(screen.getByRole("link", { name: label })).not.toHaveAttribute("aria-current");
    }
  });

  // Task 3.5: the active match changed from an exact pathname === href check
  // to an anchored prefix match (pathname === href || pathname.startsWith(
  // `${href}/`)), so a nested route under a nav item (e.g. a future detail
  // page at /yellow-card/123) still highlights its parent. Anchored on "/"
  // rather than a bare startsWith so "/admin/yellow-card" itself never falsely
  // matches an unrelated route that merely shares the string prefix.
  it("highlights the nav item for a nested route under it, via aria-current", () => {
    mockPathname = "/admin/yellow-card/123";
    renderSidebar();
    expect(screen.getByRole("link", { name: "Yellow Card" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
  });

  it("shows the profile's full name rather than the hardcoded Admin User", () => {
    mockProfile = { full_name: "Maria Santos", email: "maria.santos@lucena.local" };
    renderSidebar();
    expect(screen.getByText("Welcome back, Maria Santos")).toBeInTheDocument();
    expect(screen.queryByText(/Admin User/)).not.toBeInTheDocument();
  });

  it("falls back to the email local-part when full_name is missing", () => {
    mockProfile = { full_name: null, email: "juan.delacruz@lucena.local" };
    renderSidebar();
    expect(screen.getByText("Welcome back, juan.delacruz")).toBeInTheDocument();
  });

  it("awaits signOut and replaces to /login (not push) with a refresh, on success", async () => {
    const user = userEvent.setup();
    renderSidebar();
    await user.click(screen.getByRole("button", { name: "Logout" }));
    expect(signOutMock).toHaveBeenCalled();
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/admin/login"));
    expect(refreshMock).toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("stays put and shows a specific error when sign-out fails, keeping the session live", async () => {
    // supabase-js keeps the local session alive when the revoke call fails,
    // so the cookie is still live server-side. Navigating to /login anyway
    // would show a sign-in form to someone who is in fact still signed in.
    signOutMock.mockResolvedValue({ error: "network down" });
    const user = userEvent.setup();
    renderSidebar();
    await user.click(screen.getByRole("button", { name: "Logout" }));

    expect(
      await screen.findByText("Could not sign you out. Check your connection and try again."),
    ).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("disables the Logout button while signing out, to prevent a double-click firing two sign-outs", async () => {
    let resolveSignOut!: (value: { error: string | null }) => void;
    signOutMock.mockImplementation(
      () => new Promise<{ error: string | null }>((resolve) => (resolveSignOut = resolve)),
    );
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByRole("button", { name: "Logout" }));
    expect(screen.getByRole("button", { name: /signing out/i })).toBeDisabled();
    expect(signOutMock).toHaveBeenCalledTimes(1);

    resolveSignOut({ error: null });
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/admin/login"));
  });

  describe("hamburger drawer (mobile off-canvas nav)", () => {
    it("does not render the drawer until the hamburger is opened", () => {
      renderSidebar();
      expect(screen.queryByTestId("mobile-nav-drawer")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Open navigation menu" })).toHaveAttribute(
        "aria-expanded",
        "false"
      );
    });

    it("opens the drawer, exposing aria-expanded=true and the nav links a second time inside it", async () => {
      const user = userEvent.setup();
      renderSidebar();

      const drawer = await openDrawer(user);
      expect(drawer).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Open navigation menu" })).toHaveAttribute(
        "aria-expanded",
        "true"
      );
      // The desktop aside's copy of the links is still in the DOM (only CSS-
      // hidden below md, which jsdom doesn't apply), so scope to the drawer
      // itself to assert its own copy renders.
      expect(within(drawer).getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    });

    it("locks body scroll while the drawer is open and restores it on close", async () => {
      const user = userEvent.setup();
      renderSidebar();
      expect(document.body.style.overflow).toBe("");

      await openDrawer(user);
      expect(document.body.style.overflow).toBe("hidden");

      fireEvent.keyDown(document, { key: "Escape" });
      expect(document.body.style.overflow).toBe("");
    });

    it("resets body scroll lock when the sidebar unmounts while the drawer is open", async () => {
      const user = userEvent.setup();
      const { unmount } = renderSidebar();

      await openDrawer(user);
      expect(document.body.style.overflow).toBe("hidden");

      unmount();
      expect(document.body.style.overflow).toBe("");
    });

    it("moves focus to the drawer heading when opened", async () => {
      const user = userEvent.setup();
      renderSidebar();

      const drawer = await openDrawer(user);
      const heading = within(drawer).getByRole("heading", { name: "Lucena City" });
      expect(document.activeElement).toBe(heading);
    });

    it("gives the initial-focus heading a visible focus indicator", async () => {
      const user = userEvent.setup();
      renderSidebar();

      const drawer = await openDrawer(user);
      const heading = within(drawer).getByRole("heading", { name: "Lucena City" });
      // Project-wide `focus-visible:` convention (Task 3.3), matching
      // Modal.tsx's equivalent initial-focus heading — see
      // src/portals/admin/components/ui/modal.test.tsx's identical assertion.
      expect(heading.className).toMatch(/\bfocus-visible:ring-2\b/);
      expect(heading.className).toMatch(/\bfocus-visible:ring-blue-900\b/);
    });

    it("closes on Escape and returns focus to the hamburger button", async () => {
      const user = userEvent.setup();
      renderSidebar();

      const hamburger = screen.getByRole("button", { name: "Open navigation menu" });
      await openDrawer(user);

      fireEvent.keyDown(document, { key: "Escape" });
      expect(screen.queryByTestId("mobile-nav-drawer")).not.toBeInTheDocument();
      expect(document.activeElement).toBe(hamburger);
    });

    it("closes when the backdrop is clicked", async () => {
      const user = userEvent.setup();
      renderSidebar();

      await openDrawer(user);
      // The backdrop is the aria-hidden sibling of the drawer panel inside
      // the fixed overlay wrapper.
      const overlay = screen.getByTestId("mobile-nav-drawer").parentElement!;
      const backdrop = overlay.querySelector('[aria-hidden="true"]') as HTMLElement;
      await user.click(backdrop);

      expect(screen.queryByTestId("mobile-nav-drawer")).not.toBeInTheDocument();
    });

    it("closes when the in-drawer close button is clicked", async () => {
      const user = userEvent.setup();
      renderSidebar();

      const drawer = await openDrawer(user);
      await user.click(within(drawer).getByRole("button", { name: "Close navigation menu" }));

      expect(screen.queryByTestId("mobile-nav-drawer")).not.toBeInTheDocument();
    });

    it("closes automatically on route change", async () => {
      const user = userEvent.setup();
      const { rerender } = renderSidebar();

      await openDrawer(user);
      expect(screen.getByTestId("mobile-nav-drawer")).toBeInTheDocument();

      mockPathname = "/admin/yellow-card";
      rerender(<Sidebar />);

      expect(screen.queryByTestId("mobile-nav-drawer")).not.toBeInTheDocument();
    });

    it("wraps focus from the last focusable element (Logout) back to the first (Close) on Tab", async () => {
      const user = userEvent.setup();
      renderSidebar();

      const drawer = await openDrawer(user);
      const closeButton = within(drawer).getByRole("button", { name: "Close navigation menu" });
      const logoutButton = within(drawer).getByRole("button", { name: "Logout" });

      logoutButton.focus();
      expect(document.activeElement).toBe(logoutButton);

      fireEvent.keyDown(logoutButton, { key: "Tab" });
      expect(document.activeElement).toBe(closeButton);
    });

    it("wraps focus from the first focusable element (Close) back to the last (Logout) on Shift+Tab", async () => {
      const user = userEvent.setup();
      renderSidebar();

      const drawer = await openDrawer(user);
      const closeButton = within(drawer).getByRole("button", { name: "Close navigation menu" });
      const logoutButton = within(drawer).getByRole("button", { name: "Logout" });

      closeButton.focus();
      expect(document.activeElement).toBe(closeButton);

      fireEvent.keyDown(closeButton, { key: "Tab", shiftKey: true });
      expect(document.activeElement).toBe(logoutButton);
    });
  });
});
