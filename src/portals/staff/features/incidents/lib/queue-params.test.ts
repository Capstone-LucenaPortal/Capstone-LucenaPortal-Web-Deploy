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

describe("buildQueueHref — sort", () => {
  it("carries a chosen sort alongside the tab and the search", () => {
    expect(buildQueueHref({ status: "in_pool", search: "flood", sort: "newest" })).toBe(
      "/staff/incidents?status=in_pool&q=flood&sort=newest",
    );
  });

  it("leaves Default out of the URL", () => {
    expect(buildQueueHref({ status: "all", sort: "default" })).toBe("/staff/incidents");
  });
});
