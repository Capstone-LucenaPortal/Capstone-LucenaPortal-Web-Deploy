import { describe, expect, it } from "vitest";
import { buildQueueHref, parseStatusFilter } from "./queue-params";

describe("parseStatusFilter", () => {
  it("accepts every real status", () => {
    expect(parseStatusFilter("pending")).toBe("pending");
    expect(parseStatusFilter("withdrawn")).toBe("withdrawn");
    expect(parseStatusFilter("revision_requested")).toBe("revision_requested");
  });

  it("defaults to all for a missing param", () => {
    expect(parseStatusFilter(undefined)).toBe("all");
  });

  it("defaults to all rather than trusting a hand-typed URL", () => {
    expect(parseStatusFilter("'; drop table --")).toBe("all");
    expect(parseStatusFilter("PENDING")).toBe("all");
  });
});

describe("buildQueueHref", () => {
  it("returns the bare path for the default view", () => {
    expect(buildQueueHref({ status: "all" })).toBe("/staff/yellow-card");
  });

  it("adds the status param", () => {
    expect(buildQueueHref({ status: "pending" })).toBe("/staff/yellow-card?status=pending");
  });

  it("preserves the search term when switching tabs", () => {
    expect(buildQueueHref({ status: "approved", search: "santos" })).toBe(
      "/staff/yellow-card?status=approved&q=santos",
    );
  });

  it("encodes a term with spaces and symbols", () => {
    expect(buildQueueHref({ status: "all", search: "dela cruz & co" })).toBe(
      "/staff/yellow-card?q=dela+cruz+%26+co",
    );
  });
});
