import { listApplications, readApplicationPii, exportApplications } from "@/portals/admin/features/yellow-card/lib/yellow-card";
import { vi } from "vitest";

// vi.mock's first argument is a plain string, not an import specifier, so it
// is not rewritten by the SWC path-alias transform the way `@/...` imports
// elsewhere in this file are. A relative path is required for the mock to be
// registered against the same resolved module that src/portals/admin/features/yellow-card/lib/yellow-card.ts
// imports.

// One chainable builder stands in for both requests listViewNewestFirst
// sends: the newest-row read, which is awaited, and the paged read, which
// fetchAllRows drives through .range(). Every chain method returns the builder.
const NEWEST = "2026-01-01T00:00:00.000649+00:00";
let newestResponse: { data: { submitted_at: string | null }[] | null; error: unknown };
const mockRange = vi.fn();
const builder = {
  select: vi.fn(() => builder),
  order: vi.fn(() => builder),
  limit: vi.fn(() => builder),
  lte: vi.fn(() => builder),
  abortSignal: vi.fn(() => builder),
  range: mockRange,
  then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve(newestResponse).then(resolve, reject),
};
const mockFrom = vi.fn(() => builder);
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
    for (const method of [builder.select, builder.order, builder.limit, builder.lte, builder.abortSignal]) {
      method.mockClear();
    }
    mockRange.mockReset();
    newestResponse = { data: [{ submitted_at: NEWEST }], error: null };
  });

  it("reads admin_yellow_card_analytics: its newest submitted_at, then every row (select *) up to it, newest first by submitted_at then id", async () => {
    mockRange.mockResolvedValue({ data: [], error: null });

    await listApplications();

    // Assert the exact view name. That view deliberately carries no applicant
    // PII; reading a base table instead would 403, and reading a different
    // view would leak. This is the guard against someone "optimising" it away.
    expect(mockFrom.mock.calls).toEqual([["admin_yellow_card_analytics"], ["admin_yellow_card_analytics"]]);
    expect(builder.select.mock.calls).toEqual([["submitted_at"], ["*"]]);
    expect(builder.limit).toHaveBeenCalledWith(1);
    expect(builder.lte).toHaveBeenCalledWith("submitted_at", NEWEST);
    expect(builder.order.mock.calls).toEqual([
      ["submitted_at", { ascending: false }],
      ["submitted_at", { ascending: false }],
      ["id", { ascending: false }],
    ]);
    expect(mockRange).toHaveBeenCalledWith(0, 999);
  });

  // Admin Portal Fix Plan, Task 4.2.
  it("does not call .abortSignal() when no signal is given", async () => {
    mockRange.mockResolvedValue({ data: [], error: null });

    await listApplications();

    expect(builder.abortSignal).not.toHaveBeenCalled();
  });

  // Both requests carry the signal, so a cancelled load cancels whichever one
  // is in flight; fetchAllRows gets it too, so no further page is asked for.
  it("attaches a given AbortSignal to both requests via .abortSignal()", async () => {
    mockRange.mockResolvedValue({ data: [], error: null });
    const controller = new AbortController();

    await listApplications(controller.signal);

    expect(builder.abortSignal.mock.calls).toEqual([[controller.signal], [controller.signal]]);
    expect(mockRange).toHaveBeenCalledWith(0, 999);
  });

  it("asks for no page when the given signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(listApplications(controller.signal)).rejects.toBeTruthy();

    expect(mockRange).not.toHaveBeenCalled();
  });

  it("returns [] for an empty view, asking for no page — an empty gate result is not an error", async () => {
    newestResponse = { data: [], error: null };

    const result = await listApplications();

    expect(result).toEqual([]);
    expect(mockRange).not.toHaveBeenCalled();
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

  it("throws a PortalError, asking for no page, when the newest-row read fails", async () => {
    newestResponse = {
      data: null,
      error: { code: "42501", message: "caller is not an active Admin" },
    };

    await expect(listApplications()).rejects.toMatchObject({ kind: "permission" });
    expect(mockRange).not.toHaveBeenCalled();
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

  it("calls .rpc('export_yellow_card_applications', { p_status, p_from, p_to, p_date_basis }) and passes null for omitted filters", async () => {
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
      p_date_basis: null,
    });
  });

  it("passes null for all four filters when no filter is given at all", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    await exportApplications();

    expect(mockRpc).toHaveBeenCalledWith("export_yellow_card_applications", {
      p_status: null,
      p_from: null,
      p_to: null,
      p_date_basis: null,
    });
  });

  it("passes every provided filter value through", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    await exportApplications({
      status: "approved",
      from: "2026-01-01",
      to: "2026-01-31",
      dateBasis: "completion",
    });

    expect(mockRpc).toHaveBeenCalledWith("export_yellow_card_applications", {
      p_status: "approved",
      p_from: "2026-01-01",
      p_to: "2026-01-31",
      p_date_basis: "completion",
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
