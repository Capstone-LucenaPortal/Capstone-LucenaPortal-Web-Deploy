/** Domain types for the public content slice (announcements, events, explore). */

/** A `public_events` row. Only `id`, `title` and `start_at` are guaranteed;
 * the LGU can save an event with nothing else filled in. */
export interface PublicEvent {
  id: string;
  title: string;
  description: string | null;
  location_text: string | null;
  category_code: string | null;
  category_label: string | null;
  color_hex: string | null;
  start_at: string;
  end_at: string | null;
  image_path: string | null;
}

export interface EventMonthGroup {
  /** `YYYY-MM`, stable across renders — what React keys on. */
  key: string;
  /** e.g. "September 2026". */
  label: string;
  events: PublicEvent[];
}

/**
 * A `public_posts` row — the announcements the SuperStaff editor publishes.
 *
 * `category_label` and `color_hex` are denormalised onto the view already, so
 * a list does not need to join against `public_post_categories`; that catalog
 * is only needed to render the full set of filter chips, including categories
 * with no published post yet.
 *
 * `body` is plain text. The SuperStaff editor validates non-empty plain text
 * with no markdown and no length cap, so it renders with `white-space:
 * pre-line` to keep the author's line breaks. It must NEVER go through
 * `dangerouslySetInnerHTML` — nothing sanitises it on the way in.
 */
export interface PublicPost {
  id: string;
  content_type: string;
  title: string;
  body: string | null;
  image_path: string | null;
  category_code: string | null;
  category_label: string | null;
  color_hex: string | null;
  published_at: string;
}

/** A `public_post_categories` row. `color_hex` is the authoritative swatch
 * colour — never re-map codes to colours in the page. */
export interface PublicPostCategory {
  code: string;
  label: string;
  color_hex: string | null;
  sort_order: number;
}
