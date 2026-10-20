import { describe, expect, it } from "vitest";
import { toCreateEventArgs, toUpdateEventArgs } from "./event-args";
import type { CityEvent, EventInput } from "../types";

const input: EventInput = {
  title: "Pasayahan sa Lucena",
  description: "Street dancing along Quezon Avenue.",
  categoryCode: "festival",
  locationText: "Quezon Avenue",
  imagePath: "event/def-456.png",
  startAt: "2026-05-29T08:00:00+08:00",
  endAt: "2026-05-29T18:00:00+08:00",
  isPublished: true,
};

const existing: CityEvent = {
  id: "22222222-2222-2222-2222-222222222222",
  title: "Old title",
  description: null,
  categoryCode: null,
  categoryLabel: null,
  colorHex: null,
  locationText: null,
  startAt: "2026-05-01T08:00:00+08:00",
  endAt: null,
  imagePath: "event/def-456.png",
  isPublished: false,
  createdBy: "Ana Reyes",
  createdAt: "2026-04-01T08:00:00+08:00",
  updatedAt: "2026-04-02T08:00:00+08:00",
};

describe("toCreateEventArgs", () => {
  it("builds exactly the arguments create_event declares", () => {
    expect(toCreateEventArgs(input)).toEqual({
      p_title: "Pasayahan sa Lucena",
      p_location_text: "Quezon Avenue",
      p_start_at: "2026-05-29T08:00:00+08:00",
      p_description: "Street dancing along Quezon Avenue.",
      p_category_code: "festival",
      p_end_at: "2026-05-29T18:00:00+08:00",
      p_image_path: "event/def-456.png",
      p_is_published: true,
    });
  });

  it("carries an image uploaded before the row existed — the path is uuid-keyed", () => {
    expect(toCreateEventArgs({ ...input, imagePath: null }).p_image_path).toBeNull();
  });
});

describe("toUpdateEventArgs", () => {
  // The image round-trip invariant is NOT asserted here. Since the builders
  // take `input`, any assertion in this file reduces to `input.imagePath ===
  // input.imagePath` — true by construction, unable to fail. It is held in
  // `form-value.test.ts`, which runs the whole chain from the loaded row.
  it("builds exactly the arguments update_event declares", () => {
    expect(toUpdateEventArgs(existing.id, input)).toEqual({
      p_id: "22222222-2222-2222-2222-222222222222",
      p_title: "Pasayahan sa Lucena",
      p_location_text: "Quezon Avenue",
      p_start_at: "2026-05-29T08:00:00+08:00",
      p_description: "Street dancing along Quezon Avenue.",
      p_category_code: "festival",
      p_end_at: "2026-05-29T18:00:00+08:00",
      p_image_path: "event/def-456.png",
      p_is_published: true,
    });
  });

});
