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

/** The Staff Modal's dimmed backdrop, which closes the panel when clicked. */
function backdrop(): HTMLElement {
  const el = document.querySelector<HTMLElement>(".fixed.inset-0 > [aria-hidden='true']");
  if (!el) throw new Error("No Modal backdrop is showing");
  return el;
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
    // A faked system clock rather than the wall clock, at a moment when UTC
    // and Manila disagree on the day: 23:30 UTC on the 26th is 07:30 on the
    // 27th in Manila, so a default taken in UTC would show the wrong date.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-26T23:30:00Z"));
    try {
      await open();
      expect(screen.getByLabelText(/Paid on/)).toHaveValue("2026-11-27");
    } finally {
      vi.useRealTimers();
    }
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

  describe("opens at its starting values however it was last closed (#31)", () => {
    async function fillEverything(user: ReturnType<typeof userEvent.setup>) {
      await user.clear(screen.getByLabelText(/Amount/));
      await user.type(screen.getByLabelText(/Amount/), "100");
      await user.type(screen.getByLabelText(/Official receipt number/), "OR-9001");
      await user.selectOptions(screen.getByLabelText("Method"), "check");
      await user.clear(screen.getByLabelText(/Paid on/));
      await user.type(screen.getByLabelText(/Paid on/), "2026-01-15");
    }

    function expectStartingValues(today: string) {
      expect(screen.getByLabelText(/Amount/)).toHaveValue(20400);
      expect(screen.getByLabelText(/Official receipt number/)).toHaveValue("");
      expect(screen.getByLabelText("Method")).toHaveValue("cash");
      expect(screen.getByLabelText(/Paid on/)).toHaveValue(today);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    }

    afterEach(() => {
      vi.useRealTimers();
    });

    it("after a refused save is cancelled", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-11-26T03:00:00Z"));
      vi.spyOn(actions, "recordBalancePayment").mockResolvedValue({
        ok: false,
        message: "The amount must match the outstanding balance exactly.",
        stale: false,
      });
      const user = await open();

      await fillEverything(user);
      await user.click(screen.getByRole("button", { name: "Record payment" }));
      expect(await screen.findByRole("alert")).toBeInTheDocument();
      // While the panel stays open, a refused save keeps what was typed.
      expect(screen.getByLabelText(/Official receipt number/)).toHaveValue("OR-9001");

      await user.click(screen.getByRole("button", { name: "Cancel" }));
      await user.click(screen.getByRole("button", { name: "Record balance payment" }));

      expectStartingValues("2026-11-26");
    });

    it("after a click on the backdrop", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-11-26T03:00:00Z"));
      const user = await open();

      await fillEverything(user);
      await user.click(backdrop());
      await user.click(screen.getByRole("button", { name: "Record balance payment" }));

      expectStartingValues("2026-11-26");
    });

    it("dates the payment today in Manila as of the reopening, not the first open", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      // 23:30 in Manila on the 26th…
      vi.setSystemTime(new Date("2026-11-26T15:30:00Z"));
      const user = await open();
      expect(screen.getByLabelText(/Paid on/)).toHaveValue("2026-11-26");
      await user.click(screen.getByRole("button", { name: "Cancel" }));

      // …and 00:30 on the 27th when the panel is opened again.
      vi.setSystemTime(new Date("2026-11-26T16:30:00Z"));
      await user.click(screen.getByRole("button", { name: "Record balance payment" }));

      expect(screen.getByLabelText(/Paid on/)).toHaveValue("2026-11-27");
    });
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
