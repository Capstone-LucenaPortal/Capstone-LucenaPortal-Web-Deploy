import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  UnsavedChangesProvider,
  useReportUnsavedChanges,
} from "@/portals/super-staff/components/providers/unsaved-changes-provider";
import * as health from "@/portals/super-staff/features/system-health/lib/queries";
import { FAST, healthySnapshot, withCheck } from "@/portals/super-staff/features/system-health/test/fixture";
import { Sidebar } from "./sidebar";

const { navigate, location } = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: { pathname: "/super-staff/configuration/booking" },
}));

// Under jsdom `next/link` resolves to the Pages-router Link, which never calls
// onNavigate without a router. This stand-in follows App Router's contract:
// call onNavigate, then navigate unless it called preventDefault.
vi.mock("next/link", () => ({
  default: ({
    href,
    onNavigate,
    children,
    ...rest
  }: React.ComponentProps<"a"> & {
    href: string;
    onNavigate?: (e: { preventDefault: () => void }) => void;
  }) => (
    <a
      href={href}
      {...rest}
      onClick={(e) => {
        e.preventDefault();
        let prevented = false;
        onNavigate?.({ preventDefault: () => (prevented = true) });
        if (!prevented) navigate(href);
      }}
    >
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => location.pathname,
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/portals/super-staff/features/inbox/lib/queries", () => ({
  listContactMessages: () => Promise.resolve([]),
}));

vi.mock("@/portals/super-staff/features/system-health/lib/queries");

function DirtyPage({ dirty }: { dirty: boolean }) {
  useReportUnsavedChanges(dirty);
  return null;
}

function renderShell(dirty: boolean) {
  render(
    <UnsavedChangesProvider>
      <Sidebar />
      <DirtyPage dirty={dirty} />
    </UnsavedChangesProvider>,
  );
}

beforeEach(() => {
  vi.mocked(health.getSystemHealth).mockResolvedValue(healthySnapshot());
  vi.mocked(health.checkReachability).mockResolvedValue(FAST);
  navigate.mockReset();
  location.pathname = "/super-staff/configuration/booking";
});

describe("Sidebar", () => {
  it("asks before a nav link leaves a page with unsaved edits", async () => {
    renderShell(true);

    await userEvent.click(screen.getByRole("link", { name: "Accounts" }));

    expect(screen.getByRole("dialog")).toHaveTextContent("Discard unsaved changes?");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("asks before the Configuration link leaves another tab with unsaved edits", async () => {
    renderShell(true);

    await userEvent.click(screen.getByRole("link", { name: "Configuration" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("stays put when the Configuration link would redirect back to this tab", async () => {
    location.pathname = "/super-staff/configuration/incidents";
    renderShell(true);

    await userEvent.click(screen.getByRole("link", { name: "Configuration" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("does not ask when nothing is unsaved", async () => {
    renderShell(false);

    await userEvent.click(screen.getByRole("link", { name: "Accounts" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(navigate).toHaveBeenCalledWith("/super-staff/accounts");
  });
});

// The System Health item's dot: the alert that shows on every Super-staff page.
describe("Sidebar · System Health dot", () => {
  const item = () => screen.getByRole("link", { name: /^System Health/ });

  it("stays one item, whichever System Health page is open", async () => {
    location.pathname = "/super-staff/system-health/database";
    renderShell(false);

    await waitFor(() => expect(health.checkReachability).toHaveBeenCalled());
    expect(screen.getAllByRole("link", { name: /^System Health/ })).toHaveLength(1);
    expect(screen.queryByRole("link", { name: /^Database/ })).not.toBeInTheDocument();
  });

  it("shows no dot when the system is healthy", async () => {
    renderShell(false);

    await waitFor(() => expect(health.checkReachability).toHaveBeenCalled());
    expect(item()).toHaveAccessibleName("System Health");
  });

  it("is amber when the database grades something warning", async () => {
    vi.mocked(health.getSystemHealth).mockResolvedValue({ ...healthySnapshot(), status: "warning" });
    renderShell(false);

    await waitFor(() => expect(item()).toHaveAccessibleName("System Health (Warning)"));
  });

  // The defence demo fault: the hold sweep switched off, one booking's hold expired.
  it("is red when a Citizen service's own check is critical", async () => {
    const snapshot = withCheck(healthySnapshot(), "lcc", "expired_hold", "critical", 1);
    withCheck(snapshot, "jobs", "switched_off", "warning", 1);
    vi.mocked(health.getSystemHealth).mockResolvedValue(snapshot);
    renderShell(false);

    await waitFor(() => expect(item()).toHaveAccessibleName("System Health (Critical)"));
  });

  // The absence of data must never look like health.
  it("is red when the health read fails", async () => {
    vi.mocked(health.getSystemHealth).mockRejectedValue(new Error("timeout"));
    renderShell(false);

    await waitFor(() => expect(item()).toHaveAccessibleName("System Health (Can't read system health)"));
  });

  it("is red when the database is unreachable", async () => {
    vi.mocked(health.checkReachability).mockResolvedValue({ ok: true, db_ok: false, ms: 30 });
    renderShell(false);

    await waitFor(() => expect(item()).toHaveAccessibleName("System Health (Critical)"));
  });

  it("is red when the health check does not answer at all", async () => {
    vi.mocked(health.checkReachability).mockResolvedValue(null);
    renderShell(false);

    await waitFor(() => expect(item()).toHaveAccessibleName("System Health (Critical)"));
  });
});
