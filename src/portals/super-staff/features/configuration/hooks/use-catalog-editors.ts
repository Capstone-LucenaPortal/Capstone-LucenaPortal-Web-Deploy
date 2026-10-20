"use client";

import { callRpc } from "@/portals/super-staff/lib/supabase/rpc";
import { byCode, useCatalogEditor } from "./use-catalog-editor";
import {
  toBookingClassificationArgs,
  toBookingEventTypeArgs,
  toBookingVenueArgs,
  toDepartmentArgs,
  toIncidentTypeArgs,
  toYellowCardDocumentTypeArgs,
} from "../lib/catalog-args";
import {
  listBookingClassifications,
  listBookingEventTypes,
  listBookingVenues,
  listDepartments,
  listIncidentTypes,
  listYellowCardDocumentTypes,
} from "../lib/catalog-queries";
import type {
  BookingClassification,
  BookingEventType,
  BookingVenue,
  Department,
  IncidentType,
  YellowCardDocumentType,
} from "../lib/catalog-types";
import { validateCatalogOrder, validateCatalogRow } from "../lib/validation";

/**
 * The six catalog editors the three configuration tabs mount, gathered here so
 * the card components next door are presentation only. They used to sit in the
 * component files beside their RPC commit functions, which gave those files two
 * unrelated reasons to change.
 *
 * ⚠️ EVERY function passed to `useCatalogEditor` must be MODULE SCOPE. The load
 * effect depends on `load`'s identity and a fresh closure each render re-fetches
 * forever. Same trap `use-config-editor` documents.
 *
 * Nothing outside configuration should import from here — this mounts all six
 * editors. `byCode` is re-exported from `use-catalog-editor` for that reason.
 */

async function commitVenue(row: BookingVenue): Promise<void> {
  await callRpc("update_booking_venue", toBookingVenueArgs(row));
}
async function commitEventType(row: BookingEventType): Promise<void> {
  await callRpc("update_booking_event_type", toBookingEventTypeArgs(row));
}
async function commitClassification(row: BookingClassification): Promise<void> {
  await callRpc("update_booking_classification", toBookingClassificationArgs(row));
}
async function commitDepartment(row: Department): Promise<void> {
  await callRpc("update_department", toDepartmentArgs(row));
}
async function commitIncidentType(row: IncidentType): Promise<void> {
  await callRpc("update_incident_type", toIncidentTypeArgs(row));
}
async function commitDocumentType(row: YellowCardDocumentType): Promise<void> {
  await callRpc("update_yellow_card_document_type", toYellowCardDocumentTypeArgs(row));
}

// ── Booking ────────────────────────────────────────────────────────────────
export function useVenuesEditor() {
  return useCatalogEditor<BookingVenue>({
    load: listBookingVenues,
    commit: commitVenue,
    validate: validateCatalogRow,
    keyOf: byCode,
    label: "venues",
  });
}

export function useEventTypesEditor() {
  return useCatalogEditor<BookingEventType>({
    load: listBookingEventTypes,
    commit: commitEventType,
    validate: validateCatalogRow,
    keyOf: byCode,
    label: "event types",
  });
}

/** Order only: `booking_classifications` has no editable label and no
 *  `is_active` column, so validating a label would make a row with an empty one
 *  in the database permanently unsavable. */
export function useClassificationsEditor() {
  return useCatalogEditor<BookingClassification>({
    load: listBookingClassifications,
    commit: commitClassification,
    validate: validateCatalogOrder,
    keyOf: byCode,
    label: "classifications",
  });
}

// ── Incidents ──────────────────────────────────────────────────────────────
export function useDepartmentsEditor() {
  return useCatalogEditor<Department>({
    load: listDepartments,
    commit: commitDepartment,
    validate: validateCatalogRow,
    keyOf: byCode,
    label: "departments",
  });
}

export function useIncidentTypesEditor() {
  return useCatalogEditor<IncidentType>({
    load: listIncidentTypes,
    commit: commitIncidentType,
    validate: validateCatalogRow,
    keyOf: byCode,
    label: "incident types",
  });
}

// ── Yellow Card ────────────────────────────────────────────────────────────
export function useDocumentTypesEditor() {
  return useCatalogEditor<YellowCardDocumentType>({
    load: listYellowCardDocumentTypes,
    commit: commitDocumentType,
    validate: validateCatalogRow,
    keyOf: byCode,
    label: "document types",
  });
}
