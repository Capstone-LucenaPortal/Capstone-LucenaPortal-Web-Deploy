import { describe, expect, it } from "vitest";
import { slotPathFor, validateImageFile, withVersion } from "./site-content";

describe("validateImageFile", () => {
  const file = (type: string, size: number) => ({ type, size }) as File;

  it("accepts a jpeg under 5 MB", () => {
    expect(validateImageFile(file("image/jpeg", 4_000_000))).toBeNull();
  });

  it("rejects webp — the bucket's allowed_mime_types does not include it", () => {
    expect(validateImageFile(file("image/webp", 1000))).toBe(
      "Use a JPEG or PNG image.",
    );
  });

  it("rejects a file over 5 MB", () => {
    expect(validateImageFile(file("image/png", 6_000_000))).toBe(
      "Keep the image under 5 MB.",
    );
  });
});

describe("slotPathFor", () => {
  it("mints {kind}/{uuid}.{ext} on first upload", () => {
    expect(slotPathFor("post", null, "image/jpeg")).toMatch(
      /^post\/[0-9a-f-]{36}\.jpg$/,
    );
    expect(slotPathFor("event", null, "image/png")).toMatch(
      /^event\/[0-9a-f-]{36}\.png$/,
    );
  });

  it("mints a fresh slot each time it is called with no current path", () => {
    expect(slotPathFor("event", null, "image/png")).not.toBe(
      slotPathFor("event", null, "image/png"),
    );
  });

  /**
   * The invariant the whole design rests on: `image_path` never changes after
   * first save. That is what stops update_post / update_event
   * logging a spurious "Image changed", and what guarantees no orphan.
   */
  it("reuses the current slot verbatim on a replacement", () => {
    expect(slotPathFor("post", "post/abc-123.jpg", "image/jpeg")).toBe(
      "post/abc-123.jpg",
    );
  });

  it("reuses the current slot even when the replacement changes format", () => {
    // The extension is a NAME, not a claim about the bytes — upload() sends an
    // explicit contentType, so the CDN serves the right type regardless.
    expect(slotPathFor("post", "post/abc-123.jpg", "image/png")).toBe(
      "post/abc-123.jpg",
    );
  });

  it("refuses a mime the bucket does not accept, minting or replacing", () => {
    expect(() => slotPathFor("post", null, "image/webp")).toThrow(
      "site-content accepts JPEG and PNG only",
    );
    expect(() => slotPathFor("post", "post/abc.jpg", "image/webp")).toThrow(
      "site-content accepts JPEG and PNG only",
    );
  });
});

describe("withVersion", () => {
  it("cache-busts on the version stamp, because the path never changes", () => {
    expect(
      withVersion("https://x.co/o/site-content/post/a.jpg", "2026-08-12T10:00:00Z"),
    ).toBe("https://x.co/o/site-content/post/a.jpg?v=2026-08-12T10%3A00%3A00Z");
  });

  it("returns null for a row with no image", () => {
    expect(withVersion(null, "2026-08-12T10:00:00Z")).toBeNull();
  });

  it("leaves the URL alone when there is no stamp yet", () => {
    expect(withVersion("https://x.co/o/site-content/post/a.jpg", undefined)).toBe(
      "https://x.co/o/site-content/post/a.jpg",
    );
  });
});
