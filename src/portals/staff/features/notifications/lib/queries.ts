import { createClient, type Db } from "@/shared/supabase/server";
import type { Database } from "@/shared/supabase/types";
import type { YellowCardStatus } from "@/portals/staff/features/yellow-card/types";
import { applicationIdOf } from "./notice";
import type { StaffNotification } from "../types";

/**
 * The Notifications reads: the list and the bell's count.
 *
 * `my_notifications` (l24) scopes on recipient_user_id rather than citizen_id
 * and a staff member's staff_accounts.id IS their auth.users.id, so the view
 * the Citizen and Responder portals read serves Staff unchanged. No database
 * change came with this surface (SCRUM-236).
 *
 * Both reads take an optional client, the queue's pattern (ADR-0001): a test
 * hands in one whose fetch it records.
 */

/**
 * One string literal on one line, so postgrest-js checks it against the
 * generated types (see the note on QUEUE_COLUMNS in yellow-card/lib/queries.ts).
 */
const NOTICE_COLUMNS = "id, module_code, record_id, title, body, created_at, read_at";

type NoticeRow = Pick<
  Database["public"]["Views"]["my_notifications"]["Row"],
  "id" | "module_code" | "record_id" | "title" | "body" | "created_at" | "read_at"
>;

/**
 * Every notice, newest first, each carrying its application's current status.
 *
 * Every row, with no limit (SCRUM-236 "shows every notice"): the bell counts
 * all unread rows, so a capped list would leave the oldest unread ones counted
 * and unreachable. A Yellow Card application warns at most twice per Running
 * Period (l81), so the list grows slowly. PostgREST's own max-rows setting is
 * the ceiling; page this list before a staff member gets near it.
 *
 * Two reads, not a join: the status lives behind staff_yellow_card_queue's
 * module gate, and my_notifications is not a Yellow Card surface. The second
 * read is skipped when no notice names an application.
 */
export async function getNotifications(db?: Db): Promise<StaffNotification[]> {
  const supabase = db ?? await createClient();

  const { data, error } = await supabase
    .from("my_notifications")
    .select(NOTICE_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`my_notifications read failed: ${error.message}`);
  }

  // Every view column is nullable in the generated types; a row with no id
  // cannot be opened, so it is not a notice.
  const rows = ((data as NoticeRow[] | null) ?? []).filter(
    (row): row is NoticeRow & { id: string } => row.id !== null,
  );

  const statuses = await readApplicationStatuses(
    supabase,
    [...new Set(rows.flatMap((row) => applicationIdOf(row) ?? []))],
  );

  return rows.map((row) => {
    const applicationId = applicationIdOf(row);
    return {
      id: row.id,
      title: row.title ?? "",
      body: row.body,
      createdAt: row.created_at,
      readAt: row.read_at,
      applicationStatus:
        applicationId === null ? null : statuses.get(applicationId) ?? null,
    };
  });
}

async function readApplicationStatuses(
  supabase: Db,
  applicationIds: string[],
): Promise<Map<string, YellowCardStatus>> {
  if (applicationIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("staff_yellow_card_queue")
    .select("id, status")
    .in("id", applicationIds);

  if (error) {
    throw new Error(`staff_yellow_card_queue read failed: ${error.message}`);
  }

  return new Map(
    (data ?? []).flatMap((row) =>
      row.id && row.status ? [[row.id, row.status] as const] : [],
    ),
  );
}

/**
 * The bell's figure. head: true, so Postgres counts and no rows cross the wire.
 *
 * Returns null on failure rather than throwing, the readAwaitingReviewCount
 * precedent: the (portal) layout renders this on every Staff page, and one
 * failed badge read must not become an error page everywhere. Null, never
 * zero — zero would say "nothing needs you", which is the one thing a Deadline
 * Notice exists to never say by accident. The bell shows it as unknown.
 */
export async function getUnreadNotificationCount(db?: Db): Promise<number | null> {
  const supabase = db ?? await createClient();

  const { count, error } = await supabase
    .from("my_notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);

  if (error) return null;
  return count ?? 0;
}
