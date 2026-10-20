import { createClient } from "@/shared/supabase/client";
import { toPortalError } from "@/portals/admin/lib/supabase/errors";
import type { Database } from "@/shared/supabase/types";

export type DepartmentRow = Database["public"]["Views"]["public_departments"]["Row"];
export type VenueRow = Database["public"]["Views"]["public_booking_venues"]["Row"];
export type IncidentCategoryRow =
  Database["public"]["Views"]["public_incident_categories"]["Row"];
export type BookingEventTypeRow =
  Database["public"]["Views"]["public_booking_event_types"]["Row"];
export type BarangayRow = Database["public"]["Views"]["public_barangays"]["Row"];
export type IncidentConfigRow =
  Database["public"]["Views"]["public_incident_config"]["Row"];

/**
 * Catalog labels the admin analytics views do not carry.
 *
 * `admin_incident_analytics` exposes `assigned_department_code` and
 * `category_code`, and `admin_booking_analytics` exposes `venue_code` and
 * `event_type_code`, but none of the four analytics columns carry the human
 * label. These four catalog views do, and all are granted to anon as well as
 * authenticated — they are public reference data, not scoped records, so
 * they need no admin gate and return the same rows to everyone.
 */
export async function listDepartments(): Promise<DepartmentRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("public_departments")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) throw toPortalError(error);
  return data ?? [];
}

export async function listVenues(): Promise<VenueRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("public_booking_venues")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) throw toPortalError(error);
  return data ?? [];
}

export async function listIncidentCategories(): Promise<IncidentCategoryRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("public_incident_categories")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) throw toPortalError(error);
  return data ?? [];
}

export async function listBookingEventTypes(): Promise<BookingEventTypeRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("public_booking_event_types")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) throw toPortalError(error);
  return data ?? [];
}

/**
 * Every barangay in Lucena City, whether or not it has ever filed anything.
 *
 * This is the source of the "Barangays Reached — N / TOTAL" denominator on
 * the Yellow Card page and dashboard. It cannot be derived from the analytics
 * rows the way `barangaysReached` can: a barangay that has filed zero
 * applications never appears in them at all, so counting distinct barangays
 * in those rows would always report the total as equal to the reached figure
 * and the tile would permanently read "N / N".
 */
export async function listBarangays(): Promise<BarangayRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("public_barangays")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) throw toPortalError(error);
  return data ?? [];
}

/**
 * The city's incident SLA settings — critically, the PER-LEVEL response
 * targets (`sla_hours_critical` / `_high` / `_medium` / `_low`).
 *
 * Unlike the catalog lists above this is a single-row view with no
 * `sort_order`, so it is read with `.maybeSingle()`. A missing row returns
 * null rather than throwing: callers must treat "no config" as "no target to
 * judge against" (see incidentSlaHours/issueRangeStats in src/portals/admin/lib/aggregate.ts,
 * which surface that as a null breach count, not as zero breaches).
 *
 * These values are Super Staff-editable via `save_incident_config`, which is
 * exactly why the figures must be read from here rather than copied into the
 * frontend as literals.
 */
export async function getIncidentConfig(): Promise<IncidentConfigRow | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("public_incident_config")
    .select("*")
    .maybeSingle();

  if (error) throw toPortalError(error);
  return data ?? null;
}
