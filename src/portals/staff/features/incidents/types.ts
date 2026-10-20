import type { Database } from "@/shared/supabase/types";

/**
 * Every one of these is a real PostgreSQL enum. Taking them from the generated
 * types means a value added in the database becomes a compile error here rather
 * than a row that silently renders blank. The mock's hand-written unions carried
 * two values the database has never had — `assigned` and `expired_unverified`.
 */
export type IncidentStatus = Database["public"]["Enums"]["incident_status"];
export type IncidentLevel = Database["public"]["Enums"]["incident_level"];
export type ClosureReason = Database["public"]["Enums"]["closure_reason"];
export type IncidentEventType =
  Database["public"]["Enums"]["incident_event_type"];
export type ActorRole = Database["public"]["Enums"]["actor_role"];
export type PhotoKind = Database["public"]["Enums"]["photo_kind"];

/** The two closure reasons a Refusal writes (l85); the other three are not Staff's to choose. */
export type RefusalReason = Extract<ClosureReason, "invalid" | "duplicate">;

/**
 * A department is a string code with a label from `public_departments`. The
 * mock's `DepartmentId` union hardcoded six of them; Super Staff can add a
 * seventh at runtime, at which point a union is a portal that breaks.
 */

/** What the queue table needs. Every field is required — row-mapper collapses the view's nullability. */
export interface IncidentQueueItem {
  id: string;
  reference_number: string;
  type_label: string;
  incident_level: IncidentLevel;
  status: IncidentStatus;
  closure_reason: ClosureReason | null;
  is_verified: boolean;
  barangay_name: string;
  submitted_at: string;
  sla_armed_at: string | null;
  sla_due_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  /**
   * The Original a Duplicate points at (l85). Both null on every other report.
   * The id builds the link; the reference is what the officer reads.
   */
  duplicate_of: string | null;
  original_reference: string | null;
}

/** Everything the detail page adds. */
export interface Incident extends IncidentQueueItem {
  incident_type_code: string;
  category_code: string | null;
  description: string;
  address: string;
  barangay_code: string;
  is_anonymous: boolean;
  verified_at: string | null;
  suggested_department_code: string | null;
  assigned_department_code: string | null;
  assigned_responder_id: string | null;
  assigned_responder_name: string | null;
  routed_at: string | null;
  sla_target_hours: number | null;
  reopened_count: number;
  /** First name, or the literal 'Anonymous'. Staff never sees a full legal name. */
  reporter_first_name: string;
  /** Null when the report is anonymous. */
  reporter_phone: string | null;
  photo_count: number;
}

/** A row of `staff_incident_events`. Not embedded on `Incident` — it is a separate read. */
export interface IncidentEvent {
  id: string;
  event_type: IncidentEventType;
  actor_role: ActorRole;
  actor_name: string;
  note: string | null;
  cycle_number: number;
  created_at: string;
}

/** A row of `staff_incident_photos`. `uploaded_at` is never null — the view filters it. */
export interface IncidentPhoto {
  id: string;
  kind: PhotoKind;
  cycle_number: number;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_at: string;
  uploaded_by_name: string;
}
