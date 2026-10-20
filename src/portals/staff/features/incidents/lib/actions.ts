"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/shared/supabase/server";
import {
  toActionFailure,
  type ActionResult,
  type ErrorMessages,
} from "@/portals/staff/lib/supabase/errors";
import type { Database } from "@/shared/supabase/types";
import { readAwaitingTriageCount } from "./queries";
import { toRefusalFailure } from "./refusal-errors";
import type { IncidentLevel, RefusalReason } from "../types";

/**
 * The generated argument signatures, used to keep the objects below honest.
 * .rpc() checks each object against the function's signature again at the call.
 */
type RouteArgs = Database["public"]["Functions"]["route_incident"]["Args"];
type ForceReleaseArgs =
  Database["public"]["Functions"]["force_release_incident"]["Args"];
type RefuseArgs = Database["public"]["Functions"]["refuse_incident"]["Args"];

const ROUTE_MESSAGES: ErrorMessages = {
  forbidden:
    "You do not have permission to route incidents. Ask an administrator to check your module assignment.",
  conflict:
    "This incident can no longer be routed — it may have been resolved, or the department may have been retired. The page has been refreshed.",
  missing: "This incident no longer exists. The page has been refreshed.",
  fallback: "The routing could not be saved. Please try again.",
};

const RELEASE_MESSAGES: ErrorMessages = {
  forbidden:
    "Only a supervisor can force-release a claim. Ask an administrator if you should have this.",
  conflict:
    "This claim is no longer held — the responder may have released it already. The page has been refreshed.",
  missing: "This incident no longer exists. The page has been refreshed.",
  fallback: "The claim could not be released. Please try again.",
};

function revalidate(incidentId: string) {
  revalidatePath(`/staff/incidents/${incidentId}`);
  revalidatePath("/staff/incidents");
  revalidatePath("/staff/dashboard");
}

/**
 * How many reports are awaiting triage right now.
 *
 * Polled by the queue's activity bar to decide whether anything has arrived
 * since the page rendered. A shell: it builds the real client, hands it to
 * ./queries.ts and adds nothing of its own — no parameter included, so this
 * endpoint reads exactly one set and cannot be told to read another by an
 * argument arriving over the wire. Returns null rather than throwing on
 * failure; see readAwaitingTriageCount for why.
 */
export async function countAwaitingTriage(): Promise<number | null> {
  return readAwaitingTriageCount(await createClient());
}

/**
 * Assign an incident to a department, optionally correcting its level.
 *
 * The RPC does the rest: it stamps `routed_at` on the first call only, moves
 * `open` to `in_pool`, and writes `routed` or `rerouted` depending on whether
 * this incident has been routed before. Nothing here reimplements any of it.
 *
 * Note that the RPC would also accept an `in_progress` incident. The UI does not
 * offer that — see `isRoutable` and decision 7.
 */
export async function routeIncident({
  incidentId,
  departmentCode,
  level,
  note,
}: {
  incidentId: string;
  departmentCode: string;
  level?: IncidentLevel;
  note?: string;
}): Promise<ActionResult> {
  const supabase = await createClient();

  const args: RouteArgs = {
    p_incident_id: incidentId,
    p_department_code: departmentCode,
    // Both are optional in the RPC and blank is treated as absent. Let it
    // enforce that rather than duplicating the rule.
    p_level: level,
    p_note: note?.trim() || undefined,
  };

  const { error } = await supabase.rpc("route_incident", args);

  if (error) {
    const failure = toActionFailure(error, ROUTE_MESSAGES);
    // A guard violation or a missing row almost always means this page is
    // showing state a colleague has already changed. Re-read so the operator
    // sees what is actually true.
    if (failure.stale) revalidate(incidentId);
    return failure;
  }

  revalidate(incidentId);
  return { ok: true };
}

/**
 * Take a claim off a responder and return the incident to the department pool.
 *
 * The RPC requires `is_supervisor`, a non-blank reason, and an incident that is
 * actually `in_progress` with someone attached. All three are enforced there;
 * the UI only avoids offering the button when it is obviously pointless.
 */
export async function forceReleaseIncident({
  incidentId,
  reason,
}: {
  incidentId: string;
  reason: string;
}): Promise<ActionResult> {
  const supabase = await createClient();

  const args: ForceReleaseArgs = {
    p_incident_id: incidentId,
    p_reason: reason.trim(),
  };

  const { error } = await supabase.rpc("force_release_incident", args);

  if (error) {
    const failure = toActionFailure(error, RELEASE_MESSAGES);
    if (failure.stale) revalidate(incidentId);
    return failure;
  }

  revalidate(incidentId);
  return { ok: true };
}

/**
 * Close an `open` or `in_pool` report as Invalid, or as a Duplicate of the
 * Original named by its reference number. Final: nothing reopens a Refusal.
 *
 * The RPC trims, checks the 500-character cap, resolves the Original, writes
 * the `closed` event and sends the Citizen's notice naming the caller. Nothing
 * here reimplements any of it, and the reason and reference go over as typed.
 *
 * `originalReference` is null, never undefined, on an Invalid refusal: the RPC
 * has no argument defaults, so an omitted one is a PGRST202 rather than a
 * silent null (DB what-not-to-do.md §10).
 */
export async function refuseIncident({
  incidentId,
  closureReason,
  reason,
  originalReference,
}: {
  incidentId: string;
  closureReason: RefusalReason;
  reason: string;
  originalReference: string | null;
}): Promise<ActionResult> {
  const supabase = await createClient();

  // The generated Args type `p_original_reference` as `string`: the codegen
  // cannot see which SQL parameters accept NULL. A plain `as`, not `as unknown
  // as`, so a renamed or retyped parameter is still a compile error.
  const args = {
    p_incident_id: incidentId,
    p_closure_reason: closureReason,
    p_reason: reason,
    p_original_reference: originalReference,
  } as RefuseArgs;

  const { error } = await supabase.rpc("refuse_incident", args);

  if (error) {
    // Not toActionFailure: this RPC's 22023 and PT404 each cover several
    // situations, most of them about what was typed. See ./refusal-errors.ts.
    const failure = toRefusalFailure(error);
    if (failure.stale) revalidate(incidentId);
    return failure;
  }

  revalidate(incidentId);
  return { ok: true };
}
