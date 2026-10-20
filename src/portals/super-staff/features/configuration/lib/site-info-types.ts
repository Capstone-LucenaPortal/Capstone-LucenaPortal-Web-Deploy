/** The three lists site_info_entries carries. An entry never moves between
 *  them, which is why `kind` is not a parameter of update_site_info_entry. */
export type SiteInfoKind =
  | "emergency_hotline"
  | "office_contact"
  | "floor_directory";

/** The singleton contact scalars. */
export type SiteInfo = {
  trunkline: string;
  officeHours: string;
};

export type SiteInfoEntry = {
  id: string;
  kind: SiteInfoKind;
  label: string;
  value: string;
  sortOrder: number;
  isActive: boolean;
};
