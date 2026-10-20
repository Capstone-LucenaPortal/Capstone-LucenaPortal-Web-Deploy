import type { AnnouncementInput } from "../types";

export type AnnouncementErrors = Partial<
  Record<"title" | "body" | "categoryCode" | "startAt" | "endAt", string>
>;

/**
 * Validate an editor payload. Same rules for Save draft and Publish: title,
 * body and a category are required, and any end date needs a start it falls
 * after. The category rule mirrors `create_post`, whose `p_category_code` has
 * no default — a null would be rejected by the database, not silently accepted.
 */
export function validateAnnouncement(
  input: AnnouncementInput,
): AnnouncementErrors {
  const errors: AnnouncementErrors = {};

  if (!input.title.trim()) {
    errors.title = "Title is required.";
  }
  if (!input.body.trim()) {
    errors.body = "Body is required.";
  }
  if (!input.categoryCode) errors.categoryCode = "Choose a category.";

  if (input.endAt) {
    if (!input.startAt) {
      errors.endAt = "Set a start date before an end date.";
    } else if (new Date(input.endAt).getTime() <= new Date(input.startAt).getTime()) {
      errors.endAt = "End must be after the start.";
    }
  }

  return errors;
}
