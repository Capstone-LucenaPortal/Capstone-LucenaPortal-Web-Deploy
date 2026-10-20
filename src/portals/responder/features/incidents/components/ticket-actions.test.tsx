import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { resolveTicket } from "@/portals/responder/features/incidents/actions";
import { TicketActions } from "@/portals/responder/features/incidents/components/ticket-actions";

vi.mock("@/portals/responder/features/incidents/actions", () => ({
  resolveTicket: vi.fn(),
}));

let answer: (() => void) | undefined;

afterEach(async () => {
  // A transition left in flight leaks into the next test's form status.
  await act(async () => answer?.());
  answer = undefined;
  vi.mocked(resolveTicket).mockReset();
});

/** A server action that has not answered yet — a slow field connection. */
function slowAnswer() {
  return new Promise<void>((resolve) => {
    answer = resolve;
  });
}

// ISO-9: on a slow connection a second tap must not double-act on an incident.
describe("TicketActions", () => {
  it("sends one resolve however often Resolve is tapped", async () => {
    vi.mocked(resolveTicket).mockImplementation(slowAnswer);
    render(<TicketActions incidentId="inc-1" ready />);
    const resolve = screen.getByRole("button", { name: "Resolve this incident" });

    // Both taps land before React re-renders — the case a disabled button
    // cannot catch, so the second must be dropped at the action.
    await act(async () => {
      fireEvent.click(resolve);
      fireEvent.click(resolve);
    });

    expect(resolveTicket).toHaveBeenCalledTimes(1);
  });

  // Unready is a hint, not the gate: pressing it is the route to the photo
  // sheet, so it must stay pressable.
  it("keeps Resolve pressable without an after photo", () => {
    render(<TicketActions incidentId="inc-1" ready={false} />);

    expect(
      screen.getByRole("button", { name: "Resolve · needs an after photo" }),
    ).toBeEnabled();
  });
});
