import { describe, expect, it } from "vitest";
import { RpcError } from "./errors";
import { maybeRow, rows, singleRow } from "./select";

type ErrLike = { code: string | null; message: string; details?: string | null };

/** A stand-in for a PostgREST builder: it is only ever awaited. */
function resolves<T>(result: {
  data: T | null;
  error: ErrLike | null;
}): PromiseLike<{ data: T | null; error: ErrLike | null }> {
  return Promise.resolve(result);
}

describe("rows", () => {
  it("hands back the rows the view returned", async () => {
    const data = [{ id: "a" }, { id: "b" }];
    await expect(rows(resolves({ data, error: null }))).resolves.toEqual(data);
  });

  it("reads no rows as an empty list, not as a failure", async () => {
    // PostgREST returns [] for a list the gate scoped to nothing. That is an
    // answer, not an error — the caller renders an empty table.
    await expect(rows(resolves({ data: [], error: null }))).resolves.toEqual([]);
  });

  it("reads a null payload as an empty list", async () => {
    await expect(rows(resolves({ data: null, error: null }))).resolves.toEqual([]);
  });

  it("throws the classified error rather than returning a partial list", async () => {
    await expect(
      rows(resolves<{ id: string }[]>({ data: null, error: { code: "42501", message: "denied" } })),
    ).rejects.toBeInstanceOf(RpcError);
  });

  it("preserves the classification the SQLSTATE earned", async () => {
    try {
      await rows(
        resolves<{ id: string }[]>({ data: null, error: { code: "42501", message: "denied" } }),
      );
      expect.unreachable("should have thrown");
    } catch (e) {
      expect((e as RpcError).kind).toBe("permission");
    }
  });
});

describe("maybeRow", () => {
  it("hands back the row when one matched", async () => {
    const row = { id: "a" };
    await expect(maybeRow(resolves({ data: row, error: null }))).resolves.toEqual(row);
  });

  it("returns null when no row matched, rather than an empty object", async () => {
    // The bug this replaces: callers fell back to `toX({} as Row)`, handing the
    // mapper an object with every column undefined. An absent row is null.
    await expect(maybeRow(resolves({ data: null, error: null }))).resolves.toBeNull();
  });

  it("throws the classified error", async () => {
    await expect(
      maybeRow(resolves<{ id: string }>({ data: null, error: { code: "42501", message: "denied" } })),
    ).rejects.toBeInstanceOf(RpcError);
  });
});

describe("singleRow", () => {
  it("hands back the row", async () => {
    const row = { downpayment_pct: 30 };
    await expect(singleRow(resolves({ data: row, error: null }))).resolves.toEqual(row);
  });

  it("throws the classified error", async () => {
    // Zero rows on a one-row config view arrives as PGRST116, which the error
    // seam reads as `permission` — the gate refused, config is not missing.
    try {
      await singleRow(
        resolves<{ x: number }>({
          data: null,
          error: { code: "PGRST116", message: "0 rows", details: "The result contains 0 rows" },
        }),
      );
      expect.unreachable("should have thrown");
    } catch (e) {
      expect((e as RpcError).kind).toBe("permission");
    }
  });

  it("refuses a null row that arrived without an error", async () => {
    // `.single()` promises a row or an error. Both absent is a broken
    // invariant, not a value to hand onward as though a row came back.
    await expect(
      singleRow(resolves<{ x: number }>({ data: null, error: null })),
    ).rejects.toBeInstanceOf(RpcError);
  });
});
