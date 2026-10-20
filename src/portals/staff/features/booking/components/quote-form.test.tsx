import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuoteForm } from "./quote-form";
import * as actions from "../lib/actions";
import type { FeeReference } from "../lib/fee-reference";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const known: FeeReference = {
  amount: 150000,
  requiresQuote: false,
  unknown: false,
};

afterEach(() => {
  vi.restoreAllMocks();
});

function renderForm(reference = known) {
  return render(
    <QuoteForm
      bookingId="bk-1"
      reference={reference}
      downpaymentPct={50}
      paymentWindowHours={72}
    />,
  );
}

describe("QuoteForm", () => {
  it("never prefills the fee", () => {
    // The booking that most needs this screen is full_facility discounted,
    // which the card marks requires_quote. Prefilling the commercial figure
    // would turn "price this" into "confirm this".
    renderForm();
    expect(screen.getByLabelText(/Total fee/)).toHaveValue(null);
  });

  it("anchors the operator with the commercial reference", () => {
    renderForm();
    expect(
      screen.getByText(/this booking at the commercial tier costs/i),
    ).toBeInTheDocument();
    expect(screen.getByText("₱150,000.00")).toBeInTheDocument();
  });

  it("shows nothing rather than a zero when the rate is unknown", () => {
    // booking_price raises 23503 rather than issuing a free booking; the
    // display equivalent is silence.
    renderForm({ amount: null, requiresQuote: false, unknown: true });
    expect(
      screen.queryByText(/at the commercial tier costs/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("₱0.00")).not.toBeInTheDocument();
  });

  it("explains why a quote is needed when the card requires one", () => {
    renderForm({ amount: null, requiresQuote: true, unknown: false });
    expect(
      screen.getByText(/no published rate for this venue and tier/i),
    ).toBeInTheDocument();
  });

  it("previews the split live as the operator types", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText(/Total fee/), "115000");

    expect(screen.getByText(/Downpayment due now \(50%\)/)).toBeInTheDocument();
    expect(screen.getAllByText("₱57,500.00")).toHaveLength(2);
  });

  it("reads the payment window from config rather than hardcoding 72", () => {
    render(
      <QuoteForm
        bookingId="bk-1"
        reference={known}
        downpaymentPct={50}
        paymentWindowHours={48}
      />,
    );
    expect(screen.getByText(/restarts the 48-hour payment window/)).toBeInTheDocument();
  });

  it("submits the typed figure", async () => {
    const spy = vi
      .spyOn(actions, "quoteBooking")
      .mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/Total fee/), "90000");
    await user.click(screen.getByRole("button", { name: "Issue quote" }));

    expect(spy).toHaveBeenCalledWith({ bookingId: "bk-1", totalFee: 90000 });
  });

  it("cannot be submitted empty", () => {
    renderForm();
    expect(screen.getByRole("button", { name: "Issue quote" })).toBeDisabled();
  });

  it("shows the failure message inline", async () => {
    vi.spyOn(actions, "quoteBooking").mockResolvedValue({
      ok: false,
      message: "This booking is no longer awaiting a quote.",
      stale: true,
    });
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/Total fee/), "90000");
    await user.click(screen.getByRole("button", { name: "Issue quote" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This booking is no longer awaiting a quote.",
    );
  });
});
