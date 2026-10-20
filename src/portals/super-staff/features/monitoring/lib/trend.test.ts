import { describe, expect, it } from "vitest";
import { trendPresentation } from "./trend";

describe("trendPresentation", () => {
  it("maps up to a rising glyph and 'up' label", () => {
    expect(trendPresentation("up")).toEqual({ glyph: "▲", srLabel: "up" });
  });

  it("maps down to a falling glyph and 'down' label", () => {
    expect(trendPresentation("down")).toEqual({ glyph: "▼", srLabel: "down" });
  });

  it("maps flat to a level glyph and 'no change' label", () => {
    expect(trendPresentation("flat")).toEqual({
      glyph: "▬",
      srLabel: "no change",
    });
  });
});
