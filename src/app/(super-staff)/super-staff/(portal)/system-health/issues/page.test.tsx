import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ToastProvider } from "@/portals/super-staff/components/providers/toast-provider";
import * as queries from "@/portals/super-staff/features/system-health/lib/queries";
import {
  FAST,
  SAMPLES,
  SUMMARY,
  healthySnapshot,
} from "@/portals/super-staff/features/system-health/test/fixture";
import * as issues from "@/portals/super-staff/features/system-issues/lib/system-issue-queries";
import SystemHealthLayout from "../layout";
import SystemIssuesPage from "./page";

// Who may reach the page is the Super Staff portal layout's gate (decideAccess),
// which wraps every route under (portal), and super_system_issues' own
// is_active_staff('super_staff') gate behind it. This tests where it sits.

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => "/super-staff/system-health/issues",
}));

vi.mock("@/portals/super-staff/features/system-health/lib/queries");
vi.mock("@/portals/super-staff/features/system-issues/lib/system-issue-queries");
vi.mock("@/portals/super-staff/features/audit-log/lib/queries");

beforeEach(() => {
  vi.mocked(queries.getSystemHealth).mockResolvedValue(healthySnapshot());
  vi.mocked(queries.checkReachability).mockResolvedValue(FAST);
  vi.mocked(queries.listHealthSamples).mockResolvedValue(SAMPLES);
  vi.mocked(queries.getHealthSummary).mockResolvedValue(SUMMARY);
  vi.mocked(issues.listSystemIssues).mockResolvedValue([]);
});

async function renderPage() {
  render(
    <ToastProvider>
      <SystemHealthLayout>
        <SystemIssuesPage />
      </SystemHealthLayout>
    </ToastProvider>,
  );
  await screen.findByRole("heading", { name: "System issues" });
}

describe("System Health · System issues page", () => {
  it("sits inside the System Health shell", async () => {
    await renderPage();

    expect(screen.getByRole("heading", { name: "System Health", level: 1 })).toBeInTheDocument();
    expect(await screen.findByText("No System issues here.")).toBeInTheDocument();
  });

  it("has its own entry under User reports in the section nav, marked open, with no status", async () => {
    await renderPage();

    const nav = screen.getByRole("navigation", { name: "System Health sections" });
    expect(within(nav).getByText("User reports")).toBeInTheDocument();
    const link = within(nav).getByRole("link", { name: "System issues" });
    expect(link).toHaveAttribute("href", "/super-staff/system-health/issues");
    expect(link).toHaveAttribute("aria-current", "page");
    // Ungraded (ADR 0013): no dot, so no status word for a screen reader.
    expect(link).toHaveAccessibleName("System issues");
    expect(within(nav).getByRole("link", { name: /^General/ })).not.toHaveAttribute("aria-current");
  });
});
