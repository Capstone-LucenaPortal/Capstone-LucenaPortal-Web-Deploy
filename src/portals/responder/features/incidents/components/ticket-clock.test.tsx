import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { TicketClock } from "@/portals/responder/features/incidents/components/ticket-clock";
import { anIncident } from "@/portals/responder/features/incidents/lib/fixtures";

const NOW = new Date("2026-08-12T00:08:00.000Z");
const ARMED = "2026-08-12T00:00:00.000Z";

/** A promise of `hours`, armed at ARMED. The clock reads against NOW. */
const promise = (hours: number) =>
  anIncident({
    sla_armed_at: ARMED,
    sla_due_at: new Date(Date.parse(ARMED) + hours * 3_600_000).toISOString(),
  });

describe("TicketClock", () => {
  it("counts down inside the promise", () => {
    render(<TicketClock incident={promise(4)} now={NOW} />);

    expect(
      screen.getByText("Time left on the citizen promise"),
    ).toBeInTheDocument();
    expect(screen.getByText("3h 52m")).toBeInTheDocument();
    expect(screen.getByText("of 4h")).toBeInTheDocument();
  });

  it("keeps counting down once the promise is at risk", () => {
    // 5h 10m into an 8h promise: past the 50% at-risk mark, still ahead.
    render(
      <TicketClock
        incident={promise(8)}
        now={new Date("2026-08-12T05:10:00.000Z")}
      />,
    );

    expect(
      screen.getByText("Time left on the citizen promise"),
    ).toBeInTheDocument();
    expect(screen.getByText("2h 50m")).toBeInTheDocument();
    expect(screen.getByText("of 8h")).toBeInTheDocument();
  });

  it("counts up once the promise is missed", () => {
    render(
      <TicketClock
        incident={promise(4)}
        now={new Date("2026-08-12T04:55:00.000Z")}
      />,
    );

    expect(screen.getByText("Overdue by")).toBeInTheDocument();
    expect(screen.getByText("55m")).toBeInTheDocument();
    expect(
      screen.queryByText("Time left on the citizen promise"),
    ).not.toBeInTheDocument();
  });

  it("keeps ticking after the page has rendered", () => {
    // SCRUM-191: the page renders once, and the demo read 23h 57m for three
    // minutes of taps while the resolve modal said 23h 56m.
    vi.useFakeTimers({ now: NOW });
    try {
      render(<TicketClock incident={promise(4)} now={NOW} />);
      expect(screen.getByText("3h 52m")).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(3 * 60_000));

      expect(screen.getByText("3h 49m")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("states the rule instead of a time when nothing is running", () => {
    const unverified = anIncident({
      is_verified: false,
      sla_armed_at: null,
      sla_due_at: null,
    });

    render(<TicketClock incident={unverified} now={NOW} />);

    expect(screen.getByText("SLA paused")).toBeInTheDocument();
    expect(
      screen.getByText("Unverified — no clock is running on this one"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Verify on site before you spend the shift on it."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^of /)).not.toBeInTheDocument();
  });
});
