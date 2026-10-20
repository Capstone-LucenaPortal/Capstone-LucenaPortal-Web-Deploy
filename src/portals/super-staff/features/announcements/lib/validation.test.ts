import { describe, expect, it } from "vitest";
import type { AnnouncementInput } from "../types";
import { validateAnnouncement } from "./validation";

const base: AnnouncementInput = {
  contentType: "announcement",
  title: "Typhoon advisory",
  body: "Stay indoors.",
  categoryCode: "advisory",
  imagePath: null,
  startAt: "2026-07-16T09:00:00+08:00",
  endAt: "2026-07-20T17:00:00+08:00",
};

describe("validateAnnouncement", () => {
  it("passes a complete input", () => {
    expect(validateAnnouncement(base)).toEqual({});
  });
  it("passes a bare draft (title + body + category, no window)", () => {
    expect(
      validateAnnouncement({ ...base, startAt: null, endAt: null }),
    ).toEqual({});
  });
  it("requires a title", () => {
    expect(validateAnnouncement({ ...base, title: "  " }).title).toBeDefined();
  });
  it("requires a body", () => {
    expect(validateAnnouncement({ ...base, body: "" }).body).toBeDefined();
  });
  it("requires a category", () => {
    expect(
      validateAnnouncement({ ...base, categoryCode: null }).categoryCode,
    ).toBe("Choose a category.");
  });
  it("rejects an end without a start", () => {
    expect(
      validateAnnouncement({ ...base, startAt: null }).endAt,
    ).toBeDefined();
  });
  it("rejects an end that is not after the start", () => {
    expect(
      validateAnnouncement({
        ...base,
        startAt: "2026-07-20T17:00:00+08:00",
        endAt: "2026-07-16T09:00:00+08:00",
      }).endAt,
    ).toBeDefined();
  });
});
