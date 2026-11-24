"use server";

/**
 * The Yellow Card module's server actions, and nothing else.
 *
 * These are shells: they build the real client, hand it to ./review.ts, and own
 * revalidation. Everything with a rule in it lives there — see the note at the
 * top of that file for why the seam moved rather than opening one here.
 *
 * Revalidation is framework glue and is deliberately untested.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/shared/supabase/server";
import type { ActionResult } from "@/portals/staff/lib/supabase/errors";
import {
  readAwaitingReviewCount,
  writeReviewDecision,
  writeRevocation,
  type ReviewDecisionInput,
  type RevocationInput,
} from "./review";

/**
 * How many applications are awaiting review right now.
 *
 * Polled by the queue's activity bar to decide whether anything has arrived
 * since the page rendered. Returns null rather than throwing on failure — see
 * readAwaitingReviewCount for why.
 */
export async function countAwaitingReview(): Promise<number | null> {
  return readAwaitingReviewCount(await createClient());
}

/** Records a staff member's decision on one application. */
export async function reviewApplication(
  input: ReviewDecisionInput,
): Promise<ActionResult> {
  const result = await writeReviewDecision(await createClient(), input);

  // A stale failure — a guard violation or a missing row — almost always means
  // this page is showing state a colleague has already changed, so it is
  // re-read on the same two paths a success is. Any other failure leaves the
  // screen alone: revalidating would re-render the message out from under
  // whoever is reading it.
  if (result.ok || result.stale) {
    revalidatePath(`/staff/yellow-card/${input.applicationId}`);
    revalidatePath("/staff/yellow-card");
  }

  // The dashboard's counts only move when a decision actually lands.
  if (result.ok) revalidatePath("/staff/dashboard");

  return result;
}

/**
 * Revokes the card an approved application issued. The application itself
 * stays approved, so only its own page changes: the queue and the dashboard
 * count applications, not cards.
 */
export async function revokeCard(
  input: RevocationInput & { applicationId: string },
): Promise<ActionResult> {
  const result = await writeRevocation(await createClient(), input);

  // Re-read on a stale failure too, for the same reason reviewApplication
  // does: a colleague revoked first, or a Correction replaced the card.
  if (result.ok || result.stale) {
    revalidatePath(`/staff/yellow-card/${input.applicationId}`);
  }

  return result;
}
