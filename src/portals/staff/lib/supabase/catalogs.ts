import { cache } from "react";
import { createClient } from "@/shared/supabase/server";

/**
 * The `public_*` catalog views that are a flat (code, label) lookup.
 *
 * These are editable tables behind the views — Super Staff can rename a
 * department or retire a venue — which is why labels are read rather than
 * hardcoded in TypeScript. See decision 2 of the 2026-08-07 record.
 *
 * Extend this union as later modules need more catalogs.
 */
export type LabelCatalog =
  | "public_genders"
  | "public_civil_statuses"
  | "public_departments"
  | "public_incident_types"
  | "public_booking_venues"
  | "public_booking_event_types"
  | "public_booking_classifications";

/**
 * ⚠️ `public_booking_rehearsal_rates` is deliberately NOT in this union, even
 * though it is also (code, label, …). getLabels throws away every column but
 * the first two, and the whole point of that view is `hourly_rate`. It has its
 * own reader in features/booking/lib/queries.ts.
 */

export type CatalogRow = { code: string | null; label: string | null };

/** Pure. A row missing either half is dropped, never written as undefined. */
export function toLabelMap(rows: CatalogRow[] | null): Record<string, string> {
  const map: Record<string, string> = {};
  for (const row of rows ?? []) {
    if (row.code && row.label) map[row.code] = row.label;
  }
  return map;
}

/**
 * Server-only glue. React's cache() dedupes across a single render pass, so a
 * page that labels both gender and civil status makes each request once.
 *
 * Read failures return an empty map rather than throwing: a missing label
 * degrades to showing the raw code, which is legible. Failing the whole page
 * because a lookup table was unreachable would not be.
 */
export const getLabels = cache(
  async (view: LabelCatalog): Promise<Record<string, string>> => {
    const supabase = await createClient();
    const { data } = await supabase.from(view).select("code, label");
    return toLabelMap((data as CatalogRow[] | null) ?? null);
  },
);
