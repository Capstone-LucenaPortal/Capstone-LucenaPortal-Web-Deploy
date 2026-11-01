import { describe, expect, it } from "vitest";
import type { Announcement } from "../types";
import {
  computeStatusCounts,
  previewPublishedStatus,
  publishedToastMessage,
} from "./lifecycle";

describe("previewPublishedStatus", () => {
  const now = new Date("2026-08-12T10:00:00+08:00");

  it("schedules when the start is in the future", () => {
    expect(previewPublishedStatus("2026-08-20T08:00:00+08:00", null, now)).toBe(
      "Scheduled",
    );
  });

  it("publishes when there is no start date", () => {
    expect(previewPublishedStatus(null, null, now)).toBe("Published");
  });

  it("publishes when the start has passed", () => {
    expect(previewPublishedStatus("2026-08-01T08:00:00+08:00", null, now)).toBe(
      "Published",
    );
  });

  it("reports Expired when the end has already passed", () => {
    expect(previewPublishedStatus(null, "2026-08-01T08:00:00+08:00", now)).toBe(
      "Expired",
    );
  });
});

describe("publishedToastMessage", () => {
  it("names the go-live date when the post was scheduled", () => {
    expect(
      publishedToastMessage("Scheduled", "2026-10-31T08:00:00+08:00"),
    ).toBe("Announcement scheduled for Oct 31, 2026.");
  });

  it("says the post stays off the portal when it published as Expired", () => {
    expect(publishedToastMessage("Expired", null)).toBe(
      "Announcement published as Expired. It stays off the portal until you extend or clear the end date.",
    );
  });

  it("says published when the post went live now", () => {
    expect(
      publishedToastMessage("Published", "2026-08-01T08:00:00+08:00"),
    ).toBe("Announcement published.");
  });
});

const base: Announcement = {
  id: "ann-base",
  contentType: "announcement",
  title: "t",
  body: "b",
  categoryCode: "advisory",
  categoryLabel: "Advisory",
  colorHex: "#0B5FFF",
  imagePath: null,
  isPublished: false,
  status: "Draft",
  startAt: null,
  endAt: null,
  createdBy: "Ana Reyes",
  createdAt: "2026-07-01T00:00:00+08:00",
  lastEditedAt: "2026-07-01T00:00:00+08:00",
};

const mk = (status: Announcement["status"]): Announcement => ({
  ...base,
  id: `ann-${status}-${Math.random()}`,
  status,
});

describe("computeStatusCounts", () => {
  it("counts all statuses and the total", () => {
    const rows = [
      mk("Draft"),
      mk("Draft"),
      mk("Scheduled"),
      mk("Published"),
      mk("Published"),
      mk("Published"),
    ];
    const c = computeStatusCounts(rows);
    expect(c.all).toBe(6);
    expect(c.Draft).toBe(2);
    expect(c.Scheduled).toBe(1);
    expect(c.Published).toBe(3);
  });

  it("counts expired announcements in their own bucket", () => {
    const counts = computeStatusCounts([
      { ...base, status: "Expired" },
      { ...base, status: "Published" },
    ]);
    expect(counts.Expired).toBe(1);
    expect(counts.all).toBe(2);
  });
});
