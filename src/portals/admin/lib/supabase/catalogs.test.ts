import { vi } from "vitest";
import {
  getIncidentConfig,
  listBarangays,
  listDepartments,
  listVenues,
  listIncidentCategories,
  listBookingEventTypes,
} from "@/portals/admin/lib/supabase/catalogs";

const mockOrder = vi.fn();
const mockMaybeSingle = vi.fn();
const mockSelect = vi.fn(() => ({ order: mockOrder, maybeSingle: mockMaybeSingle }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

const mockSupabase = {
  from: mockFrom,
};

vi.mock("../../../../shared/supabase/client", () => ({
  createClient: () => mockSupabase,
}));

describe("listDepartments", () => {
  beforeEach(() => {
    mockFrom.mockClear();
    mockSelect.mockClear();
    mockOrder.mockReset();
  });

  it("reads from public_departments, selects *, and orders by sort_order ascending", async () => {
    mockOrder.mockResolvedValue({ data: [], error: null });

    await listDepartments();

    // Assert the exact view name. The analytics views carry codes but not
    // labels; these catalogs supply them and must read from the correct
    // public reference views, not accidentally from a base table or other view.
    expect(mockFrom).toHaveBeenCalledWith("public_departments");
    expect(mockSelect).toHaveBeenCalledWith("*");
    expect(mockOrder).toHaveBeenCalledWith("sort_order", { ascending: true });
  });

  it("returns [] when the view returns [] — an empty catalog is not an error", async () => {
    mockOrder.mockResolvedValue({ data: [], error: null });

    const result = await listDepartments();

    expect(result).toEqual([]);
  });

  it("returns whatever rows the view provides", async () => {
    const rows = [
      {
        code: "DEPT-1",
        label: "Department One",
        sort_order: 1,
      },
      {
        code: "DEPT-2",
        label: "Department Two",
        sort_order: 2,
      },
    ];
    mockOrder.mockResolvedValue({ data: rows, error: null });

    const result = await listDepartments();

    expect(result).toEqual(rows);
  });

  it("throws a PortalError with kind: permission when the client returns { code: '42501' }", async () => {
    mockOrder.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "read permission denied on public_departments" },
    });

    await expect(listDepartments()).rejects.toMatchObject({ kind: "permission" });
  });
});

describe("listVenues", () => {
  beforeEach(() => {
    mockFrom.mockClear();
    mockSelect.mockClear();
    mockOrder.mockReset();
  });

  it("reads from public_booking_venues, selects *, and orders by sort_order ascending", async () => {
    mockOrder.mockResolvedValue({ data: [], error: null });

    await listVenues();

    // Assert the exact view name. The analytics views carry codes but not
    // labels; these catalogs supply them and must read from the correct
    // public reference views, not accidentally from a base table or other view.
    expect(mockFrom).toHaveBeenCalledWith("public_booking_venues");
    expect(mockSelect).toHaveBeenCalledWith("*");
    expect(mockOrder).toHaveBeenCalledWith("sort_order", { ascending: true });
  });

  it("returns [] when the view returns [] — an empty catalog is not an error", async () => {
    mockOrder.mockResolvedValue({ data: [], error: null });

    const result = await listVenues();

    expect(result).toEqual([]);
  });

  it("returns whatever rows the view provides", async () => {
    const rows = [
      {
        code: "VENUE-1",
        label: "Venue One",
        capacity_label: "100 pax",
        is_hourly: true,
        sort_order: 1,
      },
      {
        code: "VENUE-2",
        label: "Venue Two",
        capacity_label: "200 pax",
        is_hourly: false,
        sort_order: 2,
      },
    ];
    mockOrder.mockResolvedValue({ data: rows, error: null });

    const result = await listVenues();

    expect(result).toEqual(rows);
  });

  it("throws a PortalError with kind: permission when the client returns { code: '42501' }", async () => {
    mockOrder.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "read permission denied on public_booking_venues" },
    });

    await expect(listVenues()).rejects.toMatchObject({ kind: "permission" });
  });
});

describe("listIncidentCategories", () => {
  beforeEach(() => {
    mockFrom.mockClear();
    mockSelect.mockClear();
    mockOrder.mockReset();
  });

  it("reads from public_incident_categories, selects *, and orders by sort_order ascending", async () => {
    mockOrder.mockResolvedValue({ data: [], error: null });

    await listIncidentCategories();

    // Assert the exact view name — the guard against a later repoint to a
    // revoked base table (incident_categories) or the wrong view.
    expect(mockFrom).toHaveBeenCalledWith("public_incident_categories");
    expect(mockSelect).toHaveBeenCalledWith("*");
    expect(mockOrder).toHaveBeenCalledWith("sort_order", { ascending: true });
  });

  it("returns [] when the view returns [] — an empty catalog is not an error", async () => {
    mockOrder.mockResolvedValue({ data: [], error: null });

    const result = await listIncidentCategories();

    expect(result).toEqual([]);
  });

  it("returns whatever rows the view provides", async () => {
    const rows = [
      { code: "infrastructure", label: "Infrastructure", sort_order: 1 },
      { code: "sanitation", label: "Sanitation", sort_order: 2 },
    ];
    mockOrder.mockResolvedValue({ data: rows, error: null });

    const result = await listIncidentCategories();

    expect(result).toEqual(rows);
  });

  it("throws a PortalError with kind: permission when the client returns { code: '42501' }", async () => {
    mockOrder.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "read permission denied on public_incident_categories" },
    });

    await expect(listIncidentCategories()).rejects.toMatchObject({ kind: "permission" });
  });
});

describe("listBookingEventTypes", () => {
  beforeEach(() => {
    mockFrom.mockClear();
    mockSelect.mockClear();
    mockOrder.mockReset();
  });

  it("reads from public_booking_event_types, selects *, and orders by sort_order ascending", async () => {
    mockOrder.mockResolvedValue({ data: [], error: null });

    await listBookingEventTypes();

    // Assert the exact view name — the guard against a later repoint to a
    // revoked base table (booking_event_types) or the wrong view.
    expect(mockFrom).toHaveBeenCalledWith("public_booking_event_types");
    expect(mockSelect).toHaveBeenCalledWith("*");
    expect(mockOrder).toHaveBeenCalledWith("sort_order", { ascending: true });
  });

  it("returns [] when the view returns [] — an empty catalog is not an error", async () => {
    mockOrder.mockResolvedValue({ data: [], error: null });

    const result = await listBookingEventTypes();

    expect(result).toEqual([]);
  });

  it("returns whatever rows the view provides", async () => {
    const rows = [
      { code: "wedding", label: "Wedding", sort_order: 1 },
      { code: "conference", label: "Conference", sort_order: 2 },
    ];
    mockOrder.mockResolvedValue({ data: rows, error: null });

    const result = await listBookingEventTypes();

    expect(result).toEqual(rows);
  });

  it("throws a PortalError with kind: permission when the client returns { code: '42501' }", async () => {
    mockOrder.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "read permission denied on public_booking_event_types" },
    });

    await expect(listBookingEventTypes()).rejects.toMatchObject({ kind: "permission" });
  });
});

describe("listBarangays", () => {
  beforeEach(() => {
    mockFrom.mockClear();
    mockSelect.mockClear();
    mockOrder.mockReset();
  });

  it("reads from public_barangays, selects *, and orders by sort_order ascending", async () => {
    mockOrder.mockResolvedValue({ data: [], error: null });

    await listBarangays();

    // The barangay TOTAL on the Yellow Card coverage tile comes from this
    // view's row count — a barangay that has filed nothing never appears in
    // the analytics rows, so it cannot be derived from them.
    expect(mockFrom).toHaveBeenCalledWith("public_barangays");
    expect(mockSelect).toHaveBeenCalledWith("*");
    expect(mockOrder).toHaveBeenCalledWith("sort_order", { ascending: true });
  });

  it("returns whatever rows the view provides", async () => {
    const rows = [
      { code: "BGY-1", name: "Barangay One", is_poblacion: true, sort_order: 1 },
      { code: "BGY-2", name: "Barangay Two", is_poblacion: false, sort_order: 2 },
    ];
    mockOrder.mockResolvedValue({ data: rows, error: null });

    expect(await listBarangays()).toEqual(rows);
  });

  it("throws a PortalError with kind: permission when the client returns { code: '42501' }", async () => {
    mockOrder.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "read permission denied on public_barangays" },
    });

    await expect(listBarangays()).rejects.toMatchObject({ kind: "permission" });
  });
});

describe("getIncidentConfig", () => {
  beforeEach(() => {
    mockFrom.mockClear();
    mockSelect.mockClear();
    mockMaybeSingle.mockReset();
  });

  it("reads the single public_incident_config row via maybeSingle", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    await getIncidentConfig();

    // public_incident_config is a one-row view with no sort_order column, so
    // it is read with maybeSingle rather than the .order() every catalog list
    // above uses.
    expect(mockFrom).toHaveBeenCalledWith("public_incident_config");
    expect(mockSelect).toHaveBeenCalledWith("*");
    expect(mockMaybeSingle).toHaveBeenCalled();
  });

  it("returns the config row the view provides", async () => {
    const row = {
      sla_hours_critical: 4,
      sla_hours_high: 8,
      sla_hours_medium: 24,
      sla_hours_low: 72,
      auto_close_day: 7,
      confirmation_window_days: 3,
      max_active_reports_per_citizen: 3,
      max_photos_per_cycle: 3,
      nudge_day: 5,
    };
    mockMaybeSingle.mockResolvedValue({ data: row, error: null });

    expect(await getIncidentConfig()).toEqual(row);
  });

  it("returns null when the view has no row — not an error", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    expect(await getIncidentConfig()).toBeNull();
  });

  it("throws a PortalError with kind: permission when the client returns { code: '42501' }", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "read permission denied on public_incident_config" },
    });

    await expect(getIncidentConfig()).rejects.toMatchObject({ kind: "permission" });
  });
});
