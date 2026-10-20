import type { Database } from "@/shared/supabase/types";

/**
 * The response-time promise attached to an incident type.
 *
 * ⚠️ Derived from the generated enum, NOT from `IncidentLevel` in `../types`.
 * They are different vocabularies that look alike: the database enum is
 * LOWERCASE (`"high"`), while `IncidentLevel` is capitalised (`"High"`) because
 * it keys `slaHours` onto the `sla_hours_high` columns. Assigning one to the
 * other type-checks nowhere and would misrender here.
 */
export type IncidentBaseLevel = Database["public"]["Enums"]["incident_level"];

/** Every catalog row is keyed by a TEXT code that migrations own. The editors
 *  never create or delete rows — `incidents.incident_type_code` and its siblings
 *  reference these codes, so a row can never truly be removed. Deactivation is
 *  the only retirement, which is why `isActive` is the important field. */
export type Department = {
  code: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
};

export type IncidentType = {
  code: string;
  label: string;
  /** READ-ONLY. The public response-time promise; unresolved by doc 00 §8 and
   *  owned by the LGU. `inc_on_submit()` stamps it onto every incoming incident,
   *  and `public_incident_types` publishes it to anon. */
  baseLevel: IncidentBaseLevel;
  /** READ-ONLY — taxonomy, migration-owned. */
  categoryCode: string | null;
  defaultDepartmentCode: string | null;
  sortOrder: number;
  isActive: boolean;
};

export type BookingVenue = {
  code: string;
  label: string;
  /** Free text, e.g. "Up to 500 pax" — NOT a number. */
  capacityLabel: string | null;
  /** READ-ONLY — drives pricing; `booking_price()` reads it. */
  isHourly: boolean;
  sortOrder: number;
  isActive: boolean;
};

export type BookingEventType = {
  code: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
};

/** No `is_active` column exists on this table — do not invent one. */
export type BookingClassification = {
  code: string;
  label: string;
  isDiscountEligible: boolean;
  sortOrder: number;
};

export type YellowCardDocumentType = {
  code: string;
  label: string;
  isRequired: boolean;
  sortOrder: number;
  isActive: boolean;
};

export type PostCategory = {
  code: string;
  label: string;
  colorHex: string | null;
  sortOrder: number;
  isActive: boolean;
};
