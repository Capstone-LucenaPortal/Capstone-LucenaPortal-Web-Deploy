import { cache } from "react";
import { createClient } from "@/shared/supabase/server";
import { getCurrentResponder } from "@/portals/responder/features/auth/lib/session";
import type {
  HistoryRow,
  Incident,
  IncidentConfig,
  IncidentEvent,
  IncidentPhoto,
  PhotoKind,
  ResponderNotification,
} from "@/portals/responder/features/incidents/types";

/**
 * SEAM 1 — the only module in this feature that talks to Supabase.
 *
 * Pages and server actions import from here and from nowhere else, and tests
 * fake THIS module. The rejected alternative was faking the Supabase client
 * itself, which means asserting on query-builder chains: tests that break when
 * a column is reordered and pass when the view is wrong.
 *
 * ── EVERY READ THROWS ON A POSTGRES ERROR ────────────────────────────────────
 * It does not swallow one into an empty array. A failed GATE returns HTTP 200
 * with zero rows and is indistinguishable from an empty pool -- that silence is
 * unavoidable and is what scripts/smoke.ts exists to catch. A genuine ERROR is
 * distinguishable, and turning it into [] would throw away the one signal this
 * architecture still gives us. Do not add a `?? []` to any of these.
 *
 * ── COLUMN LISTS AND THE ROW CASTS ───────────────────────────────────────────
 * Column lists are checked against the generated types: a column the view does
 * not have is a compile error. That holds only while each list is ONE string
 * literal on ONE source line -- split it with `+` or build it with `.join()`
 * and TypeScript widens it to `string`, which postgrest-js cannot parse, so
 * the row type degrades to GenericStringError[]. .rpc() arguments are checked
 * against the function's signature the same way.
 *
 * The results are still cast to hand-declared row types, which narrow the
 * views' nullable columns. Compile-time only.
 *
 * ── `.eq()` ON A VIEW READ: DEPARTMENT IS NOT IDENTITY ───────────────────────
 * responder_incidents self-scopes to the caller's DEPARTMENT through
 * staff_accounts, and carries NO assigned_responder_id predicate of its own.
 * responder_incident_events and responder_history self-scope to "incidents I
 * have an event on". Re-filtering on what a view already guarantees would hide
 * a bug and, if a column name ever changes, would silently return nothing --
 * so the pool and the report pane add nothing.
 *
 * ⚠️ BUT "the ticket I hold" IS NOT A DEPARTMENT QUESTION. getHeldTicket must
 * filter on the responder itself; the earlier wording of this block read
 * "self-scopes to the caller" and that is how it came to return a colleague's
 * ticket to every responder in the department. See getHeldTicket below.
 */

/** Every column the pool card, the report pane and the held ticket render. */
const INCIDENT_COLUMNS = "id, reference_number, incident_type_code, type_label, category_label, incident_level, status, is_verified, description, address, barangay_name, assigned_department_code, assigned_responder_id, sla_due_at, sla_armed_at, submitted_at, pooled_at, reporter_first_name, reporter_phone, before_photo_count, after_photo_count, cycle_number";

function fail(what: string, error: { message: string } | null): never {
  throw new Error(`${what}: ${error?.message ?? "unknown error"}`);
}

/**
 * The department pool: unclaimed incidents routed to my department.
 *
 * Filtered on status here rather than in the view, deliberately -- the view is
 * shared by the pool, the held ticket and the report pane, and l21's header
 * records why it is not called `incident_pool_view`. `open` is NOT included: a
 * rejected incident is unrouted and belongs to staff triage, not to any pool.
 *
 * NOT sorted here. Decision C7 keeps verified-first/level ordering in the app:
 * it is presentation over a small result set, and putting it in the view would
 * make the ordering a schema change.
 */
export const getPool = cache(async (): Promise<Incident[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("responder_incidents")
    .select(INCIDENT_COLUMNS)
    .eq("status", "in_pool");

  if (error) fail("getPool", error);
  return (data as unknown as Incident[]) ?? [];
});

/**
 * The one ticket I am holding, or null.
 *
 * ⚠️ BOTH FILTERS ARE LOAD-BEARING, AND THE RESPONDER ONE IS THE SUBTLE ONE.
 * responder_incidents is scoped by DEPARTMENT, so `in_progress` alone matches
 * whatever any colleague is working on. That is not a cosmetic slip:
 *   - /my-ticket renders a colleague's ticket, with its action buttons live
 *     (the RPCs then refuse the write with "is not your ticket", which
 *     noticeFor() reports as force_released -- a misleading banner for a tap
 *     that should never have been offered);
 *   - `gated={held !== null}` disables Claim on every card, so ONE claim
 *     freezes the whole department's pool;
 *   - and maybeSingle() takes two rows the moment two colleagues hold tickets at
 *     once, which fail() would turn into a 500 for every responder in the
 *     department -- the layout calls this, so it takes every page down with it.
 *     That last one follows from the query shape and was never observed: the
 *     fix landed first. See #6, which records it as inferred.
 *
 * The one-active-claim rule (one_active_claim_per_responder, l10a) is a partial
 * unique index per RESPONDER, not per department -- so it is the responder
 * filter, not the index, that makes "at most one row" true here. maybeSingle()
 * stays: with both filters applied, two rows would mean that index had been
 * broken, and a loud failure is the right answer to that.
 */
export const getHeldTicket = cache(async (): Promise<Incident | null> => {
  const supabase = await createClient();

  // staff_accounts.id IS auth.users.id on this project, so the responder's id is
  // what assigned_responder_id holds. getCurrentResponder() rather than the raw
  // profile row: it already owns the "no admitted profile" case and throws a
  // message that says how it can happen, so the policy for that failure stays in
  // ONE place. It reads through cache()d getMyProfileRow, which the portal layout
  // has already called this pass, so this costs no extra round trip.
  const me = await getCurrentResponder();

  const { data, error } = await supabase
    .from("responder_incidents")
    .select(INCIDENT_COLUMNS)
    .eq("status", "in_progress")
    .eq("assigned_responder_id", me.id)
    .maybeSingle();

  if (error) fail("getHeldTicket", error);
  return (data as unknown as Incident | null) ?? null;
});

/** One incident by id, for the report pane. Null when it has left my scope. */
export const getIncident = cache(
  async (id: string): Promise<Incident | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("responder_incidents")
      .select(INCIDENT_COLUMNS)
      .eq("id", id)
      .maybeSingle();

    if (error) fail("getIncident", error);
    return (data as unknown as Incident | null) ?? null;
  },
);

/**
 * The incident's timeline.
 *
 * Scoped by the view to incidents I have an event on, so this returns [] for a
 * pool incident I have never touched -- which is correct, and is why the held
 * ticket is the only screen that renders it.
 */
export const getTimeline = cache(
  async (incidentId: string): Promise<IncidentEvent[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("responder_incident_events")
      .select(
        "id, incident_id, event_type, actor_role, actor_name, note, cycle_number, created_at",
      )
      .eq("incident_id", incidentId)
      .order("created_at", { ascending: true });

    if (error) fail("getTimeline", error);
    return (data as unknown as IncidentEvent[]) ?? [];
  },
);

/**
 * Photo ROWS -- ids, not paths.
 *
 * No storage_path is projected by the view, by design (l34/l52/l53): a raw path
 * would be a second, unaudited route to the object. The caller passes an id to
 * getPhotoUrl, which re-checks entitlement on every request.
 *
 * This view admits an incident in my department even when I have no event on it
 * -- that is what makes "see the citizen's photos before you claim" work.
 */
export const getPhotos = cache(
  async (incidentId: string, kind?: PhotoKind): Promise<IncidentPhoto[]> => {
    const supabase = await createClient();
    let query = supabase
      .from("responder_incident_photos")
      .select(
        "id, incident_id, kind, cycle_number, mime_type, size_bytes, uploaded_at, uploaded_by_name",
      )
      .eq("incident_id", incidentId)
      .order("uploaded_at", { ascending: true });

    if (kind) query = query.eq("kind", kind);

    const { data, error } = await query;
    if (error) fail("getPhotos", error);
    return (data as unknown as IncidentPhoto[]) ?? [];
  },
);

/**
 * A short-lived signed URL for one photo.
 *
 * Two hops, both of which re-check entitlement: get_document_path applies the
 * same predicate as the bucket's SELECT policy, and createSignedUrl then goes
 * through that policy. A caller who guesses an id gets zero rows from the first
 * and never reaches the second.
 *
 * Returns null rather than throwing on a miss: an unreadable photo should render
 * as a missing tile, not take down the page around it.
 */
export async function getPhotoUrl(photoId: string): Promise<string | null> {
  const supabase = await createClient();

  const { data: paths, error } = await supabase.rpc("get_document_path", {
    p_kind: "incident_photo",
    p_row_id: photoId,
  });
  if (error) fail("getPhotoUrl", error);

  const row = (paths as unknown as { bucket: string; path: string }[])?.[0];
  if (!row) return null;

  const { data: signed } = await supabase.storage
    .from(row.bucket)
    .createSignedUrl(row.path, 60);

  return signed?.signedUrl ?? null;
}

/**
 * Everything I have worked, resolved or handed back.
 *
 * Its own view, not a widening of responder_incidents: the pool view is
 * department-scoped, live and forward-looking; history is personal,
 * outcome-scoped, and outlives a department assignment.
 */
export const getHistory = cache(async (): Promise<HistoryRow[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("responder_history")
    .select(
      "id, reference_number, incident_type_code, type_label, category_label, incident_level, status, closure_reason, is_verified, description, address, barangay_name, assigned_department_code, sla_armed_at, sla_due_at, sla_target_hours, submitted_at, resolved_at, closed_at, reopened_count, my_last_outcome, my_last_outcome_at",
    )
    .order("my_last_outcome_at", { ascending: false, nullsFirst: false });

  if (error) fail("getHistory", error);
  return (data as unknown as HistoryRow[]) ?? [];
});

/**
 * The inbox. my_notifications (l24) scopes on recipient_user_id, not citizen_id,
 * and its own header says it "is the inbox, not a citizen-only surface" -- a
 * responder's staff_accounts.id IS their auth.users.id, so no responder-specific
 * view was ever needed and l56 did not add one.
 */
export const getNotifications = cache(
  async (): Promise<ResponderNotification[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("my_notifications")
      .select(
        "id, module_code, record_id, event_code, channel, status, title, body, created_at, sent_at, read_at",
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) fail("getNotifications", error);
    return (data as unknown as ResponderNotification[]) ?? [];
  },
);

/** The nav badge. head+count, so no rows cross the wire. */
export const getUnreadCount = cache(async (): Promise<number> => {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("my_notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);

  if (error) fail("getUnreadCount", error);
  return count ?? 0;
});

/**
 * Limits the database will actually enforce.
 *
 * ⚠️ ONLY max_photos_per_cycle is readable. public_incident_config has NINE
 * columns and at_risk_threshold_pct is not among them -- l23 omitted it on
 * purpose ("an internal ops threshold ... not a public promise") because that
 * view is granted to `anon`, and assert_l23 check 4b fails the DB suite if
 * anyone adds it. It lives on staff_incident_config (l53), which is gated
 * `is_active_staff('staff')`, and roles are exact, so a responder reading it
 * gets []. See tone.ts.
 *
 * The 140-character note cap and the 20-notes-per-cycle cap are hardcoded inside
 * add_incident_note (l22) and are in no config table at all.
 */
export const getIncidentConfig = cache(async (): Promise<IncidentConfig> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("public_incident_config")
    .select("*")
    .maybeSingle();

  if (error) fail("getIncidentConfig", error);
  if (!data) fail("getIncidentConfig", { message: "no config row" });
  return data as unknown as IncidentConfig;
});
