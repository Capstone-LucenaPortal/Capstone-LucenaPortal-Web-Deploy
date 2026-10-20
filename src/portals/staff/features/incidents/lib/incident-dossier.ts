import { createClient, type Db } from "@/shared/supabase/server";
import { getLabels } from "@/portals/staff/lib/supabase/catalogs";
import { toEvent, toIncident, toPhoto } from "./row-mapper";
import type {
  StaffIncidentEventRow,
  StaffIncidentPhotoRow,
  StaffIncidentRow,
} from "./row-mapper";
import type { Incident, IncidentEvent, IncidentPhoto } from "../types";

/**
 * Column lists are checked against the generated types: a column
 * the view does not have is a compile error. That holds only while each list
 * is ONE string literal on ONE source line — split it with `+` or build it
 * with `.join()` and TypeScript widens it to `string`, which postgrest-js
 * cannot parse, so the row type degrades to GenericStringError[].
 *
 * The results are still cast to their row types below. All three were verified
 * by live query against the sandbox on 2026-08-07. Do not add a column without
 * doing the same.
 *
 * The detail list is a superset of the queue's, and is now written out rather
 * than concatenated onto it: the two reads answer different screens' questions
 * and their column lists are owned by different modules, the same call
 * `./dashboard-card.ts` already makes against this view. Exporting the queue's
 * list to build this one would widen the read module's interface by exactly the
 * one export this work exists to remove.
 *
 * That unties a knot Yellow Card never had. The concatenation guaranteed the
 * detail select was a superset of the queue's, and nothing guarantees it now: a
 * column the view gains for both screens has to be added in both places, and no
 * test notices if it is added to only one. The offset is that this list is
 * asserted exactly by its own test for the first time — it had no wire test at
 * all while it was derived. See ADR-0004.
 */
const DETAIL_COLUMNS = "id, reference_number, type_label, incident_level, status, closure_reason, is_verified, barangay_name, submitted_at, sla_armed_at, sla_due_at, resolved_at, closed_at, incident_type_code, category_code, description, address, barangay_code, is_anonymous, verified_at, suggested_department_code, assigned_department_code, assigned_responder_id, assigned_responder_name, routed_at, sla_target_hours, reopened_count, reporter_first_name, reporter_phone, photo_count, duplicate_of, original_reference";

/** Layer 53 views. */
const EVENT_COLUMNS = "id, event_type, actor_role, actor_name, note, cycle_number, created_at";

/** ⚠️ size_bytes — incident_photos does NOT use byte_size. */
const PHOTO_COLUMNS = "id, kind, cycle_number, mime_type, size_bytes, uploaded_at, uploaded_by_name";

/**
 * Everything the desk needs on screen about one incident.
 *
 * Named for the record rather than for the activity, diverging from Yellow
 * Card's `getReviewDossier` on purpose: that screen serves one decision by one
 * role, and this one serves five statuses and three different jobs — a triage
 * officer routing, a supervisor force-releasing, and anyone reading a closed
 * history. "Triage dossier" would be wrong for a closed incident. See ADR-0004.
 *
 * Flat, with the labels named beside the incident rather than folded onto it:
 * that object mirrors a database row and the row mapper owns its contract, so a
 * hand-resolved department label sitting next to the view-resolved `type_label`
 * would read as the same kind of thing and isn't.
 *
 * Data, not a view model. Resolving a code to a label is domain knowledge about
 * what the desk needs; the strings shown when there is no code at all — "None
 * suggested", "Not yet routed" — are one screen's copy and belong to the
 * caller.
 */
export interface IncidentDossier {
  incident: Incident;
  /** The whole history, oldest first. Empty, never absent. */
  events: IncidentEvent[];
  /** The confirmed uploads. Empty, never absent. */
  photos: IncidentPhoto[];
  /** Null when nothing has been suggested; the raw code when it has no label. */
  suggestedDepartmentLabel: string | null;
  /** Null when the incident is not routed yet; the raw code when it has no label. */
  assignedDepartmentLabel: string | null;
  /**
   * The departments this office routes to, as `[code, label]` pairs in
   * catalogue order — which is domain knowledge about what the desk needs, so
   * it is resolved here rather than by the screen that renders it. The
   * order-preservation mechanism is implementation and stays with it.
   */
  departmentOptions: [string, string][];
}

/**
 * Answers "what does the desk need on screen about this incident", so the
 * detail route does not have to know the read order, the concurrency shape,
 * which catalogue pairs with this screen, the catalogue's ordering mechanism,
 * or the fallback rule.
 *
 * Two-phase on purpose: the incident is read first and a nonexistent id returns
 * null without firing the other three reads.
 *
 * Two things the detail route needs are deliberately not here. The current
 * staff user is owned by the auth feature and answers "who is looking", not
 * "what is being looked at". The at-risk threshold is a third thing again — a
 * fact about the office's configuration rather than about this incident, and
 * the only candidate member shared with the Queue screen, so folding it in
 * would give the threshold two owners.
 *
 * This is the module's whole interface. The three reads below are private, and
 * stay private: an export is an export, and the next caller to import one will
 * not read the comment above it. See ADR-0003.
 */
export async function getIncidentDossier(
  id: string,
  db?: Db,
): Promise<IncidentDossier | null> {
  const incident = await readIncident(id, db);
  if (!incident) return null;

  const [events, photos, departments] = await Promise.all([
    readEvents(incident.id, db),
    readPhotos(incident.id, db),
    getLabels("public_departments"),
  ]);

  // A code with no catalogue entry falls back to the code itself, which is
  // legible; showing nothing would hide that the incident is routed at all.
  // This is also how a failed catalogue read degrades — getLabels swallows it
  // and returns an empty map. A null code is a different thing entirely: there
  // is nothing to resolve, and the copy for that case is the caller's.
  const label = (code: string | null) =>
    code ? (departments[code] ?? code) : null;

  return {
    incident,
    events,
    photos,
    suggestedDepartmentLabel: label(incident.suggested_department_code),
    assignedDepartmentLabel: label(incident.assigned_department_code),
    // public_departments is returned in sort_order, and Object.entries
    // preserves insertion order for string keys, so the pairs come back in the
    // order the office uses everywhere else.
    departmentOptions: Object.entries(departments) as [string, string][],
  };
}

/** Returns null when the id does not exist or is not visible to this staff member. */
async function readIncident(id: string, db?: Db): Promise<Incident | null> {
  const supabase = db ?? await createClient();
  const { data, error } = await supabase
    .from("staff_incidents")
    .select(DETAIL_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`staff_incidents detail read failed: ${error.message}`);
  }

  return toIncident(data as StaffIncidentRow | null);
}

/**
 * The whole history, oldest first — the order it happened in, which is the
 * order the timeline reads in. Not limited: an incident reopened twice has
 * perhaps thirty events, and truncating a history is worse than a long page.
 */
async function readEvents(
  incidentId: string,
  db?: Db,
): Promise<IncidentEvent[]> {
  const supabase = db ?? await createClient();
  const { data, error } = await supabase
    .from("staff_incident_events")
    .select(EVENT_COLUMNS)
    .eq("incident_id", incidentId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`staff_incident_events read failed: ${error.message}`);
  }

  return ((data as StaffIncidentEventRow[] | null) ?? []).map(toEvent);
}

/**
 * The confirmed uploads. The view already excludes reservations that were never
 * completed, so nothing here has to filter for that — which is exactly why l53
 * had to fix `photo_count` at the same time, or the strip and the count would
 * disagree.
 */
async function readPhotos(
  incidentId: string,
  db?: Db,
): Promise<IncidentPhoto[]> {
  const supabase = db ?? await createClient();
  const { data, error } = await supabase
    .from("staff_incident_photos")
    .select(PHOTO_COLUMNS)
    .eq("incident_id", incidentId)
    .order("uploaded_at", { ascending: true });

  if (error) {
    throw new Error(`staff_incident_photos read failed: ${error.message}`);
  }

  return ((data as StaffIncidentPhotoRow[] | null) ?? []).map(toPhoto);
}
