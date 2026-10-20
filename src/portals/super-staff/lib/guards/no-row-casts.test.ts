import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The contract half of PRD Q9.
 *
 * Q9 asked for the cast to live in one place — typed `rpc()`/`from()` helpers
 * in `src/portals/super-staff/lib/supabase/` — and the review found the
 * `from()` half had never been built, so ~20 ad-hoc row casts had spread
 * across ten feature modules.
 * Ticket 02 emptied them. This is what stops them coming back.
 *
 * ⚠️ Normally this repo's rule is "Vitest covers pure logic only", and a test
 * that reads the source tree is a deliberate exception to it. The alternative
 * was ESLint, which this Portal did not have when this was written — no
 * config, no dependency, no script; it ran on `tsc` and `vitest` alone. (Lint
 * runs on it since the merge into one app, MRG-05.) Adding a linter and its
 * plugin tree to enforce one rule costs more than the rule is worth, and a
 * rule in a tool nobody runs enforces nothing. This runs in `npm test`, where it will
 * actually be seen.
 *
 * Scope is `src/portals/super-staff/features/` only. Its `lib/supabase/` is
 * where the cast legitimately lives (`callRpc` documents its own), and the
 * shared `types.ts` is generated — neither is scanned.
 */

const FEATURES = path.resolve(__dirname, "../../features");

/** Cast to a hand-declared row type: `as EventRow`, `as SomeRow[] | null`. */
const ROW_CAST = /\bas\s+[A-Z]\w*Row\b/;

/** Fabricating a row out of nothing, to feed a mapper a missing record. */
const EMPTY_ROW_CAST = /\{\s*\}\s+as\s+\w/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    if (!/\.tsx?$/.test(full) || /\.test\.tsx?$/.test(full)) return [];
    return [full];
  });
}

/**
 * What is left of a file once the parts that cannot contain a cast are gone.
 *
 * Comments go because prose that NAMES the banned pattern — including the
 * comments ticket 02 left explaining why it is banned — must not trip the
 * guard. Imports go because `as` means something else entirely there:
 * `import type { PostCategory as CategoryRow }` is a rename, not an assertion.
 *
 * Both are blanked rather than deleted, so a reported line number still points
 * at the right line.
 */
function scannable(source: string): string {
  const blank = (m: string) => m.replace(/[^\n]/g, "");
  return source
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/\/\/[^\n]*/g, blank)
    .replace(/^import[\s\S]*?from\s+["'][^"']+["'];?/gm, blank);
}

function offenders(pattern: RegExp): string[] {
  return sourceFiles(FEATURES).flatMap((file) =>
    scannable(readFileSync(file, "utf8"))
      .split("\n")
      .map((line, i) => ({ line, n: i + 1 }))
      .filter(({ line }) => pattern.test(line))
      .map(({ n }) => `${path.relative(FEATURES, file).split(path.sep).join("/")}:${n}`),
  );
}

describe("no ad-hoc row casts under src/portals/super-staff/features", () => {
  it("finds source files to scan — a guard over nothing passes vacuously", () => {
    expect(sourceFiles(FEATURES).length).toBeGreaterThan(20);
  });

  it("has no cast to a hand-declared row type", () => {
    expect(
      offenders(ROW_CAST),
      "Read the view through rows()/maybeRow()/singleRow() in @/lib/supabase/select " +
        "instead. The typed client infers a view's row correctly since the " +
        "@supabase/ssr 0.12.4 upgrade, so a cast here asserts a shape nothing " +
        "checks — see PRD Q9.",
    ).toEqual([]);
  });

  it("never fabricates an empty object as a row", () => {
    expect(
      offenders(EMPTY_ROW_CAST),
      "A missing record is null, not an object with every column undefined. " +
        "maybeRow() returns the absence maybeSingle() already reported.",
    ).toEqual([]);
  });

  it("still catches a cast when one is written", () => {
    // Proves the matcher works, so the two guards above are not passing
    // because the pattern is broken.
    expect(ROW_CAST.test("return ((data ?? []) as EventRow[]).map(toEvent);")).toBe(true);
    expect(ROW_CAST.test("toEvent((data as EventRow | null) ?? null)")).toBe(true);
    expect(EMPTY_ROW_CAST.test("toEvent(data ?? ({} as EventRow))")).toBe(true);
  });

  it("does not mistake an import alias for a cast", () => {
    // `as` in an import renames a type; it asserts nothing. No file does this
    // today — the one that did was resolved by ticket 08 — but the guard must
    // not punish a future one for it.
    const source =
      'import type { PostCategory as CategoryRow } from "x";\nconst a = 1;';
    expect(ROW_CAST.test(scannable(source))).toBe(false);
  });

  it("does not mistake prose about the ban for the ban", () => {
    expect(ROW_CAST.test(scannable("// never write `as EventRow` here"))).toBe(false);
    expect(ROW_CAST.test(scannable("/* (data ?? []) as EventRow[] */"))).toBe(false);
  });

  it("keeps line numbers honest when it strips", () => {
    const source = '// comment\nimport { a } from "b";\nconst x = data as EventRow;';
    expect(scannable(source).split("\n")).toHaveLength(3);
  });
});
