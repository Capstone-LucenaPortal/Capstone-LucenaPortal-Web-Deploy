import type { SiteInfo, SiteInfoEntry } from "./site-info-types";

export const toSiteInfoArgs = (c: SiteInfo) => ({
  p_trunkline: c.trunkline,
  p_office_hours: c.officeHours,
});

/** `kind` is NOT a parameter — an entry does not move between lists. The row is
 *  keyed by its uuid, so unlike the code-keyed catalogs there is no natural key
 *  to accidentally rewrite. */
export const toSiteInfoEntryArgs = (r: SiteInfoEntry) => ({
  p_id: r.id,
  p_label: r.label,
  p_value: r.value,
  p_sort_order: r.sortOrder,
  p_is_active: r.isActive,
});
