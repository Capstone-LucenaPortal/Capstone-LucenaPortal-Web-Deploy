import { createClient } from "@/shared/supabase/client";
import { toPortalError } from "@/portals/admin/lib/supabase/errors";
import { listViewNewestFirst } from "@/portals/admin/lib/supabase/views";
import type { Database } from "@/shared/supabase/types";
import type { YellowCardDateBasis } from "@/portals/admin/features/yellow-card/types";

export type YellowCardRow =
  Database["public"]["Views"]["admin_yellow_card_analytics"]["Row"];
type GeneratedYellowCardPii =
  Database["public"]["Functions"]["read_yellow_card_application_pii"]["Returns"][number];
// The generator types every column a function returns as non-null, but l123's
// three Correction text columns are null on an ordinary application (the
// replaced card comes through a LEFT join), and the printed number is null
// whenever the applicant gave none. Typed as they arrive, so the modal can't
// render a null as if it were text.
export type YellowCardPii = Omit<
  GeneratedYellowCardPii,
  "replaced_card_number" | "correction_note" | "printed_card_number"
> & {
  replaced_card_number: string | null;
  correction_note: string | null;
  printed_card_number: string | null;
};
export type YellowCardExportRow =
  Database["public"]["Functions"]["export_yellow_card_applications"]["Returns"][number];

export interface ExportFilter {
  status?: string | null;
  from?: string | null;
  to?: string | null;
  // Which date from/to bound: submitted_at ("application") or decided_at
  // ("completion"). The RPC reads null as "application".
  dateBasis?: YellowCardDateBasis | null;
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
 * The view is read whole, newest first, through listViewNewestFirst, which
 * holds the pages still past 1,000 rows (an upper limit on submitted_at and an
 * id tie-break) and threads `signal` through every request. Callers
 * (Dashboard, SLA Reports) create one `AbortController` per fetch and abort
 * the previous one on remount/re-fetch, so this view is never read in more
 * than one in-flight request at a time.
 */
export async function listApplications(signal?: AbortSignal): Promise<YellowCardRow[]> {
  return listViewNewestFirst("admin_yellow_card_analytics", signal);
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
  // Pass explicit nulls rather than omitting keys — the RPC reads null as its
  // default (p_date_basis's is 'application') and PostgREST matches on
  // argument NAME, so an omitted key and a null are not equivalent for
  // overload resolution.
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
    p_date_basis: filter.dateBasis ?? null,
  } as Database["public"]["Functions"]["export_yellow_card_applications"]["Args"];
  const { data, error } = await supabase.rpc("export_yellow_card_applications", params);

  if (error) throw toPortalError(error);
  return data ?? [];
}
