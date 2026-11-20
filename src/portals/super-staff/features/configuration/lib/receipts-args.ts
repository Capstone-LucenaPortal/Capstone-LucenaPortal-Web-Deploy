import type { AgencyIdentity, Officer } from "./receipts-types";

/**
 * Both RPCs take NO argument defaults (DB `docs/what-not-to-do.md` §10), so
 * every field is sent on every save. They btrim server-side too; trimming here
 * keeps what is sent equal to what the confirm dialog showed.
 *
 * `is_placeholder` is not a parameter: `update_officer_of_record` always
 * writes false, which is what makes a nomination one-way.
 */
export const toOfficerArgs = (o: Officer) => ({
  p_service: o.service,
  p_full_name: o.fullName.trim(),
  p_unit: o.unit.trim(),
  p_designation: o.designation.trim(),
});

export const toAgencyIdentityArgs = (a: AgencyIdentity) => ({
  p_agency_name: a.agencyName.trim(),
  p_seal_path: a.sealPath.trim(),
});
