"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/shared/supabase/server";
import { routeForOutcome } from "@/portals/responder/features/incidents/lib/claim-outcome";
import { noticeFor } from "@/portals/responder/features/incidents/lib/notice";
import type { ClaimResult, ProgressStage } from "@/portals/responder/features/incidents/types";

/**
 * Every write is one RPC call from a server action. The base tables are revoked,
 * so there is no other way in -- and every RPC re-checks the caller
 * independently, which is why none of these actions re-authorises anything.
 *
 * On failure: noticeFor() maps the message to a code and RE-THROWS anything it
 * does not recognise. A catch-all here would turn a broken RPC into a friendly
 * banner and hide it for a week.
 *
 * ⚠️ `redirect()` throws by design, so it must never sit inside a try/catch that
 * swallows. Each call below is the end of its function.
 */

async function rpc<T>(
  name: string,
  args: Record<string, unknown>,
): Promise<{ data: T | null; notice: string | null }> {
  const supabase = await createClient();
  // `name` is any string here, not a known function name, so .rpc() cannot be
  // typed through this helper; callers pass the arguments the RPC declares.
  const { data, error } = await supabase.rpc(name as never, args as never);
  if (error) return { data: null, notice: noticeFor(error) };
  return { data: data as T, notice: null };
}

export async function claimIncident(formData: FormData): Promise<void> {
  const { data, notice } = await rpc<ClaimResult[]>("claim_incident", {
    p_incident_id: String(formData.get("incidentId") ?? ""),
  });
  if (notice) redirect(`/responder/pool?notice=${notice}`);

  // `returns table` arrives as an array. Exactly one row, always.
  const result = data?.[0];
  if (!result) redirect("/responder/pool?notice=gone");

  redirect(routeForOutcome(result));
}

export async function advanceStageAction(formData: FormData): Promise<void> {
  const stage = String(formData.get("stage") ?? "") as ProgressStage;
  const { notice } = await rpc("advance_incident_stage", {
    p_incident_id: String(formData.get("incidentId") ?? ""),
    p_stage: stage,
  });
  redirect(notice ? `/responder/my-ticket?notice=${notice}` : "/responder/my-ticket");
}

export async function postNote(formData: FormData): Promise<void> {
  const { notice } = await rpc("add_incident_note", {
    p_incident_id: String(formData.get("incidentId") ?? ""),
    p_note: String(formData.get("note") ?? ""),
  });
  redirect(notice ? `/responder/my-ticket?notice=${notice}` : "/responder/my-ticket");
}

export async function resolveTicket(formData: FormData): Promise<void> {
  // p_note is OPTIONAL on resolve_incident and typed `string`, not `string |
  // null` -- so it is omitted rather than passed as null.
  const { notice } = await rpc("resolve_incident", {
    p_incident_id: String(formData.get("incidentId") ?? ""),
  });
  // The gate holds and, in the same tap, hands over the fix: the sheet is a
  // consequence, not a scolding.
  if (notice === "needs_photo") {
    redirect("/responder/my-ticket?sheet=photo&notice=needs_photo");
  }
  if (notice) redirect(`/responder/my-ticket?notice=${notice}`);

  redirect("/responder/pool?resolved=1");
}

export async function releaseTicket(formData: FormData): Promise<void> {
  // The reason is mandatory on BOTH release and reject (ruled 2026-08-12): the
  // event row is the only record that reaches the next responder.
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) redirect("/responder/my-ticket?sheet=release&notice=reason_required");

  const { notice } = await rpc("release_incident", {
    p_incident_id: String(formData.get("incidentId") ?? ""),
    p_reason: reason,
  });
  redirect(notice ? `/responder/my-ticket?notice=${notice}` : "/responder/pool");
}

export async function rejectTicket(formData: FormData): Promise<void> {
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) redirect("/responder/my-ticket?sheet=reject&notice=reason_required");

  const { notice } = await rpc("reject_incident", {
    p_incident_id: String(formData.get("incidentId") ?? ""),
    p_reason: reason,
  });
  redirect(notice ? `/responder/my-ticket?notice=${notice}` : "/responder/pool");
}

/** Decision F3: no polling and no Realtime — an explicit refresh instead. */
export async function refreshPool(): Promise<void> {
  revalidatePath("/responder/pool");
  redirect("/responder/pool");
}

export async function markNotificationRead(formData: FormData): Promise<void> {
  await rpc("mark_notification_read", {
    p_notification_id: String(formData.get("notificationId") ?? ""),
  });
  revalidatePath("/responder/notifications");
  redirect("/responder/notifications");
}

/**
 * Step 1 of 3 of the after-photo upload (decision E2). Writes the reservation
 * row and hands back the path the browser is allowed to PUT to.
 *
 * Returns rather than redirects: the caller is the one client component in this
 * feature and needs the path. It carries no bytes, so it is nowhere near the
 * 1 MB Server Action body cap.
 */
export async function requestAfterPhoto(
  incidentId: string,
  ext: string,
): Promise<
  | { ok: true; rowId: string; bucket: string; path: string }
  | { ok: false; notice: string }
> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_incident_photo_upload", {
    p_incident_id: incidentId,
    p_kind: "after",
    p_ext: ext,
  });
  if (error) return { ok: false, notice: noticeFor(error) };

  const row = (
    data as unknown as {
      row_id: string;
      bucket: string;
      storage_path: string;
    }[]
  )?.[0];
  if (!row) return { ok: false, notice: "upload_failed" };

  return {
    ok: true,
    rowId: row.row_id,
    bucket: row.bucket,
    path: row.storage_path,
  };
}

/**
 * Step 3 of 3. THIS is the audit event -- not the bytes.
 *
 * confirm_upload re-checks that the row is the caller's own UNCONFIRMED
 * reservation AND that the object actually landed in the bucket, so a client
 * that skips step 2 cannot fake an attachment.
 *
 * ⚠️ `p_kind` is the string 'incident_photo' HERE and the photo_kind enum
 * 'after' in requestAfterPhoto. Two parameters with the same name and different
 * domains, in two RPCs called three lines apart. Getting them the wrong way
 * round returns 22023 from one and a "no reservation" P0002 from the other.
 */
export async function confirmAfterPhoto(
  rowId: string,
  sizeBytes: number,
  mimeType: string,
): Promise<{ ok: boolean; notice: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_upload", {
    p_kind: "incident_photo",
    p_row_id: rowId,
    p_size_bytes: sizeBytes,
    p_mime_type: mimeType,
  });
  if (error) return { ok: false, notice: "upload_failed" };

  revalidatePath("/responder/my-ticket");
  return { ok: true, notice: null };
}

/**
 * A Phone alert's tap opens the incident's pool detail, and opening it marks
 * the matching Inbox entry read (ADR 0001, decision 7) — so does opening it
 * any other way: the responder has seen the work either way.
 *
 * By incident, not by notification id: the alert carries no notification id
 * on purpose, because the push row it came from is not the Inbox row
 * (send-push-queue delivery.ts). my_notifications is in_app only (l64), so
 * nothing here can touch a push row.
 *
 * Called from an effect, never a form, so it returns rather than redirects;
 * the layout is revalidated only when something changed, for the nav badge.
 * A failure THROWS, like every unrecognised error in this file: the server
 * logs it, and the caller drops it, because the entry merely stays unread.
 */
export async function markArrivalRead(incidentId: string): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("my_notifications")
    .select("id")
    .eq("record_id", incidentId)
    .eq("event_code", "incident_pool_arrival")
    .is("read_at", null);
  if (error) throw new Error(`markArrivalRead: ${error.message}`);

  const ids = (data ?? []).flatMap((row) => (row.id ? [row.id] : []));
  if (ids.length === 0) return;

  const results = await Promise.all(
    ids.map((id) => supabase.rpc("mark_notification_read", { p_notification_id: id })),
  );
  revalidatePath("/responder", "layout");

  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(`markArrivalRead: ${failed.error.message}`);
}
