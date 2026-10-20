// src/portals/admin/features/incidents/components/issue-report-review-modal.test.tsx
import { StrictMode } from "react";
import { act, render, screen } from "@testing-library/react";
import { IssueReportReviewModal } from "@/portals/admin/features/incidents/components/issue-report-review-modal";
import type { IncidentPii } from "@/portals/admin/features/incidents/lib/incidents";
import { vi } from "vitest";

// vi.mock's first argument is a plain string, not an import specifier, so it
// is not rewritten by the SWC path-alias transform the way `@/...` imports
// elsewhere in this file are. A relative path is required for the mock to be
// registered against the same resolved module that
// src/portals/admin/features/incidents/components/issue-report-review-modal.tsx imports.
const mockReadIncidentPii = vi.fn();

vi.mock("../lib/incidents", () => ({
  readIncidentPii: (id: string) => mockReadIncidentPii(id),
}));

function buildPii(overrides: Partial<IncidentPii> = {}): IncidentPii {
  return {
    reference: "INC-2026-000001",
    description: "Fallen tree blocking the road",
    address: "123 Rizal St., Barangay One",
    barangay_code: "BGY-1",
    barangay_name: "Barangay One",
    incident_type_code: "infra",
    incident_type_label: "Infrastructure",
    incident_level: "high",
    assigned_department_code: "DEPT-1",
    assigned_department_label: "Engineering",
    status: "open",
    submitted_at: "2026-05-01T00:00:00Z",
    is_anonymous: false,
    reporter_first_name: "Juan",
    reporter_middle_name: "Santos",
    reporter_last_name: "Dela Cruz",
    reporter_contact_number: "0917-123-4567",
    reporter_email: "juan.delacruz@example.com",
    ...overrides,
  };
}

describe("IssueReportReviewModal", () => {
  beforeEach(() => {
    mockReadIncidentPii.mockReset();
  });

  it("does not call readIncidentPii when closed", () => {
    render(<IssueReportReviewModal incidentId={null} onClose={() => {}} />);
    expect(mockReadIncidentPii).not.toHaveBeenCalled();
  });

  it("calls readIncidentPii exactly once with the incident id when opened", async () => {
    mockReadIncidentPii.mockResolvedValue(buildPii());

    render(<IssueReportReviewModal incidentId="inc-1" onClose={() => {}} />);

    await screen.findByText("juan.delacruz@example.com");
    expect(mockReadIncidentPii).toHaveBeenCalledTimes(1);
    expect(mockReadIncidentPii).toHaveBeenCalledWith("inc-1");
  });

  it("does not re-fire the fetch on re-render with the same incident id", async () => {
    mockReadIncidentPii.mockResolvedValue(buildPii());

    const { rerender } = render(
      <IssueReportReviewModal incidentId="inc-1" onClose={() => {}} />
    );
    await screen.findByText("juan.delacruz@example.com");

    // A parent re-render (e.g. an unrelated state change) must not re-fire
    // the audited fetch — every call writes a pii_access audit row.
    rerender(<IssueReportReviewModal incidentId="inc-1" onClose={() => {}} />);
    rerender(<IssueReportReviewModal incidentId="inc-1" onClose={() => {}} />);

    expect(mockReadIncidentPii).toHaveBeenCalledTimes(1);
  });

  // Regression guard for the Strict Mode double-invoke trap: if the modal is
  // ever mounted already-open (incidentId non-null on the very first render —
  // a common alternative to the current "mount once, toggle a null/id prop"
  // pattern), dev-only Strict Mode fires the effect, its cleanup, then the
  // effect again, all before the first fetch's promise settles. Marking
  // "fetched" at fetch-start (before the promise resolves) makes the second
  // invocation skip starting its own fetch while the first invocation's
  // result gets discarded by its own cleanup — nothing ever resolves. Erasing
  // the mark on an unsettled teardown instead fixes the hang but, on its own,
  // makes the second invocation start a genuinely new network call — two real
  // calls, two pii_access audit rows, for one open. Both invocations must
  // resolve, but exactly one real call may happen: the second invocation has
  // to *reuse* the first's in-flight promise, not start (or skip) its own.
  it("resolves after a fresh already-open mount under Strict Mode, with exactly one real call", async () => {
    mockReadIncidentPii.mockResolvedValue(buildPii());

    render(
      <StrictMode>
        <IssueReportReviewModal incidentId="inc-1" onClose={() => {}} />
      </StrictMode>
    );

    expect(await screen.findByText("juan.delacruz@example.com")).toBeInTheDocument();
    expect(mockReadIncidentPii).toHaveBeenCalledTimes(1);
  });

  it("switching incidentId fetches the new record, and a late-resolving stale fetch does not overwrite it", async () => {
    let resolveStale!: (value: IncidentPii) => void;
    let resolveFresh!: (value: IncidentPii) => void;
    const stalePromise = new Promise<IncidentPii>((resolve) => {
      resolveStale = resolve;
    });
    const freshPromise = new Promise<IncidentPii>((resolve) => {
      resolveFresh = resolve;
    });

    mockReadIncidentPii.mockImplementation((id: string) =>
      id === "inc-1" ? stalePromise : freshPromise
    );

    const { rerender } = render(
      <IssueReportReviewModal incidentId="inc-1" onClose={() => {}} />
    );
    // Switch to a different incident before inc-1's fetch has settled.
    rerender(<IssueReportReviewModal incidentId="inc-2" onClose={() => {}} />);

    expect(mockReadIncidentPii).toHaveBeenCalledWith("inc-1");
    expect(mockReadIncidentPii).toHaveBeenCalledWith("inc-2");

    // Resolve the abandoned inc-1 fetch AFTER the switch — this is the
    // ordering that would clobber the new record if the guard were keyed on
    // "settled" alone rather than on each attempt's own active flag.
    await act(async () => {
      resolveStale(buildPii({ reporter_email: "stale@example.com" }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => {
      resolveFresh(buildPii({ reporter_email: "fresh@example.com" }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(await screen.findByText("fresh@example.com")).toBeInTheDocument();
    expect(screen.queryByText("stale@example.com")).not.toBeInTheDocument();
  });

  it("renders a loading state while the fetch is pending", () => {
    mockReadIncidentPii.mockReturnValue(new Promise(() => {}));

    render(<IssueReportReviewModal incidentId="inc-1" onClose={() => {}} />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("renders reporter name, contact and email for a named report, plus incident detail", async () => {
    mockReadIncidentPii.mockResolvedValue(buildPii());

    render(<IssueReportReviewModal incidentId="inc-1" onClose={() => {}} />);

    expect(await screen.findByText(/Juan.*Dela Cruz/)).toBeInTheDocument();
    expect(screen.getByText("0917-123-4567")).toBeInTheDocument();
    expect(screen.getByText("juan.delacruz@example.com")).toBeInTheDocument();
    expect(screen.getByText("Fallen tree blocking the road")).toBeInTheDocument();
    expect(screen.getByText("123 Rizal St., Barangay One")).toBeInTheDocument();
  });

  it('renders "Anonymous" and no contact details when is_anonymous is true, while still rendering description and address', async () => {
    mockReadIncidentPii.mockResolvedValue(
      buildPii({
        is_anonymous: true,
        reporter_first_name: null as unknown as string,
        reporter_middle_name: null as unknown as string,
        reporter_last_name: null as unknown as string,
        reporter_contact_number: null as unknown as string,
        reporter_email: null as unknown as string,
      })
    );

    render(<IssueReportReviewModal incidentId="inc-1" onClose={() => {}} />);

    expect(await screen.findByText("Anonymous")).toBeInTheDocument();
    expect(screen.getByText("Fallen tree blocking the road")).toBeInTheDocument();
    expect(screen.getByText("123 Rizal St., Barangay One")).toBeInTheDocument();
    expect(screen.queryByText("0917-123-4567")).not.toBeInTheDocument();
    expect(screen.queryByText("juan.delacruz@example.com")).not.toBeInTheDocument();
    expect(screen.queryByText("Contact Number")).not.toBeInTheDocument();
    expect(screen.queryByText("Email")).not.toBeInTheDocument();
  });

  it("renders a permission message on kind: permission", async () => {
    mockReadIncidentPii.mockRejectedValue({
      kind: "permission",
      message: "caller is not an active Admin",
    });

    render(<IssueReportReviewModal incidentId="inc-1" onClose={() => {}} />);

    expect(await screen.findByText(/permission/i)).toBeInTheDocument();
  });

  it("renders a not-found message on kind: not-found", async () => {
    mockReadIncidentPii.mockRejectedValue({
      kind: "not-found",
      message: "Incident not found.",
    });

    render(<IssueReportReviewModal incidentId="inc-1" onClose={() => {}} />);

    expect(await screen.findByText(/not.*found/i)).toBeInTheDocument();
  });

  it("shows a note that viewing these details is recorded", async () => {
    mockReadIncidentPii.mockResolvedValue(buildPii());

    render(<IssueReportReviewModal incidentId="inc-1" onClose={() => {}} />);

    expect(screen.getByText(/recorded/i)).toBeInTheDocument();
    // Let the pending fetch settle within this test's act() boundary rather
    // than leaking a state update into a later test.
    await screen.findByText("juan.delacruz@example.com");
  });

  // Admin Portal Fix Plan, final review, Fix 2: this modal used to render
  // data.status/data.incident_level RAW, so it disagreed with the "Awaiting
  // Triage" friendly label the table's own Status column already shows for
  // this same row (Task 5.1). IncidentPii types status/incident_level as
  // plain `string`, so this must go through the fallback lookups in
  // src/portals/admin/lib/status-labels.ts (incidentStatusLabel/incidentLevelLabel), not a
  // direct enum-keyed Record index.
  it("renders the friendly status and level labels, not the raw enum codes", async () => {
    mockReadIncidentPii.mockResolvedValue(buildPii({ status: "open", incident_level: "high" }));

    render(<IssueReportReviewModal incidentId="inc-1" onClose={() => {}} />);

    expect(await screen.findByText("Awaiting Triage")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.queryByText("open")).not.toBeInTheDocument();
  });

  // A code the label map doesn't recognise must still render — as itself —
  // rather than crash the modal (the fallback ?? code in incidentStatusLabel/
  // incidentLevelLabel).
  it("falls back to the raw code for a status/level the label maps don't recognise", async () => {
    mockReadIncidentPii.mockResolvedValue(
      buildPii({ status: "made_up_status", incident_level: "made_up_level" })
    );

    render(<IssueReportReviewModal incidentId="inc-1" onClose={() => {}} />);

    expect(await screen.findByText("made_up_status")).toBeInTheDocument();
    expect(screen.getByText("made_up_level")).toBeInTheDocument();
  });
});
