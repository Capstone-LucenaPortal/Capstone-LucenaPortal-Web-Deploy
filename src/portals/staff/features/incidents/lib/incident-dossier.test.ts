import { afterEach, describe, expect, it, vi } from "vitest";
import {
  columnsOf,
  createTableFetch,
  createTestClient,
  requestTo,
} from "@/portals/staff/lib/supabase/testing";
import * as catalogs from "@/portals/staff/lib/supabase/catalogs";
import { getIncidentDossier } from "./incident-dossier";
import type {
  StaffIncidentEventRow,
  StaffIncidentPhotoRow,
  StaffIncidentQueueRow,
  StaffIncidentRow,
} from "./row-mapper";

const INCIDENT_ID = "000000de-0000-4004-8000-000000000004";

/**
 * The queue row these fixtures build on is defined identically in
 * queries.test.ts, which still owns the queue, status-count and at-risk reads.
 * The two files agree on which report INC-2026-000123 is on purpose: a reader
 * comparing a detail assertion here against a queue assertion there is
 * comparing the same incident.
 */
const CANNED_QUEUE_ROW: StaffIncidentQueueRow = {
  id: "inc-1",
  reference_number: "INC-2026-000123",
  type_label: "Flooding",
  incident_level: "high",
  status: "in_progress",
  closure_reason: null,
  is_verified: true,
  barangay_name: "Barangay Ibabang Dupay",
  submitted_at: "2026-08-01T02:11:09.114000+00:00",
  sla_armed_at: "2026-08-01T02:40:00.000000+00:00",
  sla_due_at: "2026-08-02T02:40:00.000000+00:00",
  resolved_at: null,
  closed_at: null,
  duplicate_of: null,
  original_reference: null,
};

const CANNED_INCIDENT_ROW: StaffIncidentRow = {
  ...CANNED_QUEUE_ROW,
  id: INCIDENT_ID,
  incident_type_code: "flooding",
  category_code: "infrastructure",
  description: "Knee-deep water across the whole of Del Pilar St.",
  address: "Del Pilar St.",
  barangay_code: "ibabang_dupay",
  is_anonymous: false,
  verified_at: "2026-08-01T02:40:00.000000+00:00",
  suggested_department_code: "water",
  assigned_department_code: "engineering",
  assigned_responder_id: null,
  assigned_responder_name: null,
  routed_at: "2026-08-01T03:10:00.000000+00:00",
  sla_target_hours: 24,
  reopened_count: 0,
  reporter_first_name: "Linda",
  reporter_phone: "09170000001",
  photo_count: 2,
};

const CANNED_EVENT_ROW: StaffIncidentEventRow = {
  id: "event-1",
  event_type: "routed",
  actor_role: "staff",
  actor_name: "Ana Reyes",
  note: "Sent to Engineering — this is a drainage job, not a supply one.",
  cycle_number: 1,
  created_at: "2026-08-01T03:10:00.000000+00:00",
};

const CANNED_PHOTO_ROW: StaffIncidentPhotoRow = {
  id: "photo-1",
  kind: "before",
  cycle_number: 1,
  mime_type: "image/jpeg",
  size_bytes: 512_000,
  uploaded_at: "2026-08-01T02:38:11.000000+00:00",
  uploaded_by_name: "Linda",
};

const INCIDENTS = "staff_incidents";
const EVENTS = "staff_incident_events";
const PHOTOS = "staff_incident_photos";

/** The catalogue in the office's own order, which is what the dropdown shows. */
const DEPARTMENTS = {
  engineering: "City Engineering Office",
  water: "Water District",
  health: "City Health Office",
};

/**
 * All three tables answered, so one call drives every read the dossier makes.
 * The reads whose query shape is asserted below do not care what comes back,
 * only that they fired.
 *
 * This stays local while `createTableFetch` does not: it names this module's
 * three tables and this file's canned rows, so there is nothing in it two
 * dossiers could share.
 */
function createFullDossierFetch() {
  return createTableFetch({
    [INCIDENTS]: [CANNED_INCIDENT_ROW],
    [EVENTS]: [CANNED_EVENT_ROW],
    [PHOTOS]: [CANNED_PHOTO_ROW],
  });
}

/**
 * The catalogs module is mocked rather than driven through the recording
 * fetch: `getLabels` is cache()-wrapped, so it cannot take a `db` seam. See
 * ADR-0001 on the cache rule, and ADR-0003 on why one file using two mechanisms
 * is forced here rather than untidy.
 *
 * ⚠️ Known blind spot. The dropdown's ordering runs from `public_departments`'
 * `sort_order`, through the label map's insertion order, to the pairs the
 * dossier returns. Mocking the reader means this test hands itself its own
 * ordered map, so the database's half of that chain is unreachable from here.
 * What is asserted below is our half — that an ordered map comes back as pairs
 * in that same order — which pins the real risk that we sort or reshape it. The
 * view's sort order is the database's guarantee and no test in this repository
 * can see it.
 */
function stubDepartments(departments: Record<string, string> = DEPARTMENTS) {
  return vi.spyOn(catalogs, "getLabels").mockResolvedValue(departments);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getIncidentDossier", () => {
  it("returns nothing when the incident does not exist or is not visible", async () => {
    stubDepartments();
    const { fetch } = createTableFetch({});

    expect(await getIncidentDossier(INCIDENT_ID, createTestClient(fetch))).toBeNull();
  });

  it("does not fire the other three reads when there is nothing to show", async () => {
    const getLabels = stubDepartments();
    const { fetch, requests } = createTableFetch({});

    await getIncidentDossier(INCIDENT_ID, createTestClient(fetch));

    expect(requests.map((request) => request.table)).toEqual([INCIDENTS]);
    expect(getLabels).not.toHaveBeenCalled();
  });

  it("carries the incident, its whole history and its confirmed uploads", async () => {
    stubDepartments();
    const { fetch, requests } = createFullDossierFetch();

    const dossier = await getIncidentDossier(INCIDENT_ID, createTestClient(fetch));

    expect(requests.map((request) => request.table).sort()).toEqual(
      [INCIDENTS, EVENTS, PHOTOS].sort(),
    );
    expect(dossier?.incident.reference_number).toBe("INC-2026-000123");
    expect(dossier?.events).toHaveLength(1);
    expect(dossier?.events[0].actor_name).toBe("Ana Reyes");
    expect(dossier?.photos).toHaveLength(1);
    expect(dossier?.photos[0].kind).toBe("before");
  });

  it("resolves the suggested and assigned department codes to catalogue labels", async () => {
    stubDepartments();
    const { fetch } = createTableFetch({ [INCIDENTS]: [CANNED_INCIDENT_ROW] });

    const dossier = await getIncidentDossier(INCIDENT_ID, createTestClient(fetch));

    expect(dossier?.suggestedDepartmentLabel).toBe("Water District");
    expect(dossier?.assignedDepartmentLabel).toBe("City Engineering Office");
  });

  /**
   * Flat, and the labels named separately. Folding them onto the incident would
   * put a hand-resolved label beside `type_label`, which the view resolves — the
   * same thing to read and not the same thing at all. Two members the route
   * needs are absent on purpose: the staff user answers "who is looking", and
   * the at-risk threshold is a fact about the office's configuration that the
   * Queue screen also owns.
   */
  it("names the labels beside the incident rather than folding them onto it", async () => {
    stubDepartments();
    const { fetch } = createTableFetch({ [INCIDENTS]: [CANNED_INCIDENT_ROW] });

    const dossier = await getIncidentDossier(INCIDENT_ID, createTestClient(fetch));

    expect(Object.keys(dossier!).sort()).toEqual([
      "assignedDepartmentLabel",
      "departmentOptions",
      "events",
      "incident",
      "photos",
      "suggestedDepartmentLabel",
    ]);
    expect(dossier!.incident).not.toHaveProperty("assignedDepartmentLabel");
  });

  /**
   * Resolution is ours, presentation is the caller's. A null code has nothing
   * to resolve, so it stays null and the route supplies "None suggested" and
   * "Not yet routed" — one screen's copy, the same line that kept byte
   * formatting out of Yellow Card's dossier.
   */
  it("reports an unrouted incident as null rather than as the screen's copy", async () => {
    stubDepartments();
    const { fetch } = createTableFetch({
      [INCIDENTS]: [
        {
          ...CANNED_INCIDENT_ROW,
          suggested_department_code: null,
          assigned_department_code: null,
        },
      ],
    });

    const dossier = await getIncidentDossier(INCIDENT_ID, createTestClient(fetch));

    expect(dossier?.suggestedDepartmentLabel).toBeNull();
    expect(dossier?.assignedDepartmentLabel).toBeNull();
  });

  /** Resolution is ours, presentation is the caller's. */
  it("returns the raw byte count for the caller to format", async () => {
    stubDepartments();
    const { fetch } = createTableFetch({
      [INCIDENTS]: [CANNED_INCIDENT_ROW],
      [PHOTOS]: [CANNED_PHOTO_ROW],
    });

    const dossier = await getIncidentDossier(INCIDENT_ID, createTestClient(fetch));

    expect(dossier?.photos[0].size_bytes).toBe(512_000);
  });

  /**
   * Two ordinary first states, not failures: a report nothing has happened to
   * yet, and one with no photo attached. The timeline and the evidence strip
   * render their own empty states.
   */
  it("reports no events and no photos as empty rather than as missing", async () => {
    stubDepartments();
    const { fetch } = createTableFetch({ [INCIDENTS]: [CANNED_INCIDENT_ROW] });

    const dossier = await getIncidentDossier(INCIDENT_ID, createTestClient(fetch));

    expect(dossier?.events).toEqual([]);
    expect(dossier?.photos).toEqual([]);
  });

  it("falls back to the raw code when the catalogue has no label for it", async () => {
    stubDepartments({ water: "Water District" });
    const { fetch } = createTableFetch({
      [INCIDENTS]: [{ ...CANNED_INCIDENT_ROW, assigned_department_code: "sanitation" }],
    });

    const dossier = await getIncidentDossier(INCIDENT_ID, createTestClient(fetch));

    expect(dossier?.assignedDepartmentLabel).toBe("sanitation");
  });

  /**
   * getLabels swallows its own read failure and returns an empty map, so a
   * catalogue the officer cannot reach degrades to the raw code by the same
   * route a missing entry does. An unreachable lookup table must not fail the
   * page, and a blank field would hide that the incident is routed at all.
   */
  it("falls back to the raw code when the catalogue read failed", async () => {
    stubDepartments({});
    const { fetch } = createTableFetch({ [INCIDENTS]: [CANNED_INCIDENT_ROW] });

    const dossier = await getIncidentDossier(INCIDENT_ID, createTestClient(fetch));

    expect(dossier?.suggestedDepartmentLabel).toBe("water");
    expect(dossier?.assignedDepartmentLabel).toBe("engineering");
    expect(dossier?.departmentOptions).toEqual([]);
  });

  /**
   * Our half of the ordering chain — see the blind spot noted on
   * `stubDepartments`. The pairs must come back in the order the catalogue gave
   * them, so that a future refactor cannot silently sort the dropdown.
   */
  it("keeps the departments in the order the catalogue gave them", async () => {
    stubDepartments();
    const { fetch } = createTableFetch({ [INCIDENTS]: [CANNED_INCIDENT_ROW] });

    const dossier = await getIncidentDossier(INCIDENT_ID, createTestClient(fetch));

    expect(dossier?.departmentOptions).toEqual([
      ["engineering", "City Engineering Office"],
      ["water", "Water District"],
      ["health", "City Health Office"],
    ]);
  });

  /**
   * A failed read must not be mistaken for a missing incident: that renders a
   * 404 over a row that is sitting right there.
   */
  it("raises when the incident read fails rather than reporting nothing to show", async () => {
    stubDepartments();
    const { fetch } = createTableFetch({}, {
      table: INCIDENTS,
      message: "permission denied for view staff_incidents",
    });

    await expect(
      getIncidentDossier(INCIDENT_ID, createTestClient(fetch)),
    ).rejects.toThrow(/staff_incidents detail read failed: permission denied/);
  });

  /**
   * Reported as an empty history, a reopened incident reads as one nothing has
   * ever happened to — on the screen a supervisor uses to work out why it came
   * back.
   */
  it("raises when the event read fails rather than showing an empty history", async () => {
    stubDepartments();
    const { fetch } = createTableFetch({ [INCIDENTS]: [CANNED_INCIDENT_ROW] }, {
      table: EVENTS,
      message: "permission denied for view staff_incident_events",
    });

    await expect(
      getIncidentDossier(INCIDENT_ID, createTestClient(fetch)),
    ).rejects.toThrow(/staff_incident_events read failed: permission denied/);
  });

  /**
   * Partial degradation is rejected, as ADR-0003 decided for documents — and
   * the evidence count already on the incident row makes it stronger here, not
   * weaker. An empty strip prints the affirmative sentence "this report was
   * verified, but no photo is attached", a false statement about evidence on
   * the screen where evidence decides whether the report is real, while the
   * count two cards above it says otherwise.
   */
  it("raises when the photo read fails rather than rendering an empty strip", async () => {
    stubDepartments();
    const { fetch } = createTableFetch({ [INCIDENTS]: [CANNED_INCIDENT_ROW] }, {
      table: PHOTOS,
      message: "permission denied for view staff_incident_photos",
    });

    await expect(
      getIncidentDossier(INCIDENT_ID, createTestClient(fetch)),
    ).rejects.toThrow(/staff_incident_photos read failed: permission denied/);
  });
});

// ---------------------------------------------------------------------------
// The three composed reads. Private to this module, so their query shapes are
// asserted through the dossier — the only way in that is left. None of these
// was asserted at all before: all three built their own client, so no wire test
// could see them.
// ---------------------------------------------------------------------------

describe("getIncidentDossier — the incident read", () => {
  it("reads the staff_incidents view", async () => {
    stubDepartments();
    const { fetch, requests } = createFullDossierFetch();

    await getIncidentDossier(INCIDENT_ID, createTestClient(fetch));

    requestTo(requests, INCIDENTS);
  });

  /**
   * The detail screen shows every field the desk uses to triage, so a refactor
   * must not quietly drop one. This list was derived by concatenation until
   * now, which is why it had no assertion — adding a column here is meant to
   * cost something: it sends the author back to verify the name against the
   * live view first.
   */
  it("selects the exact column list", async () => {
    stubDepartments();
    const { fetch, requests } = createFullDossierFetch();

    await getIncidentDossier(INCIDENT_ID, createTestClient(fetch));

    expect(columnsOf(requestTo(requests, INCIDENTS))).toEqual([
      "id",
      "reference_number",
      "type_label",
      "incident_level",
      "status",
      "closure_reason",
      "is_verified",
      "barangay_name",
      "submitted_at",
      "sla_armed_at",
      "sla_due_at",
      "resolved_at",
      "closed_at",
      "incident_type_code",
      "category_code",
      "description",
      "address",
      "barangay_code",
      "is_anonymous",
      "verified_at",
      "suggested_department_code",
      "assigned_department_code",
      "assigned_responder_id",
      "assigned_responder_name",
      "routed_at",
      "sla_target_hours",
      "reopened_count",
      "reporter_first_name",
      "reporter_phone",
      "photo_count",
      "duplicate_of",
      "original_reference",
    ]);
  });

  it("filters by the requested id", async () => {
    stubDepartments();
    const { fetch, requests } = createFullDossierFetch();

    await getIncidentDossier(INCIDENT_ID, createTestClient(fetch));

    expect(requestTo(requests, INCIDENTS).filters["id"]).toEqual([`eq.${INCIDENT_ID}`]);
  });

  /**
   * There is deliberately no "asks for a single row" assertion here, and the
   * absence is the finding rather than an omission. `maybeSingle()` sets no
   * header and no query parameter — it is a client-side flag that collapses the
   * array PostgREST returns — so the request this read sends is
   * indistinguishable on the wire from one that asked for a list. Yellow Card's
   * dossier test pins `limit` only on the read that calls `.limit(1)`
   * explicitly, and its own `maybeSingle()`-only read has no such assertion for
   * the same reason. What the id filter above pins is the whole of what the
   * seam can see.
   */

  it("maps the canned row through the row mapper", async () => {
    stubDepartments();
    const { fetch } = createFullDossierFetch();

    const dossier = await getIncidentDossier(INCIDENT_ID, createTestClient(fetch));

    expect(dossier?.incident).toMatchObject({
      id: INCIDENT_ID,
      reference_number: "INC-2026-000123",
      address: "Del Pilar St.",
      sla_target_hours: 24,
      reopened_count: 0,
      photo_count: 2,
      assigned_responder_name: null,
    });
  });
});

describe("getIncidentDossier — the event read", () => {
  it("reads the staff_incident_events view", async () => {
    stubDepartments();
    const { fetch, requests } = createFullDossierFetch();

    await getIncidentDossier(INCIDENT_ID, createTestClient(fetch));

    requestTo(requests, EVENTS);
  });

  it("selects the exact column list", async () => {
    stubDepartments();
    const { fetch, requests } = createFullDossierFetch();

    await getIncidentDossier(INCIDENT_ID, createTestClient(fetch));

    expect(columnsOf(requestTo(requests, EVENTS))).toEqual([
      "id",
      "event_type",
      "actor_role",
      "actor_name",
      "note",
      "cycle_number",
      "created_at",
    ]);
  });

  it("filters by incident_id", async () => {
    stubDepartments();
    const { fetch, requests } = createFullDossierFetch();

    await getIncidentDossier(INCIDENT_ID, createTestClient(fetch));

    expect(requestTo(requests, EVENTS).filters["incident_id"]).toEqual([
      `eq.${INCIDENT_ID}`,
    ]);
  });

  /**
   * Oldest first — the order it happened in, which is the order the timeline
   * reads in. Ordered the other way, a reopened incident's cycles run
   * backwards.
   */
  it("orders by created_at ascending", async () => {
    stubDepartments();
    const { fetch, requests } = createFullDossierFetch();

    await getIncidentDossier(INCIDENT_ID, createTestClient(fetch));

    expect(requestTo(requests, EVENTS).order).toBe("created_at.asc");
  });

  /**
   * An incident reopened twice has perhaps thirty events, and truncating a
   * history is worse than a long page. The absent limit is the decision.
   */
  it("does not limit the history", async () => {
    stubDepartments();
    const { fetch, requests } = createFullDossierFetch();

    await getIncidentDossier(INCIDENT_ID, createTestClient(fetch));

    expect(requestTo(requests, EVENTS).limit).toBeNull();
  });

  it("maps the canned row through the row mapper", async () => {
    stubDepartments();
    const { fetch } = createFullDossierFetch();

    const dossier = await getIncidentDossier(INCIDENT_ID, createTestClient(fetch));

    expect(dossier?.events).toEqual([
      {
        id: "event-1",
        event_type: "routed",
        actor_role: "staff",
        actor_name: "Ana Reyes",
        note: "Sent to Engineering — this is a drainage job, not a supply one.",
        cycle_number: 1,
        created_at: "2026-08-01T03:10:00.000000+00:00",
      },
    ]);
  });
});

describe("getIncidentDossier — the photo read", () => {
  it("reads the staff_incident_photos view", async () => {
    stubDepartments();
    const { fetch, requests } = createFullDossierFetch();

    await getIncidentDossier(INCIDENT_ID, createTestClient(fetch));

    requestTo(requests, PHOTOS);
  });

  it("selects the exact column list", async () => {
    stubDepartments();
    const { fetch, requests } = createFullDossierFetch();

    await getIncidentDossier(INCIDENT_ID, createTestClient(fetch));

    expect(columnsOf(requestTo(requests, PHOTOS))).toEqual([
      "id",
      "kind",
      "cycle_number",
      "mime_type",
      "size_bytes",
      "uploaded_at",
      "uploaded_by_name",
    ]);
  });

  it("filters by incident_id", async () => {
    stubDepartments();
    const { fetch, requests } = createFullDossierFetch();

    await getIncidentDossier(INCIDENT_ID, createTestClient(fetch));

    expect(requestTo(requests, PHOTOS).filters["incident_id"]).toEqual([
      `eq.${INCIDENT_ID}`,
    ]);
  });

  /** Oldest first, so the strip reads in the order the evidence arrived. */
  it("orders by uploaded_at ascending", async () => {
    stubDepartments();
    const { fetch, requests } = createFullDossierFetch();

    await getIncidentDossier(INCIDENT_ID, createTestClient(fetch));

    expect(requestTo(requests, PHOTOS).order).toBe("uploaded_at.asc");
  });

  it("maps the canned row through the row mapper", async () => {
    stubDepartments();
    const { fetch } = createFullDossierFetch();

    const dossier = await getIncidentDossier(INCIDENT_ID, createTestClient(fetch));

    expect(dossier?.photos).toEqual([
      {
        id: "photo-1",
        kind: "before",
        cycle_number: 1,
        mime_type: "image/jpeg",
        size_bytes: 512_000,
        uploaded_at: "2026-08-01T02:38:11.000000+00:00",
        uploaded_by_name: "Linda",
      },
    ]);
  });
});
