import type { Database } from "@/shared/supabase/types";

/**
 * The responder's slice of the shared incidents contract — as the DATABASE
 * names it, not as this app once did.
 *
 * Decision C1. The alternative was a mapping layer at the boundary: four files
 * instead of twenty, and a hand-written translation with no test of its own
 * that fails by producing an undefined field rather than by throwing. Adopting
 * the names makes the generated type file load-bearing, which is what it is
 * for — the DB repo regenerates it at every layer and propagates it here
 * specifically so this portal notices schema drift.
 *
 * WHAT MOVED, so a reader of an old branch is not lost:
 *   reference_no  -> reference_number      title       -> (gone; see C2)
 *   level         -> incident_level        category    -> category_label
 *   verified      -> is_verified           barangay    -> barangay_name
 *   created_at    -> submitted_at          reporter_name -> reporter_first_name
 *   department_id -> assigned_department_code
 *   photo_count   -> before_photo_count + after_photo_count
 *   version       -> (gone; first-claim-wins is a conditional UPDATE, not an
 *                     optimistic lock — see claim_incident)
 *   status "assigned" -> "in_pool", and "open" joins the responder's slice
 *
 * There is NO title column and there will not be one: the citizen submission
 * RPC takes a type code and free text, so nothing could write one. The card
 * headline is `type_label` with `description` promoted onto the card (C2).
 *
 * ⚠️ EVERY COLUMN ON A VIEW ROW IS NULLABLE in the generated types — Postgres
 * does not carry a base table's NOT NULL through a view, so the codegen cannot
 * know. Components guard rather than assert; the few places that genuinely
 * cannot proceed without an id say so at the point of use.
 */
type Views = Database["public"]["Views"];
type Fns = Database["public"]["Functions"];

export type Incident = Views["responder_incidents"]["Row"];
export type IncidentEvent = Views["responder_incident_events"]["Row"];
export type IncidentPhoto = Views["responder_incident_photos"]["Row"];
export type HistoryRow = Views["responder_history"]["Row"];
export type ResponderNotification = Views["my_notifications"]["Row"];
export type IncidentConfig = Views["public_incident_config"]["Row"];

export type IncidentLevel = Database["public"]["Enums"]["incident_level"];
export type IncidentStatus = Database["public"]["Enums"]["incident_status"];
export type PhotoKind = Database["public"]["Enums"]["photo_kind"];
export type IncidentEventType =
  Database["public"]["Enums"]["incident_event_type"];

/**
 * The three stage taps, as the enum members the RPC accepts. `ProgressStage`
 * used to be "en_route" | "on_site" | "working"; the database calls them
 * stage_*, and advance_incident_stage is typed on the enum, so the app sends
 * the enum rather than translating.
 */
export type ProgressStage = Extract<
  IncidentEventType,
  "stage_en_route" | "stage_on_site" | "stage_working"
>;

/** claim_incident's five outcomes. Returned as a one-row table. */
export type ClaimResult = Fns["claim_incident"]["Returns"][number];
