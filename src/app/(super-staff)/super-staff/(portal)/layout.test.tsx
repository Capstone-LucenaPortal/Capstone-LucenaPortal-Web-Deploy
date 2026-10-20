import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import PortalLayout from "./layout";
import * as profile from "@/portals/super-staff/features/auth/lib/profile";
import type { StaffProfile } from "@/portals/super-staff/features/auth/types";

const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT ${path}`);
});

vi.mock("next/navigation", () => ({
  redirect: (path: string) => redirect(path),
}));

vi.mock("@/shared/supabase/client", () => ({
  createClient: () => ({ auth: { signOut: vi.fn().mockResolvedValue({}) } }),
}));

const ACTIVE_SUPER_STAFF: StaffProfile = {
  id: "11111111-1111-1111-1111-111111111111",
  fullName: "Maria Santos",
  email: "maria.santos@lucenacity.gov.ph",
  role: "super_staff",
  status: "active",
};

afterEach(() => {
  vi.restoreAllMocks();
  redirect.mockClear();
});

// The layout's own gate, defence in depth behind the request guard's. Each
// refusal withholds the page and says why.
describe("PortalLayout", () => {
  it.each([
    ["a citizen", null, /for city employees/i],
    ["an employee of another portal", { ...ACTIVE_SUPER_STAFF, role: "staff" as const }, /wrong portal/i],
    ["a deactivated employee", { ...ACTIVE_SUPER_STAFF, status: "inactive" }, /deactivated/i],
  ])("refuses %s and withholds the page", async (_who, row, reason) => {
    vi.spyOn(profile, "getStaffProfile").mockResolvedValue(row);

    render(await PortalLayout({ children: <p>secret</p> }));

    expect(screen.getByText(reason)).toBeInTheDocument();
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
  });

  // The guard's read succeeded and this one, a moment later, did not.
  // No verdict: it goes to the error boundary, not AccessDenied.
  it("hands a failed profile read to the error boundary instead of refusing", async () => {
    vi.spyOn(profile, "getStaffProfile").mockRejectedValue(
      new profile.ProfileReadError({ message: "timeout", code: "57014" }),
    );

    await expect(PortalLayout({ children: <p>secret</p> })).rejects.toBeInstanceOf(
      profile.ProfileReadError,
    );

    expect(redirect).not.toHaveBeenCalled();
  });
});
