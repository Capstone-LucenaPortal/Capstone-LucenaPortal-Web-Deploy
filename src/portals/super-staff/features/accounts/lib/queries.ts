import type { TimelineItem } from "@/portals/super-staff/components/ui/history-timeline";
import { createClient } from "@/shared/supabase/client";
import type { Account } from "../types";
import { toAccountRow } from "./account-row";

// Base tables are revoked from `authenticated` (PL-12): reads go through the
// super_* views, which self-scope. Never add .eq() filters for permission —
// the view already did it.
//
// Keep this on one line. Split it with `+` and TypeScript widens it to `string`,
// which postgrest-js cannot parse into a row type — the result degrades to
// GenericStringError[] and every downstream cast breaks.
const COLUMNS =
  "id, full_name, email, role, modules, is_supervisor, status, department_code, department_label, phone, employee_id, created_at, last_change_at, invited_at, last_sign_in_at";

export async function listAccounts(): Promise<Account[]> {
  const { data, error } = await createClient()
    .from("super_accounts")
    .select(COLUMNS)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? [])
    .map(toAccountRow)
    .filter((a): a is Account => a !== null);
}

export async function getAccount(id: string): Promise<Account | null> {
  const { data, error } = await createClient()
    .from("super_accounts")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return toAccountRow(data);
}

export async function countActiveSuperStaff(): Promise<number> {
  const { count, error } = await createClient()
    .from("super_accounts")
    .select("id", { count: "exact", head: true })
    .eq("role", "super_staff")
    .eq("status", "active");

  if (error) throw new Error(error.message);
  return count ?? 0;
}

/**
 * Account history: audit entries targeting this account id. Matched on
 * target_id, not on the display name — a rename must not orphan the history.
 */
export async function getAccountHistory(id: string): Promise<TimelineItem[]> {
  const { data, error } = await createClient()
    .from("super_audit_log")
    .select("id, occurred_at, actor_name, change, detail")
    .eq("target_id", id)
    .order("occurred_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? [])
    .filter((e) => e.id && e.occurred_at)
    .map((e) => ({
      id: e.id!,
      timestamp: e.occurred_at!,
      summary: e.detail ? `${e.change ?? ""} — ${e.detail}` : (e.change ?? ""),
      actor: e.actor_name ?? "System",
    }));
}
