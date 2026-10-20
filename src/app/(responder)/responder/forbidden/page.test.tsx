import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ForbiddenPage from "./page";
import * as profile from "@/portals/responder/features/auth/lib/profile";

const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT ${path}`);
});

vi.mock("next/navigation", () => ({
  redirect: (path: string) => redirect(path),
}));

vi.mock("@/shared/supabase/client", () => ({
  createClient: () => ({ auth: { signOut: vi.fn().mockResolvedValue({}) } }),
}));

const ACTIVE_RESPONDER = {
  id: "responder-1",
  full_name: "Maria Santos",
  email: "maria.santos@lucenacity.gov.ph",
  role: "responder" as const,
  status: "active",
  department_code: "cdrrmo",
  department_label: "CDRRMO",
  phone: null,
  employee_id: null,
  on_duty: false,
  created_at: "2026-01-15T08:00:00.000Z",
};

afterEach(() => {
  vi.restoreAllMocks();
  redirect.mockClear();
});

// Where the request guard's role check sends the accounts it refuses. The page
// tells each one why, from the same row and the same decision.
describe("ForbiddenPage", () => {
  it("tells an employee of another portal which portal is theirs", async () => {
    vi.spyOn(profile, "getMyProfileRow").mockResolvedValue({ ...ACTIVE_RESPONDER, role: "staff" });

    render(await ForbiddenPage());

    expect(screen.getByText(/wrong portal/i)).toBeInTheDocument();
  });

  it("tells a citizen this portal is for city employees", async () => {
    vi.spyOn(profile, "getMyProfileRow").mockResolvedValue(null);

    render(await ForbiddenPage());

    expect(screen.getByText(/for city employees/i)).toBeInTheDocument();
  });

  it("tells a deactivated responder their account is deactivated", async () => {
    vi.spyOn(profile, "getMyProfileRow").mockResolvedValue({ ...ACTIVE_RESPONDER, status: "inactive" });

    render(await ForbiddenPage());

    expect(screen.getByText(/deactivated/i)).toBeInTheDocument();
  });

  // A stale redirect, or a role restored mid-session: nothing to refuse.
  it("sends an active responder to the pool", async () => {
    vi.spyOn(profile, "getMyProfileRow").mockResolvedValue(ACTIVE_RESPONDER);

    await expect(ForbiddenPage()).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledWith("/responder/pool");
  });

  // A failed read is no verdict: it goes to the error boundary, not AccessDenied.
  it("hands a failed profile read to the error boundary instead of refusing", async () => {
    vi.spyOn(profile, "getMyProfileRow").mockRejectedValue(
      new profile.ProfileReadError({ message: "timeout", code: "57014" }),
    );

    await expect(ForbiddenPage()).rejects.toBeInstanceOf(profile.ProfileReadError);

    expect(redirect).not.toHaveBeenCalled();
  });
});
