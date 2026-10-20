import { describe, expect, it } from "vitest";
import { toUpdateEventArgs } from "./event-args";
import { toFormValue, toInput } from "./form-value";
import type { CityEvent } from "../types";

/**
 * The image round-trip guard for events. See
 * `announcements/lib/form-value.test.ts` for why this shape and not the
 * assertion it replaces: `update_event` has no argument defaults either, so an
 * EXPLICIT null `p_image_path` wipes a live image — an OMITTED one is a
 * `PGRST202` 404 that writes nothing, not a wipe — and every assertion below
 * starts from `stored` rather than from a literal a fixture already holds.
 */

const stored: CityEvent = {
  id: "22222222-2222-2222-2222-222222222222",
  title: "Pasayahan sa Lucena",
  description: "Street dancing along Quezon Avenue.",
  categoryCode: "festival",
  categoryLabel: "Festival",
  colorHex: "#0B5FFF",
  locationText: "Quezon Avenue",
  // The shape PostgREST actually returns: `timestamptz` normalised to UTC.
  // See `announcements/lib/form-value.test.ts` for why this is not `+08:00`.
  startAt: "2026-05-29T00:00:00+00:00", // 08:00 in Manila
  endAt: "2026-05-29T10:00:00+00:00", // 18:00 in Manila
  imagePath: "event/def-456.png",
  isPublished: true,
  createdBy: "Ana Reyes",
  createdAt: "2026-04-01T00:00:00+00:00",
  updatedAt: "2026-04-02T00:00:00+00:00",
};

const savedUnchanged = (e: CityEvent) =>
  toUpdateEventArgs(e.id, toInput(toFormValue(e)));

describe("the image survives an edit that never touches it", () => {
  it("carries the stored path into the update arguments", () => {
    expect(savedUnchanged(stored).p_image_path).toBe(stored.imagePath);
  });

  it("does not send an absent image path", () => {
    expect(savedUnchanged(stored)).toHaveProperty("p_image_path");
    expect(savedUnchanged(stored).p_image_path).not.toBeUndefined();
  });

  it("survives an edit to another field", () => {
    const edited = { ...toFormValue(stored), title: "Pasayahan sa Lucena 2026" };
    const args = toUpdateEventArgs(stored.id, toInput(edited));
    expect(args.p_title).toBe("Pasayahan sa Lucena 2026");
    expect(args.p_image_path).toBe(stored.imagePath);
  });

  it("keeps an event that never had an image at null", () => {
    expect(savedUnchanged({ ...stored, imagePath: null }).p_image_path).toBeNull();
  });

  it("sends a newly uploaded path instead of the stored one", () => {
    const uploaded = { ...toFormValue(stored), imagePath: "event/xyz-999.png" };
    expect(toUpdateEventArgs(stored.id, toInput(uploaded)).p_image_path).toBe(
      "event/xyz-999.png",
    );
  });
});

describe("the rest of the round trip", () => {
  it("returns an unedited event to the same input it was loaded from", () => {
    expect(toInput(toFormValue(stored))).toEqual({
      title: stored.title,
      description: stored.description,
      categoryCode: stored.categoryCode,
      locationText: stored.locationText,
      imagePath: stored.imagePath,
      // Loaded as UTC, written back in the offset the portal writes with.
      startAt: "2026-05-29T08:00:00+08:00",
      endAt: "2026-05-29T18:00:00+08:00",
      isPublished: stored.isPublished,
    });
  });

  it("sends back the instants it loaded, not ones shifted by the offset", () => {
    // The drift guard — see the announcements twin. Starts from `stored`.
    const input = toInput(toFormValue(stored));
    expect(Date.parse(input.startAt)).toBe(Date.parse(stored.startAt));
    expect(Date.parse(input.endAt!)).toBe(Date.parse(stored.endAt!));
  });

  it("sends blank optional text as null, not as an empty string", () => {
    const blanked = { ...toFormValue(stored), description: "   ", categoryCode: "" };
    const input = toInput(blanked);
    expect(input.description).toBeNull();
    expect(input.categoryCode).toBeNull();
  });

  it("carries the published flag, which events set in the same call", () => {
    // Unlike posts, publication is part of update_event, not a second RPC.
    const unpublished = { ...toFormValue(stored), isPublished: false };
    expect(toInput(unpublished).isPublished).toBe(false);
  });
});
