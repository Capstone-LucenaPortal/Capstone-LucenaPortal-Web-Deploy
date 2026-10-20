import type { EventInput } from "../types";

/** `create_event` defaults `p_is_published` to false, but the editor always has
 *  an explicit toggle value, so send it rather than relying on the default. */
export function toCreateEventArgs(input: EventInput) {
  return {
    p_title: input.title,
    p_location_text: input.locationText,
    p_start_at: input.startAt,
    p_description: input.description,
    p_category_code: input.categoryCode,
    p_end_at: input.endAt,
    p_image_path: input.imagePath,
    p_is_published: input.isPublished,
  };
}

/** `update_event` declares nine parameters and no defaults. `p_image_path`
 *  comes from the input, which the editor seeds from the loaded row, so an
 *  untouched image round-trips unchanged and null never silently clears it.
 *
 * Takes the id, not the loaded row: nothing else about `existing` was ever
 * read here, and asking for the whole record to reach one field made this look
 * like an update-against-a-baseline when it is a full replace.
 */
export function toUpdateEventArgs(id: string, input: EventInput) {
  return {
    p_id: id,
    p_title: input.title,
    p_location_text: input.locationText,
    p_start_at: input.startAt,
    p_description: input.description,
    p_category_code: input.categoryCode,
    p_end_at: input.endAt,
    p_image_path: input.imagePath,
    p_is_published: input.isPublished,
  };
}
