// src/app/(admin)/admin/page.test.tsx
import { render } from "@testing-library/react";
import Home from "@/app/(admin)/admin/page";
import { vi } from "vitest";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

let mockSession: { user: { id: string } } | null = null;

// See src/portals/admin/features/auth/hooks/use-auth.test.tsx: vi.mock's first argument is a
// plain string, not an import specifier, so it must be a relative path
// rather than the `@/...` alias.
vi.mock("../../../portals/admin/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({
    session: mockSession,
    profile: null,
    isLoading: false,
    isAdmin: false,
    isDeactivated: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));

describe("Home", () => {
  beforeEach(() => {
    pushMock.mockClear();
    mockSession = null;
  });

  it("redirects to /login when not authenticated", () => {
    render(<Home />);
    expect(pushMock).toHaveBeenCalledWith("/admin/login");
  });

  it("redirects to /dashboard when authenticated", () => {
    mockSession = { user: { id: "user-1" } };
    render(<Home />);
    expect(pushMock).toHaveBeenCalledWith("/admin/dashboard");
  });
});
