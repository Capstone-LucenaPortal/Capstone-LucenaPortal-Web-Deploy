import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@/portals/super-staff/components/providers/toast-provider";
import { toRpcError } from "@/portals/super-staff/lib/supabase/errors";
import type { Holiday, OfficeHours } from "../lib/calendar-types";
import { CalendarView } from "./calendar-view";

// The screen is tested at its module boundary: the three reads and the one RPC
// call site are mocked, everything between them and the DOM is real.

const callRpc = vi.fn();
const listHolidays = vi.fn();
const getCalendarEndsOn = vi.fn();
const listOfficeHours = vi.fn();

vi.mock("@/portals/super-staff/lib/supabase/rpc", () => ({
  callRpc: (...args: unknown[]) => callRpc(...args),
}));

vi.mock("../lib/calendar-queries", () => ({
  listHolidays: () => listHolidays(),
  getCalendarEndsOn: () => getCalendarEndsOn(),
  listOfficeHours: () => listOfficeHours(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/super-staff/configuration/calendar",
  useRouter: () => ({ push: vi.fn() }),
}));

const christmas: Holiday = {
  id: "11111111-1111-1111-1111-111111111111",
  holidayDate: "2026-12-25",
  name: "Christmas Day",
  kind: "regular",
  source: "RA 9492",
  isActive: true,
};

const retired: Holiday = {
  id: "22222222-2222-2222-2222-222222222222",
  holidayDate: "2026-08-19",
  name: "Quezon Day",
  kind: "local",
  source: "RA 6741",
  isActive: false,
};

const weekday = (isoWeekday: number, dayName: string, open = true): OfficeHours => ({
  isoWeekday,
  dayName,
  open,
  openTime: open ? "08:00" : "",
  closeTime: open ? "17:00" : "",
});

const week: OfficeHours[] = [
  weekday(1, "Monday"),
  weekday(2, "Tuesday"),
  weekday(3, "Wednesday"),
  weekday(4, "Thursday"),
  weekday(5, "Friday"),
  weekday(6, "Saturday", false),
  weekday(7, "Sunday", false),
];

async function renderView() {
  render(
    <ToastProvider>
      <CalendarView />
    </ToastProvider>,
  );
  await screen.findByDisplayValue("Christmas Day");
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-30T02:00:00Z"));
  listHolidays.mockResolvedValue([retired, christmas]);
  getCalendarEndsOn.mockResolvedValue("2027-12-31");
  listOfficeHours.mockResolvedValue(week);
  callRpc.mockResolvedValue({});
});

afterEach(() => {
  vi.useRealTimers();
});

describe("CalendarView — Holidays", () => {
  it("lists retired holidays too, marked as retired", async () => {
    await renderView();

    const row = screen.getByDisplayValue("Quezon Day").closest("tr")!;
    expect(within(row).getByText("2026-08-19")).toBeInTheDocument();
    expect(within(row).getByText("Retired")).toBeInTheDocument();
    expect(within(row).getByDisplayValue("RA 6741")).toBeInTheDocument();

    const active = screen.getByDisplayValue("Christmas Day").closest("tr")!;
    // Rendered but hidden: it reserves its width so the column does not jump.
    expect(within(active).getByText("Retired").closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it("offers no delete — retiring is the only removal", async () => {
    await renderView();
    expect(screen.queryByRole("button", { name: /delete/i })).toBeNull();
  });

  it("retires a holiday by sending every update_holiday argument", async () => {
    const user = userEvent.setup();
    await renderView();

    await user.click(screen.getByRole("checkbox", { name: "2026-12-25 active" }));
    const row = screen.getByDisplayValue("Christmas Day").closest("tr")!;
    await user.click(within(row).getByRole("button", { name: "Save" }));

    expect(callRpc).toHaveBeenCalledWith("update_holiday", {
      p_id: christmas.id,
      p_name: "Christmas Day",
      p_kind: "regular",
      p_source: "RA 9492",
      p_is_active: false,
    });
  });

  it("says Not found when a stale screen edits a holiday that is gone", async () => {
    const user = userEvent.setup();
    callRpc.mockRejectedValue(
      toRpcError({ code: "PT404", message: "update_holiday: no holiday" }),
    );
    await renderView();

    await user.clear(screen.getByDisplayValue("Christmas Day"));
    await user.type(screen.getByRole("textbox", { name: "2026-12-25 name" }), "Pasko");
    const row = screen.getByDisplayValue("Pasko").closest("tr")!;
    await user.click(within(row).getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/^Not found/);
  });

  it("says Not permitted on a 42501", async () => {
    const user = userEvent.setup();
    callRpc.mockRejectedValue(
      toRpcError({ code: "42501", message: "update_holiday: caller is not an active Super Staff" }),
    );
    await renderView();

    await user.click(screen.getByRole("checkbox", { name: "2026-12-25 active" }));
    const row = screen.getByDisplayValue("Christmas Day").closest("tr")!;
    await user.click(within(row).getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/^Not permitted/);
  });

  it("adds a holiday with every add_holiday argument", async () => {
    const user = userEvent.setup();
    await renderView();

    await user.click(screen.getByRole("button", { name: "Add holiday" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Date"), "2026-10-31");
    await user.type(within(dialog).getByLabelText("Name"), "Typhoon Kristine suspension");
    await user.selectOptions(within(dialog).getByLabelText("Kind"), "suspension");
    await user.type(within(dialog).getByLabelText("Source"), "EO 12, s. 2026");
    await user.click(within(dialog).getByRole("button", { name: "Add holiday" }));

    expect(callRpc).toHaveBeenCalledWith("add_holiday", {
      p_holiday_date: "2026-10-31",
      p_name: "Typhoon Kristine suspension",
      p_kind: "suspension",
      p_source: "EO 12, s. 2026",
    });
    expect(listHolidays).toHaveBeenCalledTimes(2);
  });

  it("refuses an add with no source before calling the database", async () => {
    const user = userEvent.setup();
    await renderView();

    await user.click(screen.getByRole("button", { name: "Add holiday" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Date"), "2026-10-31");
    await user.type(within(dialog).getByLabelText("Name"), "Suspension");
    await user.click(within(dialog).getByRole("button", { name: "Add holiday" }));

    expect(callRpc).not.toHaveBeenCalled();
    expect(within(dialog).getByText(/proclamation or declaration/)).toBeInTheDocument();
  });

  it("shows the database's message when the date already has an entry", async () => {
    const user = userEvent.setup();
    const message =
      "add_holiday: 2026-08-19 already has a holiday entry; edit or reactivate it instead";
    callRpc.mockRejectedValue(toRpcError({ code: "23505", message }));
    await renderView();

    await user.click(screen.getByRole("button", { name: "Add holiday" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Date"), "2026-08-19");
    await user.type(within(dialog).getByLabelText("Name"), "Quezon Day");
    await user.type(within(dialog).getByLabelText("Source"), "RA 6741");
    await user.click(within(dialog).getByRole("button", { name: "Add holiday" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(message);
  });
});

describe("CalendarView — Office Hours", () => {
  it("shows one row per weekday, closed days marked closed", async () => {
    await renderView();

    expect(screen.getByRole("textbox", { name: "Monday opens" })).toHaveValue("08:00");
    expect(screen.getByRole("textbox", { name: "Monday closes" })).toHaveValue("17:00");
    const sunday = screen.getByText("Sunday").closest("tr")!;
    expect(within(sunday).getByText("Closed")).toBeInTheDocument();
    expect(within(sunday).getByRole("checkbox", { name: "Sunday open" })).not.toBeChecked();
  });

  it("marks a day closed by sending both times as explicit nulls", async () => {
    const user = userEvent.setup();
    await renderView();

    await user.click(screen.getByRole("checkbox", { name: "Friday open" }));
    const row = screen.getByText("Friday").closest("tr")!;
    await user.click(within(row).getByRole("button", { name: "Save" }));

    expect(callRpc).toHaveBeenCalledWith("set_office_hours", {
      p_iso_weekday: 5,
      p_open_time: null,
      p_close_time: null,
    });
  });

  it("shows the database's 22023 message for a close before the open", async () => {
    const user = userEvent.setup();
    const message = "set_office_hours: close_time 07:00:00 must be after open_time 08:00:00";
    callRpc.mockRejectedValue(toRpcError({ code: "22023", message }));
    await renderView();

    const closes = screen.getByRole("textbox", { name: "Monday closes" });
    await user.clear(closes);
    await user.type(closes, "07:00");
    const row = screen.getByText("Monday").closest("tr")!;
    await user.click(within(row).getByRole("button", { name: "Save" }));

    expect(callRpc).toHaveBeenCalledWith("set_office_hours", {
      p_iso_weekday: 1,
      p_open_time: "08:00",
      p_close_time: "07:00",
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
  });
});

describe("CalendarView — a refused gate", () => {
  // The super_* views answer a wrong caller with ZERO rows, not an error. All
  // seven weekdays are seeded, so an empty week is the access signal.
  beforeEach(() => {
    listHolidays.mockResolvedValue([]);
    getCalendarEndsOn.mockResolvedValue(null);
    listOfficeHours.mockResolvedValue([]);
  });

  it("reads empty views as not permitted, not as an empty calendar", async () => {
    render(
      <ToastProvider>
        <CalendarView />
      </ToastProvider>,
    );

    expect(await screen.findAllByText(/^Not permitted/)).toHaveLength(2);
    expect(screen.queryByText(/There are no active holidays/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Add holiday" })).toBeNull();
  });
});

describe("CalendarView — the notices", () => {
  it("says saving moves every running Processing Deadline", async () => {
    await renderView();
    expect(
      screen.getByText(/moves the Processing Deadline of every open Yellow Card application whose clock is running/),
    ).toBeInTheDocument();
  });

  it("shows how far ahead the calendar reaches", async () => {
    await renderView();
    expect(await screen.findByText(/31 December 2027/)).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("warns as the end of the calendar approaches", async () => {
    vi.setSystemTime(new Date("2027-11-15T02:00:00Z"));
    await renderView();
    const warning = await screen.findByRole("status");
    expect(warning).toHaveTextContent(/in 46 days/);
    expect(warning).toHaveTextContent(/Add next year.s holidays/);
  });

  it("says so once the calendar has run out", async () => {
    vi.setSystemTime(new Date("2028-01-03T02:00:00Z"));
    await renderView();
    expect(await screen.findByRole("status")).toHaveTextContent(/ended on 31 December 2027, 3 days ago/);
  });
});
