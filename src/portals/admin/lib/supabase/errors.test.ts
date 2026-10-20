import { GENERIC_ERROR_MESSAGE, toPortalError } from "@/portals/admin/lib/supabase/errors";

describe("toPortalError", () => {
  it("maps 42501 to a permission error", () => {
    const result = toPortalError({
      code: "42501",
      message: "read_incident_pii: caller is not an active Admin",
    });
    expect(result.kind).toBe("permission");
  });

  it("maps P0002 to not-found even though PostgREST reports it as a 500", () => {
    const result = toPortalError({
      code: "P0002",
      message: "read_incident_pii: no incident abc",
    });
    expect(result.kind).toBe("not-found");
  });

  it("maps PT404 to not-found the same way as P0002", () => {
    const result = toPortalError({
      code: "PT404",
      message: "read_incident_pii: no incident abc",
    });
    expect(result.kind).toBe("not-found");
  });

  it("maps 22023 to an invalid-input error and keeps the message", () => {
    const result = toPortalError({
      code: "22023",
      message: "create_citizen_profile: you must accept the Terms",
    });
    expect(result.kind).toBe("invalid");
    expect(result.message).toContain("you must accept the Terms");
  });

  it("strips the function-name prefix from the displayed message", () => {
    const result = toPortalError({
      code: "42501",
      message: "read_booking_pii: caller is not an active Admin",
    });
    expect(result.message).toBe("caller is not an active Admin");
  });

  it("falls back to unknown for an unrecognised shape", () => {
    expect(toPortalError(new Error("network down")).kind).toBe("unknown");
  });

  // Security-hardening round: an unknown error's raw Postgres message
  // (constraint, column, function names) used to be rendered as-is by every
  // page's error banner. The displayed message is now generic; the raw text
  // moves to `detail`, which no component renders.
  it("replaces an unknown error's raw database message with the generic one", () => {
    const raw = 'duplicate key value violates unique constraint "yc_applications_reference_key"';
    const result = toPortalError({ code: "23505", message: raw });
    expect(result.kind).toBe("unknown");
    expect(result.message).toBe(GENERIC_ERROR_MESSAGE);
    expect(result.message).not.toContain("constraint");
  });

  it("keeps the raw message in detail for logging, on every kind", () => {
    const unknown = toPortalError({ code: "XX000", message: "internal_thing: exploded" });
    expect(unknown.detail).toBe("internal_thing: exploded");

    const permission = toPortalError({ code: "42501", message: "rpc: no" });
    expect(permission.detail).toBe("rpc: no");
  });

  it("handles a non-object error without leaking its contents", () => {
    const result = toPortalError("boom");
    expect(result.kind).toBe("unknown");
    expect(result.message).toBe(GENERIC_ERROR_MESSAGE);
  });
});
