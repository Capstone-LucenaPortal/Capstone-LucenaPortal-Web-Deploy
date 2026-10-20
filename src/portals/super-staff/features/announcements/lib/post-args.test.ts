import { describe, expect, it } from "vitest";
import { toCreatePostArgs, toUpdatePostArgs } from "./post-args";
import type { Announcement, AnnouncementInput } from "../types";

const input: AnnouncementInput = {
  contentType: "announcement",
  title: "Water interruption",
  body: "Barangay 1 to 4, 8am to 5pm.",
  categoryCode: "advisory",
  imagePath: "post/abc-123.jpg",
  startAt: "2026-08-14T08:00:00+08:00",
  endAt: null,
};

const existing: Announcement = {
  id: "11111111-1111-1111-1111-111111111111",
  contentType: "announcement",
  title: "Old title",
  body: "Old body",
  categoryCode: "advisory",
  categoryLabel: "Advisory",
  colorHex: "#0B5FFF",
  imagePath: "post/abc-123.jpg",
  isPublished: true,
  status: "Published",
  startAt: "2026-08-01T08:00:00+08:00",
  endAt: null,
  createdBy: "Ana Reyes",
  createdAt: "2026-08-01T07:00:00+08:00",
  lastEditedAt: "2026-08-02T07:00:00+08:00",
};

describe("toCreatePostArgs", () => {
  it("builds exactly the arguments create_post declares", () => {
    expect(toCreatePostArgs(input)).toEqual({
      p_content_type: "announcement",
      p_title: "Water interruption",
      p_body: "Barangay 1 to 4, 8am to 5pm.",
      p_category_code: "advisory",
      p_image_path: "post/abc-123.jpg",
      p_start_at: "2026-08-14T08:00:00+08:00",
      p_end_at: null,
      p_is_published: false,
    });
  });

  it("carries an image uploaded before the row existed — the path is uuid-keyed, not row-keyed", () => {
    expect(toCreatePostArgs(input).p_image_path).toBe("post/abc-123.jpg");
    expect(toCreatePostArgs({ ...input, imagePath: null }).p_image_path).toBeNull();
  });

  it("always creates a draft — publication is a separate call", () => {
    expect(toCreatePostArgs(input).p_is_published).toBe(false);
  });
});

describe("toUpdatePostArgs", () => {
  // The image round-trip invariant is NOT asserted here. Since the builders
  // take `input`, any assertion in this file reduces to `input.imagePath ===
  // input.imagePath` — true by construction, unable to fail. It is held in
  // `form-value.test.ts`, which runs the whole chain from the loaded row.
  it("builds exactly the arguments update_post declares", () => {
    expect(toUpdatePostArgs(existing.id, input)).toEqual({
      p_id: "11111111-1111-1111-1111-111111111111",
      p_title: "Water interruption",
      p_body: "Barangay 1 to 4, 8am to 5pm.",
      p_category_code: "advisory",
      p_image_path: "post/abc-123.jpg",
      p_start_at: "2026-08-14T08:00:00+08:00",
      p_end_at: null,
    });
  });

  it("never sends a published flag — update_post does not accept one", () => {
    expect(toUpdatePostArgs(existing.id, input)).not.toHaveProperty(
      "p_is_published",
    );
  });

  it("sends an explicit null for a cleared category", () => {
    const cleared = { ...input, categoryCode: null };
    expect(toUpdatePostArgs(existing.id, cleared).p_category_code).toBeNull();
  });
});
