import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SessionProvider, useSession } from "@/portals/responder/features/auth/hooks/use-session";
import { DutySwitch } from "@/portals/responder/components/ui/duty-switch";
import { OffDutyBanner } from "@/portals/responder/features/incidents/components/off-duty-banner";
import { NavDrawer } from "@/portals/responder/components/layout/nav-drawer";
import { PhoneAlertsProvider } from "@/portals/responder/features/alerts/hooks/use-phone-alerts";
import type { ResponderUser } from "@/portals/responder/features/auth/types";

const rpc = vi.fn();
const refresh = vi.fn();
const showToast = vi.fn();

vi.mock("@/shared/supabase/client", () => ({
  createClient: () => ({ rpc }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
  usePathname: () => "/responder/pool",
}));

vi.mock("@/portals/responder/components/ui/toast", () => ({
  useToast: () => ({ showToast }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockResolvedValue({ error: null });
});

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

function Who() {
  const { responder, duty } = useSession();
  return (
    <>
      <p>{responder.full_name}</p>
      <p>{duty ? `${duty.onDuty} of ${duty.total}` : "no count"}</p>
    </>
  );
}

function Harness({
  responder = RESPONDER,
  duty = { onDuty: 1, total: 2 } as { onDuty: number; total: number } | null,
  drawer = false,
}) {
  return (
    <SessionProvider responder={responder} duty={duty}>
      <Who />
      <DutySwitch size="sm" />
      <DutySwitch size="md" />
      <DutySwitch size="lg" />
      <DutySwitch size="md" />
      <OffDutyBanner />
      {drawer && (
        <PhoneAlertsProvider>
          <NavDrawer
            open
            onClose={() => {}}
            counts={{ pool: 0, notifications: 0 }}
            hasActiveClaim={false}
          />
        </PhoneAlertsProvider>
      )}
    </SessionProvider>
  );
}

describe("session context", () => {
  it("carries the responder to every consumer", () => {
    render(<Harness />);

    expect(screen.getByText("Juan Dela Cruz")).toBeInTheDocument();
  });

  it("seeds the duty switch from the profile, not from a constant", () => {
    // This is the whole point of the rename: on_duty is a database column now,
    // so a responder who went off duty yesterday comes back off duty.
    render(<Harness responder={{ ...RESPONDER, on_duty: false }} />);

    for (const s of screen.getAllByRole("switch")) {
      expect(s).toHaveAttribute("aria-checked", "false");
    }
  });

  it("flipping one switch moves all of them", () => {
    render(<Harness />);

    fireEvent.click(screen.getAllByRole("switch")[0]!);

    for (const s of screen.getAllByRole("switch")) {
      expect(s).toHaveAttribute("aria-checked", "false");
    }
  });

  it("hides the off-duty banner while on duty", () => {
    render(<Harness />);

    expect(screen.queryByText(/you're off duty/i)).not.toBeInTheDocument();
  });

  it("reveals the off-duty banner when duty goes off", () => {
    render(<Harness />);

    fireEvent.click(screen.getAllByRole("switch")[2]!);

    // Off duty takes you out of the headcount but must never hide work (PRD §5).
    expect(
      screen.getByText(
        "You're off duty, so your department doesn't count you in this shift. The pool stays browsable and claimable.",
      ),
    ).toBeInTheDocument();
  });

  it("the drawer says what duty does, never that a push is on", () => {
    // ISO-9: "Push on" / "Push muted" presented a channel that did not exist
    // as if it worked. Under jsdom no phone alert can be offered (no key, not
    // a production build), so the line is the headcount alone; the alert half
    // is dutyLine's (phone-alerts.test.tsx).
    render(<Harness drawer />);

    expect(screen.getByText("Counted in shift")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("switch")[0]!);

    expect(screen.getByText("Not counted")).toBeInTheDocument();
    expect(screen.queryByText(/push/i)).not.toBeInTheDocument();
  });

  it("toggles back on", async () => {
    render(<Harness />);
    const first = screen.getAllByRole("switch")[0]!;

    fireEvent.click(first);
    // The second tap has to wait for the first write to settle: a switch that
    // accepts a tap mid-flight sends two writes whose order is not guaranteed.
    await waitFor(() => expect(first).toBeEnabled());
    fireEvent.click(first);

    await waitFor(() => expect(first).toHaveAttribute("aria-checked", "true"));
    expect(screen.queryByText(/you're off duty/i)).not.toBeInTheDocument();
  });

  it("exposes the department duty count", () => {
    render(<Harness />);

    expect(screen.getByText("1 of 2")).toBeInTheDocument();
  });

  it("tolerates having no duty count at all", () => {
    // The view returns no row for a caller it does not recognise. That must
    // read as "no count available", never as "0 of 0".
    render(<Harness duty={null} />);

    expect(screen.getByText("no count")).toBeInTheDocument();
  });

  it("persists the flip through set_my_on_duty", async () => {
    render(<Harness />);

    fireEvent.click(screen.getAllByRole("switch")[0]!);

    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("set_my_on_duty", { p_on_duty: false }),
    );
    // The department count came from the server; it is now one behind.
    expect(refresh).toHaveBeenCalled();
  });

  it("moves the switch immediately, before the write lands", () => {
    // The responder taps this at the roadside on a slow connection. Waiting
    // for the round trip before moving the switch reads as a dead control.
    render(<Harness />);

    fireEvent.click(screen.getAllByRole("switch")[0]!);

    expect(screen.getAllByRole("switch")[0]).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("puts the switch back and says so when the write fails", async () => {
    rpc.mockResolvedValue({ error: { message: "network down" } });
    render(<Harness />);

    fireEvent.click(screen.getAllByRole("switch")[0]!);

    // Leaving it flipped would tell a responder they are out of the headcount
    // when they are not, or counted when they are not. Either way they act on it.
    await waitFor(() =>
      expect(screen.getAllByRole("switch")[0]).toHaveAttribute(
        "aria-checked",
        "true",
      ),
    );
    expect(showToast).toHaveBeenCalled();
  });
});
