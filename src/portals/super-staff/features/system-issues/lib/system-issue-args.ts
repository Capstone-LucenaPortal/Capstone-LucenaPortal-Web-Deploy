import type { FnArgs } from "@/portals/super-staff/lib/supabase/rpc";
import type { CloseReason, IssueCategory, IssuePriority } from "../types";

// Like the maintenance pair, the System issue RPCs have NO argument defaults
// (l128 header §2.4): an omitted name matches no signature and is a loud
// PGRST202 404. Every builder names every argument, every time.

/** The database trims the same characters (l128): spaces, tabs, CR and LF. */
const trimmed = (note: string) => note.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, "");

/** One triage change: the panel's two selects change one field at a time. */
export type TriageChange = { priority: IssuePriority } | { category: IssueCategory };

/**
 * Null means "leave unchanged" to triage_system_issue (l128 §4f), so the other
 * field is sent as an explicit null: a priority can never be cleared back to
 * not prioritised.
 */
export const toTriageSystemIssueArgs = (
  id: string,
  change: TriageChange,
): FnArgs<"triage_system_issue"> => ({
  p_id: id,
  p_priority: "priority" in change ? change.priority : null,
  p_category: "category" in change ? change.category : null,
});

export const toStartSystemIssueArgs = (id: string): FnArgs<"start_system_issue"> => ({
  p_id: id,
});

/** The note is the one the reporter reads. */
export const toResolveSystemIssueArgs = (
  id: string,
  note: string,
): FnArgs<"resolve_system_issue"> => ({
  p_id: id,
  p_note: trimmed(note),
});

export const toCloseSystemIssueArgs = (
  id: string,
  reason: CloseReason,
  note: string,
): FnArgs<"close_system_issue"> => ({
  p_id: id,
  p_reason: reason,
  p_note: trimmed(note),
});

/** What Super-staff type from a helpdesk email: who wrote, about which part, and what they said. */
export type OnBehalfReport = { email: string; category: IssueCategory; description: string };

/** The email is never matched to a Citizen (l128 §4e): it is stored as typed, trimmed. */
export const toLogSystemIssueOnBehalfArgs = ({
  email,
  category,
  description,
}: OnBehalfReport): FnArgs<"log_system_issue_on_behalf"> => ({
  p_email: trimmed(email),
  p_category: category,
  p_description: trimmed(description),
});
