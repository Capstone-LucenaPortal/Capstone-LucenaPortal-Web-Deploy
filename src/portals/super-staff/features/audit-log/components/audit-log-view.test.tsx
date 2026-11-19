import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AuditPage, AuditPageQuery, AuditScope } from "../lib/queries";
import type { AreaCounts, AuditEntry } from "../types";
import { AuditLogView } from "./audit-log-view";

// The screen is tested at its module boundary: the three reads are mocked,
// everything between them and the DOM is real. What the reads send is tested
// at the network in queries.test.ts.

const newestAuditEntryAt = vi.fn();
const listAuditPage = vi.fn();
const countAuditAreas = vi.fn();

vi.mock("../lib/queries", () => ({
  AUDIT_PAGE_SIZE: 50,
  ZERO_COUNTS: {
    all: 0,
    accounts: 0,
    configuration: 0,
    catalogs: 0,
    content: 0,
    pii_access: 0,
    calendar: 0,
    auth: 0,
  },
  newestAuditEntryAt: (signal?: AbortSignal) => newestAuditEntryAt(signal),
  listAuditPage: (query: AuditPageQuery, signal?: AbortSignal) =>
    listAuditPage(query, signal),
  countAuditAreas: (scope: AuditScope, signal?: AbortSignal) =>
    countAuditAreas(scope, signal),
}));

const entry = (patch: Partial<AuditEntry> = {}): AuditEntry => ({
  id: "a1",
  timestamp: "2026-10-30T02:15:00Z",
  actor: "Ramon Cruz",
  area: "configuration",
  change: "Downpayment (%) 50 → 30",
  target: "Booking configuration",
  targetId: "booking_config",
  detail: undefined,
  sessionId: null,
  ipAddress: null,
  userAgent: null,
  references: [],
  releasedReport: null,
  ...patch,
});

/** `count` entries, newest first, each with its own change text. */
const many = (count: number): AuditEntry[] =>
  Array.from({ length: count }, (_, i) =>
    entry({ id: `e${i}`, change: `Change ${i}` }),
  );

const exported = entry({
  id: "exp",
  area: "pii_access",
  change: "Exported applicant list",
  target: "2 applications",
  targetId: null,
  detail: "status=rejected, 2026-10-01..2026-10-30, 2 rows",
  sessionId: "s-1",
  ipAddress: "198.51.100.7",
  userAgent: "Mozilla/5.0",
  references: ["YC-2026-000061", "YC-2026-000007"],
});

const CEILING = "2026-10-30T02:15:00Z";
// The newest entry (2026-10-30 PH) anchors the default window, 2026-09-30..2026-10-30.
const DEFAULT_SCOPE = {
  fromIso: "2026-09-30T00:00:00+08:00",
  beforeIso: "2026-10-31T00:00:00+08:00",
  ceiling: CEILING,
};

const counts = (patch: Partial<AreaCounts> = {}): AreaCounts => ({
  all: 0,
  accounts: 0,
  configuration: 0,
  catalogs: 0,
  content: 0,
  pii_access: 0,
  calendar: 0,
  auth: 0,
  ...patch,
});

/** A log holding `entries`, every one of them matching whatever is asked. */
function serve(entries: AuditEntry[], tabs: Partial<AreaCounts> = {}) {
  newestAuditEntryAt.mockResolvedValue(entries[0]?.timestamp ?? null);
  listAuditPage.mockImplementation(
    async ({ page }: AuditPageQuery): Promise<AuditPage> => ({
      entries: entries.slice((page - 1) * 50, page * 50),
      total: entries.length,
    }),
  );
  countAuditAreas.mockResolvedValue(counts({ all: entries.length, ...tabs }));
}

async function show(...entries: AuditEntry[]) {
  serve(entries);
  const view = render(<AuditLogView />);
  await screen.findByText(/^Showing/);
  return view;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Lets every settled read reach the screen. */
const settle = () => act(async () => {});

// fireEvent, not userEvent.type: typing into type="date" is unreliable in jsdom.
const setDate = (label: "From" | "To", value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const lastPageQuery = (): AuditPageQuery => listAuditPage.mock.lastCall![0];

const results = () => screen.getByText(/^Showing/).textContent;

beforeEach(() => {
  newestAuditEntryAt.mockReset();
  listAuditPage.mockReset();
  countAuditAreas.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("AuditLogView — the first open", () => {
  it("reads the ceiling once, then page 1 and the counts of the default window under it", async () => {
    await show(entry());

    expect(newestAuditEntryAt).toHaveBeenCalledTimes(1);
    expect(listAuditPage).toHaveBeenCalledTimes(1);
    expect(lastPageQuery()).toEqual({
      ...DEFAULT_SCOPE,
      area: "all",
      search: "",
      page: 1,
    });
    expect(countAuditAreas).toHaveBeenCalledTimes(1);
    expect(countAuditAreas.mock.lastCall![0]).toEqual(DEFAULT_SCOPE);
  });

  it("shows Loading… until the first page arrives", async () => {
    const ceiling = deferred<string | null>();
    serve([entry()]);
    newestAuditEntryAt.mockReturnValue(ceiling.promise);
    render(<AuditLogView />);

    expect(screen.getByText("Loading…")).toBeInTheDocument();

    ceiling.resolve(CEILING);
    expect(await screen.findByText(entry().change)).toBeInTheDocument();
    expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
  });

  it("shows the empty list and a zero on every tab for an empty log, reading nothing else", async () => {
    await show();

    expect(
      screen.getByText("No audit entries match your filters."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All (0)" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Authentication (0)" }),
    ).toBeInTheDocument();
    expect(results()).toBe("Showing 0 of 0 results.");
    expect(listAuditPage).not.toHaveBeenCalled();
    expect(countAuditAreas).not.toHaveBeenCalled();
  });

  it("cancels what is in flight when the page is left", async () => {
    newestAuditEntryAt.mockReturnValue(new Promise(() => {}));
    const { unmount } = render(<AuditLogView />);
    const signal: AbortSignal = newestAuditEntryAt.mock.calls[0][0];
    expect(signal.aborted).toBe(false);

    unmount();

    expect(signal.aborted).toBe(true);
  });

  it("cancels a page read in flight when the page is left", async () => {
    const { unmount } = await show(...many(120));
    listAuditPage.mockReturnValue(new Promise(() => {}));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    const signal: AbortSignal = listAuditPage.mock.lastCall![1];
    expect(signal.aborted).toBe(false);

    unmount();

    expect(signal.aborted).toBe(true);
  });
});

describe("AuditLogView — paging", () => {
  it("shows the first 50 rows and pages through the rest with Previous and Next", async () => {
    await show(...many(120));

    expect(screen.getByText("Change 49")).toBeInTheDocument();
    expect(screen.queryByText("Change 50")).not.toBeInTheDocument();
    expect(results()).toBe("Showing 1–50 of 120 results.");
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Change 50")).toBeInTheDocument();
    expect(results()).toBe("Showing 51–100 of 120 results.");
    expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Change 119")).toBeInTheDocument();
    expect(results()).toBe("Showing 101–120 of 120 results.");
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(await screen.findByText("Change 50")).toBeInTheDocument();
    expect(results()).toBe("Showing 51–100 of 120 results.");
  });

  it("keeps the ceiling and the counts across a page turn", async () => {
    await show(...many(120));

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Change 50");

    expect(lastPageQuery()).toEqual({
      ...DEFAULT_SCOPE,
      area: "all",
      search: "",
      page: 2,
    });
    expect(newestAuditEntryAt).toHaveBeenCalledTimes(1);
    expect(countAuditAreas).toHaveBeenCalledTimes(1);
  });

  it("disables both buttons on a single page", async () => {
    await show(...many(50));

    expect(results()).toBe("Showing 1–50 of 50 results.");
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("counts the results from the page read, which follows the search, not from the tabs", async () => {
    serve(many(7), { all: 500 });
    render(<AuditLogView />);
    await screen.findByText(/^Showing/);

    expect(results()).toBe("Showing 1–7 of 7 results.");
    expect(screen.getByRole("button", { name: "All (500)" })).toBeInTheDocument();
  });

  it("keeps the old rows on screen, dimmed, with the buttons disabled, until the next page arrives", async () => {
    await show(...many(120));
    const next = deferred<AuditPage>();
    listAuditPage.mockReturnValueOnce(next.promise);

    await userEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText("Change 0")).toBeInTheDocument();
    expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
    expect(screen.getByRole("table").closest("[aria-busy]")).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();

    next.resolve({ entries: many(120).slice(50, 100), total: 120 });
    expect(await screen.findByText("Change 50")).toBeInTheDocument();
    expect(screen.getByRole("table").closest("[aria-busy]")).toHaveAttribute(
      "aria-busy",
      "false",
    );
  });
});

describe("AuditLogView — changing the filters", () => {
  it("goes back to page 1 on a tab, under a new ceiling, keeping the counts", async () => {
    await show(...many(120));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Change 50");

    await userEvent.click(
      screen.getByRole("button", { name: "Configuration (0)" }),
    );
    await screen.findByText("Change 0");

    expect(lastPageQuery()).toMatchObject({ area: "configuration", page: 1 });
    expect(newestAuditEntryAt).toHaveBeenCalledTimes(2);
    expect(countAuditAreas).toHaveBeenCalledTimes(1);
  });

  it("goes back to page 1 on a date, re-reading the ceiling and the counts", async () => {
    await show(...many(120));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Change 50");

    setDate("From", "2026-10-01");
    await screen.findByText("Change 0");

    const scope = {
      ...DEFAULT_SCOPE,
      fromIso: "2026-10-01T00:00:00+08:00",
    };
    expect(lastPageQuery()).toEqual({
      ...scope,
      area: "all",
      search: "",
      page: 1,
    });
    expect(newestAuditEntryAt).toHaveBeenCalledTimes(2);
    expect(countAuditAreas).toHaveBeenCalledTimes(2);
    expect(countAuditAreas.mock.lastCall![0]).toEqual(scope);
  });

  it("collapses an expanded row", async () => {
    await show(entry({ detail: "Was 50, now 30" }));
    await userEvent.click(screen.getByText("Downpayment (%) 50 → 30"));
    expect(screen.getByText("Was 50, now 30")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /^Content/ }));
    await settle();

    expect(screen.queryByText("Was 50, now 30")).not.toBeInTheDocument();
  });
});

describe("AuditLogView — the search", () => {
  const type = (value: string) =>
    fireEvent.change(screen.getByLabelText("Search audit log"), {
      target: { value },
    });

  it("searches once, 300 ms after the last keystroke, from page 1, keeping the counts", async () => {
    await show(...many(120));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Change 50");
    const reads = listAuditPage.mock.calls.length;
    vi.useFakeTimers();

    type("r");
    act(() => vi.advanceTimersByTime(200));
    type("ra");
    act(() => vi.advanceTimersByTime(200));
    type("ram");
    act(() => vi.advanceTimersByTime(299));
    expect(listAuditPage).toHaveBeenCalledTimes(reads);

    act(() => vi.advanceTimersByTime(1));
    await settle();

    expect(listAuditPage).toHaveBeenCalledTimes(reads + 1);
    expect(lastPageQuery()).toMatchObject({ search: "ram", page: 1 });
    expect(newestAuditEntryAt).toHaveBeenCalledTimes(2);
    expect(countAuditAreas).toHaveBeenCalledTimes(1);
  });

  it("searches at once when the box is cleared", async () => {
    await show(...many(3));
    vi.useFakeTimers();
    type("ram");
    act(() => vi.advanceTimersByTime(300));
    await settle();
    const reads = listAuditPage.mock.calls.length;

    type("");
    await settle();

    expect(listAuditPage).toHaveBeenCalledTimes(reads + 1);
    expect(lastPageQuery()).toMatchObject({ search: "" });
  });
});

describe("AuditLogView — a late answer", () => {
  it("never shows a page that arrives after a newer one was asked for", async () => {
    await show(entry());
    const configuration = deferred<AuditPage>();
    const content = deferred<AuditPage>();
    listAuditPage
      .mockReturnValueOnce(configuration.promise)
      .mockReturnValueOnce(content.promise);

    await userEvent.click(screen.getByRole("button", { name: /^Configuration/ }));
    await userEvent.click(screen.getByRole("button", { name: /^Content/ }));
    await settle();
    const stale: AbortSignal = listAuditPage.mock.calls[1][1];
    expect(stale.aborted).toBe(true);

    content.resolve({ entries: [entry({ id: "n", change: "Newer" })], total: 1 });
    await screen.findByText("Newer");
    configuration.resolve({
      entries: [entry({ id: "o", change: "Older" })],
      total: 1,
    });
    await settle();

    expect(screen.queryByText("Older")).not.toBeInTheDocument();
    expect(screen.getByText("Newer")).toBeInTheDocument();
  });

  it("never shows counts that arrive after newer ones were asked for", async () => {
    await show(entry());
    const first = deferred<AreaCounts>();
    const second = deferred<AreaCounts>();
    countAuditAreas
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    setDate("From", "2026-10-01");
    await settle();
    setDate("From", "2026-10-02");
    await settle();

    second.resolve(counts({ all: 2 }));
    await screen.findByRole("button", { name: "All (2)" });
    first.resolve(counts({ all: 9 }));
    await settle();

    expect(screen.getByRole("button", { name: "All (2)" })).toBeInTheDocument();
  });
});

describe("AuditLogView — a failed read", () => {
  it.each([
    ["the ceiling", () => newestAuditEntryAt.mockRejectedValue(new Error("x"))],
    ["the page", () => listAuditPage.mockRejectedValue(new Error("x"))],
    ["a count", () => countAuditAreas.mockRejectedValue(new Error("x"))],
  ])(
    "shows only the load error when %s fails: no rows, counts or results line",
    async (_, fail) => {
      serve([entry()]);
      fail();
      render(<AuditLogView />);

      expect(
        await screen.findByText("Could not load the audit log."),
      ).toBeInTheDocument();
      expect(screen.queryByText(entry().change)).not.toBeInTheDocument();
      expect(screen.queryByText(/^Showing/)).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Configuration" }),
      ).toBeInTheDocument();
    },
  );

  it("tries again on the next filter change after the first open failed", async () => {
    serve([entry()]);
    newestAuditEntryAt.mockRejectedValueOnce(new Error("x"));
    render(<AuditLogView />);
    await screen.findByText("Could not load the audit log.");
    expect(newestAuditEntryAt).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole("button", { name: "Configuration" }));

    expect(await screen.findByText(entry().change)).toBeInTheDocument();
    expect(
      screen.queryByText("Could not load the audit log."),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Configuration (0)" }),
    ).toBeInTheDocument();
  });

  it("drops the rows when a later page fails", async () => {
    await show(...many(120));
    listAuditPage.mockRejectedValueOnce(new Error("x"));

    await userEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(
      await screen.findByText("Could not load the audit log."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Change 0")).not.toBeInTheDocument();
    expect(screen.queryByText(/^Showing/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
  });
});

describe("AuditLogView — an export's references", () => {
  it("lists every exported reference beside the detail and Forensic Context", async () => {
    await show(exported);
    await userEvent.click(screen.getByText("Exported applicant list"));

    const block = screen.getByText("References").parentElement!;
    expect(
      within(block)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["YC-2026-000061", "YC-2026-000007"]);
    expect(
      screen.getByText("status=rejected, 2026-10-01..2026-10-30, 2 rows"),
    ).toBeInTheDocument();
    expect(screen.getByText("198.51.100.7")).toBeInTheDocument();
  });

  it("makes an entry expandable on its references alone", async () => {
    await show(
      entry({
        id: "bare",
        area: "pii_access",
        change: "Exported applicant list",
        references: ["YC-2026-000061"],
      }),
    );
    await userEvent.click(screen.getByText("Exported applicant list"));

    expect(screen.getByText("References")).toBeInTheDocument();
    expect(screen.getByText("YC-2026-000061")).toBeInTheDocument();
  });

  it("shows no References block on an entry without references", async () => {
    await show(entry({ detail: "Was 50, now 30" }));
    await userEvent.click(screen.getByText("Downpayment (%) 50 → 30"));

    expect(screen.getByText("Was 50, now 30")).toBeInTheDocument();
    expect(screen.queryByText("References")).not.toBeInTheDocument();
  });

  it("leaves an entry with no detail, context or references unexpandable", async () => {
    await show(entry());
    expect(screen.queryByText("▸")).not.toBeInTheDocument();
  });

  it("does not list an export's references as a released report", async () => {
    await show(exported);
    await userEvent.click(screen.getByText("Exported applicant list"));

    expect(
      screen.queryByText("Report returned to the pool"),
    ).not.toBeInTheDocument();
  });
});

describe("AuditLogView — a report an account change released", () => {
  const deactivated = entry({
    id: "deact",
    area: "accounts",
    change: "Deactivated account",
    target: "juan.delacruz@lucenacity.gov.ph",
    targetId: "22222222-2222-2222-2222-222222222222",
    detail: "Transferred to another office",
    releasedReport: "INC-2026-000042",
  });

  it("shows the released report on its own labelled line, and no References block", async () => {
    await show(deactivated);
    await userEvent.click(screen.getByText("Deactivated account"));

    const line = screen.getByText("Report returned to the pool").parentElement!;
    expect(within(line).getByText("INC-2026-000042")).toBeInTheDocument();
    expect(
      screen.getByText("Transferred to another office"),
    ).toBeInTheDocument();
    expect(screen.queryByText("References")).not.toBeInTheDocument();
  });

  it("makes an entry expandable on its released report alone", async () => {
    await show({ ...deactivated, detail: undefined });
    await userEvent.click(screen.getByText("Deactivated account"));

    expect(screen.getByText("INC-2026-000042")).toBeInTheDocument();
  });

  it("shows no released-report line on an account entry that released nothing", async () => {
    await show({ ...deactivated, releasedReport: null });
    await userEvent.click(screen.getByText("Deactivated account"));

    expect(
      screen.getByText("Transferred to another office"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Report returned to the pool"),
    ).not.toBeInTheDocument();
  });
});

describe("AuditLogView — a reversed date range", () => {
  const reads = () =>
    newestAuditEntryAt.mock.calls.length +
    listAuditPage.mock.calls.length +
    countAuditAreas.mock.calls.length;

  it("says the dates are reversed, reads nothing, and shows no results line or counts", async () => {
    await show(entry());
    const before = reads();

    setDate("From", "2026-10-31");
    await settle();

    expect(
      screen.getByText("From must be on or before To."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("No audit entries match your filters."),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/^Showing/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Configuration" }),
    ).toBeInTheDocument();
    expect(reads()).toBe(before);
  });

  it("reads nothing on a tab change while the dates are reversed", async () => {
    await show(entry());
    setDate("From", "2026-10-31");
    await settle();
    const before = reads();

    await userEvent.click(screen.getByRole("button", { name: "Content" }));
    await settle();

    expect(reads()).toBe(before);
  });

  it("reads page 1 and the counts again once the dates are in order", async () => {
    await show(entry());
    setDate("From", "2026-10-31");
    expect(
      screen.getByText("From must be on or before To."),
    ).toBeInTheDocument();

    setDate("From", "2026-10-01");

    expect(await screen.findByText("Showing 1–1 of 1 results.")).toBeInTheDocument();
    expect(screen.getByText("Downpayment (%) 50 → 30")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All (1)" })).toBeInTheDocument();
    expect(lastPageQuery()).toMatchObject({
      fromIso: "2026-10-01T00:00:00+08:00",
      page: 1,
    });
    expect(countAuditAreas).toHaveBeenCalledTimes(2);
    expect(
      screen.queryByText("From must be on or before To."),
    ).not.toBeInTheDocument();
  });

  it("bounds each date box by the other one", async () => {
    await show(entry());
    setDate("From", "2026-10-05");
    setDate("To", "2026-10-20");

    expect(screen.getByLabelText("From")).toHaveAttribute("max", "2026-10-20");
    expect(screen.getByLabelText("To")).toHaveAttribute("min", "2026-10-05");
  });

  it("leaves a box unbounded while the other one is empty", async () => {
    await show(entry());
    setDate("From", "");
    setDate("To", "");

    expect(screen.getByLabelText("From")).not.toHaveAttribute("max");
    expect(screen.getByLabelText("To")).not.toHaveAttribute("min");
  });

  it("still shows the empty list for an in-order window with no rows", async () => {
    await show(entry());
    serve([]);
    newestAuditEntryAt.mockResolvedValue(CEILING);
    setDate("From", "2026-10-31");
    setDate("To", "2026-11-05");

    expect(
      await screen.findByText("No audit entries match your filters."),
    ).toBeInTheDocument();
    expect(results()).toBe("Showing 0 of 0 results.");
    expect(
      screen.queryByText("From must be on or before To."),
    ).not.toBeInTheDocument();
  });
});
