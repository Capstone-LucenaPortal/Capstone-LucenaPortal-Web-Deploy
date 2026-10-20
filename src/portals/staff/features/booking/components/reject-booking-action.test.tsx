import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RejectBookingAction } from "./reject-booking-action";
import * as actions from "../lib/actions";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("RejectBookingAction", () => {
  it("requires a reason", async () => {
    const user = userEvent.setup();
    render(<RejectBookingAction bookingId="bk-1" status="awaiting_quote" />);

    await user.click(screen.getByRole("button", { name: "Reject booking" }));
    const confirm = screen.getAllByRole("button", { name: "Reject booking" })[1];
    expect(confirm).toBeDisabled();

    await user.type(screen.getByLabelText(/Reason/), "Venue double-booked");
    expect(confirm).toBeEnabled();
  });

  it("warns about the money only when one has been sent", async () => {
    // Decision 7. At payment_verification the organiser has already paid and
    // nobody has verified it; reject_booking decides it on the way out.
    const user = userEvent.setup();
    render(
      <RejectBookingAction bookingId="bk-1" status="payment_verification" />,
    );

    await user.click(screen.getByRole("button", { name: "Reject booking" }));

    expect(screen.getByText(/no refunds through this system/i)).toBeInTheDocument();
    expect(
      screen.getByText(/contact office customer support/i),
    ).toBeInTheDocument();
  });

  it("does not warn about refunds before any payment exists", async () => {
    const user = userEvent.setup();
    render(<RejectBookingAction bookingId="bk-1" status="awaiting_quote" />);

    await user.click(screen.getByRole("button", { name: "Reject booking" }));

    expect(
      screen.queryByText(/no refunds through this system/i),
    ).not.toBeInTheDocument();
  });

  it("sends the reason", async () => {
    const spy = vi.spyOn(actions, "rejectBooking").mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<RejectBookingAction bookingId="bk-1" status="awaiting_payment" />);

    await user.click(screen.getByRole("button", { name: "Reject booking" }));
    await user.type(screen.getByLabelText(/Reason/), "Venue double-booked");
    await user.click(
      screen.getAllByRole("button", { name: "Reject booking" })[1],
    );

    expect(spy).toHaveBeenCalledWith({
      bookingId: "bk-1",
      reason: "Venue double-booked",
    });
  });

  it("surfaces the committed-booking message", async () => {
    // reject_booking's status guard raises 22023, so this is the sentence an
    // operator sees on a confirmed booking — it must read as "committed", not
    // as "someone got there first".
    vi.spyOn(actions, "rejectBooking").mockResolvedValue({
      ok: false,
      message:
        "This booking can no longer be rejected. Once a downpayment has been verified the event is committed and neither side can cancel it.",
      stale: true,
    });
    const user = userEvent.setup();
    render(
      <RejectBookingAction bookingId="bk-1" status="payment_verification" />,
    );

    await user.click(screen.getByRole("button", { name: "Reject booking" }));
    await user.type(screen.getByLabelText(/Reason/), "Too late");
    await user.click(
      screen.getAllByRole("button", { name: "Reject booking" })[1],
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "the event is committed",
    );
  });
});
