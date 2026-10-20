import { describe, expect, it } from "vitest";
import { buildQueueHref, parseStatusFilter } from "./queue-params";

describe("parseStatusFilter", () => {
  it("accepts a real status", () => {
    expect(parseStatusFilter("in_pool")).toBe("in_pool");
  });

  it("falls back to all for anything else", () => {
    // Search params are user input — someone can type anything into the bar.
    expect(parseStatusFilter("assigned")).toBe("all");
    expect(parseStatusFilter("expired_unverified")).toBe("all");
    expect(parseStatusFilter(undefined)).toBe("all");
    expect(parseStatusFilter("'; drop table incidents; --")).toBe("all");
  });
});

describe("buildQueueHref", () => {
  it("omits the status param for all", () => {
    expect(buildQueueHref({ status: "all" })).toBe("/staff/incidents");
  });

  it("carries the search term across a tab change", () => {
    expect(buildQueueHref({ status: "open", search: "cotta" })).toBe(
      "/staff/incidents?status=open&q=cotta",
    );
  });

  it("drops a whitespace-only search", () => {
    expect(buildQueueHref({ status: "open", search: "  " })).toBe(
      "/staff/incidents?status=open",
    );
  });
});
