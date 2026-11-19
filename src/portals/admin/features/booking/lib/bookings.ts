import { createClient } from "@/shared/supabase/client";
import { toPortalError } from "@/portals/admin/lib/supabase/errors";
import { listViewNewestFirst } from "@/portals/admin/lib/supabase/views";
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
 * The view is read whole, newest first, through listViewNewestFirst, which
 * holds the pages still past 1,000 rows (an upper limit on submitted_at and an
 * id tie-break) and threads `signal` through every request. Callers
 * (Dashboard, SLA Reports) create one `AbortController` per fetch and abort
 * the previous one on remount/re-fetch, so this view is never read in more
 * than one in-flight request at a time.
 */
export async function listBookings(signal?: AbortSignal): Promise<BookingRow[]> {
  return listViewNewestFirst("admin_booking_analytics", signal);
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
