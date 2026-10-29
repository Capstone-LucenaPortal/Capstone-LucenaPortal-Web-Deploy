import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ForbiddenPage from "./page";
import * as profile from "@/portals/staff/features/auth/lib/profile";

const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT ${path}`);
});

vi.mock("next/navigation", () => ({
  redirect: (path: string) => redirect(path),
}));

const signOut = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/shared/supabase/client", () => ({
  createClient: () => ({ auth: { signOut } }),
}));

const ACTIVE_STAFF = {
  id: "11111111-1111-1111-1111-111111111111",
  full_name: "Juan Dela Cruz",
  email: "juan.delacruz@lucenacity.gov.ph",
  role: "staff" as const,
  modules: ["incidents"],
  is_supervisor: false,
  status: "active",
  department_label: "Yellow Card Office",
  created_at: "2026-01-15T08:00:00.000Z",
};

afterEach(() => {
  vi.restoreAllMocks();
  redirect.mockClear();
  signOut.mockClear();
});

// Where the request guard's role check sends the accounts it refuses. The page
// tells each one why, from the same row and the same decision.
describe("ForbiddenPage", () => {
  it("tells an employee of another portal which portal is theirs", async () => {
    vi.spyOn(profile, "getMyProfileRow").mockResolvedValue({ ...ACTIVE_STAFF, role: "responder" });

    render(await ForbiddenPage());

    expect(screen.getByText(/wrong portal/i)).toBeInTheDocument();
  });

  it("tells a citizen this portal is for city employees", async () => {
    vi.spyOn(profile, "getMyProfileRow").mockResolvedValue(null);

    render(await ForbiddenPage());

    expect(screen.getByText(/for city employees/i)).toBeInTheDocument();
  });

  it("tells a deactivated employee their account is deactivated", async () => {
    vi.spyOn(profile, "getMyProfileRow").mockResolvedValue({ ...ACTIVE_STAFF, status: "inactive" });

    render(await ForbiddenPage());

    expect(screen.getByText(/deactivated/i)).toBeInTheDocument();
  });

  // Issue #19: every Portal shares one session, so signing it out here (and
  // supabase-js signs out every device by default) ended the account's own
  // Portal too. Only a deactivated account is signed out, in this browser only.
  it("keeps the session of an employee of another portal, says who is signed in, and links to their portal", async () => {
    vi.spyOn(profile, "getMyProfileRow").mockResolvedValue({ ...ACTIVE_STAFF, role: "responder" });

    render(await ForbiddenPage());

    expect(screen.getByText(/you are signed in with an? Responder account/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to the Responder portal" })).toHaveAttribute("href", "/responder");
    expect(screen.queryByText(/signed out/i)).not.toBeInTheDocument();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("keeps a citizen's session", async () => {
    vi.spyOn(profile, "getMyProfileRow").mockResolvedValue(null);

    render(await ForbiddenPage());

    expect(screen.queryByText(/signed out/i)).not.toBeInTheDocument();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("signs a deactivated employee out of this browser only", async () => {
    vi.spyOn(profile, "getMyProfileRow").mockResolvedValue({ ...ACTIVE_STAFF, status: "inactive" });

    render(await ForbiddenPage());

    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  // A stale redirect, or a role restored mid-session: nothing to refuse.
  it("sends an active Staff employee to the dashboard", async () => {
    vi.spyOn(profile, "getMyProfileRow").mockResolvedValue(ACTIVE_STAFF);

    await expect(ForbiddenPage()).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledWith("/staff/dashboard");
  });

  // A failed read is no verdict: it goes to the error boundary, not AccessDenied.
  it("hands a failed profile read to the error boundary instead of refusing", async () => {
    vi.spyOn(profile, "getMyProfileRow").mockRejectedValue(new profile.ProfileReadError({ message: "timeout", code: "57014" }));

    await expect(ForbiddenPage()).rejects.toBeInstanceOf(profile.ProfileReadError);

    expect(redirect).not.toHaveBeenCalled();
  });
});
