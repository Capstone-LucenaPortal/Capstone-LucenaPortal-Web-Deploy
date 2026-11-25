import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@/portals/super-staff/components/providers/toast-provider";
import { UnsavedChangesProvider } from "@/portals/super-staff/components/providers/unsaved-changes-provider";
import { toRpcError } from "@/portals/super-staff/lib/supabase/errors";
import type { MaintenancePeriod, SpaceState } from "../lib/maintenance-types";
import { MaintenanceView } from "./maintenance-view";

// The card is tested at its module boundary, like the Holidays editor: the two
// reads and the one RPC call site are mocked, everything between them and the
// DOM is real.

const callRpc = vi.fn();
const listMaintenancePeriods = vi.fn();
const listSpaceStates = vi.fn();

vi.mock("@/portals/super-staff/lib/supabase/rpc", () => ({
  callRpc: (...args: unknown[]) => callRpc(...args),
}));

vi.mock("../lib/maintenance-queries", () => ({
  listMaintenancePeriods: () => listMaintenancePeriods(),
  listSpaceStates: () => listSpaceStates(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/super-staff/configuration/maintenance",
  useRouter: () => ({ push: vi.fn() }),
}));

const repainting: MaintenancePeriod = {
  id: "11111111-1111-1111-1111-111111111111",
  spaceCode: "arena",
  spaceLabel: "Arena",
  firstDay: "2026-11-24",
  lastDay: "2026-12-05",
  reason: "Repainting",
  isActive: true,
};

const retired: MaintenancePeriod = {
  id: "22222222-2222-2222-2222-222222222222",
  spaceCode: "atrium",
  spaceLabel: "Atrium",
  firstDay: "2026-11-10",
  lastDay: "2026-11-12",
  reason: "Set by mistake",
  isActive: false,
};

const states: SpaceState[] = [
  { spaceCode: "arena", spaceLabel: "Arena", state: "under_maintenance", maintenanceReason: "Repainting", maintenanceLastDay: "2026-12-05" },
  { spaceCode: "atrium", spaceLabel: "Atrium", state: "reserved", maintenanceReason: null, maintenanceLastDay: null },
];

async function renderView() {
  render(
    <ToastProvider>
      <UnsavedChangesProvider>
        <MaintenanceView />
      </UnsavedChangesProvider>
    </ToastProvider>,
  );
  await screen.findByDisplayValue("Repainting");
}

const rowOf = (reason: string) => screen.getByDisplayValue(reason).closest("tr")!;

/** The refusal line a CatalogRow puts directly under `row`, if any. */
const refusalUnder = (row: HTMLElement) => {
  const next = row.nextElementSibling as HTMLElement | null;
  return next ? within(next).queryByRole("alert") : null;
};

const refusalOf = (reason: string) => refusalUnder(rowOf(reason));

const clash = (refs: string) =>
  toRpcError({
    code: "23P01",
    message: `update_maintenance_period: the Atrium is booked during those days: ${refs}; cancel or move those bookings first`,
  });

beforeEach(() => {
  vi.clearAllMocks();
  listMaintenancePeriods.mockResolvedValue([repainting, retired]);
  listSpaceStates.mockResolvedValue(states);
  callRpc.mockResolvedValue({});
});

describe("MaintenanceView — Space State", () => {
  it("shows each Space's state today, with the reason and last day while Under Maintenance", async () => {
    await renderView();

    const arena = screen.getByRole("listitem", { name: "Arena" });
    expect(arena).toHaveTextContent("Under Maintenance");
    expect(arena).toHaveTextContent("Repainting");
    expect(arena).toHaveTextContent("2026-12-05");

    const atrium = screen.getByRole("listitem", { name: "Atrium" });
    expect(atrium).toHaveTextContent("Reserved");
  });

  it("says Not permitted when the gate answers with no Spaces", async () => {
    listSpaceStates.mockResolvedValue([]);
    listMaintenancePeriods.mockResolvedValue([]);
    render(
      <ToastProvider>
        <UnsavedChangesProvider>
          <MaintenanceView />
        </UnsavedChangesProvider>
      </ToastProvider>,
    );

    expect((await screen.findAllByText(/^Not permitted/)).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Add Maintenance Period" })).toBeNull();
  });
});

describe("MaintenanceView — Maintenance Periods", () => {
  it("lists retired periods too, marked as retired", async () => {
    await renderView();

    const row = rowOf("Set by mistake");
    expect(within(row).getByText("Atrium")).toBeInTheDocument();
    expect(within(row).getByText("2026-11-10")).toBeInTheDocument();
    expect(within(row).getByText("Retired")).toBeInTheDocument();
  });

  it("does not let the first day be edited", async () => {
    await renderView();

    const row = rowOf("Repainting");
    expect(within(row).getByText("2026-11-24")).toBeInTheDocument();
    expect(within(row).queryByDisplayValue("2026-11-24")).toBeNull();
    expect(screen.queryByRole("button", { name: /delete/i })).toBeNull();
  });

  it("extends the last day with every update_maintenance_period argument, then rereads the states", async () => {
    const user = userEvent.setup();
    await renderView();

    fireEvent.change(screen.getByLabelText("Arena 2026-11-24 last day"), {
      target: { value: "2026-12-10" },
    });
    await user.click(within(rowOf("Repainting")).getByRole("button", { name: "Save" }));

    expect(callRpc).toHaveBeenCalledWith("update_maintenance_period", {
      p_id: repainting.id,
      p_last_day: "2026-12-10",
      p_reason: "Repainting",
      p_is_active: true,
    });
    await vi.waitFor(() => expect(listSpaceStates).toHaveBeenCalledTimes(2));
  });

  it("reactivates a retired period", async () => {
    const user = userEvent.setup();
    await renderView();

    await user.click(screen.getByRole("checkbox", { name: "Atrium 2026-11-10 active" }));
    await user.click(within(rowOf("Set by mistake")).getByRole("button", { name: "Save" }));

    expect(callRpc).toHaveBeenCalledWith("update_maintenance_period", {
      p_id: retired.id,
      p_last_day: "2026-11-12",
      p_reason: "Set by mistake",
      p_is_active: true,
    });
  });

  it("refuses an empty reason before calling the database", async () => {
    const user = userEvent.setup();
    await renderView();

    await user.clear(screen.getByRole("textbox", { name: "Arena 2026-11-24 reason" }));
    await user.click(within(screen.getByLabelText("Arena 2026-11-24 last day").closest("tr")!).getByRole("button", { name: "Save" }));

    expect(callRpc).not.toHaveBeenCalled();
    expect(screen.getByText("Enter a reason.")).toBeInTheDocument();
  });

  it("keeps a refused reactivation's clash under its row after the toast has gone", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      callRpc.mockRejectedValue(clash("BK-2026-0012, BK-2026-0013"));
      await renderView();

      await user.click(screen.getByRole("checkbox", { name: "Atrium 2026-11-10 active" }));
      await user.click(within(rowOf("Set by mistake")).getByRole("button", { name: "Save" }));

      const message =
        "The Atrium is booked during those days: BK-2026-0012, BK-2026-0013. Cancel or move those bookings first.";
      await vi.waitFor(() => expect(refusalOf("Set by mistake")).toHaveTextContent(message));
      // The toast still fires too.
      expect(screen.getAllByRole("alert")).toHaveLength(2);

      // Past the toast's 4 seconds: the toast is gone, the row's line is not.
      act(() => vi.advanceTimersByTime(4100));
      expect(screen.getAllByRole("alert")).toHaveLength(1);
      const line = refusalOf("Set by mistake")!;
      expect(line).toHaveTextContent(message);
      // Selectable and copyable: plain text, not a button's label.
      expect(line.closest("button")).toBeNull();
      expect(refusalOf("Repainting")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("MaintenanceView — a refused row save", () => {
  const message =
    "The Atrium is booked during those days: BK-2026-0012. Cancel or move those bookings first.";

  /** Ticks the retired Atrium period active and has its save refused. */
  async function refuseReactivation(user: ReturnType<typeof userEvent.setup>) {
    callRpc.mockRejectedValueOnce(clash("BK-2026-0012"));
    await renderView();
    await user.click(screen.getByRole("checkbox", { name: "Atrium 2026-11-10 active" }));
    await user.click(within(rowOf("Set by mistake")).getByRole("button", { name: "Save" }));
    await vi.waitFor(() => expect(refusalOf("Set by mistake")).toHaveTextContent(message));
  }

  it("clears once the refused row is edited", async () => {
    const user = userEvent.setup();
    await refuseReactivation(user);

    await user.type(screen.getByRole("textbox", { name: "Atrium 2026-11-10 reason" }), "!");

    expect(refusalOf("Set by mistake!")).toBeNull();
  });

  it("clears once the refused row is reverted", async () => {
    const user = userEvent.setup();
    await refuseReactivation(user);

    await user.click(within(rowOf("Set by mistake")).getByRole("button", { name: "Revert" }));

    expect(refusalOf("Set by mistake")).toBeNull();
  });

  it("clears when the row is saved again, and a save that lands leaves none", async () => {
    const user = userEvent.setup();
    await refuseReactivation(user);

    let land!: () => void;
    callRpc.mockReturnValueOnce(new Promise<void>((resolve) => (land = resolve)));
    await user.click(within(rowOf("Set by mistake")).getByRole("button", { name: "Save" }));
    // In flight: the old refusal no longer describes this attempt.
    expect(refusalOf("Set by mistake")).toBeNull();

    await act(async () => land());
    await vi.waitFor(() => expect(listMaintenancePeriods).toHaveBeenCalledTimes(2));
    expect(refusalOf("Set by mistake")).toBeNull();
  });

  it("belongs to its own row: another row neither shows it nor clears it", async () => {
    const user = userEvent.setup();
    await refuseReactivation(user);

    expect(refusalOf("Repainting")).toBeNull();
    await user.type(screen.getByRole("textbox", { name: "Arena 2026-11-24 reason" }), "!");

    expect(refusalOf("Set by mistake")).toHaveTextContent(message);
    expect(refusalOf("Repainting!")).toBeNull();
  });

  it("goes once a reload replaces the draft it described", async () => {
    const user = userEvent.setup();
    await refuseReactivation(user);

    // Another row's save reloads every row, which drops the refused draft.
    fireEvent.change(screen.getByLabelText("Arena 2026-11-24 last day"), {
      target: { value: "2026-12-10" },
    });
    await user.click(within(rowOf("Repainting")).getByRole("button", { name: "Save" }));
    await vi.waitFor(() => expect(listMaintenancePeriods).toHaveBeenCalledTimes(2));

    expect(screen.getByRole("checkbox", { name: "Atrium 2026-11-10 active" })).not.toBeChecked();
    expect(refusalOf("Set by mistake")).toBeNull();
  });
});

describe("MaintenanceView — adding a period", () => {
  it("adds a period with every add_maintenance_period argument", async () => {
    const user = userEvent.setup();
    await renderView();

    await user.click(screen.getByRole("button", { name: "Add Maintenance Period" }));
    const dialog = screen.getByRole("dialog");
    await user.selectOptions(within(dialog).getByLabelText("Space"), "atrium");
    await user.type(within(dialog).getByLabelText("First day"), "2026-12-01");
    await user.type(within(dialog).getByLabelText("Last day"), "2026-12-03");
    await user.type(within(dialog).getByLabelText("Reason"), "Aircon repair");
    await user.click(within(dialog).getByRole("button", { name: "Add Maintenance Period" }));

    expect(callRpc).toHaveBeenCalledWith("add_maintenance_period", {
      p_space_code: "atrium",
      p_first_day: "2026-12-01",
      p_last_day: "2026-12-03",
      p_reason: "Aircon repair",
    });
    await vi.waitFor(() => expect(listMaintenancePeriods).toHaveBeenCalledTimes(2));
    expect(listSpaceStates).toHaveBeenCalledTimes(2);
  });

  it("refuses an add with no reason before calling the database", async () => {
    const user = userEvent.setup();
    await renderView();

    await user.click(screen.getByRole("button", { name: "Add Maintenance Period" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("First day"), "2026-12-01");
    await user.type(within(dialog).getByLabelText("Last day"), "2026-12-03");
    await user.click(within(dialog).getByRole("button", { name: "Add Maintenance Period" }));

    expect(callRpc).not.toHaveBeenCalled();
    expect(within(dialog).getByText("Enter a reason.")).toBeInTheDocument();
  });

  it("keeps the dialog open with the clash and its booking references", async () => {
    const user = userEvent.setup();
    callRpc.mockRejectedValue(
      toRpcError({
        code: "23P01",
        message:
          "add_maintenance_period: the Arena is booked during those days: BK-2026-0040, BK-2026-0041; cancel or move those bookings first",
      }),
    );
    await renderView();

    await user.click(screen.getByRole("button", { name: "Add Maintenance Period" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("First day"), "2026-12-01");
    await user.type(within(dialog).getByLabelText("Last day"), "2026-12-03");
    await user.type(within(dialog).getByLabelText("Reason"), "Floor sanding");
    await user.click(within(dialog).getByRole("button", { name: "Add Maintenance Period" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "The Arena is booked during those days: BK-2026-0040, BK-2026-0041. Cancel or move those bookings first.",
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows a first day in the past as a readable refusal", async () => {
    const user = userEvent.setup();
    callRpc.mockRejectedValue(
      toRpcError({
        code: "22023",
        message: "add_maintenance_period: the first day 2026-11-20 is before today (2026-11-25)",
      }),
    );
    await renderView();

    await user.click(screen.getByRole("button", { name: "Add Maintenance Period" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("First day"), "2026-11-20");
    await user.type(within(dialog).getByLabelText("Last day"), "2026-11-30");
    await user.type(within(dialog).getByLabelText("Reason"), "Late entry");
    await user.click(within(dialog).getByRole("button", { name: "Add Maintenance Period" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "The first day, 2026-11-20, is in the past. Today is 2026-11-25.",
    );
  });
});
