import { render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShellGate } from "./shell-gate";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

const signOut = vi.fn();
vi.mock("@/shared/supabase/client", () => ({
  createClient: () => ({ auth: { signOut } }),
}));

type Profile = { role: string; status: string } | null;
type AuthState = { session: { user: { id: string } } | null; isLoading: boolean; profile: Profile };

// AuthProvider's state, stepped through by each test the way its events move it.
let auth: AuthState;
vi.mock("@/portals/admin/features/auth/hooks/use-auth", () => ({
  useAuth: () => auth,
}));

const ADMIN_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";
const ACTIVE_ADMIN = { role: "admin", status: "active" };

// Stands in for the page, with something like an open PII review modal in it:
// counts how often it mounts, since a remount re-fires the modal's audited read.
let mounts = 0;
function Page() {
  useEffect(() => {
    mounts += 1;
  }, []);
  return <p>page content</p>;
}

function renderGate() {
  const view = render(
    <ShellGate>
      <Page />
    </ShellGate>,
  );
  const step = (next: AuthState) => {
    auth = next;
    view.rerender(
      <ShellGate>
        <Page />
      </ShellGate>,
    );
  };
  return { ...view, step };
}

// AuthProvider's first state, and then the browser's read of the same session
// the server already judged.
const FIRST_STATE: AuthState = { session: null, isLoading: true, profile: null };
const LOADED_A: AuthState = { session: { user: { id: ADMIN_A } }, isLoading: false, profile: ACTIVE_ADMIN };

function loadedGate() {
  const view = renderGate();
  view.step({ session: { user: { id: ADMIN_A } }, isLoading: true, profile: null });
  view.step(LOADED_A);
  return view;
}

beforeEach(() => {
  auth = FIRST_STATE;
  mounts = 0;
  signOut.mockResolvedValue({ error: null });
});

afterEach(() => {
  push.mockClear();
  refresh.mockClear();
  signOut.mockReset();
});

describe("ShellGate on page load", () => {
  // Issue #150: the server already judged this session, so the browser's first
  // read of it must not blank the page.
  it("shows the page while the browser is still reading the session", () => {
    renderGate();
    expect(screen.getByText("page content")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("keeps the same page mounted through the browser's first read", () => {
    loadedGate();
    expect(screen.getByText("page content")).toBeInTheDocument();
    expect(mounts).toBe(1);
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("ShellGate mid-visit", () => {
  it("sends this tab to the sign-in when the session ends (signed out in another tab)", () => {
    const { step } = loadedGate();

    // SIGNED_OUT: a user change, so AuthProvider raises isLoading first.
    step({ session: null, isLoading: true, profile: null });
    expect(push).not.toHaveBeenCalled();
    step({ session: null, isLoading: false, profile: null });

    expect(push).toHaveBeenCalledWith("/employee");
    expect(screen.queryByText("page content")).not.toBeInTheDocument();
  });

  it("does not remount the page on a same-user event such as TOKEN_REFRESHED", () => {
    const { step } = loadedGate();

    step({ ...LOADED_A, profile: { ...ACTIVE_ADMIN } });

    expect(screen.getByText("page content")).toBeInTheDocument();
    expect(mounts).toBe(1);
  });

  it("hides the page while a different user's profile loads", () => {
    const { step } = loadedGate();

    step({ session: { user: { id: USER_B } }, isLoading: true, profile: null });

    expect(screen.queryByText("page content")).not.toBeInTheDocument();
  });

  it("shows the page again for a different active admin, and re-renders the shell for them", () => {
    const { step } = loadedGate();

    step({ session: { user: { id: USER_B } }, isLoading: true, profile: null });
    step({ session: { user: { id: USER_B } }, isLoading: false, profile: ACTIVE_ADMIN });

    expect(screen.getByText("page content")).toBeInTheDocument();
    // The server's name in the Sidebar was the old admin's.
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("refuses a different user the server never judged", () => {
    const { step } = loadedGate();

    step({ session: { user: { id: USER_B } }, isLoading: true, profile: null });
    step({ session: { user: { id: USER_B } }, isLoading: false, profile: { role: "staff", status: "active" } });

    expect(screen.getByText(/wrong portal/i)).toBeInTheDocument();
    expect(screen.queryByText("page content")).not.toBeInTheDocument();
  });

  // The server judged this admin. AuthProvider drops read errors, so a
  // same-user re-read that comes back empty says nothing about the account,
  // and must not refuse an active admin or close an open review modal.
  it("does not judge the same admin again when a same-user re-read comes back empty", () => {
    const { step } = loadedGate();

    step({ ...LOADED_A, profile: null });

    expect(screen.getByText("page content")).toBeInTheDocument();
    expect(screen.queryByText(/for city employees/i)).not.toBeInTheDocument();
    expect(mounts).toBe(1);
  });

  // The pin: a deactivated account's refusal signs it out, which drops the
  // session a moment later. The message must stay, not turn into a redirect
  // or a different message.
  it("keeps a deactivated user's refusal on screen after its sign-out drops the session", () => {
    const { step } = loadedGate();

    step({ session: { user: { id: USER_B } }, isLoading: true, profile: null });
    step({ session: { user: { id: USER_B } }, isLoading: false, profile: { role: "admin", status: "inactive" } });
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });

    step({ session: null, isLoading: true, profile: null });
    step({ session: null, isLoading: false, profile: null });

    expect(screen.getByText(/your account has been deactivated/i)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
