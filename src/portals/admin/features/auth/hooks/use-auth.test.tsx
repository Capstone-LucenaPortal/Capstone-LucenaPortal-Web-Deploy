import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AuthProvider, useAuth } from "@/portals/admin/features/auth/hooks/use-auth";
import type { Database } from "@/shared/supabase/types";
import { vi } from "vitest";

type StaffProfile = Database["public"]["Views"]["my_staff_profile"]["Row"];

// The auth context is exercised against a hand-built mock of the Supabase
// browser client rather than a real network call. `onAuthStateChangeCallback`
// captures the listener the context registers so tests can fire it manually
// to simulate Supabase emitting a SIGNED_IN / SIGNED_OUT event.
let onAuthStateChangeCallback: ((event: string, session: Session | null) => void) | null = null;

const mockAuth = {
  getSession: vi.fn(),
  onAuthStateChange: vi.fn((callback: (event: string, session: Session | null) => void) => {
    onAuthStateChangeCallback = callback;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  }),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
};

const mockMaybeSingle = vi.fn();
const mockSelect = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

const mockSupabase = {
  auth: mockAuth,
  from: mockFrom,
};

// vi.mock's first argument is a plain string, not an import specifier, so
// it is not rewritten by the SWC path-alias transform the way `@/...` imports
// elsewhere in this file are. A relative path is required for the mock to be
// registered against the same resolved module that src/portals/admin/features/auth/hooks/use-auth.tsx imports.
vi.mock("../../../../../shared/supabase/client", () => ({
  createClient: () => mockSupabase,
}));

const fakeSession = {
  access_token: "fake-access-token",
  refresh_token: "fake-refresh-token",
  expires_in: 3600,
  token_type: "bearer",
  user: { id: "user-1" },
} as unknown as Session;

function buildProfile(overrides: Partial<StaffProfile>): StaffProfile {
  return {
    created_at: "2026-01-01T00:00:00Z",
    department_code: "IT",
    department_label: "IT Department",
    email: "staff@lucena.local",
    employee_id: "EMP-1",
    full_name: "Staff Member",
    id: "user-1",
    is_supervisor: false,
    last_change_at: "2026-01-01T00:00:00Z",
    modules: [],
    on_duty: true,
    phone: null,
    role: "staff",
    status: "active",
    ...overrides,
  } as StaffProfile;
}

/** Simulates supabase emitting a session change and waits for the async
 * profile fetch it triggers to settle. */
async function emitAuthStateChange(session: Session | null) {
  await act(async () => {
    onAuthStateChangeCallback?.("SIGNED_IN", session);
  });
}

function TestConsumer() {
  const { session, profile, isLoading, isAdmin, isDeactivated, signIn, signOut } = useAuth();
  const [signInError, setSignInError] = useState<string | null>("untouched");
  const [signOutError, setSignOutError] = useState<string | null>("untouched");

  async function handleSignIn() {
    const { error } = await signIn("admin@lucena.local", "password123");
    setSignInError(error?.message ?? null);
  }

  async function handleSignOut() {
    const { error } = await signOut();
    setSignOutError(error);
  }

  if (isLoading) return <p>loading</p>;

  return (
    <div>
      <p>session: {session ? "present" : "null"}</p>
      <p>profile-role: {profile ? profile.role : "null"}</p>
      <p>isAdmin: {isAdmin ? "true" : "false"}</p>
      <p>isDeactivated: {isDeactivated ? "true" : "false"}</p>
      <p>signInError: {signInError === "untouched" ? "untouched" : signInError ?? "none"}</p>
      <p>signOutError: {signOutError === "untouched" ? "untouched" : signOutError ?? "none"}</p>
      <button onClick={handleSignIn}>sign-in</button>
      <button onClick={() => void handleSignOut()}>sign-out</button>
    </div>
  );
}

describe("AuthProvider / useAuth", () => {
  beforeEach(() => {
    onAuthStateChangeCallback = null;
    mockAuth.getSession.mockReset().mockResolvedValue({ data: { session: null } });
    mockAuth.onAuthStateChange.mockClear();
    mockAuth.signInWithPassword.mockReset();
    mockAuth.signOut.mockReset().mockResolvedValue({ error: null });
    mockFrom.mockClear();
    mockSelect.mockClear();
    mockMaybeSingle.mockReset().mockResolvedValue({ data: null, error: null });
  });

  it("resolves a signed-out user to session: null, isAdmin: false, and isLoading: false", async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    expect(await screen.findByText("session: null")).toBeInTheDocument();
    expect(screen.getByText("isAdmin: false")).toBeInTheDocument();
    expect(screen.queryByText("loading")).not.toBeInTheDocument();
  });

  it("calls signInWithPassword with exactly { email, password } and reports no error on success", async () => {
    mockAuth.signInWithPassword.mockResolvedValue({ error: null });
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );
    await screen.findByText("session: null");

    await user.click(screen.getByText("sign-in"));

    expect(mockAuth.signInWithPassword).toHaveBeenCalledTimes(1);
    expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({
      email: "admin@lucena.local",
      password: "password123",
    });
    expect(await screen.findByText("signInError: none")).toBeInTheDocument();
  });

  it("surfaces the error message on signIn failure and leaves session null", async () => {
    mockAuth.signInWithPassword.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );
    await screen.findByText("session: null");

    await user.click(screen.getByText("sign-in"));

    expect(await screen.findByText("signInError: Invalid login credentials")).toBeInTheDocument();
    expect(screen.getByText("session: null")).toBeInTheDocument();
  });

  it("sets isAdmin: true when the profile is role admin / status active", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: buildProfile({ role: "admin", status: "active" }),
      error: null,
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );
    await screen.findByText("session: null");

    await emitAuthStateChange(fakeSession);

    expect(await screen.findByText("session: present")).toBeInTheDocument();
    expect(screen.getByText("isAdmin: true")).toBeInTheDocument();
    expect(screen.getByText("isDeactivated: false")).toBeInTheDocument();

    // Assert the exact relation name. Without this, changing
    // .from("my_staff_profile") to a revoked base table would still leave
    // every assertion above green (mockMaybeSingle is a bare vi.fn that
    // answers regardless of what it was queried against) while locking every
    // admin out in production.
    expect(mockFrom).toHaveBeenCalledWith("my_staff_profile");
  });

  it("leaves isAdmin: false for a role: super_staff profile", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: buildProfile({ role: "super_staff", status: "active" }),
      error: null,
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );
    await screen.findByText("session: null");

    await emitAuthStateChange(fakeSession);

    expect(await screen.findByText("profile-role: super_staff")).toBeInTheDocument();
    expect(screen.getByText("isAdmin: false")).toBeInTheDocument();
  });

  it("sets isDeactivated: true and isAdmin: false for role: admin / status: inactive", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: buildProfile({ role: "admin", status: "inactive" }),
      error: null,
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );
    await screen.findByText("session: null");

    await emitAuthStateChange(fakeSession);

    expect(await screen.findByText("isDeactivated: true")).toBeInTheDocument();
    expect(screen.getByText("isAdmin: false")).toBeInTheDocument();
  });

  it("treats an empty my_staff_profile result as a non-error: profile null, isAdmin false", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );
    await screen.findByText("session: null");

    await emitAuthStateChange(fakeSession);

    // A non-staff user (e.g. a citizen) still has a valid session, but no
    // staff profile row. This must resolve cleanly, not hang in a loading
    // state and not throw — all three assertions must hold simultaneously.
    expect(await screen.findByText("session: present")).toBeInTheDocument();
    expect(screen.getByText("profile-role: null")).toBeInTheDocument();
    expect(screen.getByText("isAdmin: false")).toBeInTheDocument();
    expect(screen.queryByText("loading")).not.toBeInTheDocument();
  });

  it("clears session and profile and calls supabase.auth.signOut on signOut success", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: buildProfile({ role: "admin", status: "active" }),
      error: null,
    });
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );
    await screen.findByText("session: null");
    await emitAuthStateChange(fakeSession);
    expect(await screen.findByText("session: present")).toBeInTheDocument();

    await user.click(screen.getByText("sign-out"));

    expect(mockAuth.signOut).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("session: null")).toBeInTheDocument();
    expect(screen.getByText("profile-role: null")).toBeInTheDocument();
    expect(await screen.findByText("signOutError: none")).toBeInTheDocument();
  });

  // Regression guard: signOut() used to discard supabase's result entirely
  // and always clear local state. If the revoke call fails, the cookie is
  // still live server-side — clearing session/profile anyway would show a
  // logged-out-looking UI over a session that is actually still valid.
  it("surfaces the error and keeps session/profile intact when signOut fails", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: buildProfile({ role: "admin", status: "active" }),
      error: null,
    });
    mockAuth.signOut.mockResolvedValue({ error: { message: "network down" } });
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );
    await screen.findByText("session: null");
    await emitAuthStateChange(fakeSession);
    expect(await screen.findByText("session: present")).toBeInTheDocument();

    await user.click(screen.getByText("sign-out"));

    expect(await screen.findByText("signOutError: network down")).toBeInTheDocument();
    expect(screen.getByText("session: present")).toBeInTheDocument();
    expect(screen.getByText("profile-role: admin")).toBeInTheDocument();
  });

  // Regression guard for a real bug: onAuthStateChange used to call
  // setIsLoading(true) on EVERY event, and src/app/(admin)/admin/(shell)/layout.tsx renders null
  // whenever isLoading is true. Supabase fires TOKEN_REFRESHED roughly hourly
  // and on tab focus, so mid-session the whole admin subtree — including any
  // open PII review modal — would unmount and remount, re-firing its audited
  // read a second time for the same record. A same-user event must still
  // re-read the profile (deliberate: a JWT stays valid up to an hour after
  // deactivation) but must NOT drop back into a loading state or remount
  // profile-dependent children.
  it("a same-user auth event (e.g. TOKEN_REFRESHED) does not re-enter loading or remount profile-dependent children", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: buildProfile({ role: "admin", status: "active" }),
      error: null,
    });

    let mountCount = 0;
    function MountProbe() {
      useEffect(() => {
        mountCount += 1;
      }, []);
      return null;
    }

    function ConsumerWithProbe() {
      const { isLoading, isAdmin } = useAuth();
      if (isLoading) return <p>loading</p>;
      return (
        <div>
          <MountProbe />
          <p>isAdmin: {isAdmin ? "true" : "false"}</p>
        </div>
      );
    }

    render(
      <AuthProvider>
        <ConsumerWithProbe />
      </AuthProvider>
    );
    // Let the initial supabase.auth.getSession() call (which also writes
    // currentUserId, from its own resolved session) settle before the first
    // auth event fires, the same way every other test in this file's
    // preceding `await screen.findByText(...)` calls do implicitly. Without
    // this, getSession()'s pending .then() continuation resolves AFTER the
    // SIGNED_IN event below (both run inside the same emitAuthStateChange's
    // await act(async () => ...)), and — since it resolves LAST — stomps
    // currentUserId back to null right after SIGNED_IN sets it, which would
    // make the TOKEN_REFRESHED event below look like a user change too.
    await act(async () => {});

    await emitAuthStateChange(fakeSession);
    expect(await screen.findByText("isAdmin: true")).toBeInTheDocument();
    expect(mountCount).toBe(1);
    expect(mockMaybeSingle).toHaveBeenCalledTimes(1);

    // Same user id, different event — a token refresh, not a sign-in.
    //
    // This is deliberately split into a synchronous act(() => ...) followed
    // by a separate await act(async () => {}), NOT a single
    // await act(async () => { onAuthStateChangeCallback?.(...) }). With
    // mockMaybeSingle resolved synchronously-ish (a mockResolvedValue, no
    // real network round-trip), a single async act call lets
    // setIsLoading(true) and the later setIsLoading(false) from loadProfile's
    // continuation collapse into ONE commit — so even the pre-fix
    // unconditional setIsLoading(true) never produces an observable "loading"
    // render, and this test would pass against buggy code too. The
    // synchronous act flushes a render with whatever state changes happened
    // synchronously inside the callback (the buggy `if (true)` branch's
    // setIsLoading(true) among them) BEFORE loadProfile's awaited
    // .maybeSingle() call resolves, so a real intermediate "loading" commit
    // — and therefore a MountProbe unmount/remount — becomes observable.
    act(() => {
      onAuthStateChangeCallback?.("TOKEN_REFRESHED", fakeSession);
    });
    await act(async () => {});

    // The profile is still re-read on this event (deliberate)...
    expect(mockMaybeSingle).toHaveBeenCalledTimes(2);
    // ...but the UI never blanked and the child never remounted.
    expect(screen.queryByText("loading")).not.toBeInTheDocument();
    expect(screen.getByText("isAdmin: true")).toBeInTheDocument();
    expect(mountCount).toBe(1);
  });
});
