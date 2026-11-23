import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ToastProvider } from "@/portals/super-staff/components/providers/toast-provider";
import { UnsavedChangesProvider } from "@/portals/super-staff/components/providers/unsaved-changes-provider";
import type { BookingConfig } from "../types";
import { BookingConfigView } from "./booking-config-view";

// Tested at the module boundary: the read and the one RPC call site are mocked,
// and so are the three catalog cards, which have their own reads and saves and
// nothing to do with the scalar form. Everything between them and the DOM is
// real. No test here may reach the sandbox.

const callRpc = vi.fn();
const getBookingConfig = vi.fn();

vi.mock("@/portals/super-staff/lib/supabase/rpc", () => ({
  callRpc: (...args: unknown[]) => callRpc(...args),
}));

vi.mock("../lib/queries", () => ({
  getBookingConfig: () => getBookingConfig(),
}));

vi.mock("../hooks/use-catalog-editors", () => {
  const editor = () => ({ dirtyKeys: new Set() });
  return {
    useVenuesEditor: editor,
    useEventTypesEditor: editor,
    useClassificationsEditor: editor,
  };
});

vi.mock("./booking-catalogs", () => ({
  VenuesCard: () => null,
  EventTypesCard: () => null,
  ClassificationsCard: () => null,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/super-staff/configuration/booking",
  useRouter: () => ({ push: vi.fn() }),
}));

const config: BookingConfig = {
  downpaymentPct: 50,
  openingHour: 8,
  closingHour: 17,
  minDurationHours: 2,
  paymentWindowHours: 48,
  changeoverHours: 1,
};

async function renderView() {
  render(
    <ToastProvider>
      <UnsavedChangesProvider>
        <BookingConfigView />
      </UnsavedChangesProvider>
    </ToastProvider>,
  );
  return screen.findByLabelText("Changeover (hours)");
}

const setChangeover = (input: HTMLElement, value: string) =>
  fireEvent.change(input, { target: { value } });

const saveButton = () => screen.getByRole("button", { name: "Save changes" });

describe("BookingConfigView — the Changeover", () => {
  beforeEach(() => {
    callRpc.mockReset().mockResolvedValue(undefined);
    getBookingConfig.mockReset().mockResolvedValue(config);
  });

  it("shows the current Changeover", async () => {
    expect(await renderView()).toHaveValue(1);
  });

  it("refuses a value outside 0–4 with a message and keeps Save disabled", async () => {
    const input = await renderView();
    setChangeover(input, "5");
    expect(screen.getByText("Enter whole hours from 0 to 4.")).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();

    setChangeover(input, "1.5");
    expect(saveButton()).toBeDisabled();
  });

  it("shows the impact note with the new N before saving", async () => {
    setChangeover(await renderView(), "2");
    expect(
      screen.getByText(/keeps its space free for 2 hour\(s\) after the event/),
    ).toBeInTheDocument();
    expect(saveButton()).toBeEnabled();
  });

  it("lists the change in the confirmation and saves it through save_booking_config", async () => {
    setChangeover(await renderView(), "0");
    fireEvent.click(saveButton());

    const dialog = await screen.findByRole("dialog");
    const row = within(dialog).getByText("Changeover (hours)").closest("li");
    expect(row).toHaveTextContent("1 → 0");

    getBookingConfig.mockResolvedValue({ ...config, changeoverHours: 0 });
    fireEvent.click(within(dialog).getByRole("button", { name: /confirm|save/i }));

    await vi.waitFor(() =>
      expect(callRpc).toHaveBeenCalledWith(
        "save_booking_config",
        expect.objectContaining({ p_changeover_hours: 0 }),
      ),
    );
  });
});
