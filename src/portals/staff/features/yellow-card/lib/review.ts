/**
 * Reviewing a Yellow Card application: the decision write, and the count of
 * applications still waiting for one.
 *
 * This is everything behind the module's two server actions that has a rule in
 * it.
 *
 * Both take the client rather than constructing it, which is what lets a test
 * observe the request they build. They live here rather than in ./actions.ts
 * because that module is `"use server"`: every export there is a
 * network-reachable endpoint whose arguments are deserialised from the request,
 * so a client parameter there would widen the module's public surface — the
 * one database write included — for the benefit of a test. The shell in
 * actions.ts supplies the real client and owns revalidation.
 *
 * Unlike the reads in ./queries.ts, the client here is required rather than
 * optional: the shell is the only caller, and it always has one.
 *
 * See docs/adr/0001-supabase-recording-fetch-seam.md.
 */

import type { Db } from "@/shared/supabase/server";
import {
  toActionFailure,
  type ActionResult,
  type ErrorMessages,
} from "@/portals/staff/lib/supabase/errors";
import type { Database } from "@/shared/supabase/types";
import { REVIEWABLE_STATUSES } from "./status";
import type { YellowCardDecision } from "../types";

/**
 * How many applications are awaiting review right now.
 *
 * head: true means Postgres counts without shipping any rows, which is what
 * makes this cheap enough to run on a timer.
 *
 * Returns null rather than throwing on failure. This runs on an interval in
 * the background; a transient network blip must not surface as an error to
 * someone in the middle of reviewing an application. The caller keeps its last
 * known figure and tries again on the next tick.
 */
export async function readAwaitingReviewCount(db: Db): Promise<number | null> {
  const { count, error } = await db
    .from("staff_yellow_card_queue")
    .select("id", { count: "exact", head: true })
    .in("status", REVIEWABLE_STATUSES);

  if (error) return null;
  return count ?? 0;
}

/**
 * The generated argument signature, used to keep the object below honest.
 * .rpc() checks the object against the function's signature again at the call.
 */
type ReviewArgs =
  Database["public"]["Functions"]["review_yellow_card_application"]["Args"];

const MESSAGES: ErrorMessages = {
  forbidden:
    "You do not have permission to review Yellow Card applications. Ask an administrator to check your module assignment.",
  conflict:
    "This application is no longer awaiting review — someone may have decided it already. The page has been refreshed.",
  missing: "This application no longer exists. The page has been refreshed.",
  fallback: "The decision could not be saved. Please try again.",
};

export interface ReviewDecisionInput {
  applicationId: string;
  decision: YellowCardDecision;
  reason?: string;
}

/**
 * The single write in this module.
 *
 * Everything downstream of the status column — pausing and resuming the SLA
 * clock, stamping decided_at, minting the yellow card with its LC- reference
 * and verification token — is layer 12a's triggers reacting to this one RPC.
 * Nothing here reimplements any of it, and because it is one call it cannot
 * half-happen.
 */
export async function writeReviewDecision(
  db: Db,
  { applicationId, decision, reason }: ReviewDecisionInput,
): Promise<ActionResult> {
  const args: ReviewArgs = {
    p_application_id: applicationId,
    p_decision: decision,
    // The RPC treats blank and absent identically, and requires a reason for
    // revise and reject. Let it enforce that rather than duplicating the rule.
    p_reason: reason?.trim() || undefined,
  };

  const { error } = await db.rpc("review_yellow_card_application", args);

  return error ? toActionFailure(error, MESSAGES) : { ok: true };
}
