import { createClient } from "@/shared/supabase/client";
import { maybeRow, rows } from "@/portals/super-staff/lib/supabase/select";
import type {
  Announcement,
  AnnouncementStatus,
  ContentType,
  PostCategoryOption,
} from "../types";

// One line — see the plan's global constraints.
const COLUMNS =
  "id, content_type, title, body, category_code, category_label, color_hex, image_path, is_published, start_at, end_at, status, created_by_name, created_at, updated_at";

type ContentRow = {
  id: string | null;
  content_type: ContentType | null;
  title: string | null;
  body: string | null;
  category_code: string | null;
  category_label: string | null;
  color_hex: string | null;
  image_path: string | null;
  is_published: boolean | null;
  start_at: string | null;
  end_at: string | null;
  status: string | null;
  created_by_name: string | null;
  created_at: string | null;
  updated_at: string | null;
};

/** `post_status()` returns exactly these four. Anything else is a schema change
 *  the portal has not been taught about — surface it as Draft rather than crash. */
function toStatus(value: string | null): AnnouncementStatus {
  switch (value) {
    case "Scheduled":
    case "Published":
    case "Expired":
      return value;
    default:
      return "Draft";
  }
}

function toAnnouncement(row: ContentRow): Announcement | null {
  if (!row.id || !row.created_at) return null;
  return {
    id: row.id,
    contentType: row.content_type ?? "announcement",
    title: row.title ?? "",
    body: row.body ?? "",
    categoryCode: row.category_code,
    categoryLabel: row.category_label,
    colorHex: row.color_hex,
    imagePath: row.image_path,
    isPublished: row.is_published ?? false,
    status: toStatus(row.status),
    startAt: row.start_at,
    endAt: row.end_at,
    createdBy: row.created_by_name,
    createdAt: row.created_at,
    lastEditedAt: row.updated_at ?? row.created_at,
  };
}

export async function listAnnouncements(): Promise<Announcement[]> {
  const data = await rows(
    createClient()
      .from("super_content")
      .select(COLUMNS)
      .order("created_at", { ascending: false }),
  );

  return data.map(toAnnouncement).filter((a): a is Announcement => a !== null);
}

export async function getAnnouncement(id: string): Promise<Announcement | null> {
  const row = await maybeRow(
    createClient().from("super_content").select(COLUMNS).eq("id", id).maybeSingle(),
  );

  return row ? toAnnouncement(row) : null;
}

/** Categories and their colours are owned by the database, not the portal. */
export async function listPostCategories(): Promise<PostCategoryOption[]> {
  const data = await rows(
    createClient()
      .from("public_post_categories")
      .select("code, label, color_hex")
      .order("sort_order", { ascending: true }),
  );

  // `public_post_categories` is a definer view, so PostgREST types every column
  // nullable — including the two that identify the category. The cast this
  // replaces asserted `code: string` and quietly handed a null through to a
  // <select> value. A category with no code cannot be chosen, so drop it.
  return data
    .map((c) =>
      c.code === null || c.label === null
        ? null
        : { code: c.code, label: c.label, colorHex: c.color_hex },
    )
    .filter((c): c is PostCategoryOption => c !== null);
}
