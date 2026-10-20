import type {
  BookingClassification,
  BookingEventType,
  BookingVenue,
  Department,
  IncidentType,
  PostCategory,
  YellowCardDocumentType,
} from "./catalog-types";

/**
 * Every one of these RPCs is a FULL REPLACE — none has an argument default, so
 * every parameter is sent on every call. Verified against
 * pg_get_function_identity_arguments on the sandbox at l62.
 */

export const toDepartmentArgs = (r: Department) => ({
  p_code: r.code,
  p_label: r.label,
  p_sort_order: r.sortOrder,
  p_is_active: r.isActive,
});

/** base_level, category_code and code itself are NOT parameters — l58b rejects
 *  the idea structurally by not declaring them, and assert_l58b fails if a
 *  future migration adds a write to base_level. */
export const toIncidentTypeArgs = (r: IncidentType) => ({
  p_code: r.code,
  p_label: r.label,
  p_default_department_code: r.defaultDepartmentCode,
  p_sort_order: r.sortOrder,
  p_is_active: r.isActive,
});

export const toBookingVenueArgs = (r: BookingVenue) => ({
  p_code: r.code,
  p_label: r.label,
  p_capacity_label: r.capacityLabel,
  p_sort_order: r.sortOrder,
  p_is_active: r.isActive,
});

export const toBookingEventTypeArgs = (r: BookingEventType) => ({
  p_code: r.code,
  p_label: r.label,
  p_sort_order: r.sortOrder,
  p_is_active: r.isActive,
});

/** No label, no is_active: booking_classifications has no is_active column and
 *  l58b does not accept a label. Eligibility is the whole editable surface. */
export const toBookingClassificationArgs = (r: BookingClassification) => ({
  p_code: r.code,
  p_is_discount_eligible: r.isDiscountEligible,
  p_sort_order: r.sortOrder,
});

export const toYellowCardDocumentTypeArgs = (r: YellowCardDocumentType) => ({
  p_code: r.code,
  p_label: r.label,
  p_is_required: r.isRequired,
  p_sort_order: r.sortOrder,
  p_is_active: r.isActive,
});

export const toPostCategoryArgs = (r: PostCategory) => ({
  p_code: r.code,
  p_label: r.label,
  p_color_hex: r.colorHex,
  p_sort_order: r.sortOrder,
  p_is_active: r.isActive,
});
