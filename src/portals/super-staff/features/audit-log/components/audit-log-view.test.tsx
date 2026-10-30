import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AuditEntry } from "../types";
import { AuditLogView } from "./audit-log-view";

// The screen is tested at its module boundary: the one read is mocked,
// everything between it and the DOM is real.

const listAuditEntries = vi.fn();

vi.mock("../lib/queries", () => ({
  listAuditEntries: () => listAuditEntries(),
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
});
