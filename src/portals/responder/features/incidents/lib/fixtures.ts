import type {
  HistoryRow,
  Incident,
  IncidentEvent,
  IncidentPhoto,
  ResponderNotification,
} from "@/portals/responder/features/incidents/types";

/**
 * TEST-ONLY builders. Imported by *.test.tsx and by nothing that ships.
 *
 * This is the half of mock-pool.ts that survives: it was both the seed AND the
 * fixture, and only the seed is being deleted. Keeping it means the thirteen
 * component test files stay tests of RENDERING rather than becoming tests of a
 * query, which is the seam decision "Seam 2" is protecting.
 *
 * Timestamps are absolute and the caller pins `now` -- the convention every
 * existing test already follows, so one render shares one instant.
 */
export function anIncident(overrides: Partial<Incident> = {}): Incident {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    reference_number: "INC-2026-000076",
    incident_type_code: "flooding",
    type_label: "Flooding",
    category_label: "Roads and drainage",
    incident_level: "critical",
    status: "in_pool",
    is_verified: true,
    description:
      "Knee-deep water across both lanes by the covered court; two tricycles already stalled.",
    address: "Quezon Ave. cor. Evangelista St.",
    barangay_name: "Ibabang Dupay",
    assigned_department_code: "engineering",
    assigned_responder_id: null,
    sla_due_at: "2026-08-12T04:00:00.000Z",
    sla_armed_at: "2026-08-12T00:00:00.000Z",
    submitted_at: "2026-08-11T23:30:00.000Z",
    // Routed half an hour after it was reported -- the gap SCRUM-200 is about.
    pooled_at: "2026-08-12T00:00:00.000Z",
    reporter_first_name: "Maria",
    reporter_phone: "+63 917 555 0142",
    before_photo_count: 3,
    after_photo_count: 0,
    cycle_number: 1,
    ...overrides,
  } as Incident;
}

export function anEvent(overrides: Partial<IncidentEvent> = {}): IncidentEvent {
  return {
    id: "00000000-0000-4001-8000-000000000001",
    incident_id: "00000000-0000-4000-8000-000000000001",
    event_type: "claimed",
    actor_role: "responder",
    actor_name: "Dev",
    note: null,
    cycle_number: 1,
    created_at: "2026-08-12T01:00:00.000Z",
    ...overrides,
  } as IncidentEvent;
}

export function aPhoto(overrides: Partial<IncidentPhoto> = {}): IncidentPhoto {
  return {
    id: "00000000-0000-4002-8000-000000000001",
    incident_id: "00000000-0000-4000-8000-000000000001",
    kind: "before",
    cycle_number: 1,
    mime_type: "image/jpeg",
    size_bytes: 84000,
    uploaded_at: "2026-08-11T23:40:00.000Z",
    uploaded_by_name: "Maria",
    ...overrides,
  } as IncidentPhoto;
}

/**
 * A finished ticket, as responder_history rows it. Defaults to the case the
 * /history tiles measure: resolved, verified, and inside the promise.
 */
export function aHistoryRow(overrides: Partial<HistoryRow> = {}): HistoryRow {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    reference_number: "INC-2026-000076",
    incident_type_code: "flooding",
    type_label: "Flooding",
    category_label: "Roads and drainage",
    incident_level: "critical",
    status: "resolved",
    closure_reason: null,
    is_verified: true,
    description: "Knee-deep water across both lanes by the covered court.",
    address: "Quezon Ave. cor. Evangelista St.",
    barangay_name: "Ibabang Dupay",
    assigned_department_code: "engineering",
    sla_armed_at: "2026-08-12T00:00:00.000Z",
    sla_due_at: "2026-08-12T04:00:00.000Z",
    sla_target_hours: 4,
    submitted_at: "2026-08-11T23:30:00.000Z",
    resolved_at: "2026-08-12T02:00:00.000Z",
    closed_at: null,
    reopened_count: 0,
    my_last_outcome: "resolved",
    my_last_outcome_at: "2026-08-12T02:00:00.000Z",
    ...overrides,
  } as HistoryRow;
}

export function aNotification(
  overrides: Partial<ResponderNotification> = {},
): ResponderNotification {
  return {
    id: "00000000-0000-4003-8000-000000000001",
    module_code: "incidents",
    record_id: "00000000-0000-4000-8000-000000000001",
    event_code: "incident_pooled",
    channel: "in_app",
    status: "sent",
    title: "New report in the Engineering pool",
    body: "Flooding · Ibabang Dupay",
    created_at: "2026-08-12T01:00:00.000Z",
    sent_at: "2026-08-12T01:00:00.000Z",
    read_at: null,
    ...overrides,
  } as ResponderNotification;
}
