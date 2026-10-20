import { createClient } from "@/shared/supabase/client";
import { requiredColumn } from "@/portals/super-staff/lib/supabase/rows";
import { rows } from "@/portals/super-staff/lib/supabase/select";
import type {
  BookingClassification,
  BookingEventType,
  BookingVenue,
  Department,
  IncidentType,
  PostCategory,
  YellowCardDocumentType,
} from "./catalog-types";

/**
 * These views return INACTIVE ROWS TOO — that is the entire reason they exist.
 * Never add a `.eq("is_active", true)` filter, and never add an `.eq()` for
 * permission either: the super_* views self-scope.
 *
 * Every column list stays on ONE source line. Splitting it with `+` widens the
 * literal to `string` and the row type degrades to GenericStringError[].
 */

const DEPARTMENT_COLUMNS = "code, label, sort_order, is_active";
const INCIDENT_TYPE_COLUMNS = "code, label, base_level, default_department_code, category_code, sort_order, is_active";
const BOOKING_VENUE_COLUMNS = "code, label, capacity_label, is_hourly, sort_order, is_active";
const BOOKING_EVENT_TYPE_COLUMNS = "code, label, sort_order, is_active";
const BOOKING_CLASSIFICATION_COLUMNS = "code, label, is_discount_eligible, sort_order";
const YELLOW_CARD_DOCUMENT_TYPE_COLUMNS = "code, label, is_required, sort_order, is_active";
const POST_CATEGORY_COLUMNS = "code, label, color_hex, sort_order, is_active";

/**
 * The three fields every catalog row carries.
 *
 * ⚠️ `isActive` is NOT among them. Booking classifications have no `is_active`
 * column and one must not be invented — see `catalog-types.ts`. The six catalogs
 * that do have it add it in their own `extend`.
 */
type CatalogIdentity = { code: string; label: string; sortOrder: number };

/** What every catalog view hands back, before the per-catalog columns. */
type CatalogRow = {
  code: string | null;
  label: string | null;
  sort_order: number | null;
};

/**
 * The one mapper the seven catalogs share.
 *
 * It replaces seven copies of the same snake_case→camelCase loop, each of which
 * reached its row type through `(data ?? []) as SomeRow[]` — a cast that
 * asserted `code: string` over a definer view that types every column nullable.
 * The cast did not check that claim; this narrows it instead.
 *
 * A row missing its code or its label is dropped: the code is the key every
 * editor saves by and the label is the only thing shown, so such a row can
 * neither be rendered nor written back. The remaining columns go through
 * `requiredColumn`, which fails loudly on view/table drift rather than
 * defaulting — silently reading a null `is_active` as `false` would retire a
 * live catalog entry from the citizen-facing app.
 */
function toCatalogEntries<R extends CatalogRow, T extends CatalogIdentity>(
  view: string,
  data: R[],
  extend: (row: R, identity: CatalogIdentity) => T,
): T[] {
  return data
    .map((row) =>
      row.code === null || row.label === null
        ? null
        : extend(row, {
            code: row.code,
            label: row.label,
            sortOrder: requiredColumn(row.sort_order, "sort_order", view),
          }),
    )
    .filter((entry): entry is T => entry !== null);
}

export async function listDepartments(): Promise<Department[]> {
  const data = await rows(
    createClient()
      .from("super_departments")
      .select(DEPARTMENT_COLUMNS)
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true }),
  );

  return toCatalogEntries("super_departments", data, (r, identity) => ({
    ...identity,
    isActive: requiredColumn(r.is_active, "is_active", "super_departments"),
  }));
}

export async function listIncidentTypes(): Promise<IncidentType[]> {
  const data = await rows(
    createClient()
      .from("super_incident_types")
      .select(INCIDENT_TYPE_COLUMNS)
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true }),
  );

  return toCatalogEntries("super_incident_types", data, (r, identity) => ({
    ...identity,
    baseLevel: requiredColumn(r.base_level, "base_level", "super_incident_types"),
    categoryCode: r.category_code,
    defaultDepartmentCode: r.default_department_code,
    isActive: requiredColumn(r.is_active, "is_active", "super_incident_types"),
  }));
}

export async function listBookingVenues(): Promise<BookingVenue[]> {
  const data = await rows(
    createClient()
      .from("super_booking_venues")
      .select(BOOKING_VENUE_COLUMNS)
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true }),
  );

  return toCatalogEntries("super_booking_venues", data, (r, identity) => ({
    ...identity,
    capacityLabel: r.capacity_label,
    isHourly: requiredColumn(r.is_hourly, "is_hourly", "super_booking_venues"),
    isActive: requiredColumn(r.is_active, "is_active", "super_booking_venues"),
  }));
}

export async function listBookingEventTypes(): Promise<BookingEventType[]> {
  const data = await rows(
    createClient()
      .from("super_booking_event_types")
      .select(BOOKING_EVENT_TYPE_COLUMNS)
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true }),
  );

  return toCatalogEntries("super_booking_event_types", data, (r, identity) => ({
    ...identity,
    isActive: requiredColumn(r.is_active, "is_active", "super_booking_event_types"),
  }));
}

export async function listBookingClassifications(): Promise<BookingClassification[]> {
  const data = await rows(
    createClient()
      .from("super_booking_classifications")
      .select(BOOKING_CLASSIFICATION_COLUMNS)
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true }),
  );

  // No `isActive` here on purpose — the table has no such column.
  return toCatalogEntries("super_booking_classifications", data, (r, identity) => ({
    ...identity,
    isDiscountEligible: requiredColumn(
      r.is_discount_eligible,
      "is_discount_eligible",
      "super_booking_classifications",
    ),
  }));
}

export async function listYellowCardDocumentTypes(): Promise<YellowCardDocumentType[]> {
  const data = await rows(
    createClient()
      .from("super_yellow_card_document_types")
      .select(YELLOW_CARD_DOCUMENT_TYPE_COLUMNS)
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true }),
  );

  return toCatalogEntries("super_yellow_card_document_types", data, (r, identity) => ({
    ...identity,
    isRequired: requiredColumn(
      r.is_required,
      "is_required",
      "super_yellow_card_document_types",
    ),
    isActive: requiredColumn(r.is_active, "is_active", "super_yellow_card_document_types"),
  }));
}

export async function listPostCategories(): Promise<PostCategory[]> {
  const data = await rows(
    createClient()
      .from("super_post_categories")
      .select(POST_CATEGORY_COLUMNS)
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true }),
  );

  return toCatalogEntries("super_post_categories", data, (r, identity) => ({
    ...identity,
    colorHex: r.color_hex,
    isActive: requiredColumn(r.is_active, "is_active", "super_post_categories"),
  }));
}
