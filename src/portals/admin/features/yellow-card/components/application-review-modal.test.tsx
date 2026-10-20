// src/portals/admin/features/yellow-card/components/application-review-modal.test.tsx
import { StrictMode } from "react";
import { act, render, screen } from "@testing-library/react";
import { ApplicationReviewModal } from "@/portals/admin/features/yellow-card/components/application-review-modal";
import type { YellowCardPii } from "@/portals/admin/features/yellow-card/lib/yellow-card";
import { vi } from "vitest";

// vi.mock's first argument is a plain string, not an import specifier, so it
// is not rewritten by the SWC path-alias transform the way `@/...` imports
// elsewhere in this file are. A relative path is required for the mock to be
// registered against the same resolved module that
// src/portals/admin/features/yellow-card/components/application-review-modal.tsx imports.
const mockReadApplicationPii = vi.fn();

vi.mock("../lib/yellow-card", () => ({
  readApplicationPii: (id: string) => mockReadApplicationPii(id),
}));

function buildPii(overrides: Partial<YellowCardPii> = {}): YellowCardPii {
  return {
    reference: "YC-2026-000001",
    first_name: "Juan",
    middle_name: "Santos",
    last_name: "Dela Cruz",
    suffix: "",
    date_of_birth: "1990-01-01",
    gender_code: "male",
    civil_status_code: "single",
    barangay_code: "BGY-1",
    barangay_name: "Barangay One",
    complete_address: "123 Rizal St., Barangay One",
    contact_number: "0917-123-4567",
    email_address: "juan.delacruz@example.com",
    years_of_residency: 10,
    voter_id_number: "1234-5678-9012",
    status: "pending",
    submitted_at: "2026-05-01T00:00:00Z",
    ...overrides,
  };
}

describe("ApplicationReviewModal", () => {
  beforeEach(() => {
    mockReadApplicationPii.mockReset();
  });

  it("does not call readApplicationPii when closed", () => {
    render(<ApplicationReviewModal applicationId={null} onClose={() => {}} />);
    expect(mockReadApplicationPii).not.toHaveBeenCalled();
  });

  it("calls readApplicationPii exactly once with the application id when opened", async () => {
    mockReadApplicationPii.mockResolvedValue(buildPii());

    render(<ApplicationReviewModal applicationId="app-1" onClose={() => {}} />);

    await screen.findByText("juan.delacruz@example.com");
    expect(mockReadApplicationPii).toHaveBeenCalledTimes(1);
    expect(mockReadApplicationPii).toHaveBeenCalledWith("app-1");
  });

  it("does not re-fire the fetch on re-render with the same application id", async () => {
    mockReadApplicationPii.mockResolvedValue(buildPii());

    const { rerender } = render(
      <ApplicationReviewModal applicationId="app-1" onClose={() => {}} />
    );
    await screen.findByText("juan.delacruz@example.com");

    // A parent re-render (e.g. an unrelated state change) must not re-fire
    // the audited fetch — every call writes a pii_access audit row.
    rerender(<ApplicationReviewModal applicationId="app-1" onClose={() => {}} />);
    rerender(<ApplicationReviewModal applicationId="app-1" onClose={() => {}} />);

    expect(mockReadApplicationPii).toHaveBeenCalledTimes(1);
  });

  // Regression guard for the Strict Mode double-invoke trap: if the modal is
  // ever mounted already-open (applicationId non-null on the very first
  // render — a common alternative to the current "mount once, toggle a
  // null/id prop" pattern), dev-only Strict Mode fires the effect, its
  // cleanup, then the effect again, all before the first fetch's promise
  // settles. Marking "fetched" at fetch-start (before the promise resolves)
  // makes the second invocation skip starting its own fetch while the first
  // invocation's result gets discarded by its own cleanup — nothing ever
  // resolves. Erasing the mark on an unsettled teardown instead fixes the
  // hang but, on its own, makes the second invocation start a genuinely new
  // network call — two real calls, two pii_access audit rows, for one open.
  // Both invocations must resolve, but exactly one real call may happen: the
  // second invocation has to *reuse* the first's in-flight promise, not
  // start (or skip) its own.
  it("resolves after a fresh already-open mount under Strict Mode, with exactly one real call", async () => {
    mockReadApplicationPii.mockResolvedValue(buildPii());

    render(
      <StrictMode>
        <ApplicationReviewModal applicationId="app-1" onClose={() => {}} />
      </StrictMode>
    );

    expect(await screen.findByText("juan.delacruz@example.com")).toBeInTheDocument();
    expect(mockReadApplicationPii).toHaveBeenCalledTimes(1);
  });

  // Pre-existing coverage gap flagged in review: nothing pinned that changing
  // applicationId actually fetches the new record, nor that a stale,
  // still-in-flight fetch for the OLD id can't clobber the new one if it
  // happens to settle after the switch.
  it("switching applicationId fetches the new record, and a late-resolving stale fetch does not overwrite it", async () => {
    let resolveStale!: (value: YellowCardPii) => void;
    let resolveFresh!: (value: YellowCardPii) => void;
    const stalePromise = new Promise<YellowCardPii>((resolve) => {
      resolveStale = resolve;
    });
    const freshPromise = new Promise<YellowCardPii>((resolve) => {
      resolveFresh = resolve;
    });

    mockReadApplicationPii.mockImplementation((id: string) =>
      id === "app-1" ? stalePromise : freshPromise
    );

    const { rerender } = render(
      <ApplicationReviewModal applicationId="app-1" onClose={() => {}} />
    );
    // Switch to a different application before app-1's fetch has settled.
    rerender(<ApplicationReviewModal applicationId="app-2" onClose={() => {}} />);

    expect(mockReadApplicationPii).toHaveBeenCalledWith("app-1");
    expect(mockReadApplicationPii).toHaveBeenCalledWith("app-2");

    // Resolve the abandoned app-1 fetch AFTER the switch — this is the
    // ordering that would clobber the new record if the guard were keyed on
    // "settled" alone rather than on each attempt's own active flag.
    await act(async () => {
      resolveStale(buildPii({ email_address: "stale@example.com" }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => {
      resolveFresh(buildPii({ email_address: "fresh@example.com" }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(await screen.findByText("fresh@example.com")).toBeInTheDocument();
    expect(screen.queryByText("stale@example.com")).not.toBeInTheDocument();
  });

  it("renders a loading state while the fetch is pending", () => {
    mockReadApplicationPii.mockReturnValue(new Promise(() => {}));

    render(<ApplicationReviewModal applicationId="app-1" onClose={() => {}} />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("renders name, contact number, email, address and voter ID once resolved", async () => {
    mockReadApplicationPii.mockResolvedValue(buildPii());

    render(<ApplicationReviewModal applicationId="app-1" onClose={() => {}} />);

    expect(await screen.findByText(/Juan.*Dela Cruz/)).toBeInTheDocument();
    expect(screen.getByText("0917-123-4567")).toBeInTheDocument();
    expect(screen.getByText("juan.delacruz@example.com")).toBeInTheDocument();
    expect(screen.getByText("123 Rizal St., Barangay One")).toBeInTheDocument();
    expect(screen.getByText("1234-5678-9012")).toBeInTheDocument();
  });

  it("renders a permission message on kind: permission", async () => {
    mockReadApplicationPii.mockRejectedValue({
      kind: "permission",
      message: "caller is not an active Admin",
    });

    render(<ApplicationReviewModal applicationId="app-1" onClose={() => {}} />);

    expect(await screen.findByText(/permission/i)).toBeInTheDocument();
  });

  it("renders a not-found message on kind: not-found", async () => {
    mockReadApplicationPii.mockRejectedValue({
      kind: "not-found",
      message: "Application not found.",
    });

    render(<ApplicationReviewModal applicationId="app-1" onClose={() => {}} />);

    expect(await screen.findByText(/not.*found/i)).toBeInTheDocument();
  });

  it("shows a note that viewing these details is recorded", async () => {
    mockReadApplicationPii.mockResolvedValue(buildPii());

    render(<ApplicationReviewModal applicationId="app-1" onClose={() => {}} />);

    expect(screen.getByText(/recorded/i)).toBeInTheDocument();
    // Let the pending fetch settle within this test's act() boundary rather
    // than leaking a state update into a later test.
    await screen.findByText("juan.delacruz@example.com");
  });
});
