import { listApplications, readApplicationPii, exportApplications } from "@/portals/admin/features/yellow-card/lib/yellow-card";
import { vi } from "vitest";

// vi.mock's first argument is a plain string, not an import specifier, so it
// is not rewritten by the SWC path-alias transform the way `@/...` imports
// elsewhere in this file are. A relative path is required for the mock to be
// registered against the same resolved module that src/portals/admin/features/yellow-card/lib/yellow-card.ts
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

describe("listApplications", () => {
  beforeEach(() => {
    mockFrom.mockClear();
    mockSelect.mockClear();
    mockOrder.mockClear();
    mockAbortSignal.mockClear();
    mockRange.mockReset();
  });

  it("reads from admin_yellow_card_analytics, selects *, orders by submitted_at descending, and ranges over the first page", async () => {
    mockRange.mockResolvedValue({ data: [], error: null });

    await listApplications();

    // Assert the exact view name. That view deliberately carries no applicant
    // PII; reading a base table instead would 403, and reading a different
    // view would leak. This is the guard against someone "optimising" it away.
    expect(mockFrom).toHaveBeenCalledWith("admin_yellow_card_analytics");
    expect(mockSelect).toHaveBeenCalledWith("*");
    expect(mockOrder).toHaveBeenCalledWith("submitted_at", { ascending: false });
    expect(mockRange).toHaveBeenCalledWith(0, 999);
  });

  // Admin Portal Fix Plan, Task 4.2.
  it("does not call .abortSignal() when no signal is given", async () => {
    mockRange.mockResolvedValue({ data: [], error: null });

    await listApplications();

    expect(mockAbortSignal).not.toHaveBeenCalled();
  });

  it("attaches a given AbortSignal via .abortSignal() before ranging", async () => {
    mockRange.mockResolvedValue({ data: [], error: null });
    const controller = new AbortController();

    await listApplications(controller.signal);

    expect(mockAbortSignal).toHaveBeenCalledWith(controller.signal);
    expect(mockRange).toHaveBeenCalledWith(0, 999);
  });

  it("stops before issuing any request when the given signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(listApplications(controller.signal)).rejects.toBeTruthy();

    expect(mockRange).not.toHaveBeenCalled();
  });

  it("returns [] when the view returns [] — an empty gate result is not an error", async () => {
    mockRange.mockResolvedValue({ data: [], error: null });

    const result = await listApplications();

    expect(result).toEqual([]);
  });

  it("returns whatever rows the view provides", async () => {
    const rows = [
      {
        id: "app-1",
        reference_number: "YC-0001",
        status: "pending",
        barangay_code: "BGY-1",
        barangay_name: "Barangay One",
        submitted_at: "2026-01-01T00:00:00Z",
        decided_at: null,
        review_cycles: 0,
        sla_breached: false,
        sla_elapsed_seconds: 0,
        sla_target_hours: 24,
      },
    ];
    mockRange.mockResolvedValue({ data: rows, error: null });

    const result = await listApplications();

    expect(result).toEqual(rows);
  });

  it("throws a PortalError with kind: permission when the client returns { code: '42501' }", async () => {
    mockRange.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "read_yellow_card_applications: caller is not an active Admin" },
    });

    await expect(listApplications()).rejects.toMatchObject({ kind: "permission" });
  });
});

describe("readApplicationPii", () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it("calls .rpc('read_yellow_card_application_pii', { p_application_id: id }) with exactly that parameter name", async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          barangay_code: "BGY-1",
          barangay_name: "Barangay One",
          civil_status_code: "single",
          complete_address: "123 Street",
          contact_number: "0900000000",
          date_of_birth: "1990-01-01",
          email_address: "applicant@example.com",
          first_name: "Juan",
          gender_code: "male",
          last_name: "Dela Cruz",
          middle_name: "Santos",
          reference: "YC-0001",
          status: "pending",
          submitted_at: "2026-01-01T00:00:00Z",
          suffix: "",
          voter_id_number: "1234-5678",
          years_of_residency: 5,
        },
      ],
      error: null,
    });

    await readApplicationPii("app-1");

    expect(mockRpc).toHaveBeenCalledWith("read_yellow_card_application_pii", {
      p_application_id: "app-1",
    });
  });

  it("throws kind: not-found when the client returns { code: 'P0002' }", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: "P0002", message: "read_yellow_card_application_pii: no application abc" },
    });

    await expect(readApplicationPii("abc")).rejects.toMatchObject({ kind: "not-found" });
  });
});

describe("exportApplications", () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it("calls .rpc('export_yellow_card_applications', { p_status, p_from, p_to }) and passes null for omitted filters", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    await exportApplications({ status: "approved" });

    // Omitted keys must be explicit null, never omitted or undefined — the
    // RPC's parameters default to null and PostgREST matches on argument
    // name, so an omitted key and a null are not equivalent for overload
    // resolution.
    expect(mockRpc).toHaveBeenCalledWith("export_yellow_card_applications", {
      p_status: "approved",
      p_from: null,
      p_to: null,
    });
  });

  it("passes null for all three filters when no filter is given at all", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    await exportApplications();

    expect(mockRpc).toHaveBeenCalledWith("export_yellow_card_applications", {
      p_status: null,
      p_from: null,
      p_to: null,
    });
  });

  it("passes every provided filter value through", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    await exportApplications({ status: "approved", from: "2026-01-01", to: "2026-01-31" });

    expect(mockRpc).toHaveBeenCalledWith("export_yellow_card_applications", {
      p_status: "approved",
      p_from: "2026-01-01",
      p_to: "2026-01-31",
    });
  });

  it("throws a PortalError on RPC failure", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "export_yellow_card_applications: caller is not an active Admin" },
    });

    await expect(exportApplications({})).rejects.toMatchObject({ kind: "permission" });
  });
});
