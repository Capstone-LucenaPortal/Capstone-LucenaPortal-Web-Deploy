import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CompleteBookingAction } from "./complete-booking-action";
import * as actions from "../lib/actions";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Opens the dialog and returns the spy standing in for the Server Action.
 *
 * The confirm button is deliberately worded differently from the trigger — the
 * trigger stays in the DOM behind the modal, and two buttons sharing a name
 * would make every query here ambiguous as well as confusing the operator.
 */
async function open(user: ReturnType<typeof userEvent.setup>) {
  const spy = vi.spyOn(actions, "completeBooking").mockResolvedValue({ ok: true });
  render(<CompleteBookingAction bookingId="bk-1" />);
  await user.click(screen.getByRole("button", { name: "Mark as completed" }));
  return spy;
}

describe("CompleteBookingAction", () => {
  it("asks before completing rather than firing on the first click", async () => {
    // Completion is terminal — there is no un-complete, and the Actions card
    // disappears afterwards. A single misclick must not close the record.
    const user = userEvent.setup();
    const spy = await open(user);

    expect(
      screen.getByRole("heading", { name: "Close the record on this event" }),
    ).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  it("says the step cannot be undone", async () => {
    const user = userEvent.setup();
    await open(user);

    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
  });

  it("completes once confirmed", async () => {
    const user = userEvent.setup();
    const spy = await open(user);

    await user.click(screen.getByRole("button", { name: "Complete this booking" }));

    expect(spy).toHaveBeenCalledWith({ bookingId: "bk-1" });
  });

  it("does nothing when the operator backs out", async () => {
    const user = userEvent.setup();
    const spy = await open(user);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(spy).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("heading", { name: "Close the record on this event" }),
    ).not.toBeInTheDocument();
  });

  it("surfaces a refusal inside the dialog, where the operator is looking", async () => {
    vi.spyOn(actions, "completeBooking").mockResolvedValue({
      ok: false,
      message:
        "This booking cannot be completed yet. It must be fully paid and its event date must have passed.",
      stale: true,
    });
    const user = userEvent.setup();
    render(<CompleteBookingAction bookingId="bk-1" />);

    await user.click(screen.getByRole("button", { name: "Mark as completed" }));
    await user.click(screen.getByRole("button", { name: "Complete this booking" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "its event date must have passed",
    );
  });
});
