import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VerifyPaymentAction } from "./verify-payment-action";
import * as actions from "../lib/actions";
import type { PaymentAccept } from "../lib/desk-moves";
import type { BookingPayment } from "../types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const payment: BookingPayment = {
  id: "pay-1",
  kind: "downpayment",
  method: "gcash",
  amount: 15000,
  gcash_reference: "GC-4005-0003-7781",
  official_receipt_no: null,
  paid_at: "2026-08-10",
  submitted_at: "2026-08-10T09:46:39+08:00",
  recorded_by_name: null,
  verified_by_name: null,
  verified_at: null,
  rejected_reason: null,
  receipt_document_id: null,
};

afterEach(() => {
  vi.restoreAllMocks();
});

const renderAction = (accept: PaymentAccept = { kind: "open" }) =>
  render(
    <VerifyPaymentAction payment={payment} bookingId="bk-1" accept={accept} />,
  );

describe("VerifyPaymentAction", () => {
  it("says plainly that accepting is irreversible", async () => {
    // Decision 6, and the single most consequential click in the module.
    const user = userEvent.setup();
    renderAction();

    await user.click(screen.getByRole("button", { name: "Verify payment" }));

    expect(
      screen.getByText(/the booking is committed and neither side can cancel it/i),
    ).toBeInTheDocument();
  });

  it("shows the amount and reference to check against the account", async () => {
    const user = userEvent.setup();
    renderAction();

    await user.click(screen.getByRole("button", { name: "Verify payment" }));

    expect(
      screen.getByText(/₱15,000.00 · GC-4005-0003-7781/),
    ).toBeInTheDocument();
  });

  it("sends the PAYMENT id to the RPC and the BOOKING id for revalidation", async () => {
    // Getting these the wrong way round produces a P0002 that looks like a
    // missing booking.
    const spy = vi.spyOn(actions, "verifyPayment").mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    renderAction();

    await user.click(screen.getByRole("button", { name: "Verify payment" }));
    await user.type(screen.getByLabelText(/Official receipt no/), "OR-0042");
    await user.click(
      screen.getByRole("button", { name: "I have seen this payment" }),
    );

    expect(spy).toHaveBeenCalledWith({
      paymentId: "pay-1",
      bookingId: "bk-1",
      decision: "accept",
      reason: undefined,
      officialReceiptNo: "OR-0042",
    });
  });

  it("requires an official receipt number to accept", async () => {
    // l68: verify_payment refuses an accept without the cashier's OR.
    const user = userEvent.setup();
    renderAction();

    await user.click(screen.getByRole("button", { name: "Verify payment" }));
    const field = screen.getByLabelText(/Official receipt no/);
    const confirm = screen.getByRole("button", {
      name: "I have seen this payment",
    });
    expect(field).toBeRequired();
    expect(confirm).toBeDisabled();

    await user.type(field, "   ");
    expect(confirm).toBeDisabled();

    await user.type(field, "OR-0042");
    expect(confirm).toBeEnabled();
  });

  it("asks for no official receipt number to reject", async () => {
    // A rejected payment is not receipted.
    const spy = vi.spyOn(actions, "verifyPayment").mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    renderAction();

    await user.click(screen.getByRole("button", { name: "Reject payment" }));
    expect(screen.queryByLabelText(/Official receipt no/)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/Reason/), "Screenshot unreadable");
    await user.click(screen.getAllByRole("button", { name: "Reject payment" })[1]);

    expect(spy).toHaveBeenCalledWith({
      paymentId: "pay-1",
      bookingId: "bk-1",
      decision: "reject",
      reason: "Screenshot unreadable",
      officialReceiptNo: undefined,
    });
  });

  it("surfaces a duplicate official receipt number inline", async () => {
    vi.spyOn(actions, "verifyPayment").mockResolvedValue({
      ok: false,
      message:
        "That official receipt number is already recorded against another payment.",
      stale: false,
    });
    const user = userEvent.setup();
    renderAction();

    await user.click(screen.getByRole("button", { name: "Verify payment" }));
    await user.type(screen.getByLabelText(/Official receipt no/), "OR-0042");
    await user.click(
      screen.getByRole("button", { name: "I have seen this payment" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That official receipt number is already recorded against another payment.",
    );
  });

  it("distinguishes rejecting the payment from ending the booking", async () => {
    // verify_payment(reject) only bounces the receipt back and restarts the
    // clock; it cannot end a booking that must not go ahead.
    const user = userEvent.setup();
    renderAction();

    await user.click(screen.getByRole("button", { name: "Reject payment" }));

    expect(
      screen.getByText(/This does not end the booking/i),
    ).toBeInTheDocument();
  });

  it("requires a reason to reject", async () => {
    const user = userEvent.setup();
    renderAction();

    await user.click(screen.getByRole("button", { name: "Reject payment" }));
    const confirm = screen.getAllByRole("button", { name: "Reject payment" })[1];
    expect(confirm).toBeDisabled();

    await user.type(screen.getByLabelText(/Reason/), "Screenshot unreadable");
    expect(confirm).toBeEnabled();
  });

  it("surfaces a failure inline", async () => {
    vi.spyOn(actions, "verifyPayment").mockResolvedValue({
      ok: false,
      message: "This payment can no longer be decided.",
      stale: true,
    });
    const user = userEvent.setup();
    renderAction();

    await user.click(screen.getByRole("button", { name: "Verify payment" }));
    await user.type(screen.getByLabelText(/Official receipt no/), "OR-0042");
    await user.click(
      screen.getByRole("button", { name: "I have seen this payment" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This payment can no longer be decided.",
    );
  });

  it("holds the accept on a payment for an amount the booking no longer asks for", () => {
    renderAction({ kind: "blocked", reason: "amount_stale" });

    expect(screen.getByRole("button", { name: "Verify payment" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reject payment" })).toBeEnabled();
    expect(
      screen.getByText(
        "This payment is not for the booking's current downpayment — the booking was repriced after it was sent. Reject it so the organiser can pay the right amount.",
      ),
    ).toBeInTheDocument();
    // l72: verify_payment(reject)'s notice now names the amount paid and the
    // downpayment owed, so the operator is not asked to type it into the reason.
    expect(screen.queryByText(/in the reason/i)).toBeNull();
  });

  it("says nothing about a hold when the accept is open", () => {
    renderAction();

    expect(screen.getByRole("button", { name: "Verify payment" })).toBeEnabled();
    expect(screen.queryByText(/before verifying this payment/i)).toBeNull();
    expect(screen.queryByText(/current downpayment/i)).toBeNull();
  });
});
