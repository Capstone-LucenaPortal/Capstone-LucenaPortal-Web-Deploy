import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecordBalanceAction } from "./record-balance-action";
import * as actions from "../lib/actions";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

afterEach(() => {
  vi.restoreAllMocks();
});

async function open() {
  const user = userEvent.setup();
  render(<RecordBalanceAction bookingId="bk-1" balanceAmount={20400} />);
  await user.click(screen.getByRole("button", { name: "Record balance payment" }));
  return user;
}

describe("RecordBalanceAction", () => {
  it("prefills the amount, because the RPC demands an exact match", async () => {
    await open();
    expect(screen.getByLabelText(/Amount/)).toHaveValue(20400);
  });

  it("never offers GCash as a method", async () => {
    // record_balance_payment raises 22023 for gcash. The balance is settled
    // in person — decision 6, said in the schema rather than only in prose.
    await open();
    const select = screen.getByLabelText("Method");
    const options = within(select).getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["Cash", "Bank transfer", "Check"]);
    expect(options).not.toContain("GCash");
  });

  it("defaults the paid-on date to today in Manila", async () => {
    await open();
    // Exempt for the same reason the component is: this asserts that the
    // default is *today*, so it has to read the same wall clock the component
    // reads. A fixed instant here would assert a different property.
    // eslint-disable-next-line no-restricted-syntax
    const now = new Date();
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
    }).format(now);
    expect(screen.getByLabelText(/Paid on/)).toHaveValue(today);
  });

  it("requires an OR number", async () => {
    const user = await open();
    expect(screen.getByRole("button", { name: "Record payment" })).toBeDisabled();

    await user.type(screen.getByLabelText(/Official receipt number/), "OR-9001");
    expect(screen.getByRole("button", { name: "Record payment" })).toBeEnabled();
  });

  it("sends what the operator entered", async () => {
    const spy = vi
      .spyOn(actions, "recordBalancePayment")
      .mockResolvedValue({ ok: true });
    const user = await open();

    await user.type(screen.getByLabelText(/Official receipt number/), "OR-9001");
    await user.selectOptions(screen.getByLabelText("Method"), "check");
    await user.click(screen.getByRole("button", { name: "Record payment" }));

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: "bk-1",
        amount: 20400,
        officialReceiptNo: "OR-9001",
        method: "check",
      }),
    );
  });

  it("surfaces the duplicate-OR message", async () => {
    // 23505. An operator typo far more often than a real duplicate, so it
    // needs its own sentence rather than the generic fallback.
    vi.spyOn(actions, "recordBalancePayment").mockResolvedValue({
      ok: false,
      message:
        "That official receipt number is already recorded against another payment.",
      stale: false,
    });
    const user = await open();

    await user.type(screen.getByLabelText(/Official receipt number/), "OR-9001");
    await user.click(screen.getByRole("button", { name: "Record payment" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "already recorded against another payment",
    );
  });
});
