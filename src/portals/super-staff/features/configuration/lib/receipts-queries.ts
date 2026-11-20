import { createClient } from "@/shared/supabase/client";
import { requiredColumn } from "@/portals/super-staff/lib/supabase/rows";
import { singleRow } from "@/portals/super-staff/lib/supabase/select";
import type { AgencyIdentity, Officer, OfficerService } from "./receipts-types";

const OFFICERS_VIEW = "super_officers_of_record";
const OFFICER_COLUMNS = "full_name, unit, designation, is_placeholder";

/**
 * One officer, by service. `.single()` is sound here: `service` is the table's
 * primary key, so the filtered view holds at most one row, and zero rows can
 * only mean the gate refused (the view returns nothing to anyone who is not an
 * active Super Staff) — which the error seam reads as `permission`, exactly as
 * it does for `super_site_info`. The three officers are seeded by l66 and
 * there is no delete.
 */
export async function getOfficer(service: OfficerService): Promise<Officer> {
  const row = await singleRow(
    createClient()
      .from(OFFICERS_VIEW)
      .select(OFFICER_COLUMNS)
      .eq("service", service)
      .single(),
  );

  // Every column is NOT NULL with a CHECK in officers_of_record, so a null
  // here is drift, not a blank to render (CONTEXT.md, "super_* views").
  return {
    service,
    fullName: requiredColumn(row.full_name, "full_name", OFFICERS_VIEW),
    unit: requiredColumn(row.unit, "unit", OFFICERS_VIEW),
    designation: requiredColumn(row.designation, "designation", OFFICERS_VIEW),
    isPlaceholder: requiredColumn(row.is_placeholder, "is_placeholder", OFFICERS_VIEW),
  };
}

/** The agency half of `super_site_info`. The Site Info tab reads the other half. */
export async function getAgencyIdentity(): Promise<AgencyIdentity> {
  const row = await singleRow(
    createClient().from("super_site_info").select("agency_name, seal_path").single(),
  );

  // NOT NULL with CHECKs since l66, like the officers' columns.
  return {
    agencyName: requiredColumn(row.agency_name, "agency_name", "super_site_info"),
    sealPath: requiredColumn(row.seal_path, "seal_path", "super_site_info"),
  };
}
