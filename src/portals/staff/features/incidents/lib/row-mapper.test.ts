import { describe, expect, it } from "vitest";
import {
  countByStatus,
  toEvent,
  toIncident,
  toPhoto,
  toQueueItem,
  type StaffIncidentQueueRow,
  type StaffIncidentRow,
} from "./row-mapper";

function queueRow(over: Partial<StaffIncidentQueueRow> = {}): StaffIncidentQueueRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    reference_number: "INC-2026-000051",
    type_label: "Burst main",
    incident_level: "critical",
    status: "in_pool",
    closure_reason: null,
    is_verified: true,
    barangay_name: "Cotta",
    submitted_at: "2026-08-07T06:00:00+08:00",
    sla_armed_at: "2026-08-07T08:00:00+08:00",
    sla_due_at: "2026-08-07T12:00:00+08:00",
    resolved_at: null,
    closed_at: null,
    duplicate_of: null,
    original_reference: null,
    ...over,
  };
}

describe("toQueueItem", () => {
  it("passes a complete row through", () => {
    expect(toQueueItem(queueRow()).reference_number).toBe("INC-2026-000051");
  });

  it("throws when id is missing", () => {
    // id keys the row and builds its link. A row without one is not degraded
    // data, it is evidence the query is wrong.
    expect(() => toQueueItem(queueRow({ id: null }))).toThrow(/no id/);
  });

  it("throws when status is missing", () => {
    expect(() => toQueueItem(queueRow({ status: null }))).toThrow(/no status/);
  });

  it("throws when incident_level is missing", () => {
    // The level decides the row's badge and its place in the operator's
    // attention. Rendering it blank would be worse than failing.
    expect(() => toQueueItem(queueRow({ incident_level: null }))).toThrow(/no level/);
  });

  it("degrades cosmetic nulls rather than throwing", () => {
    const item = toQueueItem(
      queueRow({ type_label: null, barangay_name: null, reference_number: null }),
    );
    expect(item.type_label).toBe("Unknown type");
    expect(item.barangay_name).toBe("—");
    expect(item.reference_number).toBe("—");
  });

  it("carries a Duplicate's Original, by id and by reference", () => {
    // The queue row links to it; the detail page inherits it through toIncident.
    const item = toQueueItem(
      queueRow({
        closure_reason: "duplicate",
        duplicate_of: "000000de-0000-4004-8000-000000000001",
        original_reference: "INC-2026-000076",
      }),
    );
    expect(item.duplicate_of).toBe("000000de-0000-4004-8000-000000000001");
    expect(item.original_reference).toBe("INC-2026-000076");
  });

  it("treats a null is_verified as unverified", () => {
    // Fail safe: an unreadable verification state must not arm an SLA.
    expect(toQueueItem(queueRow({ is_verified: null })).is_verified).toBe(false);
  });
});

describe("toIncident", () => {
  function detailRow(over: Partial<StaffIncidentRow> = {}): StaffIncidentRow {
    return {
      ...queueRow(),
      incident_type_code: "burst_main",
      category_code: "utilities",
      description: "Main burst overnight.",
      address: "Del Pilar St.",
      barangay_code: "cotta",
      is_anonymous: false,
      verified_at: "2026-08-07T07:00:00+08:00",
      suggested_department_code: "water",
      assigned_department_code: "water",
      assigned_responder_id: null,
      assigned_responder_name: null,
      routed_at: "2026-08-07T08:00:00+08:00",
      sla_target_hours: 4,
      reopened_count: 0,
      reporter_first_name: "Linda",
      reporter_phone: "0917-000-0000",
      photo_count: 2,
      ...over,
    };
  }

  it("returns null for a null row", () => {
    // notFound() is the page's job, not the mapper's.
    expect(toIncident(null)).toBeNull();
  });

  it("carries the detail fields", () => {
    const incident = toIncident(detailRow());
    expect(incident?.reporter_first_name).toBe("Linda");
    expect(incident?.photo_count).toBe(2);
  });

  it("labels a missing reporter name as Anonymous", () => {
    // The view already writes the literal 'Anonymous', but a null must not
    // render as an empty contact card.
    expect(toIncident(detailRow({ reporter_first_name: null }))?.reporter_first_name)
      .toBe("Anonymous");
  });

  it("treats a null photo_count as zero", () => {
    expect(toIncident(detailRow({ photo_count: null }))?.photo_count).toBe(0);
  });
});

describe("toEvent", () => {
  it("names an actor the view could not resolve", () => {
    const event = toEvent({
      id: "e1",
      event_type: "routed",
      actor_role: "staff",
      actor_name: null,
      note: null,
      cycle_number: null,
      created_at: "2026-08-07T08:00:00+08:00",
    });
    expect(event.actor_name).toBe("Unknown");
    // Every incident starts at cycle 1; a null means the writer omitted it.
    expect(event.cycle_number).toBe(1);
  });
});

describe("toPhoto", () => {
  it("keeps uploaded_at, which the view guarantees", () => {
    const photo = toPhoto({
      id: "p1",
      kind: "before",
      cycle_number: 1,
      mime_type: "image/jpeg",
      size_bytes: 84000,
      uploaded_at: "2026-08-07T07:00:00+08:00",
      uploaded_by_name: "Linda",
    });
    expect(photo.uploaded_at).toBe("2026-08-07T07:00:00+08:00");
  });

  it("throws when uploaded_at is null", () => {
    // staff_incident_photos filters `uploaded_at is not null`. A null here means
    // the query hit the wrong object.
    expect(() =>
      toPhoto({
        id: "p1",
        kind: "before",
        cycle_number: 1,
        mime_type: null,
        size_bytes: null,
        uploaded_at: null,
        uploaded_by_name: null,
      }),
    ).toThrow(/uploaded_at/);
  });
});

describe("countByStatus", () => {
  it("counts every status and zero-fills the rest", () => {
    const counts = countByStatus([
      { status: "open" },
      { status: "open" },
      { status: "closed" },
      { status: null },
    ]);
    expect(counts.open).toBe(2);
    expect(counts.closed).toBe(1);
    expect(counts.in_progress).toBe(0);
  });
});
