import { createClient } from "@/shared/supabase/client";
import { rows } from "@/portals/super-staff/lib/supabase/select";
import type { ContactMessage, ContactStatus } from "../types";

// One line — see the plan's global constraints.
const COLUMNS =
  "id, name, email, message, status, handled_by_name, handled_at, created_at";

type MessageRow = {
  id: string | null;
  name: string | null;
  email: string | null;
  message: string | null;
  status: string | null;
  handled_by_name: string | null;
  handled_at: string | null;
  created_at: string | null;
};

/** The check constraint allows exactly these three. A value the portal has not
 *  been taught about surfaces as "new" rather than crashing the inbox. */
function toStatus(value: string | null): ContactStatus {
  switch (value) {
    case "read":
    case "archived":
      return value;
    default:
      return "new";
  }
}

function toMessage(row: MessageRow): ContactMessage | null {
  if (!row.id || !row.created_at) return null;
  return {
    id: row.id,
    name: row.name ?? "Anonymous",
    email: row.email ?? "",
    message: row.message ?? "",
    status: toStatus(row.status),
    handledByName: row.handled_by_name,
    handledAt: row.handled_at,
    createdAt: row.created_at,
  };
}

/** Every contact message the caller may see. The view self-scopes — do not filter. */
export async function listContactMessages(): Promise<ContactMessage[]> {
  const data = await rows(
    createClient()
      .from("super_contact_messages")
      .select(COLUMNS)
      .order("created_at", { ascending: false }),
  );

  return data.map(toMessage).filter((m): m is ContactMessage => m !== null);
}
