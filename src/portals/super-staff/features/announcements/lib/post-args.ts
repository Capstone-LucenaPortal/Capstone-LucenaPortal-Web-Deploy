import type { AnnouncementInput } from "../types";

/** `create_post` always creates a draft. Publishing is `set_post_published`,
 *  because status is derived from `is_published` + the date window, never set. */
export function toCreatePostArgs(input: AnnouncementInput) {
  return {
    p_content_type: input.contentType,
    p_title: input.title,
    p_body: input.body,
    p_category_code: input.categoryCode,
    p_image_path: input.imagePath,
    p_start_at: input.startAt,
    p_end_at: input.endAt,
    p_is_published: false,
  };
}

/**
 * `update_post` declares seven parameters and NO defaults, so every one is sent
 * on every call. `p_image_path` comes from the input, which the editor seeds
 * from the loaded row — so an untouched image round-trips unchanged and sending
 * null never silently clears a live one.
 *
 * There is no `p_is_published` — publication is `set_post_published`.
 *
 * Takes the id, not the loaded row: nothing else about `existing` was ever
 * read here, and asking for the whole record to reach one field made this look
 * like an update-against-a-baseline when it is a full replace.
 */
export function toUpdatePostArgs(id: string, input: AnnouncementInput) {
  return {
    p_id: id,
    p_title: input.title,
    p_body: input.body,
    p_category_code: input.categoryCode,
    p_image_path: input.imagePath,
    p_start_at: input.startAt,
    p_end_at: input.endAt,
  };
}
