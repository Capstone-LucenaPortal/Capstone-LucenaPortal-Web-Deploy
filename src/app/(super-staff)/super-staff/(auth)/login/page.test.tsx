import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import LoginPage from "./page";

// The server half of the sign-in screen: it reads ?reason=idle and tells
// LoginForm. login-form.test.tsx covers what the form does with it.

const getUser = vi.fn();
const redirect = vi.fn();

vi.mock("@/shared/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser } }),
}));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => redirect(path),
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/shared/supabase/client", () => ({
  createClient: () => ({ auth: {} }),
}));

async function renderPage(search: Record<string, string>) {
  render(await LoginPage({ searchParams: Promise.resolve(search) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: null } });
});

describe("LoginPage", () => {
  it("says why when the session ended for inactivity", async () => {
    await renderPage({ reason: "idle" });

    expect(screen.getByRole("status")).toHaveTextContent(
      "You were signed out after 15 minutes of inactivity.",
    );
  });

  it("says nothing extra on an ordinary visit", async () => {
    await renderPage({});

    expect(screen.queryByRole("status")).toBeNull();
  });
});
