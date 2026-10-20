import { createClient } from "@/shared/supabase/client";
import { requiredColumn } from "@/portals/super-staff/lib/supabase/rows";
import { rows, singleRow } from "@/portals/super-staff/lib/supabase/select";
import type { SiteInfo, SiteInfoEntry, SiteInfoKind } from "./site-info-types";

// `updated_at` is deliberately absent from both: neither surface renders a
// "last changed" stamp — the audit log is where that question is answered —
// and selecting a column nothing maps only invites someone to map it.
const SITE_INFO_COLUMNS = "trunkline, office_hours";
const ENTRY_COLUMNS = "id, kind, label, value, sort_order, is_active";
const VIEW = "super_site_info_entries";

export async function getSiteInfo(): Promise<SiteInfo> {
  const row = await singleRow(
    createClient().from("super_site_info").select(SITE_INFO_COLUMNS).single(),
  );

  return {
    trunkline: row.trunkline ?? "",
    officeHours: row.office_hours ?? "",
  };
}

/**
 * Returns EVERY entry, inactive ones included, in published order.
 *
 * ⚠️ Two rows are both labelled "Secondary Emergency", and two Bureau of Fire
 * Protection numbers are both live. Both were already published to citizens and
 * the owner ruled on 2026-08-12 that both are seeded and the portal must render
 * both until the LGU says which is correct. Do NOT de-duplicate here as a
 * tidy-up: that reintroduces the ambiguity in the one place a citizen would act
 * on it. Retiring the wrong one is one audited, reversible click.
 */
export async function listSiteInfoEntries(): Promise<SiteInfoEntry[]> {
  const data = await rows(
    createClient()
      .from("super_site_info_entries")
      .select(ENTRY_COLUMNS)
      .order("sort_order", { ascending: true }),
  );

  // The view types every column nullable. An entry with no id cannot be saved
  // and one with no kind cannot be placed on a tab, so neither can be rendered
  // — drop those rather than show a row the editor cannot write back.
  return data
    .map((r) =>
      r.id === null || r.kind === null
        ? null
        : {
            id: r.id,
            kind: r.kind,
            label: r.label ?? "",
            value: r.value ?? "",
            sortOrder: requiredColumn(r.sort_order, "sort_order", VIEW),
            isActive: requiredColumn(r.is_active, "is_active", VIEW),
          },
    )
    .filter((e): e is SiteInfoEntry => e !== null);
}
