import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@/portals/super-staff/components/providers/toast-provider";
import { toRpcError } from "@/portals/super-staff/lib/supabase/errors";
import type { AuditEntry } from "@/portals/super-staff/features/audit-log/types";
import type { SystemIssue } from "../types";
import { SystemIssuesView } from "./system-issues-view";

// The queue is tested at its module boundary, like Maintenance: the two reads
// and the one RPC call site are mocked, everything between them and the DOM is
// real.

const callRpc = vi.fn();
const listSystemIssues = vi.fn();
const listAuditEntriesForTarget = vi.fn();
const loadSystemIssueScreenshot = vi.fn();

vi.mock("@/portals/super-staff/lib/supabase/rpc", () => ({
  callRpc: (...args: unknown[]) => callRpc(...args),
}));

vi.mock("../lib/system-issue-queries", () => ({
  listSystemIssues: () => listSystemIssues(),
  loadSystemIssueScreenshot: (path: string) => loadSystemIssueScreenshot(path),
}));

vi.mock("@/portals/super-staff/features/audit-log/lib/queries", () => ({
  listAuditEntriesForTarget: (id: string) => listAuditEntriesForTarget(id),
}));

const issue = (over: Partial<SystemIssue>): SystemIssue => ({
  id: "00000000-0000-0000-0000-000000000000",
  reference: "SI-2026-000000",
  createdAt: "2026-11-26T02:00:00+00:00",
  category: "website",
  description: "Something is wrong.",
  capturedPage: "/",
  userAgent: "Mozilla/5.0 Chrome/131.0",
  priority: null,
  status: "open",
  resolvedAt: null,
  resolutionNote: null,
  closesAt: null,
  closedAt: null,
  closeReason: null,
  closeNote: null,
  isOnBehalf: false,
  reporter: "Maria Santos",
  reporterEmail: null,
  screenshotPath: null,
  ...over,
});

// Needs attention, in triage order: not prioritised (oldest first), then High,
// Medium, Low. The fixture order is deliberately scrambled.
const lowOpen = issue({
  id: "d",
  reference: "SI-2026-000004",
  createdAt: "2026-11-20T02:00:00+00:00",
  category: "yellow_card",
  priority: "low",
  description: "The upload button is grey on Safari.",
});
const newUnprioritised = issue({
  id: "a",
  reference: "SI-2026-000031",
  createdAt: "2026-11-26T02:00:00+00:00",
  category: "lcc",
  description: "The calendar keeps loading when I pick December. I can't choose a date for our wedding reception.",
  capturedPage: "/lcc",
  userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/131.0",
});
const highInProgress = issue({
  id: "c",
  reference: "SI-2026-000020",
  createdAt: "2026-11-25T05:00:00+00:00",
  category: "accounts",
  priority: "high",
  status: "in_progress",
  description: "The sign-in code never arrives.",
  reporter: "Jose Rizal",
});
const oldUnprioritised = issue({
  id: "b",
  reference: "SI-2026-000010",
  createdAt: "2026-11-21T01:00:00+00:00",
  category: "incidents",
  description: "The map does not load on the incident page.",
});
const mediumInProgress = issue({
  id: "e",
  reference: "SI-2026-000015",
  createdAt: "2026-11-22T01:00:00+00:00",
  priority: "medium",
  status: "in_progress",
});
const resolved = issue({
  id: "f",
  reference: "SI-2026-000008",
  createdAt: "2026-11-18T01:00:00+00:00",
  priority: "high",
  status: "resolved",
  resolvedAt: "2026-11-24T03:00:00+00:00",
  resolutionNote: "Cleared the stuck calendar cache.",
  closesAt: "2026-12-01T03:00:00+00:00",
});
const autoClosed = issue({
  id: "g",
  reference: "SI-2026-000002",
  createdAt: "2026-11-01T01:00:00+00:00",
  priority: "medium",
  status: "closed",
  resolvedAt: "2026-11-05T03:00:00+00:00",
  resolutionNote: "Fixed the form.",
  closesAt: "2026-11-12T03:00:00+00:00",
});
const duplicate = issue({
  id: "h",
  reference: "SI-2026-000003",
  createdAt: "2026-11-02T01:00:00+00:00",
  status: "closed",
  closedAt: "2026-11-03T03:00:00+00:00",
  closeReason: "duplicate",
  closeNote: "Same as SI-2026-000002.",
});

const ALL = [lowOpen, newUnprioritised, highInProgress, resolved, oldUnprioritised, autoClosed, mediumInProgress, duplicate];

const historyEntry = (over: Partial<AuditEntry>): AuditEntry => ({
  id: "1",
  timestamp: "2026-11-26T02:00:00+00:00",
  actor: "Citizen",
  area: "system_issues",
  change: "Reported a website problem",
  target: "SI-2026-000010",
  targetId: "b",
  detail: "Category: Incidents",
  sessionId: null,
  ipAddress: null,
  userAgent: null,
  references: [],
  releasedReport: null,
  ...over,
});

async function renderView() {
  render(
    <ToastProvider>
      <SystemIssuesView />
    </ToastProvider>,
  );
  await screen.findByRole("table");
}

/** The table's body rows as their reference numbers, in order. */
const references = () =>
  within(screen.getByRole("table"))
    .getAllByRole("row")
    .slice(1)
    .map((r) => within(r).getAllByRole("cell")[0].textContent);

const rowOf = (reference: string) =>
  within(screen.getByRole("table")).getByRole("button", { name: reference }).closest("tr")!;

const panel = () => screen.getByRole("complementary", { name: /^System issue/ });

beforeEach(() => {
  vi.clearAllMocks();
  listSystemIssues.mockResolvedValue(ALL);
  listAuditEntriesForTarget.mockResolvedValue([]);
  callRpc.mockResolvedValue(undefined);
});

describe("SystemIssuesView — the queue", () => {
  it("counts the open issues and those not yet prioritised", async () => {
    await renderView();

    expect(screen.getByRole("heading", { name: "System issues" })).toBeInTheDocument();
    expect(screen.getByText(/5 open, 2 not yet prioritised/)).toBeInTheDocument();
  });

  it("opens on Needs attention, in triage order: not prioritised first, then High → Low, oldest first", async () => {
    await renderView();

    expect(screen.getByRole("tab", { name: /^Needs attention/ })).toHaveAttribute("aria-selected", "true");
    expect(references()).toEqual([
      "SI-2026-000010", // not prioritised, older
      "SI-2026-000031", // not prioritised, newer
      "SI-2026-000020", // High
      "SI-2026-000015", // Medium
      "SI-2026-000004", // Low
    ]);
  });

  it("filters Resolved, Closed (auto-closed and closed with a reason) and All", async () => {
    const user = userEvent.setup();
    await renderView();

    await user.click(screen.getByRole("tab", { name: /^Resolved/ }));
    expect(references()).toEqual(["SI-2026-000008"]);

    await user.click(screen.getByRole("tab", { name: /^Closed/ }));
    expect(references()).toEqual(["SI-2026-000003", "SI-2026-000002"]);

    await user.click(screen.getByRole("tab", { name: /^All/ }));
    expect(references()).toEqual([
      "SI-2026-000003",
      "SI-2026-000010",
      "SI-2026-000031",
      "SI-2026-000008",
      "SI-2026-000020",
      "SI-2026-000002",
      "SI-2026-000015",
      "SI-2026-000004",
    ]);
  });

  it("shows each row's area, excerpt, priority, status, reported time and reporter", async () => {
    await renderView();

    const cells = within(rowOf("SI-2026-000020"))
      .getAllByRole("cell")
      .map((c) => c.textContent);
    expect(cells).toEqual([
      "SI-2026-000020",
      "Accounts & sign-in",
      "The sign-in code never arrives.",
      "High",
      "In progress",
      "Nov 25, 2026, 1:00 PMJose Rizal",
    ]);
    expect(within(rowOf("SI-2026-000010")).getByText("Not prioritised")).toBeInTheDocument();
  });

  it("says so when a tab is empty", async () => {
    listSystemIssues.mockResolvedValue([lowOpen]);
    const user = userEvent.setup();
    await renderView();

    await user.click(screen.getByRole("tab", { name: /^Resolved/ }));
    expect(screen.getByText("No System issues here.")).toBeInTheDocument();
  });

  it("says so when the list cannot be loaded", async () => {
    listSystemIssues.mockRejectedValue(toRpcError({ code: "XX000", message: "boom" }));
    render(
      <ToastProvider>
        <SystemIssuesView />
      </ToastProvider>,
    );

    expect(await screen.findByText("Could not load System issues.")).toBeInTheDocument();
  });
});

describe("SystemIssuesView — the detail panel", () => {
  it("opens on the first row, and follows the row picked", async () => {
    const user = userEvent.setup();
    await renderView();

    expect(panel()).toHaveAccessibleName("System issue SI-2026-000010");
    await user.click(screen.getByRole("button", { name: "SI-2026-000031" }));
    expect(panel()).toHaveAccessibleName("System issue SI-2026-000031");
    expect(screen.getByRole("button", { name: "SI-2026-000031" })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows the full description, the reporter, the captured page and the browser", async () => {
    const user = userEvent.setup();
    await renderView();
    await user.click(screen.getByRole("button", { name: "SI-2026-000031" }));

    expect(panel()).toHaveTextContent(newUnprioritised.description);
    const details = within(panel())
      .getAllByRole("term")
      .map((dt) => `${dt.textContent}: ${dt.nextElementSibling?.textContent}`);
    expect(details).toEqual([
      "Reported by: Maria Santos",
      "Reported: Nov 26, 2026, 10:00 AM",
      "Page: /lcc",
      "Browser: Mozilla/5.0 (Linux; Android 14) Chrome/131.0",
      "Screenshot: None",
    ]);
    expect(loadSystemIssueScreenshot).not.toHaveBeenCalled();
  });

  describe("the Citizen's screenshot (l128b)", () => {
    const withShot = issue({
      id: "s",
      reference: "SI-2026-000040",
      createdAt: "2026-11-19T01:00:00+00:00",
      screenshotPath: "si/s/shot.png",
    });

    beforeEach(() => {
      listSystemIssues.mockResolvedValue([withShot]);
      // jsdom has no object URLs.
      URL.createObjectURL = vi.fn(() => "blob:http://localhost/shot");
      URL.revokeObjectURL = vi.fn();
    });

    it("shows it as a thumbnail that opens full size", async () => {
      loadSystemIssueScreenshot.mockResolvedValue(new Blob(["png"], { type: "image/png" }));
      await renderView();

      const link = await within(panel()).findByRole("link", { name: /open the screenshot full size/i });
      expect(link).toHaveAttribute("href", "blob:http://localhost/shot");
      expect(link).toHaveAttribute("target", "_blank");
      expect(within(link).getByRole("img")).toHaveAttribute("src", "blob:http://localhost/shot");
      expect(loadSystemIssueScreenshot).toHaveBeenCalledWith("si/s/shot.png");
    });

    it("refuses to show anything but a PNG or JPEG, which could run script on this origin", async () => {
      loadSystemIssueScreenshot.mockResolvedValue(new Blob(["<script>alert(1)</script>"], { type: "text/html" }));
      await renderView();

      expect(await within(panel()).findByText("Couldn't load the screenshot.")).toBeInTheDocument();
      expect(URL.createObjectURL).not.toHaveBeenCalled();
    });

    it("says so when it cannot be loaded", async () => {
      loadSystemIssueScreenshot.mockRejectedValue(new Error("Object not found"));
      await renderView();

      expect(await within(panel()).findByText("Couldn't load the screenshot.")).toBeInTheDocument();
      expect(within(panel()).queryByRole("link", { name: /screenshot/i })).not.toBeInTheDocument();
    });
  });

  it("shows the resolution note and the date it closes by itself", async () => {
    const user = userEvent.setup();
    await renderView();
    await user.click(screen.getByRole("tab", { name: /^Resolved/ }));

    expect(panel()).toHaveTextContent("Resolution: Cleared the stuck calendar cache.");
    expect(panel()).toHaveTextContent("Closes by itself on Dec 1, 2026.");
  });

  it("shows an auto-closed issue's resolution, and a close reason with its note", async () => {
    const user = userEvent.setup();
    await renderView();
    await user.click(screen.getByRole("tab", { name: /^Closed/ }));

    expect(panel()).toHaveTextContent("Closed — Duplicate: Same as SI-2026-000002.");
    await user.click(screen.getByRole("button", { name: "SI-2026-000002" }));
    expect(panel()).toHaveTextContent("Resolution: Fixed the form.");
    expect(panel()).toHaveTextContent("Closed by itself on Nov 12, 2026.");
  });

  it("builds the History from the audit trail, matched on the issue's id", async () => {
    listAuditEntriesForTarget.mockResolvedValue([
      historyEntry({ id: "2", actor: "Ana Reyes", change: "Set priority to High", detail: "Priority Not prioritised → High" }),
      historyEntry({ id: "1" }),
    ]);
    await renderView();

    const history = within(panel()).getByRole("region", { name: "History" });
    expect(await within(history).findByText("Set priority to High — Priority Not prioritised → High")).toBeInTheDocument();
    expect(within(history).getByText("Reported a website problem — Category: Incidents")).toBeInTheDocument();
    expect(listAuditEntriesForTarget).toHaveBeenCalledWith("b");
  });
});

describe("SystemIssuesView — triage", () => {
  it("sets the priority, leaving the category unchanged, then rereads the list and the History", async () => {
    const user = userEvent.setup();
    await renderView();

    await user.selectOptions(within(panel()).getByLabelText("Priority"), "high");

    expect(callRpc).toHaveBeenCalledWith("triage_system_issue", {
      p_id: "b",
      p_priority: "high",
      p_category: null,
    });
    await vi.waitFor(() => expect(listSystemIssues).toHaveBeenCalledTimes(2));
    expect(listAuditEntriesForTarget).toHaveBeenCalledTimes(2);
  });

  it("changes the category, leaving the priority unchanged", async () => {
    const user = userEvent.setup();
    await renderView();

    await user.selectOptions(within(panel()).getByLabelText("Category"), "website");

    expect(callRpc).toHaveBeenCalledWith("triage_system_issue", {
      p_id: "b",
      p_priority: null,
      p_category: "website",
    });
  });

  it("offers Not prioritised only as the starting value, never as a choice", async () => {
    await renderView();

    const priority = within(panel()).getByLabelText("Priority");
    expect(priority).toHaveValue("");
    expect(within(priority).getByRole("option", { name: "Not prioritised" })).toBeDisabled();
  });
});

describe("SystemIssuesView — moving an issue along", () => {
  it("starts an Open issue", async () => {
    const user = userEvent.setup();
    await renderView();

    expect(within(panel()).queryByRole("button", { name: "Mark resolved" })).toBeNull();
    await user.click(within(panel()).getByRole("button", { name: "Start working on it" }));

    expect(callRpc).toHaveBeenCalledWith("start_system_issue", { p_id: "b" });
    await vi.waitFor(() => expect(listSystemIssues).toHaveBeenCalledTimes(2));
  });

  it("resolves an issue in progress with a note the reporter sees, required", async () => {
    const user = userEvent.setup();
    await renderView();
    await user.click(screen.getByRole("button", { name: "SI-2026-000020" }));

    expect(within(panel()).queryByRole("button", { name: "Start working on it" })).toBeNull();
    const resolve = within(panel()).getByRole("button", { name: "Mark resolved" });
    expect(resolve).toBeDisabled();
    await user.type(within(panel()).getByLabelText(/^Resolution note/), "   ");
    expect(resolve).toBeDisabled();

    await user.clear(within(panel()).getByLabelText(/^Resolution note/));
    await user.type(within(panel()).getByLabelText(/^Resolution note/), "Re-sent the sign-in codes.");
    await user.click(resolve);

    expect(callRpc).toHaveBeenCalledWith("resolve_system_issue", {
      p_id: "c",
      p_note: "Re-sent the sign-in codes.",
    });
  });

  it.each([
    ["Not a system issue", "not_a_system_issue"],
    ["Duplicate", "duplicate"],
  ] as const)("closes with the reason %s and a required note", async (label, reason) => {
    const user = userEvent.setup();
    await renderView();

    await user.click(within(panel()).getByRole("button", { name: "Close with a reason" }));
    const close = within(panel()).getByRole("button", { name: "Close System issue" });
    expect(close).toBeDisabled();

    await user.click(within(panel()).getByRole("radio", { name: label }));
    expect(close).toBeDisabled();
    await user.type(within(panel()).getByLabelText("Close note"), "Told them where to go.");
    await user.click(close);

    expect(callRpc).toHaveBeenCalledWith("close_system_issue", {
      p_id: "b",
      p_reason: reason,
      p_note: "Told them where to go.",
    });
  });

  it("can cancel closing", async () => {
    const user = userEvent.setup();
    await renderView();

    await user.click(within(panel()).getByRole("button", { name: "Close with a reason" }));
    await user.click(within(panel()).getByRole("button", { name: "Cancel" }));

    expect(within(panel()).queryByRole("button", { name: "Close System issue" })).toBeNull();
    expect(callRpc).not.toHaveBeenCalled();
  });

  it("keeps the issue in the panel once the move takes it off the tab", async () => {
    const user = userEvent.setup();
    await renderView();
    await user.click(screen.getByRole("button", { name: "SI-2026-000020" }));
    listSystemIssues.mockResolvedValue(
      ALL.map((i) =>
        i.id === "c"
          ? {
              ...i,
              status: "resolved" as const,
              resolvedAt: "2026-11-26T06:00:00+00:00",
              resolutionNote: "Re-sent the sign-in codes.",
              closesAt: "2026-12-03T06:00:00+00:00",
            }
          : i,
      ),
    );

    await user.type(within(panel()).getByLabelText(/^Resolution note/), "Re-sent the sign-in codes.");
    await user.click(within(panel()).getByRole("button", { name: "Mark resolved" }));

    await vi.waitFor(() => expect(panel()).toHaveTextContent("Closes by itself on Dec 3, 2026."));
    expect(panel()).toHaveAccessibleName("System issue SI-2026-000020");
    expect(references()).not.toContain("SI-2026-000020");
  });
});

describe("SystemIssuesView — locked once finished", () => {
  it.each([
    ["Resolved", "SI-2026-000008"],
    ["Closed", "SI-2026-000003"],
  ])("%s: the selects are disabled and there is nothing to do", async (tab, reference) => {
    const user = userEvent.setup();
    await renderView();
    await user.click(screen.getByRole("tab", { name: new RegExp(`^${tab}`) }));
    expect(panel()).toHaveAccessibleName(`System issue ${reference}`);

    expect(within(panel()).getByLabelText("Category")).toBeDisabled();
    expect(within(panel()).getByLabelText("Priority")).toBeDisabled();
    for (const name of ["Start working on it", "Mark resolved", "Close with a reason"]) {
      expect(within(panel()).queryByRole("button", { name })).toBeNull();
    }
  });
});

describe("SystemIssuesView — refusals", () => {
  it("shows a refused move in the panel in plain words, and keeps it past the toast", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      callRpc.mockRejectedValue(
        toRpcError({
          code: "PT409",
          message: "start_system_issue: SI-2026-000010 is in_progress; only an open System issue can be started",
        }),
      );
      await renderView();

      await user.click(within(panel()).getByRole("button", { name: "Start working on it" }));

      const message = "SI-2026-000010 is in progress. Only an open System issue can be started.";
      await vi.waitFor(() => expect(within(panel()).getByRole("alert")).toHaveTextContent(message));
      // The toast fires too.
      expect(screen.getAllByRole("alert")).toHaveLength(2);

      await act(() => vi.advanceTimersByTimeAsync(4100));
      expect(screen.getAllByRole("alert")).toHaveLength(1);
      expect(within(panel()).getByRole("alert")).toHaveTextContent(message);
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows a locked triage in the panel, and rereads so the screen catches up", async () => {
    const user = userEvent.setup();
    callRpc.mockRejectedValue(
      toRpcError({
        code: "PT409",
        message:
          "triage_system_issue: SI-2026-000010 is closed; priority and category are locked once a System issue is resolved or closed",
      }),
    );
    await renderView();

    await user.selectOptions(within(panel()).getByLabelText("Priority"), "low");

    expect(await within(panel()).findByRole("alert")).toHaveTextContent(
      "SI-2026-000010 is closed. Priority and category are locked once a System issue is resolved or closed.",
    );
    await vi.waitFor(() => expect(listSystemIssues).toHaveBeenCalledTimes(2));
  });

  it("keeps the note typed when a resolve is refused", async () => {
    const user = userEvent.setup();
    callRpc.mockRejectedValue(
      toRpcError({ code: "42501", message: "resolve_system_issue: caller is not an active Super Staff" }),
    );
    await renderView();
    await user.click(screen.getByRole("button", { name: "SI-2026-000020" }));

    await user.type(within(panel()).getByLabelText(/^Resolution note/), "Re-sent the codes.");
    await user.click(within(panel()).getByRole("button", { name: "Mark resolved" }));

    expect(await within(panel()).findByRole("alert")).toHaveTextContent(
      "Not permitted — only an active Super Staff member can work System issues.",
    );
    expect(within(panel()).getByLabelText(/^Resolution note/)).toHaveValue("Re-sent the codes.");
  });

  it("keeps an unpicked first row and its refusal in the panel when the reread moves it off the tab", async () => {
    const user = userEvent.setup();
    callRpc.mockRejectedValue(
      toRpcError({
        code: "PT409",
        message: "start_system_issue: SI-2026-000010 is closed; only an open System issue can be started",
      }),
    );
    await renderView();
    // Another officer closed it meanwhile: the reread takes it off Needs attention.
    listSystemIssues.mockResolvedValue(
      ALL.map((i) =>
        i.id === "b"
          ? { ...i, status: "closed" as const, closedAt: "2026-11-26T06:00:00+00:00", closeReason: "duplicate" as const, closeNote: "Same as SI-2026-000031." }
          : i,
      ),
    );

    await user.click(within(panel()).getByRole("button", { name: "Start working on it" }));

    await vi.waitFor(() => expect(references()).not.toContain("SI-2026-000010"));
    expect(panel()).toHaveAccessibleName("System issue SI-2026-000010");
    expect(within(panel()).getByRole("alert")).toHaveTextContent(
      "SI-2026-000010 is closed. Only an open System issue can be started.",
    );
  });

  it("clears the refusal when the next action starts", async () => {
    const user = userEvent.setup();
    callRpc.mockRejectedValueOnce(
      toRpcError({ code: "PT404", message: "start_system_issue: no System issue b" }),
    );
    await renderView();

    await user.click(within(panel()).getByRole("button", { name: "Start working on it" }));
    await within(panel()).findByRole("alert");

    await user.selectOptions(within(panel()).getByLabelText("Priority"), "medium");
    await vi.waitFor(() => expect(within(panel()).queryByRole("alert")).toBeNull());
  });
});

const fromEmail = issue({
  id: "n",
  reference: "SI-2026-000040",
  createdAt: "2026-11-26T06:00:00+00:00",
  category: "accounts",
  description: "I never get the sign-up code, so I can't make an account.",
  capturedPage: null,
  userAgent: null,
  isOnBehalf: true,
  reporter: "juan@example.com",
  reporterEmail: "juan@example.com",
});

const form = () => screen.getByRole("region", { name: "Log from helpdesk email" });

async function fillForm(user: ReturnType<typeof userEvent.setup>, email = "juan@example.com") {
  await user.click(screen.getByRole("button", { name: "Log from helpdesk email" }));
  await user.type(within(form()).getByLabelText("Their email address"), email);
  await user.selectOptions(
    within(form()).getByLabelText("Part of the website"),
    within(form()).getByRole("option", { name: "The website in general" }),
  );
  await user.type(
    within(form()).getByLabelText("What they said"),
    "I never get the sign-up code, so I can't make an account.",
  );
}

describe("SystemIssuesView — logging from a helpdesk email", () => {
  it("opens on Accounts & sign-in, what most helpdesk emails are about", async () => {
    const user = userEvent.setup();
    await renderView();
    await user.click(screen.getByRole("button", { name: "Log from helpdesk email" }));

    expect(within(form()).getByLabelText("Part of the website")).toHaveValue("accounts");
  });

  it("logs it through the on-behalf RPC, then rereads and opens the new issue", async () => {
    callRpc.mockResolvedValue([
      { issue_id: "n", issue_reference: "SI-2026-000040", issue_created_at: "2026-11-26T06:00:00+00:00" },
    ]);
    const user = userEvent.setup();
    await renderView();
    await fillForm(user);
    listSystemIssues.mockResolvedValue([...ALL, fromEmail]);

    await user.click(within(form()).getByRole("button", { name: "Log System issue" }));

    expect(callRpc).toHaveBeenCalledWith("log_system_issue_on_behalf", {
      p_email: "juan@example.com",
      p_category: "website",
      p_description: "I never get the sign-up code, so I can't make an account.",
    });
    expect(await screen.findByText("SI-2026-000040 logged.")).toBeInTheDocument();
    expect(panel()).toHaveAccessibleName("System issue SI-2026-000040");
    expect(screen.queryByRole("region", { name: "Log from helpdesk email" })).not.toBeInTheDocument();
    expect(references()).toContain("SI-2026-000040");
  });

  it("says the portal never notifies them", async () => {
    const user = userEvent.setup();
    await renderView();
    await user.click(screen.getByRole("button", { name: "Log from helpdesk email" }));

    expect(form()).toHaveTextContent(/helpdesk@lucena-city\.gov\.ph/);
    expect(form()).toHaveTextContent(/no portal notification/i);
  });

  it("logs nothing until the email and what they said are filled in", async () => {
    const user = userEvent.setup();
    await renderView();
    await user.click(screen.getByRole("button", { name: "Log from helpdesk email" }));
    const submit = within(form()).getByRole("button", { name: "Log System issue" });

    expect(submit).toBeDisabled();
    await user.type(within(form()).getByLabelText("Their email address"), "juan@example.com");
    expect(submit).toBeDisabled();
    await user.type(within(form()).getByLabelText("What they said"), "   ");
    expect(submit).toBeDisabled();
    await user.type(within(form()).getByLabelText("What they said"), "It's broken.");
    expect(submit).toBeEnabled();
  });

  it("shows a refusal in the form in plain words and keeps what was typed", async () => {
    callRpc.mockRejectedValue(
      toRpcError({
        code: "22023",
        message: "log_system_issue_on_behalf: a valid email address is required",
      }),
    );
    const user = userEvent.setup();
    await renderView();
    await fillForm(user, "juan@example");

    await user.click(within(form()).getByRole("button", { name: "Log System issue" }));

    expect(await within(form()).findByRole("alert")).toHaveTextContent(
      "Enter a valid email address, at most 254 characters.",
    );
    expect(within(form()).getByLabelText("Their email address")).toHaveValue("juan@example");
  });

  it("can cancel", async () => {
    const user = userEvent.setup();
    await renderView();
    await user.click(screen.getByRole("button", { name: "Log from helpdesk email" }));

    await user.click(within(form()).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("region", { name: "Log from helpdesk email" })).not.toBeInTheDocument();
    expect(callRpc).not.toHaveBeenCalled();
  });
});

describe("SystemIssuesView — an issue logged from an email", () => {
  beforeEach(() => {
    listSystemIssues.mockResolvedValue([fromEmail]);
  });

  it("names the reporter as the email, by email, in the row and the panel", async () => {
    await renderView();

    expect(within(rowOf("SI-2026-000040")).getByText(/juan@example\.com \(by email\)/)).toBeInTheDocument();
    expect(within(panel()).getByText("juan@example.com (by email)")).toBeInTheDocument();
  });

  it("offers Reply by email, with the reference in the subject, and says to reply from the helpdesk", async () => {
    await renderView();

    const reply = within(panel()).getByRole("link", { name: /Reply by email/ });
    const href = new URL(reply.getAttribute("href")!);
    expect(href.protocol).toBe("mailto:");
    expect(href.pathname).toBe("juan@example.com");
    expect(href.searchParams.get("subject")).toContain("SI-2026-000040");
    expect(panel()).toHaveTextContent(/no portal account/i);
    expect(panel()).toHaveTextContent(/helpdesk@lucena-city\.gov\.ph/);
  });

  it("does not tell the officer the reporter will see the resolution note", async () => {
    listSystemIssues.mockResolvedValue([{ ...fromEmail, status: "in_progress" }]);
    await renderView();

    expect(within(panel()).queryByText(/the reporter sees this/)).not.toBeInTheDocument();
    expect(within(panel()).getByLabelText(/Resolution note/)).toBeInTheDocument();
  });

  it("works like any other System issue", async () => {
    const user = userEvent.setup();
    await renderView();

    await user.click(within(panel()).getByRole("button", { name: "Start working on it" }));

    expect(callRpc).toHaveBeenCalledWith("start_system_issue", { p_id: "n" });
  });

  it("has no Reply by email on a Citizen's report", async () => {
    listSystemIssues.mockResolvedValue([lowOpen]);
    await renderView();

    expect(within(panel()).queryByRole("link", { name: /Reply by email/ })).not.toBeInTheDocument();
  });
});
