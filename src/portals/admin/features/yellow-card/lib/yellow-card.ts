import { createClient } from "@/shared/supabase/client";
import { toPortalError } from "@/portals/admin/lib/supabase/errors";
import { fetchAllRows } from "@/portals/admin/lib/supabase/pagination";
import type { Database } from "@/shared/supabase/types";

export type YellowCardRow =
  Database["public"]["Views"]["admin_yellow_card_analytics"]["Row"];
export type YellowCardPii =
  Database["public"]["Functions"]["read_yellow_card_application_pii"]["Returns"][number];
export type YellowCardExportRow =
  Database["public"]["Functions"]["export_yellow_card_applications"]["Returns"][number];

export interface ExportFilter {
  status?: string | null;
  from?: string | null;
  to?: string | null;
}

/**
 * The Yellow Card read surface.
 *
 * listApplications reads an analytics view that carries NO applicant PII —
 * that is deliberate (layer 17), not an oversight. Names, contact details and
 * the voter ID are only available through readApplicationPii.
 *
 * readApplicationPii and exportApplications each write a pii_access audit row
 * on EVERY call. Neither may be used to populate a list or called in a render
 * loop: the audit log is evidence, and filling it with noise makes a real
 * investigation harder.
 *
 * `signal`, when given, is attached to the query via `.abortSignal()` and
 * also threaded through to `fetchAllRows` so a cancelled fetch actually stops
 * issuing further pages instead of only cancelling whichever single page
 * happened to be in flight — see fetchAllRows' own doc comment. Callers
 * (Dashboard, SLA Reports) create one `AbortController` per fetch and abort
 * the previous one on remount/re-fetch, so this view is never read in more
 * than one in-flight request at a time.
 */
export async function listApplications(signal?: AbortSignal): Promise<YellowCardRow[]> {
  const supabase = createClient();
  let query = supabase
    .from("admin_yellow_card_analytics")
    .select("*")
    .order("submitted_at", { ascending: false });
  if (signal) query = query.abortSignal(signal);

  // Page through the view rather than trusting a single request — PostgREST
  // silently caps an unpaginated `.select()` at 1000 rows (see
  // src/portals/admin/lib/supabase/pagination.ts).
  const { data, error } = await fetchAllRows(query, signal);

  if (error) throw toPortalError(error);

  // An empty array is a legitimate outcome, not a failure. It is also exactly
  // what a non-admin caller sees, because the view's WHERE clause filters them
  // out rather than raising.
  return data ?? [];
}

export async function readApplicationPii(id: string): Promise<YellowCardPii> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("read_yellow_card_application_pii", {
    p_application_id: id,
  });

  if (error) throw toPortalError(error);

  const row = data?.[0];
  if (!row) {
    throw { kind: "not-found" as const, message: "Application not found." };
  }
  return row;
}

export async function exportApplications(
  filter: ExportFilter = {},
): Promise<YellowCardExportRow[]> {
  const supabase = createClient();
  // Pass explicit nulls rather than omitting keys — the RPC's parameters
  // default to null and PostgREST matches on argument NAME, so an omitted key
  // and a null are not equivalent for overload resolution.
  //
  // The generated Args type marks these params optional-string rather than
  // nullable (`p_status?: string`), which doesn't admit `null` even though
  // that's exactly what PostgREST expects for "use the default." The cast
  // below only widens the compile-time type; the runtime object still sends
  // explicit nulls, which is what the tests pin. A plain `as` (not `as
  // unknown as`) so a future retyped parameter still surfaces a compile error
  // instead of being silently swallowed by the double cast.
  const params = {
    p_status: filter.status ?? null,
    p_from: filter.from ?? null,
    p_to: filter.to ?? null,
  } as Database["public"]["Functions"]["export_yellow_card_applications"]["Args"];
  const { data, error } = await supabase.rpc("export_yellow_card_applications", params);

  if (error) throw toPortalError(error);
  return data ?? [];
}
