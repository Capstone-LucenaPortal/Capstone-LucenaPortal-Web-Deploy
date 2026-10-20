import { describe, expect, it } from "vitest";
import { NOTICES, noticeFor, noticeText } from "@/portals/responder/features/incidents/lib/notice";

describe("noticeFor", () => {
  it("maps an ownership failure to the force-release sentence", () => {
    expect(
      noticeFor({ message: "release_incident: INC-1 is not your ticket" }),
    ).toBe("force_released");
  });

  it("maps the photo-cap violation to its own code", () => {
    expect(
      noticeFor({
        message:
          "request_incident_photo_upload: already 3 after photos this cycle (limit 3)",
      }),
    ).toBe("photo_limit");
  });

  it("RE-THROWS anything it does not recognise", () => {
    expect(() =>
      noticeFor({ message: "something nobody has seen before" }),
    ).toThrow();
  });

  it("has a sentence for every code it can return", () => {
    for (const code of Object.keys(NOTICES)) {
      expect(NOTICES[code as keyof typeof NOTICES].length).toBeGreaterThan(0);
    }
  });

  it("leaves NO code able to render a raw {ref} at a responder", () => {
    // `length > 0` is not enough once the set holds a placeholder: a second
    // entry given `{ref}` with no caller passing one would ship the literal
    // braces to the screen and still pass every other test here.
    for (const code of Object.keys(NOTICES)) {
      // GIVEN a reference, every code still has something to say. No `??` here
      // -- silence with a reference in hand is a regression, not a choice.
      const named = noticeText(code, "INC-2026-000106");
      expect(named).not.toBeNull();
      expect(named).not.toContain("{ref}");

      // WITHOUT one, a code may fall silent (ASSERTS_REF) -- but the braces
      // must not survive either way.
      expect(noticeText(code) ?? "").not.toContain("{ref}");
    }
  });
});

describe("noticeText", () => {
  it("renders nothing for an absent or unknown code", () => {
    expect(noticeText(undefined)).toBeNull();
    expect(noticeText("not_a_real_code")).toBeNull();
  });

  it("is SILENT, not broken, on a code inherited from Object", () => {
    // `code in NOTICES` walks the prototype chain, so `?notice=toString` finds
    // a FUNCTION and any string work on it throws — an error page on a
    // hand-edited URL, which is the one thing notice-banner.tsx promises will
    // never happen. Own properties only.
    for (const inherited of ["toString", "constructor", "valueOf"]) {
      expect(noticeText(inherited)).toBeNull();
    }
  });

  it("returns the sentence for a known code", () => {
    expect(noticeText("gone")).toBe(NOTICES.gone);
  });

  it("says NOTHING for blocked rather than asserting a hold it cannot name", () => {
    // Issue #9: `blocked` asserts a state -- "you are already holding..." --
    // and the missing reference is evidence against it. The one screen it
    // reaches with no reference is /my-ticket's EMPTY state, whose own words
    // say the opposite, and a responder cannot tell which of the two is wrong.
    expect(noticeText("blocked")).toBeNull();
    expect(noticeText("blocked", null)).toBeNull();
    expect(noticeText("blocked", "")).toBeNull();
  });

  it("NAMES the held reference in the blocked sentence", () => {
    // Issue #8: the banner has to say WHICH ticket is in the way, or a
    // responder is left to work it out from the rest of the page.
    expect(noticeText("blocked", "INC-2026-000106")).toBe(
      "You are already holding INC-2026-000106. Finish or hand it back before claiming another.",
    );
  });
});
