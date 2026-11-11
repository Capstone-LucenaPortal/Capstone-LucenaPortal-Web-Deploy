import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AuditEntry } from "../types";
import { AuditLogView } from "./audit-log-view";

// The screen is tested at its module boundary: the one read is mocked,
// everything between it and the DOM is real.

const listAuditEntries = vi.fn();

vi.mock("../lib/queries", () => ({
  listAuditEntries: (signal?: AbortSignal) => listAuditEntries(signal),
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

async function show(...entries: AuditEntry[]) {
  listAuditEntries.mockResolvedValue(entries);
  render(<AuditLogView />);
  await screen.findByText(entries[0].change);
}

beforeEach(() => {
  listAuditEntries.mockReset();
});

describe("AuditLogView — the load", () => {
  // listAuditEntries stops paging on this signal: see its own tests.
  it("cancels the load when the page is left", () => {
    listAuditEntries.mockReturnValue(new Promise(() => {}));
    const { unmount } = render(<AuditLogView />);
    const signal: AbortSignal = listAuditEntries.mock.calls[0][0];
    expect(signal.aborted).toBe(false);

    unmount();

    expect(signal.aborted).toBe(true);
  });

  it("shows the load error when the load fails, and no results line", async () => {
    listAuditEntries.mockRejectedValue(new Error("page 2 failed"));
    render(<AuditLogView />);

    expect(
      await screen.findByText("Could not load the audit log."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^Showing/)).not.toBeInTheDocument();
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
