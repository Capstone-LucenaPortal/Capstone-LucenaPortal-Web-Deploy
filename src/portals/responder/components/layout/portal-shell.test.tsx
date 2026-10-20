import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PortalShell } from "@/portals/responder/components/layout/portal-shell";
import { BottomSheet } from "@/portals/responder/components/ui/bottom-sheet";
import { SessionProvider } from "@/portals/responder/features/auth/hooks/use-session";
import { PhoneAlertsProvider } from "@/portals/responder/features/alerts/hooks/use-phone-alerts";
import type { ResponderUser } from "@/portals/responder/features/auth/types";

vi.mock("@/shared/supabase/client", () => ({
  createClient: () => ({ rpc: vi.fn().mockResolvedValue({ error: null }) }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/responder/pool",
}));

vi.mock("@/portals/responder/components/ui/toast", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

const RESPONDER: ResponderUser = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "juan@lucena.gov",
  full_name: "Juan Dela Cruz",
  role: "responder",
  department_code: "engineering",
  department_label: "Engineering",
  phone: "09171234501",
  employee_id: "LGU-2026-0501",
  on_duty: true,
  created_at: "2026-01-12T08:00:00.000Z",
};

function renderShell(page: React.ReactNode) {
  render(
    <SessionProvider responder={RESPONDER} duty={{ onDuty: 1, total: 2 }}>
      <PhoneAlertsProvider>
        <PortalShell counts={{ pool: 3, notifications: 0 }} hasActiveClaim={false}>
          {page}
        </PortalShell>
      </PhoneAlertsProvider>
    </SessionProvider>,
  );
}

async function openDrawer() {
  const user = userEvent.setup();
  renderShell(<a href="/responder/pool?report=1">A report</a>);
  await user.click(screen.getByRole("button", { name: "Open navigation" }));
  return { user, drawer: screen.getByRole("dialog", { name: "Navigation" }) };
}

// SCRUM-223: the phone drawer is modal. It takes focus, keeps it, hides the
// page behind it and hands focus back to the hamburger.
describe("NavDrawer keyboard focus", () => {
  it("moves focus into the drawer on open", async () => {
    const { drawer } = await openDrawer();

    expect(within(drawer).getByRole("button", { name: "Close navigation" })).toHaveFocus();
  });

  it("keeps Shift+Tab inside the drawer", async () => {
    const { user, drawer } = await openDrawer();

    await user.tab({ shift: true });
    // The backdrop, which precedes the drawer in the overlay.
    expect(screen.getAllByRole("button", { name: "Close navigation" })[0]).toHaveFocus();
    await user.tab({ shift: true });
    expect(within(drawer).getByRole("switch")).toHaveFocus();
  });

  it("keeps Tab inside the drawer", async () => {
    const { user, drawer } = await openDrawer();
    within(drawer).getByRole("switch").focus();

    await user.tab();

    expect(screen.getAllByRole("button", { name: "Close navigation" })[0]).toHaveFocus();
  });

  // md:hidden takes the drawer off screen past the breakpoint; left open, it
  // would keep the desktop page inert with nothing visible to close.
  it("closes when the viewport widens past the phone layout", async () => {
    let onChange: ((e: { matches: boolean }) => void) | undefined;
    vi.stubGlobal("matchMedia", (query: string) => ({
      media: query,
      matches: false,
      addEventListener: (_: string, fn: typeof onChange) => (onChange = fn),
      removeEventListener: () => {},
    }));
    await openDrawer();

    act(() => onChange?.({ matches: true }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "A report" }).closest("[inert]")).toBeNull();
    vi.unstubAllGlobals();
  });

  it("hides the page behind it", async () => {
    await openDrawer();

    expect(screen.getByRole("link", { name: "A report" }).closest("[inert]")).not.toBeNull();
  });

  it("closes on Escape and hands focus back to the hamburger", async () => {
    const { user } = await openDrawer();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open navigation" })).toHaveFocus();
    expect(screen.getByRole("link", { name: "A report" }).closest("[inert]")).toBeNull();
  });
});

/** /my-ticket in miniature: Release takes the sheet and its opener away. */
function MyTicket() {
  const [page, setPage] = useState<"ticket" | "sheet" | "pool">("ticket");
  if (page === "pool") return <p>Pool</p>;
  return (
    <>
      <button type="button" onClick={() => setPage("sheet")}>
        Release
      </button>
      <BottomSheet open={page === "sheet"} onClose={() => setPage("ticket")} title="Release">
        <button type="button" onClick={() => setPage("pool")}>
          Release now
        </button>
      </BottomSheet>
    </>
  );
}

describe("PortalShell", () => {
  it("catches focus on <main> when a sheet closes and its opener is gone", async () => {
    const user = userEvent.setup();
    renderShell(<MyTicket />);

    await user.click(screen.getByRole("button", { name: "Release" }));
    await user.click(screen.getByRole("button", { name: "Release now" }));

    expect(screen.getByRole("main")).toHaveFocus();
  });
});
