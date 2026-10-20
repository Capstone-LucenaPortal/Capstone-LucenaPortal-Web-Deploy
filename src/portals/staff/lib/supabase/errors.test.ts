import { describe, expect, it } from "vitest";
import { toActionFailure, type ErrorMessages } from "./errors";

const messages: ErrorMessages = {
  forbidden: "You do not have permission to review applications.",
  conflict: "This application is no longer awaiting review.",
  missing: "This application no longer exists.",
  fallback: "The review could not be saved. Please try again.",
};

describe("toActionFailure", () => {
  it("maps 42501 to the forbidden message and does not mark the page stale", () => {
    const result = toActionFailure({ code: "42501", message: "raw" }, messages);
    expect(result).toEqual({ ok: false, message: messages.forbidden, stale: false });
  });

  it("maps 22023 to the conflict message and marks the page stale", () => {
    const result = toActionFailure({ code: "22023", message: "raw" }, messages);
    expect(result).toEqual({ ok: false, message: messages.conflict, stale: true });
  });

  it("maps P0002 to the missing message and marks the page stale", () => {
    const result = toActionFailure({ code: "P0002", message: "raw" }, messages);
    expect(result).toEqual({ ok: false, message: messages.missing, stale: true });
  });

  it("maps PT404 to the missing message too", () => {
    // The not-found code functions created since l77b raise instead of P0002
    // (DB docs/what-not-to-do.md section 9) — review_booking among them.
    const result = toActionFailure({ code: "PT404", message: "raw" }, messages);
    expect(result).toEqual({ ok: false, message: messages.missing, stale: true });
  });

  it("falls back for an unrecognised code", () => {
    const result = toActionFailure({ code: "08006", message: "raw" }, messages);
    expect(result).toEqual({ ok: false, message: messages.fallback, stale: false });
  });

  it("falls back when the error carries no code at all", () => {
    expect(toActionFailure({ message: "boom" }, messages).message).toBe(messages.fallback);
    expect(toActionFailure(null, messages).message).toBe(messages.fallback);
  });

  it("maps 23P01 to the unavailable message without marking the page stale", () => {
    // An EXCLUDE constraint refused the slot. Nobody acted first — the venue
    // was already taken — and revalidating would hide the message behind a
    // re-render.
    const withBooking: ErrorMessages = {
      ...messages,
      unavailable: "That slot is already taken.",
      misconfigured: "No rate is configured for this venue.",
      duplicate: "That OR number is already recorded.",
    };
    expect(toActionFailure({ code: "23P01" }, withBooking)).toEqual({
      ok: false,
      message: "That slot is already taken.",
      stale: false,
    });
  });

  it("maps 23503 to the misconfigured message", () => {
    const withBooking: ErrorMessages = {
      ...messages,
      misconfigured: "No rate is configured for this venue.",
    };
    expect(toActionFailure({ code: "23503" }, withBooking).message).toBe(
      "No rate is configured for this venue.",
    );
  });

  it("maps 23505 to the duplicate message", () => {
    const withBooking: ErrorMessages = {
      ...messages,
      duplicate: "That OR number is already recorded.",
    };
    expect(toActionFailure({ code: "23505" }, withBooking).message).toBe(
      "That OR number is already recorded.",
    );
  });

  it("falls back when a module has not defined the optional message", () => {
    // The three optional codes exist for Booking. Incidents and Yellow Card
    // never raise them, and their message objects must still compile and still
    // produce something readable if one ever arrives.
    expect(toActionFailure({ code: "23P01" }, messages).message).toBe(
      messages.fallback,
    );
    expect(toActionFailure({ code: "23503" }, messages).message).toBe(
      messages.fallback,
    );
    expect(toActionFailure({ code: "23505" }, messages).message).toBe(
      messages.fallback,
    );
  });

  it("never leaks the raw database message", () => {
    const raw = "review_yellow_card_application: YC-2026-000061 is approved, not awaiting review";
    const result = toActionFailure({ code: "22023", message: raw }, messages);
    expect(result.message).not.toContain("review_yellow_card_application");
    expect(result.message).not.toContain("YC-2026-000061");
  });
});
