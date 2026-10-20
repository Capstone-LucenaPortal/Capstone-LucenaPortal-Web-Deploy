import { STATUS_ORDER } from "./status";
import type {
  ActorRole,
  ClosureReason,
  Incident,
  IncidentEvent,
  IncidentEventType,
  IncidentLevel,
  IncidentPhoto,
  IncidentQueueItem,
  IncidentStatus,
  PhotoKind,
} from "../types";

/**
 * Every column of a view is nullable in the generated types, even ones the
 * underlying table declares NOT NULL. These row types mirror that honestly and
 * the mappers below collapse it.
 */
export type StaffIncidentQueueRow = {
  id: string | null;
  reference_number: string | null;
  type_label: string | null;
  incident_level: IncidentLevel | null;
  status: IncidentStatus | null;
  closure_reason: ClosureReason | null;
  is_verified: boolean | null;
  barangay_name: string | null;
  submitted_at: string | null;
  sla_armed_at: string | null;
  sla_due_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  duplicate_of: string | null;
  original_reference: string | null;
};

export type StaffIncidentRow = StaffIncidentQueueRow & {
  incident_type_code: string | null;
  category_code: string | null;
  description: string | null;
  address: string | null;
  barangay_code: string | null;
  is_anonymous: boolean | null;
  verified_at: string | null;
  suggested_department_code: string | null;
  assigned_department_code: string | null;
  assigned_responder_id: string | null;
  assigned_responder_name: string | null;
  routed_at: string | null;
  sla_target_hours: number | null;
  reopened_count: number | null;
  reporter_first_name: string | null;
  reporter_phone: string | null;
  photo_count: number | null;
};

export type StaffIncidentEventRow = {
  id: string | null;
  event_type: IncidentEventType | null;
  actor_role: ActorRole | null;
  actor_name: string | null;
  note: string | null;
  cycle_number: number | null;
  created_at: string | null;
};

export type StaffIncidentPhotoRow = {
  id: string | null;
  kind: PhotoKind | null;
  cycle_number: number | null;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_at: string | null;
  uploaded_by_name: string | null;
};

/**
 * `id`, `status` and `incident_level` are load-bearing: the first keys the row
 * and builds its link, the second decides which controls render, the third
 * decides how loudly the row shouts. A row missing any of them is not degraded
 * data — it is evidence the query is wrong, so fail rather than render a link to
 * /incidents/undefined.
 *
 * Everything else degrades, because a blank barangay is cosmetic and a thrown
 * page is not.
 */
export function toQueueItem(row: StaffIncidentQueueRow): IncidentQueueItem {
  if (!row.id) throw new Error("staff_incidents returned a row with no id");
  if (!row.status) {
    throw new Error(`staff_incidents returned row ${row.id} with no status`);
  }
  if (!row.incident_level) {
    throw new Error(`staff_incidents returned row ${row.id} with no level`);
  }

  return {
    id: row.id,
    reference_number: row.reference_number ?? "—",
    type_label: row.type_label ?? "Unknown type",
    incident_level: row.incident_level,
    status: row.status,
    closure_reason: row.closure_reason,
    // Fail safe: an unreadable verification state must never arm an SLA.
    is_verified: row.is_verified ?? false,
    barangay_name: row.barangay_name ?? "—",
    submitted_at: row.submitted_at ?? "",
    sla_armed_at: row.sla_armed_at,
    sla_due_at: row.sla_due_at,
    resolved_at: row.resolved_at,
    closed_at: row.closed_at,
    duplicate_of: row.duplicate_of,
    original_reference: row.original_reference,
  };
}

/** Returns null when the id does not exist or is not visible to this staff member. */
export function toIncident(row: StaffIncidentRow | null): Incident | null {
  if (!row) return null;

  return {
    ...toQueueItem(row),
    incident_type_code: row.incident_type_code ?? "",
    category_code: row.category_code,
    description: row.description ?? "",
    address: row.address ?? "",
    barangay_code: row.barangay_code ?? "",
    is_anonymous: row.is_anonymous ?? false,
    verified_at: row.verified_at,
    suggested_department_code: row.suggested_department_code,
    assigned_department_code: row.assigned_department_code,
    assigned_responder_id: row.assigned_responder_id,
    assigned_responder_name: row.assigned_responder_name,
    routed_at: row.routed_at,
    sla_target_hours: row.sla_target_hours,
    reopened_count: row.reopened_count ?? 0,
    // The view already writes the literal 'Anonymous'; this covers a null.
    reporter_first_name: row.reporter_first_name ?? "Anonymous",
    reporter_phone: row.reporter_phone,
    photo_count: row.photo_count ?? 0,
  };
}

export function toEvent(row: StaffIncidentEventRow): IncidentEvent {
  if (!row.id) throw new Error("staff_incident_events returned a row with no id");
  if (!row.event_type) {
    throw new Error(`staff_incident_events row ${row.id} has no event_type`);
  }

  return {
    id: row.id,
    event_type: row.event_type,
    actor_role: row.actor_role ?? "system",
    actor_name: row.actor_name ?? "Unknown",
    note: row.note,
    // Every incident starts at cycle 1. A null means the writer omitted it.
    cycle_number: row.cycle_number ?? 1,
    created_at: row.created_at ?? "",
  };
}

export function toPhoto(row: StaffIncidentPhotoRow): IncidentPhoto {
  if (!row.id) throw new Error("staff_incident_photos returned a row with no id");
  // The view filters `uploaded_at is not null`. A null here means the query hit
  // something other than staff_incident_photos.
  if (!row.uploaded_at) {
    throw new Error(`staff_incident_photos row ${row.id} has no uploaded_at`);
  }

  return {
    id: row.id,
    kind: row.kind ?? "before",
    cycle_number: row.cycle_number ?? 1,
    mime_type: row.mime_type,
    size_bytes: row.size_bytes,
    uploaded_at: row.uploaded_at,
    uploaded_by_name: row.uploaded_by_name ?? "Unknown",
  };
}

/**
 * PostgREST has no GROUP BY, so the tab counts come from selecting one column
 * across the whole view and counting here.
 */
export function countByStatus(
  rows: { status: IncidentStatus | null }[],
): Record<IncidentStatus, number> {
  const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as Record<
    IncidentStatus,
    number
  >;
  for (const row of rows) {
    if (row.status && row.status in counts) counts[row.status] += 1;
  }
  return counts;
}
