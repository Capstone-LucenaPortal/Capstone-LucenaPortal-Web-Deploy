import type { Database } from "@/shared/supabase/types";

/**
 * The services that print an Acknowledgement Receipt, in the order the
 * Receipts tab shows them. `module_code` has more values (`platform` and the
 * rest), but only these three have an Officer of Record.
 */
export const OFFICER_SERVICES = ["yellow_card", "incidents", "booking"] as const satisfies readonly Database["public"]["Enums"]["module_code"][];

export type OfficerService = (typeof OFFICER_SERVICES)[number];

export const OFFICER_SERVICE_LABELS: Record<OfficerService, string> = {
  yellow_card: "Yellow Card",
  incidents: "Incidents",
  booking: "Booking",
};

/** One row of `officers_of_record`, as the Receipts tab edits it. */
export type Officer = {
  service: OfficerService;
  fullName: string;
  unit: string;
  designation: string;
  /** Read-only: `update_officer_of_record` always writes false, one-way. */
  isPlaceholder: boolean;
};

/** The agency half of `site_info`. Saved through `save_agency_identity`
 *  only, never through `save_site_info`. */
export type AgencyIdentity = {
  agencyName: string;
  /** A `site-content` path under `agency/`. Insert-only: a new seal always
   *  gets a new path, and the old one stays for receipts already issued. */
  sealPath: string;
};
