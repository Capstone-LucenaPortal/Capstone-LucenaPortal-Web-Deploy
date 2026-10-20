import { createClient } from "@/shared/supabase/client";
import { maybeRow, rows } from "@/portals/super-staff/lib/supabase/select";
import type { CityEvent } from "../types";

// One line — see the plan's global constraints.
const COLUMNS =
  "id, title, description, category_code, category_label, color_hex, location_text, start_at, end_at, image_path, is_published, created_by_name, created_at, updated_at";

type EventRow = {
  id: string | null;
  title: string | null;
  description: string | null;
  category_code: string | null;
  category_label: string | null;
  color_hex: string | null;
  location_text: string | null;
  start_at: string | null;
  end_at: string | null;
  image_path: string | null;
  is_published: boolean | null;
  created_by_name: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function toEvent(row: EventRow): CityEvent | null {
  if (!row.id || !row.start_at || !row.created_at) return null;
  return {
    id: row.id,
    title: row.title ?? "",
    description: row.description,
    categoryCode: row.category_code,
    categoryLabel: row.category_label,
    colorHex: row.color_hex,
    locationText: row.location_text,
    startAt: row.start_at,
    endAt: row.end_at,
    imagePath: row.image_path,
    isPublished: row.is_published ?? false,
    createdBy: row.created_by_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
  };
}

/** Every event the caller may see. The view self-scopes — do not filter. */
export async function listEvents(): Promise<CityEvent[]> {
  const data = await rows(
    createClient()
      .from("super_events")
      .select(COLUMNS)
      .order("start_at", { ascending: false }),
  );

  return data.map(toEvent).filter((e): e is CityEvent => e !== null);
}

export async function getEvent(id: string): Promise<CityEvent | null> {
  const row = await maybeRow(
    createClient().from("super_events").select(COLUMNS).eq("id", id).maybeSingle(),
  );

  return row ? toEvent(row) : null;
}
