import { createClient } from "@/shared/supabase/client";
import { toPortalError } from "@/portals/admin/lib/supabase/errors";
import { fetchAllRows } from "@/portals/admin/lib/supabase/pagination";
import type { Database } from "@/shared/supabase/types";

export type BookingRow =
  Database["public"]["Views"]["admin_booking_analytics"]["Row"];
export type BookingPii =
  Database["public"]["Functions"]["read_booking_pii"]["Returns"][number];

/**
 * The booking read surface.
 *
 * listBookings reads an analytics view that carries NO organiser PII by
 * design — the contact person, contact number, email address and
 * organization name are only available through readBookingPii.
 *
 * readBookingPii writes a pii_access audit row on EVERY call. It must never
 * be used to populate a list or called in a render loop: the audit log is
 * evidence, and filling it with noise makes a real investigation harder.
 *
 * Bookings have no anonymity flag. A venue booking is made in a named
 * person's name by definition, so unlike read_incident_pii there is no
 * masking branch here — every field on the PII row returns exactly as
 * stored, with no conditional nulling out of the contact fields.
 *
 * `signal`, when given, is attached to the query via `.abortSignal()` and
 * also threaded through to `fetchAllRows` so a cancelled fetch actually stops
 * issuing further pages instead of only cancelling whichever single page
 * happened to be in flight — see fetchAllRows' own doc comment. Callers
 * (Dashboard, SLA Reports) create one `AbortController` per fetch and abort
 * the previous one on remount/re-fetch, so this view is never read in more
 * than one in-flight request at a time.
 */
export async function listBookings(signal?: AbortSignal): Promise<BookingRow[]> {
  const supabase = createClient();
  let query = supabase
    .from("admin_booking_analytics")
    .select("*")
    .order("submitted_at", { ascending: false });
  if (signal) query = query.abortSignal(signal);

  // Page through the view rather than trusting a single request — PostgREST
  // silently caps an unpaginated `.select()` at 1000 rows (see
  // src/portals/admin/lib/supabase/pagination.ts).
  const { data, error } = await fetchAllRows(query, signal);

  if (error) throw toPortalError(error);

  // An empty array is a legitimate outcome, not a failure. It is also exactly
  // what a non-admin caller sees, because the view's WHERE clause filters
  // them out rather than raising.
  return data ?? [];
}

export async function readBookingPii(id: string): Promise<BookingPii> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("read_booking_pii", {
    p_booking_id: id,
  });

  if (error) throw toPortalError(error);

  const row = data?.[0];
  if (!row) {
    throw { kind: "not-found" as const, message: "Booking not found." };
  }
  return row;
}
