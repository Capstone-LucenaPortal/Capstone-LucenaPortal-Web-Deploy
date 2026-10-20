import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import PortalLayout from "./layout";
import * as profile from "@/portals/responder/features/auth/lib/profile";

const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT ${path}`);
});
vi.mock("next/navigation", () => ({
  redirect: (path: string) => redirect(path),
}));

const signOut = vi.fn().mockResolvedValue({});
vi.mock("@/shared/supabase/client", () => ({
  createClient: () => ({ auth: { signOut } }),
}));

// Reached only past the gate; neither case here gets that far.
vi.mock("@/portals/responder/features/incidents/lib/data", () => ({
  getPool: vi.fn(),
  getHeldTicket: vi.fn(),
  getUnreadCount: vi.fn(),
}));
vi.mock("@/portals/responder/features/auth/lib/department-duty", () => ({
  getDepartmentDuty: vi.fn(),
}));

afterEach(() => {
  vi.restoreAllMocks();
  redirect.mockClear();
  signOut.mockClear();
});

describe("PortalLayout", () => {
  it("refuses a citizen instead of rendering the page", async () => {
    vi.spyOn(profile, "getMyProfileRow").mockResolvedValue(null);

    render(await PortalLayout({ children: <p>secret</p> }));

    expect(screen.getByText(/for city employees/i)).toBeInTheDocument();
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
  });

  // Middleware's read succeeded and this one, a moment later, did not.
  // No verdict: it goes to the error boundary, not AccessDenied.
  it("hands a failed profile read to the error boundary instead of refusing", async () => {
    vi.spyOn(profile, "getMyProfileRow").mockRejectedValue(
      new profile.ProfileReadError({ message: "timeout", code: "57014" }),
    );

    await expect(PortalLayout({ children: <p>secret</p> })).rejects.toBeInstanceOf(
      profile.ProfileReadError,
    );

    expect(redirect).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });
});
