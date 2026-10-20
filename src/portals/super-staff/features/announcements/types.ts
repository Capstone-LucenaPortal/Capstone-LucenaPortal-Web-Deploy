// Domain types for the announcements feature. Mirrors `super_content`.
//
// Status is DERIVED by the database (`post_status(is_published, start_at,
// end_at)`) and never stored. The portal reads it and never sends it.
export type AnnouncementStatus = "Draft" | "Scheduled" | "Published" | "Expired";

/** The `content_type` enum. Both kinds live in `platform_posts`. */
export type ContentType = "announcement" | "news";

export type Announcement = {
  id: string;
  contentType: ContentType;
  title: string;
  body: string;
  categoryCode: string | null;
  categoryLabel: string | null;
  colorHex: string | null;
  /** Set on first upload and then STABLE — a replacement reuses the same path,
   *  which is what keeps update_post from logging a spurious "Image changed". */
  imagePath: string | null;
  isPublished: boolean;
  status: AnnouncementStatus;
  startAt: string | null; // ISO
  endAt: string | null; // ISO; null = open-ended
  createdBy: string | null;
  createdAt: string; // ISO
  lastEditedAt: string; // ISO
};

/** The editable fields. Publication is a separate RPC and is not in here. */
export type AnnouncementInput = {
  contentType: ContentType;
  title: string;
  body: string;
  categoryCode: string | null;
  /** The uploaded path, or the row's existing one round-tripped unchanged. */
  imagePath: string | null;
  startAt: string | null;
  endAt: string | null;
};

/**
 * One choice in the category picker on a post or event editor.
 *
 * ⚠️ NOT `PostCategory` in `configuration/lib/catalog-types` — that is the full
 * catalog ROW, carrying `sortOrder` and `isActive`, read from `super_post_categories`
 * (every row, inactive included) so the catalog editor can retire one. This is
 * read from `public_post_categories` and is only what an author picks between:
 * a code, a label, and the colour the list renders its swatch from. Sharing the
 * name made two different reads of two different views look interchangeable.
 */
export type PostCategoryOption = {
  code: string;
  label: string;
  colorHex: string | null;
};
