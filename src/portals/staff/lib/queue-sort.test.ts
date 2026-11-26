import { describe, expect, it } from "vitest";
import { parseQueueSort, QUEUE_SORT_OPTIONS } from "./queue-sort";

describe("parseQueueSort", () => {
  it("accepts newest and oldest", () => {
    expect(parseQueueSort("newest")).toBe("newest");
    expect(parseQueueSort("oldest")).toBe("oldest");
  });

  it("is Default when the param is missing or empty", () => {
    expect(parseQueueSort(undefined)).toBe("default");
    expect(parseQueueSort("")).toBe("default");
  });

  it("falls back to Default rather than trusting a hand-typed URL", () => {
    expect(parseQueueSort("NEWEST")).toBe("default");
    expect(parseQueueSort("submitted_at.desc")).toBe("default");
    expect(parseQueueSort("default")).toBe("default");
  });
});

describe("QUEUE_SORT_OPTIONS", () => {
  it("offers Default, Newest submitted and Oldest submitted, in that order", () => {
    expect(QUEUE_SORT_OPTIONS.map((o) => o.label)).toEqual([
      "Default",
      "Newest submitted",
      "Oldest submitted",
    ]);
  });
});
