import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import * as queries from "@/portals/super-staff/features/system-health/lib/queries";
import {
  FAST,
  SAMPLES,
  SUMMARY,
  healthySnapshot,
  withCheck,
} from "@/portals/super-staff/features/system-health/test/fixture";
import SystemHealthLayout from "./layout";
import GeneralPage from "./page";

vi.mock("next/navigation", () => ({
  usePathname: () => "/super-staff/system-health",
}));

vi.mock("@/portals/super-staff/features/system-health/lib/queries");

vi.mock("@/portals/super-staff/features/monitoring/lib/queries", () => ({
  getMetrics: () =>
    Promise.resolve({
      slaCompliancePct: 88,
      slaCompliancePctPrev: 85,
      atRiskNow: 2,
      atRiskPrev: null,
      openBacklog: 9,
      openBacklogPrev: 11,
      bookings7d: 4,
      bookings7dPrev: 3,
    }),
}));

beforeEach(() => {
  vi.mocked(queries.getSystemHealth).mockResolvedValue(healthySnapshot());
  vi.mocked(queries.checkReachability).mockResolvedValue(FAST);
  vi.mocked(queries.listHealthSamples).mockResolvedValue(SAMPLES);
  vi.mocked(queries.getHealthSummary).mockResolvedValue(SUMMARY);
});

function renderGeneral() {
  render(
    <SystemHealthLayout>
      <GeneralPage />
    </SystemHealthLayout>,
  );
}

describe("System Health · General", () => {
  it("shows a Platform row with one tile per section, each leading to its page", async () => {
    renderGeneral();

    const row = await screen.findByRole("region", { name: "Platform" });
    const tiles = within(row).getAllByRole("link");
    expect(tiles.map((t) => t.getAttribute("href"))).toEqual([
      "/super-staff/system-health/database",
      "/super-staff/system-health/storage",
      "/super-staff/system-health/notifications",
      "/super-staff/system-health/jobs",
      "/super-staff/system-health/accounts",
    ]);
    expect(within(row).getByRole("link", { name: /^Database/ })).toBeInTheDocument();
    expect(within(row).getByRole("link", { name: /^Accounts & sign-in/ })).toBeInTheDocument();
  });

  it("reads all working when every section is ok, with the 7-day healthy share", async () => {
    renderGeneral();

    expect(await screen.findByRole("heading", { name: "All systems working" })).toBeInTheDocument();
    expect(screen.getByText("System healthy 93.3% of samples (last 7 days)")).toBeInTheDocument();
  });

  it("shows a Citizen services row before Platform, one tile per service, each leading to its page", async () => {
    renderGeneral();

    const row = await screen.findByRole("region", { name: "Citizen services" });
    expect(within(row).getAllByRole("link").map((t) => t.getAttribute("href"))).toEqual([
      "/super-staff/system-health/yellow-card",
      "/super-staff/system-health/incidents",
      "/super-staff/system-health/lcc",
    ]);
    const platform = screen.getByRole("region", { name: "Platform" });
    expect(row.compareDocumentPosition(platform) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  describe("banner", () => {
    /** The banner's lines: one per root cause. */
    async function bannerLines(): Promise<string[]> {
      const banner = await screen.findByRole("status");
      return within(banner)
        .queryAllByRole("listitem")
        .map((li) => li.textContent ?? "");
    }

    it("names a component's fault once, with the services it affects, and not each service again", async () => {
      vi.mocked(queries.getSystemHealth).mockResolvedValue(
        withCheck(healthySnapshot(), "storage", "quota", "critical", 97.2),
      );
      renderGeneral();

      expect(await screen.findByRole("status")).toHaveTextContent("Something needs attention now");
      expect(await bannerLines()).toEqual([
        "Storage: Critical · Storage used (% of the 1 GiB quota): 97.2 · affects Yellow Card, Incidents, LCC Bookings",
      ]);
    });

    it("names a component only the services that depend on it", async () => {
      vi.mocked(queries.getSystemHealth).mockResolvedValue(
        withCheck(healthySnapshot(), "accounts", "single_super_staff", "warning", 1),
      );
      renderGeneral();

      expect(await bannerLines()).toEqual([
        "Accounts & sign-in: Warning · Active Super-staff accounts that have signed in: 1 · affects Incidents",
      ]);
    });

    it("lists the components critical first, then the services whose own checks fail", async () => {
      // The demo fault: the hold sweep switched off, one booking's hold expired 31 minutes ago.
      const health = withCheck(healthySnapshot(), "lcc", "expired_hold", "critical", 1);
      health.sections.lcc.checks[0].oldest_seconds = 31 * 60;
      withCheck(health, "jobs", "switched_off", "warning", 1);
      withCheck(health, "storage", "missing_objects", "critical", 2);
      vi.mocked(queries.getSystemHealth).mockResolvedValue(health);
      renderGeneral();

      expect(await bannerLines()).toEqual([
        "Storage: Critical · Missing files: a confirmed upload whose file is gone: 2 · affects Yellow Card, Incidents, LCC Bookings",
        "Background jobs: Warning · A system job is switched off: 1 · affects Yellow Card, Incidents, LCC Bookings",
        "LCC Bookings: Critical · Expired holds still blocking the hall after 30 minutes: 1 · oldest 31 min",
      ]);
    });

    it("names a failing service alone when no component is at fault", async () => {
      vi.mocked(queries.getSystemHealth).mockResolvedValue(
        withCheck(healthySnapshot(), "yellow_card", "no_receipt", "warning", 3),
      );
      renderGeneral();

      expect(await screen.findByRole("status")).toHaveTextContent("Something needs a look");
      expect(await bannerLines()).toEqual([
        "Yellow Card: Warning · No Acknowledgement Receipt 5 minutes after submission: 3",
      ]);
    });

    it("names Database, with every service, when it is the app's response time that is bad", async () => {
      vi.mocked(queries.checkReachability).mockResolvedValue({ ...FAST, ms: 2500 });
      renderGeneral();

      expect(await screen.findByRole("status")).toHaveTextContent("Something needs attention now");
      expect(await bannerLines()).toEqual([
        "Database: Critical · Response time 2.5 s · affects Yellow Card, Incidents, LCC Bookings",
      ]);
      const row = await screen.findByRole("region", { name: "Platform" });
      expect(within(row).getByRole("link", { name: /^Database Critical/ })).toBeInTheDocument();
      expect(within(row).getByRole("link", { name: /^Storage OK/ })).toBeInTheDocument();
    });
  });

  describe("Citizen service tiles", () => {
    async function tile(label: string): Promise<HTMLElement> {
      const row = await screen.findByRole("region", { name: "Citizen services" });
      return within(row).getByRole("link", { name: new RegExp(`^${label}`) });
    }

    it("reads all checks OK when nothing is wrong", async () => {
      renderGeneral();

      expect(await tile("Yellow Card")).toHaveAccessibleName("Yellow Card OK. All checks OK");
    });

    it("shows its worst own check", async () => {
      const health = withCheck(healthySnapshot(), "incidents", "pool_alerts_unreachable", "warning", 2);
      withCheck(health, "incidents", "pool_no_responders", "critical", 4);
      vi.mocked(queries.getSystemHealth).mockResolvedValue(health);
      renderGeneral();

      expect(await tile("Incidents")).toHaveAccessibleName(
        "Incidents Critical. In a pool whose department has no active responder: 4",
      );
    });

    it("takes a dependency's grade and says what it is affected by, worst first", async () => {
      const health = withCheck(healthySnapshot(), "jobs", "overdue", "warning", 1);
      withCheck(health, "storage", "quota", "critical", 97.2);
      vi.mocked(queries.getSystemHealth).mockResolvedValue(health);
      renderGeneral();

      expect(await tile("LCC Bookings")).toHaveAccessibleName(
        "LCC Bookings Critical. All checks OK Affected by Storage, Background jobs",
      );
    });

    it("is affected by Database when it is the app's response time that is bad", async () => {
      vi.mocked(queries.checkReachability).mockResolvedValue({ ...FAST, ms: 900 });
      renderGeneral();

      expect(await tile("Incidents")).toHaveAccessibleName("Incidents Warning. All checks OK Affected by Database");
    });

    it("puts Database first when the app's grade makes it the worse dependency", async () => {
      vi.mocked(queries.getSystemHealth).mockResolvedValue(
        withCheck(healthySnapshot(), "storage", "missing_objects", "warning", 1),
      );
      vi.mocked(queries.checkReachability).mockResolvedValue({ ...FAST, ms: 2500 });
      renderGeneral();

      expect(await tile("Yellow Card")).toHaveAccessibleName(
        "Yellow Card Critical. All checks OK Affected by Database, Storage",
      );
    });
  });

  describe("Platform tiles", () => {
    /** A tile's text after its label: the status (for a screen reader), then the line under it. */
    async function tile(label: string): Promise<HTMLElement> {
      const row = await screen.findByRole("region", { name: "Platform" });
      return within(row).getByRole("link", { name: new RegExp(`^${label}`) });
    }

    it("reads all checks OK when nothing is wrong, with the round trip on Database", async () => {
      renderGeneral();

      expect(await tile("Storage")).toHaveTextContent("All checks OK");
      expect(await tile("Database")).toHaveTextContent("All checks OK · 120 ms round trip");
    });

    it("shows the section's worst check, with its count and oldest age", async () => {
      const health = withCheck(healthySnapshot(), "notifications", "push_queue", "warning", 9);
      health.sections.notifications.checks.find((c) => c.key === "push_queue")!.oldest_seconds = 1200;
      vi.mocked(queries.getSystemHealth).mockResolvedValue(health);
      renderGeneral();

      expect(await tile("Notifications")).toHaveAccessibleName(
        "Notifications Warning. Oldest queued push: 9 · oldest 20 min",
      );
    });

    it("picks the critical check over a warning one", async () => {
      const health = withCheck(healthySnapshot(), "jobs", "overdue", "warning", 1);
      withCheck(health, "jobs", "failed", "critical", 2);
      vi.mocked(queries.getSystemHealth).mockResolvedValue(health);
      renderGeneral();

      expect(await tile("Background jobs")).toHaveAccessibleName(
        "Background jobs Critical. Last run failed: 2",
      );
    });

    it("shows the response time when it is the app's grade that makes Database bad", async () => {
      vi.mocked(queries.checkReachability).mockResolvedValue({ ...FAST, ms: 2500 });
      renderGeneral();

      expect(await tile("Database")).toHaveAccessibleName("Database Critical. Response time 2.5 s");
    });

    it("says so when the health check did not answer", async () => {
      vi.mocked(queries.checkReachability).mockResolvedValue(null);
      renderGeneral();

      expect(await tile("Database")).toHaveAccessibleName("Database Critical. Health check did not answer");
    });
  });

  it("leads with a second-level nav, General, the Citizen services, then Platform, each with its status", async () => {
    vi.mocked(queries.checkReachability).mockResolvedValue({ ...FAST, ms: 900 });
    renderGeneral();

    const nav = screen.getByRole("navigation", { name: "System Health sections" });
    await screen.findByRole("region", { name: "Platform" });
    expect(within(nav).getByText("Citizen services")).toBeInTheDocument();
    expect(within(nav).getAllByRole("link").map((l) => l.textContent)).toEqual([
      "General (Warning)",
      "Yellow Card (Warning)",
      "Incidents (Warning)",
      "LCC Bookings (Warning)",
      "Database (Warning)",
      "Storage (OK)",
      "Notifications (OK)",
      "Background jobs (OK)",
      "Accounts & sign-in (OK)",
    ]);
    expect(within(nav).getByRole("link", { name: /^General/ })).toHaveAttribute("aria-current", "page");
  });

  it("leaves the thresholds and the sign-ins to their section pages", async () => {
    renderGeneral();

    await screen.findByRole("region", { name: "Platform" });
    expect(screen.queryByRole("region", { name: "Thresholds" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /sign-ins/i })).not.toBeInTheDocument();
  });

  it("keeps Admin's Service impact, last", async () => {
    renderGeneral();

    expect(await screen.findByText("88%")).toBeInTheDocument();
    const regions = screen.getAllByRole("region");
    expect(regions.at(-1)).toHaveAccessibleName("Service impact");
  });
});
