import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminShellLayout from "@/app/(admin)/admin/(shell)/layout";
import {
  ProfileReadError,
  getAdminProfile,
  hasSession,
  type AdminProfileRow,
} from "@/portals/admin/features/auth/lib/profile";
import { LAST_ACTIVITY_COOKIE } from "@/portals/admin/lib/supabase/idle-timeout";

const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT ${path}`);
});
const push = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (path: string) => redirect(path),
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/admin/dashboard",
}));

vi.mock("@/portals/admin/features/auth/lib/profile", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/portals/admin/features/auth/lib/profile")>()),
  getAdminProfile: vi.fn(),
  hasSession: vi.fn(),
}));

const signOut = vi.fn();
vi.mock("@/shared/supabase/client", () => ({
  createClient: () => ({ auth: { signOut } }),
}));

// useAuth's state: the browser's view of the session. The server render
// always sees AuthProvider's first state: still loading, no session yet.
let auth: { session: { user: { id: string } } | null; isLoading: boolean; profile: unknown };
vi.mock("@/portals/admin/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({ ...auth, signOut: vi.fn() }),
}));

const ACTIVE_ADMIN: AdminProfileRow = {
  id: "11111111-1111-1111-1111-111111111111",
  full_name: "Maria Santos",
  email: "maria.santos@lucenacity.gov.ph",
  role: "admin",
  status: "active",
};

async function renderLayout() {
  return render(await AdminShellLayout({ children: <p>protected content</p> }));
}

beforeEach(() => {
  auth = { session: null, isLoading: true, profile: null };
  signOut.mockResolvedValue({ error: null });
  vi.mocked(hasSession).mockResolvedValue(true);
});

afterEach(() => {
  document.cookie = `${LAST_ACTIVITY_COOKIE}=; Path=/; Max-Age=0`;
  vi.mocked(getAdminProfile).mockReset();
  vi.mocked(hasSession).mockReset();
  redirect.mockClear();
  push.mockClear();
  signOut.mockReset();
});

describe("AdminShellLayout: an active admin", () => {
  beforeEach(() => {
    vi.mocked(getAdminProfile).mockResolvedValue(ACTIVE_ADMIN);
  });

  // Issue #150: this all used to wait for the browser to read the session.
  it("renders the whole shell while the browser is still reading the session", async () => {
    await renderLayout();

    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main");
    expect(main).toHaveAttribute("tabindex", "-1");
    expect(within(main).getByText("protected content")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("welcomes the admin by name from the server's read", async () => {
    await renderLayout();
    expect(screen.getByText("Welcome back, Maria Santos")).toBeInTheDocument();
  });

  // The skip link is the first Tab stop on every Admin page.
  it("puts a skip link to #main ahead of every other link and button", async () => {
    await renderLayout();
    const skipLink = screen.getByRole("link", { name: "Skip to content" });
    expect(skipLink).toHaveAttribute("href", "#main");

    const focusable = [...screen.getAllByRole("link"), ...screen.getAllByRole("button")];
    for (const el of focusable) {
      if (el === skipLink) continue;
      expect(skipLink.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  // The browser half of the 15-minute idle timeout (SCRUM-265): it starts the
  // shared idle clock as the shell mounts.
  it("starts the idle timeout", async () => {
    await renderLayout();
    expect(document.cookie).toMatch(new RegExp(`${LAST_ACTIVITY_COOKIE}=\\d{13}`));
  });

  it("never asks whether there is a session: the profile row already says so", async () => {
    await renderLayout();
    expect(hasSession).not.toHaveBeenCalled();
  });
});

describe("AdminShellLayout: a refused account", () => {
  it.each([
    [
      "a deactivated admin",
      { ...ACTIVE_ADMIN, status: "inactive" },
      /your account has been deactivated/i,
    ],
    ["another Portal's account", { ...ACTIVE_ADMIN, role: "staff" as const }, /wrong portal/i],
    ["a signed-in non-employee", null, /this portal is for city employees/i],
  ])("refuses %s from the server and withholds the shell", async (_who, row, reason) => {
    vi.mocked(getAdminProfile).mockResolvedValue(row);

    await renderLayout();

    expect(screen.getByText(reason)).toBeInTheDocument();
    expect(screen.queryByText("protected content")).not.toBeInTheDocument();
    expect(screen.queryByRole("main")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Skip to content" })).not.toBeInTheDocument();
    expect(redirect).not.toHaveBeenCalled();
    // No idle timeout on a refusal: it would sign the account out from under
    // the message, and a wrong-portal account keeps its session.
    expect(document.cookie).not.toContain(LAST_ACTIVITY_COOKIE);
  });

  it("names the account's own Portal to a wrong-portal account, and keeps its session", async () => {
    vi.mocked(getAdminProfile).mockResolvedValue({ ...ACTIVE_ADMIN, role: "staff" });
    await renderLayout();
    expect(
      screen.getByText(/you are signed in with a staff account\. use the staff portal instead\./i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to the Staff portal" })).toBeInTheDocument();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("signs a deactivated admin out of this browser", async () => {
    vi.mocked(getAdminProfile).mockResolvedValue({ ...ACTIVE_ADMIN, status: "inactive" });
    await renderLayout();
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(await screen.findByText(/you have been signed out of this portal/i)).toBeInTheDocument();
  });

  // The pin: that sign-out drops the browser's session a moment later. It
  // must not swap the message for a redirect to the sign-in.
  it("keeps the deactivated message on screen after the sign-out drops the session", async () => {
    vi.mocked(getAdminProfile).mockResolvedValue({ ...ACTIVE_ADMIN, status: "inactive" });
    auth = { session: { user: { id: "user-1" } }, isLoading: false, profile: null };
    const element = await AdminShellLayout({ children: <p>protected content</p> });
    const { rerender } = render(element);

    auth = { session: null, isLoading: false, profile: null };
    rerender(element);

    expect(screen.getByText(/your account has been deactivated/i)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});

describe("AdminShellLayout: no session on the server", () => {
  // The request guard should have caught this first.
  it("sends the visitor to the employee sign-in, not a refusal", async () => {
    vi.mocked(getAdminProfile).mockResolvedValue(null);
    vi.mocked(hasSession).mockResolvedValue(false);

    await expect(renderLayout()).rejects.toThrow("NEXT_REDIRECT /employee");
    expect(redirect).toHaveBeenCalledWith("/employee");
  });
});

describe("AdminShellLayout: a failed profile read", () => {
  // No verdict on the account: it goes to the error page, not a refusal.
  it("hands the error to the error page instead of refusing or redirecting", async () => {
    vi.mocked(getAdminProfile).mockRejectedValue(
      new ProfileReadError({ message: "timeout", code: "57014" }),
    );

    await expect(renderLayout()).rejects.toBeInstanceOf(ProfileReadError);
    expect(redirect).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });
});
