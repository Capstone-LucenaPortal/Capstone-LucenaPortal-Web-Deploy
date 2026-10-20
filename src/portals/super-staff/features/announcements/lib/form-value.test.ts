import { describe, expect, it } from "vitest";
import { toFormValue, toInput } from "./form-value";
import { toUpdatePostArgs } from "./post-args";
import type { Announcement } from "../types";

/**
 * The image round-trip guard the Portal A plan called "the highest-value test
 * in the plan".
 *
 * `update_post` declares no argument defaults, so `p_image_path` is written on
 * every call from whatever the caller sends. Sending an EXPLICIT null wipes a
 * live image and nothing in the database prevents it, so the portal must carry
 * the loaded row's path all the way back out — through `toFormValue`, through
 * `toInput`, into the RPC arguments.
 *
 * ⚠️ OMITTING the argument is a different case and is NOT the danger.
 * PostgREST resolves an RPC by argument names, so a missing `p_image_path`
 * matches no signature and returns `PGRST202` / HTTP 404 without entering the
 * function. A dropped key breaks the save loudly; a null quietly destroys
 * data. This file guards the second. DB repo `docs/what-not-to-do.md` §10
 * carries the live probe.
 *
 * ⚠️ The assertions here start from `stored` and never mention a literal path.
 * The tests this replaces asserted `toUpdatePostArgs(id, input).p_image_path`
 * equalled a fixture value that `input.imagePath` already held — true by
 * construction, and unable to fail no matter which step dropped the field.
 * Break any link in the chain below and these go red.
 */

const stored: Announcement = {
  id: "11111111-1111-1111-1111-111111111111",
  contentType: "announcement",
  title: "Water interruption",
  body: "Barangay 1 to 4, 8am to 5pm.",
  categoryCode: "advisory",
  categoryLabel: "Advisory",
  colorHex: "#0B5FFF",
  imagePath: "post/abc-123.jpg",
  isPublished: true,
  status: "Published",
  // `start_at` is `timestamptz` and the database's `TimeZone` is `UTC`, so
  // PostgREST returns instants normalised to `+00:00` — never `+08:00`. This
  // fixture used to carry the offset the portal writes with, which is why the
  // eight-hour drift of ticket 11 rode straight through this file unnoticed.
  startAt: "2026-08-01T00:00:00+00:00", // 08:00 in Manila
  endAt: "2026-08-05T09:00:00+00:00", // 17:00 in Manila
  createdBy: "Ana Reyes",
  createdAt: "2026-07-31T23:00:00+00:00",
  lastEditedAt: "2026-08-01T23:00:00+00:00",
};

/** Exactly what the editor does on save, with no field touched. */
const savedUnchanged = (a: Announcement) =>
  toUpdatePostArgs(a.id, toInput(toFormValue(a)));

describe("the image survives an edit that never touches it", () => {
  it("carries the stored path into the update arguments", () => {
    expect(savedUnchanged(stored).p_image_path).toBe(stored.imagePath);
  });

  it("does not send an absent image path", () => {
    // An omitted key and an explicit null are NOT the same: the first is a
    // `PGRST202` 404 that writes nothing, the second is a silent wipe.
    // Presence is asserted separately from value so a chain that drops the key
    // fails here rather than against the database.
    expect(savedUnchanged(stored)).toHaveProperty("p_image_path");
    expect(savedUnchanged(stored).p_image_path).not.toBeUndefined();
  });

  it("survives an edit to another field", () => {
    const edited = { ...toFormValue(stored), title: "Water interruption (rev)" };
    const args = toUpdatePostArgs(stored.id, toInput(edited));
    expect(args.p_title).toBe("Water interruption (rev)");
    expect(args.p_image_path).toBe(stored.imagePath);
  });

  it("keeps a post that never had an image at null", () => {
    // Null is the honest value here, and must not become "" or undefined.
    expect(savedUnchanged({ ...stored, imagePath: null }).p_image_path).toBeNull();
  });

  it("sends a newly uploaded path instead of the stored one", () => {
    // ImageField writes the new path into form state; that must win.
    const uploaded = { ...toFormValue(stored), imagePath: "post/def-456.jpg" };
    expect(toUpdatePostArgs(stored.id, toInput(uploaded)).p_image_path).toBe(
      "post/def-456.jpg",
    );
  });
});

describe("the rest of the round trip", () => {
  it("returns an unedited post to the same input it was loaded from", () => {
    const input = toInput(toFormValue(stored));
    expect(input).toEqual({
      contentType: stored.contentType,
      title: stored.title,
      body: stored.body,
      categoryCode: stored.categoryCode,
      imagePath: stored.imagePath,
      // Loaded as UTC, written back in the offset the portal writes with: the
      // same two instants, spelled the other way round.
      startAt: "2026-08-01T08:00:00+08:00",
      endAt: "2026-08-05T17:00:00+08:00",
    });
  });

  it("sends back the instants it loaded, not ones shifted by the offset", () => {
    // The drift guard, and the reason the fixture above is in `+00:00`: every
    // save used to hand the database an instant eight hours earlier than the
    // one it had just read. Starts from `stored`, so no spelling of the
    // offset can make it pass by construction.
    const input = toInput(toFormValue(stored));
    expect(Date.parse(input.startAt!)).toBe(Date.parse(stored.startAt!));
    expect(Date.parse(input.endAt!)).toBe(Date.parse(stored.endAt!));
  });

  it("sends a cleared category as null, not as an empty string", () => {
    const cleared = { ...toFormValue(stored), categoryCode: "" };
    expect(toInput(cleared).categoryCode).toBeNull();
  });
});
