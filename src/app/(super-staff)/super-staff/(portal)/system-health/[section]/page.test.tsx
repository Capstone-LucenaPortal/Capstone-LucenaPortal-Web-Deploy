import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import * as queries from "@/portals/super-staff/features/system-health/lib/queries";
import {
  FAST,
  SAMPLES,
  SUMMARY,
  healthySnapshot,
  withCheck,
} from "@/portals/super-staff/features/system-health/test/fixture";
import SystemHealthLayout from "../layout";
import SectionPage from "./page";

const { location } = vi.hoisted(() => ({ location: { pathname: "" } }));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => location.pathname,
}));

vi.mock("@/portals/super-staff/features/system-health/lib/queries");

beforeEach(() => {
  vi.mocked(queries.getSystemHealth).mockResolvedValue(healthySnapshot());
  vi.mocked(queries.checkReachability).mockResolvedValue(FAST);
  vi.mocked(queries.listHealthSamples).mockResolvedValue(SAMPLES);
  vi.mocked(queries.getHealthSummary).mockResolvedValue(SUMMARY);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

async function renderSection(section: string) {
  location.pathname = `/super-staff/system-health/${section}`;
  const page = await SectionPage({ params: Promise.resolve({ section }) });
  render(<SystemHealthLayout>{page}</SystemHealthLayout>);
  // The status header, once the reading is in.
  return screen.findByRole("region", { name: "Section status" });
}

/** The section's thresholds as "label: value" lines. */
function thresholds(): string[] {
  const panel = screen.getByRole("region", { name: "Thresholds" });
  return within(panel)
    .queryAllByRole("term")
    .map((dt) => `${dt.textContent}: ${dt.nextElementSibling?.textContent}`);
}

/** A table's body rows as cell texts. */
function rowsOf(table: HTMLElement): string[][] {
  return within(table)
    .getAllByRole("row")
    .slice(1)
    .map((r) => within(r).getAllByRole("cell").map((c) => c.textContent ?? ""));
}

/** A panel's "term: definition" pairs. */
function definitions(panel: HTMLElement): string[] {
  return within(panel)
    .getAllByRole("term")
    .map((dt) => `${dt.textContent}: ${dt.nextElementSibling?.textContent}`);
}

/** The checks table's rows as [check, count, oldest, status, what to do]. */
function checkRows(): string[][] {
  return rowsOf(within(screen.getByRole("region", { name: "Checks" })).getByRole("table"));
}

describe("System Health · section pages", () => {
  describe("checks table", () => {
    it("shows every Database check with its count, oldest age, status and what to do", async () => {
      await renderSection("database");

      expect(checkRows()).toEqual([
        ["Database size (% of the 500 MiB limit)", "24", "—", "OK", "Free space before the limit."],
        ["Client connections (% of max_connections)", "23.3", "—", "OK", "Find and close idle or runaway client connections."],
        ["Cache hit ratio (%)", "99.87", "—", "OK", "Reads are going to disk."],
        ["Open transactions (age of the oldest)", "1", "2 s", "OK", "Find the session holding the transaction open and end it."],
        ["Sessions waiting on a lock over 30 s", "0", "—", "OK", "End the session holding the lock."],
        ["Dead rows awaiting vacuum (all tables)", "1,840", "—", "Not graded", "Nothing to do unless one table keeps growing."],
      ]);
    });

    it.each(["database", "storage", "notifications", "jobs", "accounts"] as const)(
      "%s shows every one of its checks, ungraded ones without a pill",
      async (section) => {
        await renderSection(section);

        const fixture = healthySnapshot().sections[section].checks;
        expect(checkRows().map(([label, , , status]) => [label, status])).toEqual(
          fixture.map((c) => [c.label, c.graded ? "OK" : "Not graded"]),
        );
      },
    );

    it("pills a check the database grades badly, and the section with it", async () => {
      vi.mocked(queries.getSystemHealth).mockResolvedValue(
        withCheck(healthySnapshot(), "accounts", "recovery_requests", "warning", 6),
      );
      const header = await renderSection("accounts");

      expect(header).toHaveTextContent("Warning");
      expect(checkRows()[1].slice(0, 4)).toEqual([
        "Staff password-recovery requests (last hour)",
        "6",
        "—",
        "Warning",
      ]);
    });
  });

  describe("24 h status strip", () => {
    it("draws the section's own status from each sample, in time order", async () => {
      await renderSection("database");

      const panel = screen.getByRole("region", { name: "Status, last 24 h" });
      expect(within(panel).getByRole("img")).toHaveAccessibleName(
        "Database, last 24 h: 1 OK, 1 Warning, 1 not sampled",
      );
      expect(
        within(panel)
          .getAllByTitle(/Asia\/Manila/)
          .map((cell) => cell.getAttribute("title")),
      ).toEqual([
        "13:45 (Asia/Manila): not sampled",
        "13:50 (Asia/Manila): Warning",
        "13:55 (Asia/Manila): OK",
      ]);
    });

    it("reads another section's column, not the overall status", async () => {
      await renderSection("storage");

      expect(
        within(screen.getByRole("region", { name: "Status, last 24 h" })).getByRole("img"),
      ).toHaveAccessibleName("Storage, last 24 h: 2 OK, 1 not sampled");
    });

    it("says so when there are no samples yet", async () => {
      vi.mocked(queries.listHealthSamples).mockResolvedValue([]);
      await renderSection("jobs");

      expect(screen.getByRole("region", { name: "Status, last 24 h" })).toHaveTextContent(
        "No samples in the last 24 h yet. One is taken every 5 minutes.",
      );
    });
  });

  it("marks the open section in the second-level nav", async () => {
    await renderSection("storage");

    const nav = screen.getByRole("navigation", { name: "System Health sections" });
    expect(within(nav).getByRole("link", { name: /^Storage/ })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: /^General/ })).not.toHaveAttribute("aria-current");
  });

  describe("Database", () => {
    it("shows reachability, size with the largest tables, and connections by state", async () => {
      const header = await renderSection("database");

      expect(header).toHaveTextContent("Database");
      expect(header).toHaveTextContent("OK");
      expect(screen.getByRole("region", { name: "Reachability and response time" })).toHaveTextContent(
        "120ms round trip",
      );
      const size = screen.getByRole("region", { name: "Size and connections" });
      expect(size).toHaveTextContent("120.0 MB of 500.0 MB · 24%");
      expect(size).toHaveTextContent("14 of 60 · 23.3%");
      expect(size).toHaveTextContent("Active 2 · Idle 11 · Idle in transaction 0 · Other 1");
      expect(rowsOf(within(size).getByRole("table"))).toEqual([
        ["audit_log", "38.0 MB"],
        ["notifications", "21.0 MB"],
      ]);
    });

    it("shows the cache hit ratio, open transactions and lock waits", async () => {
      await renderSection("database");

      expect(definitions(screen.getByRole("region", { name: "Cache, transactions and locks" }))).toEqual([
        "Cache hit ratio: 99.87% (998,700 hits, 1,300 disk reads)",
        "Open transactions: 1, the oldest 2 s",
        "Waiting on a lock over 30 s: 0",
      ]);
    });

    it("lists the tables with the most dead rows, with their last autovacuum", async () => {
      await renderSection("database");

      const panel = screen.getByRole("region", { name: "Dead rows" });
      expect(panel).toHaveTextContent("All tables: 1,840");
      expect(rowsOf(within(panel).getByRole("table"))).toEqual([
        ["notifications", "1,200", "48,000", "Oct 31, 2026, 11:10 AM"],
        ["booking_holds", "640", "90", "Never"],
      ]);
    });

    it("keeps the connections chart and performance", async () => {
      await renderSection("database");

      expect(screen.getByRole("region", { name: "Open connections, last 24 h" })).toBeInTheDocument();
      expect(screen.getByRole("region", { name: "Performance" })).toHaveTextContent(
        "select * from incidents where id = $1",
      );
    });

    it("lists its own thresholds, response time included", async () => {
      await renderSection("database");

      expect(thresholds()).toEqual([
        "Response time: over 500 ms / over 2.0 s",
        "Size: over 80% / over 95% of 500.0 MB (Free plan)",
        "Connections: over 80% / over 95% of the 60 allowed",
        "Cache hit ratio: below 99% / below 95%",
        "Oldest open transaction: over 5 min / over 30 min",
        "Lock waits: 1 or more waiting over 30 s (warning)",
      ]);
    });

    it("says what it does not measure, and links to the project's Logs Explorer", async () => {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abcdefghijkl.supabase.co");
      await renderSection("database");

      expect(screen.getByText(/^Not measured here:/)).toHaveTextContent(
        "Not measured here: request errors and failed sign-ins. See Supabase → Logs",
      );
      expect(screen.getByRole("link", { name: "Supabase → Logs" })).toHaveAttribute(
        "href",
        "https://supabase.com/dashboard/project/abcdefghijkl/logs/explorer",
      );
    });

    it("is critical when the app grades the response time critical", async () => {
      vi.mocked(queries.checkReachability).mockResolvedValue({ ...FAST, ms: 2500 });
      const header = await renderSection("database");

      expect(header).toHaveTextContent("Critical");
    });

    it("is critical when the database is unreachable", async () => {
      vi.mocked(queries.checkReachability).mockResolvedValue({ ok: true, db_ok: false, ms: 30 });
      const header = await renderSection("database");

      expect(header).toHaveTextContent("Critical");
      expect(screen.getByRole("region", { name: "Reachability and response time" })).toHaveTextContent(
        "DatabaseDown",
      );
    });
  });

  describe("Storage", () => {
    it("shows the total against the quota and each bucket's files, stray and missing", async () => {
      const header = await renderSection("storage");

      expect(header).toHaveTextContent("Storage");
      const panel = screen.getByRole("region", { name: "Buckets" });
      expect(panel).toHaveTextContent("300.0 MB of 1.00 GB · 29.3%");
      expect(rowsOf(within(panel).getByRole("table"))).toEqual([
        ["incident-photos", "812", "250.0 MB", "3 (2.0 MB)", "0"],
        ["yellow-card-documents", "96", "50.0 MB", "0", "0"],
      ]);
    });

    it("says whether the agency seal has a file", async () => {
      await renderSection("storage");
      expect(screen.getByRole("region", { name: "Buckets" })).toHaveTextContent("Agency seal: on file");

      const health = withCheck(healthySnapshot(), "storage", "seal_missing", "warning", 1);
      health.sections.storage.detail.seal_present = false;
      vi.mocked(queries.getSystemHealth).mockResolvedValue(health);
      cleanup();
      await renderSection("storage");
      expect(screen.getByRole("region", { name: "Buckets" })).toHaveTextContent("Agency seal: no file");
    });

    it("lists its own thresholds", async () => {
      await renderSection("storage");

      expect(thresholds()).toEqual([
        "Quota: over 80% / over 95% of 1.00 GB (Free plan)",
        "Missing files: 1 or more (warning)",
      ]);
    });

    it("carries no not-measured line: storage has no log of its own here", async () => {
      await renderSection("storage");

      expect(screen.queryByText(/^Not measured here:/)).not.toBeInTheDocument();
    });
  });

  describe("Notifications", () => {
    it("shows each channel's delivery over 24 h, in-app included", async () => {
      await renderSection("notifications");

      const panel = screen.getByRole("region", { name: "Delivery by channel (24 h)" });
      expect(rowsOf(within(panel).getByRole("table"))).toEqual([
        ["Email", "0", "31", "0", "0", "0", "1", "0", "—"],
        ["Push", "2", "12", "0", "0", "1", "0", "0", "40 s"],
        ["In-app", "0", "64", "0", "0", "0", "0", "0", "—"],
      ]);
    });

    it("groups failures by reason, never by address", async () => {
      const health = withCheck(healthySnapshot(), "notifications", "email_failures", "warning", 6);
      const email = health.sections.notifications.detail.channels[0];
      email.failure_reasons = { ...email.failure_reasons, provider_refused: 4, bounce: 2 };
      vi.mocked(queries.getSystemHealth).mockResolvedValue(health);
      const header = await renderSection("notifications");

      expect(header).toHaveTextContent("Warning");
      const panel = screen.getByRole("region", { name: "Failures by reason (24 h)" });
      expect(rowsOf(within(panel).getByRole("table"))).toEqual([
        ["Provider refused", "4", "0", "0"],
        ["Bounced", "2", "0", "0"],
      ]);
    });

    it("says when nothing failed", async () => {
      await renderSection("notifications");

      expect(screen.getByRole("region", { name: "Failures by reason (24 h)" })).toHaveTextContent(
        "No failures in the last 24 h.",
      );
    });

    it("shows the database's two fixed lines, and keeps the queue chart", async () => {
      await renderSection("notifications");

      const panel = screen.getByRole("region", { name: "Delivery by channel (24 h)" });
      expect(panel).toHaveTextContent("SMS is not built: nothing in this system writes an SMS notification.");
      expect(panel).toHaveTextContent('"Sent" means the provider accepted the message, not that it arrived.');
      expect(screen.getByRole("region", { name: "Queued notifications, last 24 h" })).toBeInTheDocument();
    });

    it("lists its own thresholds", async () => {
      await renderSection("notifications");

      expect(thresholds()).toEqual([
        "Oldest queued: over 15 min / over 1.0 h",
        "Failed or bounced: 1 or more in 24 h, per channel (warning)",
      ]);
    });
  });

  describe("Background jobs", () => {
    it("shows each job with the section it serves and the check that proves it worked", async () => {
      await renderSection("jobs");

      const panel = screen.getByRole("region", { name: "Jobs" });
      expect(rowsOf(within(panel).getByRole("table"))).toEqual([
        [
          "purge-cron-history",
          "Database",
          "Background jobs: Job run history kept past 7 days",
          "Oct 31, 2026, 3:17 AM · OK · took 310 ms",
          "0",
          "OK",
        ],
        [
          "sample-system-health",
          "—",
          "Background jobs: History not sampled within twice the sampler's interval",
          "Oct 31, 2026, 1:55 PM · OK · took 240 ms",
          "0",
          "OK",
        ],
        [
          "sweep-expired-booking-holds",
          "LCC Bookings",
          "LCC Bookings: Expired holds still blocking the hall after 30 minutes",
          "Oct 31, 2026, 1:55 PM · OK · took 42 ms",
          "0",
          "OK",
        ],
      ]);
    });

    it("shows a switched-off system job as the database grades it, warning", async () => {
      const health = withCheck(healthySnapshot(), "jobs", "switched_off", "warning", 1);
      const sweep = health.sections.jobs.detail.items[2];
      Object.assign(sweep, { active: false, status: "warning" });
      vi.mocked(queries.getSystemHealth).mockResolvedValue(health);
      const header = await renderSection("jobs");

      expect(header).toHaveTextContent("Warning");
      const rows = rowsOf(within(screen.getByRole("region", { name: "Jobs" })).getByRole("table"));
      expect(rows[2].at(-1)).toBe("Switched off");
    });

    it("shows the run history and the job that purges it", async () => {
      await renderSection("jobs");

      const panel = screen.getByRole("region", { name: "Run history" });
      expect(panel).toHaveTextContent("4,210 runs kept, the oldest 7 d old");
      expect(panel).toHaveTextContent(
        "purge-cron-history deletes runs older than 7 d, daily. Last ran Oct 31, 2026, 3:17 AM.",
      );
    });

    it("lists its own thresholds", async () => {
      await renderSection("jobs");

      expect(thresholds()).toEqual([
        "Job overdue: no run in 2× its interval (warning)",
        "Run history: kept 7 d (warning when older runs remain)",
      ]);
    });
  });

  describe("Accounts & sign-in", () => {
    it("is graded now: sign-ins, recovery requests, the Super-staff count and stale invitations", async () => {
      const header = await renderSection("accounts");

      expect(header).toHaveTextContent("Accounts & sign-in");
      expect(header).toHaveTextContent("OK");
      expect(definitions(screen.getByRole("region", { name: "Staff accounts" }))).toEqual([
        "Staff sign-ins (24 h): 17",
        "Password-recovery requests (last hour): 0",
        "Super-staff accounts that have signed in: 2",
        "Invitations unaccepted after 7 d: 1, the oldest 9 d",
      ]);
    });

    it("lists its own thresholds", async () => {
      await renderSection("accounts");

      expect(thresholds()).toEqual([
        "Password-recovery requests: 5 or more in 1.0 h (warning)",
        "Super-staff accounts: 1 or fewer signed in (warning)",
      ]);
    });

    it("says what it does not measure, and links to Supabase's logs", async () => {
      await renderSection("accounts");

      expect(screen.getByText(/^Not measured here:/)).toHaveTextContent(
        "Not measured here: request errors and failed sign-ins. See Supabase → Logs",
      );
      expect(screen.getByRole("link", { name: "Supabase → Logs" })).toBeInTheDocument();
    });
  });

  describe("Citizen services", () => {
    it.each([
      ["yellow-card", "yellow_card", "Yellow Card"],
      ["incidents", "incidents", "Incidents"],
      ["lcc", "lcc", "LCC Bookings"],
    ] as const)("/%s shows every %s check, ungraded ones without a pill", async (slug, key, label) => {
      const header = await renderSection(slug);

      expect(header).toHaveTextContent(label);
      const fixture = healthySnapshot().sections[key].checks;
      expect(checkRows().map(([check, , , status]) => [check, status])).toEqual(
        fixture.map((c) => [c.label, c.graded ? "OK" : "Not graded"]),
      );
    });

    it("shows a check's count, oldest age and what to do, as the demo fault reads", async () => {
      const health = withCheck(healthySnapshot(), "lcc", "expired_hold", "critical", 1);
      health.sections.lcc.checks[0].oldest_seconds = 31 * 60;
      vi.mocked(queries.getSystemHealth).mockResolvedValue(health);
      const header = await renderSection("lcc");

      expect(header).toHaveTextContent("Critical");
      expect(checkRows()[0]).toEqual([
        "Expired holds still blocking the hall after 30 minutes",
        "1",
        "31 min",
        "Critical",
        "Report it to the developer.",
      ]);
    });

    it("draws the service's own 24 h strip", async () => {
      await renderSection("yellow-card");

      expect(
        within(screen.getByRole("region", { name: "Status, last 24 h" })).getByRole("img"),
      ).toHaveAccessibleName("Yellow Card, last 24 h: 2 OK, 1 not sampled");
    });

    it("names what it is affected by in its header, linking to each component's page", async () => {
      const health = withCheck(healthySnapshot(), "jobs", "overdue", "warning", 1);
      withCheck(health, "storage", "quota", "critical", 97.2);
      vi.mocked(queries.getSystemHealth).mockResolvedValue(health);
      const header = await renderSection("yellow-card");

      expect(header).toHaveTextContent("Critical");
      expect(header).toHaveTextContent("Affected by Storage, Background jobs");
      expect(within(header).getByRole("link", { name: "Storage" })).toHaveAttribute(
        "href",
        "/super-staff/system-health/storage",
      );
      expect(within(header).getByRole("link", { name: "Background jobs" })).toHaveAttribute(
        "href",
        "/super-staff/system-health/jobs",
      );
    });

    it("is affected by Database when it is the app's response time that is bad", async () => {
      vi.mocked(queries.checkReachability).mockResolvedValue({ ...FAST, ms: 900 });
      const header = await renderSection("incidents");

      expect(header).toHaveTextContent("Warning");
      expect(within(header).getByRole("link", { name: "Database" })).toHaveAttribute(
        "href",
        "/super-staff/system-health/database",
      );
    });

    it("says nothing about dependencies when none is at fault, and a component never does", async () => {
      vi.mocked(queries.getSystemHealth).mockResolvedValue(
        withCheck(healthySnapshot(), "storage", "quota", "critical", 97.2),
      );
      expect(await renderSection("lcc")).toHaveTextContent("Affected by Storage");
      cleanup();
      expect(await renderSection("storage")).not.toHaveTextContent("Affected by");
      cleanup();
      vi.mocked(queries.getSystemHealth).mockResolvedValue(healthySnapshot());
      expect(await renderSection("lcc")).not.toHaveTextContent("Affected by");
    });

    describe("last activity", () => {
      beforeEach(() => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-10-31T06:00:00Z"));
      });
      afterEach(() => {
        vi.useRealTimers();
      });

      it("says how long ago the last submission was, and when", async () => {
        const header = await renderSection("yellow-card");

        expect(header).toHaveTextContent("Last activity 20 min ago (Oct 31, 2026, 1:40 PM)");
      });

      it("says so when there has never been one", async () => {
        const health = healthySnapshot();
        health.sections.lcc.last_activity_at = null;
        vi.mocked(queries.getSystemHealth).mockResolvedValue(health);
        const header = await renderSection("lcc");

        expect(header).toHaveTextContent("No activity yet");
      });

      it("is not shown on a Platform page", async () => {
        expect(await renderSection("database")).not.toHaveTextContent("Last activity");
      });
    });

    it("Yellow Card lists its own thresholds", async () => {
      await renderSection("yellow-card");

      expect(thresholds()).toEqual([
        "Faulty items: 1 or more grades the check (critical or warning, per check)",
        "Acknowledgement Receipt: none 5 min after submission (warning), for submissions since Oct 1, 2026",
        "At Risk or Overdue notice: missed by over 30 min (warning)",
        "Abandoned uploads: older than 1 d (not graded)",
      ]);
    });

    it("Incidents lists its own thresholds", async () => {
      await renderSection("incidents");

      expect(thresholds()).toEqual([
        "Faulty items: 1 or more grades the check (critical or warning, per check)",
        "Acknowledgement Receipt: none 5 min after submission (warning), for submissions since Oct 1, 2026",
        "Lifecycle sweep: over 1 d past the closing or confirmation window (warning)",
      ]);
    });

    it("LCC Bookings lists its own thresholds", async () => {
      const health = healthySnapshot();
      health.sections.lcc.detail.receipts_checked_since = null;
      vi.mocked(queries.getSystemHealth).mockResolvedValue(health);
      await renderSection("lcc");

      expect(thresholds()).toEqual([
        "Faulty items: 1 or more grades the check (critical or warning, per check)",
        "Acknowledgement Receipt: none 5 min after submission (warning)",
        "Expired hold: still blocking the hall over 30 min after it expired (critical)",
        "Abandoned uploads: older than 1 d (not graded)",
      ]);
    });

    it("is not served at its database key", async () => {
      await expect(SectionPage({ params: Promise.resolve({ section: "yellow_card" }) })).rejects.toThrow(
        "NEXT_HTTP_ERROR_FALLBACK;404",
      );
    });
  });

  it("shows Page not found for a section that does not exist", async () => {
    await expect(SectionPage({ params: Promise.resolve({ section: "printers" }) })).rejects.toThrow(
      "NEXT_HTTP_ERROR_FALLBACK;404",
    );
  });
});
