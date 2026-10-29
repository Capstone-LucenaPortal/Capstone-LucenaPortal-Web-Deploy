import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useSignedInStaffRole } from "./use-signed-in-staff-role";

// The session already in this browser, and the my_staff_profile row the
// signed-in caller sees.
const getSession = vi.fn();
const maybeSingle = vi.fn();
const from = vi.fn(() => ({ select: () => ({ maybeSingle }) }));

vi.mock("@/shared/supabase/client", () => ({
  createClient: () => ({ auth: { getSession }, from }),
}));

const SESSION = { user: { id: "user-1" } };

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue({ data: { session: SESSION } });
  maybeSingle.mockResolvedValue({ data: { role: "responder" }, error: null });
});

describe("useSignedInStaffRole", () => {
  it("names the role of the signed-in staff account, from my_staff_profile", async () => {
    const { result } = renderHook(() => useSignedInStaffRole());

    await waitFor(() => expect(result.current).toBe("responder"));
    expect(from).toHaveBeenCalledWith("my_staff_profile");
  });

  it("reads no profile when no one is signed in", async () => {
    getSession.mockResolvedValue({ data: { session: null } });

    const { result } = renderHook(() => useSignedInStaffRole());

    // Settle the getSession() round before checking nothing followed it.
    await waitFor(() => expect(getSession).toHaveBeenCalled());
    await getSession.mock.results[0].value;
    expect(from).not.toHaveBeenCalled();
    expect(result.current).toBeNull();
  });

  it("names no role for an account with no staff row", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useSignedInStaffRole());

    await waitFor(() => expect(maybeSingle).toHaveBeenCalled());
    await maybeSingle.mock.results[0].value;
    expect(result.current).toBeNull();
  });

  // The note is a courtesy: a failed read must not break the sign-in form.
  it("names no role when the read fails", async () => {
    maybeSingle.mockRejectedValue(new Error("offline"));

    const { result } = renderHook(() => useSignedInStaffRole());

    await waitFor(() => expect(maybeSingle).toHaveBeenCalled());
    await expect(maybeSingle.mock.results[0].value).rejects.toThrow("offline");
    expect(result.current).toBeNull();
  });
});
