import { describe, expect, it } from "vitest";
import {
  classifyDbError,
  rpcErrorMessage,
  toRpcError,
  toStorageRpcError,
} from "./errors";

const err = (code: string, message = "boom", details: string | null = null) => ({
  code,
  message,
  details,
  hint: null,
});

describe("classifyDbError", () => {
  it("maps the is_active_staff gate to permission", () => {
    expect(classifyDbError(err("42501"))).toBe("permission");
  });

  it("maps argument validation to validation", () => {
    expect(classifyDbError(err("22023"))).toBe("validation");
  });

  it("maps a unique violation to conflict", () => {
    expect(classifyDbError(err("23505"))).toBe("conflict");
  });

  it("maps the legacy P0002 not-found to not_found", () => {
    expect(classifyDbError(err("P0002"))).toBe("not_found");
  });

  it("maps a PT404 sqlstate to not_found", () => {
    expect(classifyDbError(err("PT404"))).toBe("not_found");
  });

  it("maps a PGRST status override of 404 to not_found", () => {
    expect(classifyDbError(err("PGRST", "no row", '{"status":404}'))).toBe(
      "not_found",
    );
  });

  it("does not treat a PGRST override of another status as not_found", () => {
    expect(classifyDbError(err("PGRST", "conflict", '{"status":409}'))).toBe(
      "unexpected",
    );
  });

  it("survives malformed details rather than throwing", () => {
    expect(classifyDbError(err("PGRST", "no row", "{not json"))).toBe(
      "unexpected",
    );
  });

  // Verbatim from the sandbox on 2026-08-21: `.single()` against a view with
  // no matching row. Note `details` is plain English, not the JSON a status
  // override uses — so `overriddenStatus` finds nothing and this fell through
  // to `unexpected` before PGRST116 was handled by name.
  it("maps PGRST116 to permission — zero rows from .single() means the gate refused", () => {
    expect(
      classifyDbError(
        err(
          "PGRST116",
          "Cannot coerce the result to a single JSON object",
          "The result contains 0 rows",
        ),
      ),
    ).toBe("permission");
  });

  it("falls back to unexpected for an unknown code", () => {
    expect(classifyDbError(err("XX000"))).toBe("unexpected");
  });

  it("treats a null code as unexpected", () => {
    expect(classifyDbError({ code: null, message: "x", details: null })).toBe(
      "unexpected",
    );
  });
});

describe("toRpcError", () => {
  it("carries the kind, the code and the database message", () => {
    const e = toRpcError(err("22023", "opening_hour must be 0-23"));
    expect(e.kind).toBe("validation");
    expect(e.code).toBe("22023");
    expect(e.message).toBe("opening_hour must be 0-23");
  });
});

describe("toStorageRpcError", () => {
  it("maps a storage 403 to permission, matching the RPC seam", () => {
    expect(toStorageRpcError({ message: "denied", status: 403 }).kind).toBe(
      "permission",
    );
  });

  it("maps a storage 401 to permission too", () => {
    expect(toStorageRpcError({ message: "no session", status: 401 }).kind).toBe(
      "permission",
    );
  });

  it("carries the status as the code", () => {
    expect(toStorageRpcError({ message: "denied", status: 403 }).code).toBe("403");
  });

  it("does not classify a 413 as validation — the client already gates size", () => {
    expect(
      toStorageRpcError({ message: "Payload too large", status: 413 }).kind,
    ).toBe("unexpected");
  });

  it("falls back to unexpected when there is no status", () => {
    const e = toStorageRpcError({ message: "network down" });
    expect(e.kind).toBe("unexpected");
    expect(e.code).toBeNull();
  });
});

// The copy every caught load/save failure ends up as. Untested until now, and
// it is the half of B1 the config views actually render.
describe("rpcErrorMessage", () => {
  const LOAD_FALLBACK = "Could not load the configuration.";

  it("reads a gate refusal on a one-row view as not authorised, not as a missing config", () => {
    const empty = toRpcError({
      code: "PGRST116",
      message: "Cannot coerce the result to a single JSON object",
      details: "The result contains 0 rows",
    });
    expect(rpcErrorMessage(empty, LOAD_FALLBACK)).toBe(
      "You no longer have access. Sign in again.",
    );
  });

  it("shows the database's own message for a validation failure", () => {
    const e = toRpcError(err("22023", "opening_hour must be 0-23"));
    expect(rpcErrorMessage(e, LOAD_FALLBACK)).toBe("opening_hour must be 0-23");
  });

  it("points a not_found at the stale list rather than at access", () => {
    expect(rpcErrorMessage(toRpcError(err("PT404")), LOAD_FALLBACK)).toBe(
      "That record no longer exists. Refresh the list.",
    );
  });

  it("falls back for a conflict — a raw unique-violation message is not copy", () => {
    const e = toRpcError(err("23505", 'duplicate key value violates unique constraint "x_pkey"'));
    expect(rpcErrorMessage(e, LOAD_FALLBACK)).toBe(LOAD_FALLBACK);
  });

  it("falls back for an unexpected code", () => {
    expect(rpcErrorMessage(toRpcError(err("XX000")), LOAD_FALLBACK)).toBe(
      LOAD_FALLBACK,
    );
  });

  it("falls back for anything that is not an RpcError at all", () => {
    expect(rpcErrorMessage(new Error("network down"), LOAD_FALLBACK)).toBe(
      LOAD_FALLBACK,
    );
    expect(rpcErrorMessage("nope", LOAD_FALLBACK)).toBe(LOAD_FALLBACK);
  });
});
