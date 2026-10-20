import { listIncidents, readIncidentPii } from "@/portals/admin/features/incidents/lib/incidents";
import { vi } from "vitest";

// vi.mock's first argument is a plain string, not an import specifier, so it
// is not rewritten by the SWC path-alias transform the way `@/...` imports
// elsewhere in this file are. A relative path is required for the mock to be
// registered against the same resolved module that src/portals/admin/features/incidents/lib/incidents.ts
// imports.
const mockRange = vi.fn();
const mockAbortSignal = vi.fn(() => ({ range: mockRange }));
const mockOrder = vi.fn(() => ({ range: mockRange, abortSignal: mockAbortSignal }));
const mockSelect = vi.fn(() => ({ order: mockOrder }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));
const mockRpc = vi.fn();

const mockSupabase = {
  from: mockFrom,
  rpc: mockRpc,
};

vi.mock("../../../../../shared/supabase/client", () => ({
  createClient: () => mockSupabase,
}));

describe("listIncidents", () => {
  beforeEach(() => {
    mockFrom.mockClear();
    mockSelect.mockClear();
    mockOrder.mockClear();
    mockAbortSignal.mockClear();
    mockRange.mockReset();
  });

  it("reads from admin_incident_analytics, selects *, orders by submitted_at descending, and ranges over the first page", async () => {
    mockRange.mockResolvedValue({ data: [], error: null });

    await listIncidents();

    // Assert the exact view name. That view carries no reporter PII by
    // design; reading a base table instead would 403, and reading a
    // different view would leak. This is the guard against someone
    // "optimising" it away.
    expect(mockFrom).toHaveBeenCalledWith("admin_incident_analytics");
    expect(mockSelect).toHaveBeenCalledWith("*");
    expect(mockOrder).toHaveBeenCalledWith("submitted_at", { ascending: false });
    expect(mockRange).toHaveBeenCalledWith(0, 999);
  });

  // Admin Portal Fix Plan, Task 4.2: with no signal given (the common case —
  // every existing call site above passes none), .abortSignal() must not be
  // called at all, matching every fixture above that already asserts the
  // exact call shape with no signal in play.
  it("does not call .abortSignal() when no signal is given", async () => {
    mockRange.mockResolvedValue({ data: [], error: null });

    await listIncidents();

    expect(mockAbortSignal).not.toHaveBeenCalled();
  });

  // When a signal IS given (Dashboard/SLA Reports now pass one — see their
  // fetch effects), it must be attached to the query via .abortSignal()
  // before any page is fetched, so the underlying HTTP request for every
  // page (not just the first) can actually be cancelled by the caller.
  it("attaches a given AbortSignal via .abortSignal() before ranging", async () => {
    mockRange.mockResolvedValue({ data: [], error: null });
    const controller = new AbortController();

    await listIncidents(controller.signal);

    expect(mockAbortSignal).toHaveBeenCalledWith(controller.signal);
    expect(mockRange).toHaveBeenCalledWith(0, 999);
  });

  // fetchAllRows itself checks `signal.aborted` at the top of every page
  // loop (see lib/supabase/pagination.test.ts for the paging-specific coverage)
  // — this pins that listIncidents actually threads the SAME signal object
  // through to fetchAllRows, not just onto the query builder, by proving an
  // already-aborted signal stops the fetch before any page request is even
  // issued.
  it("stops before issuing any request when the given signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(listIncidents(controller.signal)).rejects.toBeTruthy();

    expect(mockRange).not.toHaveBeenCalled();
  });

  it("returns [] when the view returns [] — an empty gate result is not an error", async () => {
    mockRange.mockResolvedValue({ data: [], error: null });

    const result = await listIncidents();

    expect(result).toEqual([]);
  });

  it("returns whatever rows the view provides", async () => {
    const rows = [
      {
        id: "incident-1",
        reference_number: "INC-0001",
        status: "submitted",
        barangay_code: "BGY-1",
        barangay_name: "Barangay One",
        category_code: "CAT-1",
        incident_type_code: "TYPE-1",
        incident_type_label: "Type One",
        incident_level: "low",
        assigned_department_code: null,
        submitted_at: "2026-01-01T00:00:00Z",
        routed_at: null,
        resolved_at: null,
        closed_at: null,
        closure_reason: null,
        reopened_count: 0,
        sla_met: null,
        time_to_triage_hours: null,
      },
    ];
    mockRange.mockResolvedValue({ data: rows, error: null });

    const result = await listIncidents();

    expect(result).toEqual(rows);
  });

  it("throws a PortalError with kind: permission when the client returns { code: '42501' }", async () => {
    mockRange.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "read_incidents: caller is not an active Admin" },
    });

    await expect(listIncidents()).rejects.toMatchObject({ kind: "permission" });
  });
});

describe("readIncidentPii", () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it("calls .rpc('read_incident_pii', { p_incident_id: id }) with exactly that parameter name", async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          address: "123 Street",
          assigned_department_code: "DEPT-1",
          assigned_department_label: "Department One",
          barangay_code: "BGY-1",
          barangay_name: "Barangay One",
          description: "Something happened",
          incident_level: "low",
          incident_type_code: "TYPE-1",
          incident_type_label: "Type One",
          is_anonymous: false,
          reference: "INC-0001",
          reporter_contact_number: "0900000000",
          reporter_email: "reporter@example.com",
          reporter_first_name: "Juan",
          reporter_last_name: "Dela Cruz",
          reporter_middle_name: "Santos",
          status: "submitted",
          submitted_at: "2026-01-01T00:00:00Z",
        },
      ],
      error: null,
    });

    await readIncidentPii("incident-1");

    expect(mockRpc).toHaveBeenCalledWith("read_incident_pii", {
      p_incident_id: "incident-1",
    });
  });

  it("returns null for reporter name, contact number and email together on anonymous reports", async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          address: "123 Street",
          assigned_department_code: "DEPT-1",
          assigned_department_label: "Department One",
          barangay_code: "BGY-1",
          barangay_name: "Barangay One",
          description: "Something happened",
          incident_level: "low",
          incident_type_code: "TYPE-1",
          incident_type_label: "Type One",
          is_anonymous: true,
          reference: "INC-0002",
          reporter_contact_number: null,
          reporter_email: null,
          reporter_first_name: null,
          reporter_last_name: null,
          reporter_middle_name: null,
          status: "submitted",
          submitted_at: "2026-01-01T00:00:00Z",
        },
      ],
      error: null,
    });

    const result = await readIncidentPii("incident-2");

    expect(result.is_anonymous).toBe(true);
    expect(result.reporter_first_name).toBeNull();
    expect(result.reporter_last_name).toBeNull();
    expect(result.reporter_contact_number).toBeNull();
    expect(result.reporter_email).toBeNull();
  });

  it("throws kind: not-found when the client returns { code: 'P0002' }", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: "P0002", message: "read_incident_pii: no incident abc" },
    });

    await expect(readIncidentPii("abc")).rejects.toMatchObject({ kind: "not-found" });
  });
});
