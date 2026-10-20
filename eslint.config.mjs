import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// The Staff Portal's two rules, brought over with it (MRG-04) and scoped to its
// files. The reasoning is Staff's own; see its eslint.config.mjs in history.

/**
 * The render-top clock rule. A zero-argument `new Date()` is a read of the wall
 * clock, and it belongs at the top of a render; everything below is handed the
 * moment it needs. A function that invents its own moment disagrees with the
 * one beside it — which is how the At Risk card came to contradict the badges
 * under it (#37) — and can only be tested by mocking a timer.
 *
 * Zero-argument only. Every fixed instant in Staff is built with arguments,
 * and a rule that flagged those would be worthless.
 *
 * The second half of this rule — that a render-top creates *exactly one* clock
 * — cannot be linted, because the allowlist below cannot count. It is written
 * as prose in src/portals/staff/docs/adr/0005-render-top-clock-rule.md.
 */
const noBareClock = {
  selector: 'NewExpression[callee.name="Date"][arguments.length=0]',
  message:
    "new Date() reads the wall clock. Create it at the top of a render — a route file, or a module's dashboard-card.ts — and pass the moment down. See src/portals/staff/docs/adr/0005-render-top-clock-rule.md.",
};

/**
 * The testing layer is for tests only, and this is what says so.
 *
 * `src/portals/staff/lib/supabase/testing.ts` imports `expect` from vitest —
 * `requestTo` carries its own assertion — and vitest is a devDependency. So a
 * production module importing that file does not merely pull in something
 * unused: it fails at load, and whether that failure is loud depends on
 * whether the build installed devDependencies.
 */
const noTestingImport = {
  paths: [
    {
      name: "@/portals/staff/lib/supabase/testing",
      message:
        "The Supabase testing layer imports vitest, a devDependency, so importing it from production code fails at load. Test files only. See ADR-0001's Follow-on adoption entry for #41.",
    },
  ],
};

const STAFF_FILES = ["src/portals/staff/**/*.{ts,tsx}", "src/app/(staff)/**/*.{ts,tsx}"];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: STAFF_FILES,
    /*
      The two places a clock may be created, each the top of its own fan-out:
      route files (named by Next's own file conventions, so the test files
      beside them are still covered), and each module's dashboard-card
      composer. Scoped with `ignores` rather than a second object switching
      the rule off, so a later `no-restricted-syntax` entry would not be
      silently disabled in a route.
    */
    ignores: [
      "src/app/(staff)/**/page.tsx",
      "src/app/(staff)/**/layout.tsx",
      "src/app/(staff)/**/route.ts",
      "src/portals/staff/features/*/lib/dashboard-card.ts",
    ],
    rules: { "no-restricted-syntax": ["error", noBareClock] },
  },
  {
    files: STAFF_FILES,
    // Test files are the testing layer's only permitted callers.
    ignores: ["src/portals/staff/**/*.test.{ts,tsx}", "src/app/(staff)/**/*.test.{ts,tsx}"],
    rules: { "no-restricted-imports": ["error", noTestingImport] },
  },
  {
    files: STAFF_FILES,
    // New in Next 16's lint set, and violated by Staff's imported code (the
    // sidebar's collapse state and the queue activity bar's baseline). A
    // warning until after the freeze, like the other lint debt (MRG-02).
    rules: { "react-hooks/set-state-in-effect": "warn" },
  },
  {
    // The Super-staff Portal had no ESLint before the merge (MRG-05). Lint now
    // runs on it; the two rules its imported code violates — both new in Next
    // 16's lint set — are warnings until after the freeze, like the other lint
    // debt (MRG-02).
    files: ["src/portals/super-staff/**/*.{ts,tsx}", "src/app/(super-staff)/**/*.{ts,tsx}"],
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
    },
  },
  {
    // The Citizen Portal, linted by Next 15's set before the merge (MRG-07).
    // The two rules its imported code violates — both new in Next 16's lint
    // set — are warnings until after the freeze, like the other lint debt
    // (MRG-02).
    files: [
      "src/portals/citizen/**/*.{ts,tsx}",
      "src/app/(citizen)/**/*.{ts,tsx}",
      "src/app/global-error.tsx",
    ],
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // Not eslint-config-next defaults — local-only trees that are full copies of
    // this repo. `npm run lint` runs bare `eslint`, which walks the whole working
    // directory, so without these a checkout that has sibling worktrees present
    // lints all of them: ~25k problems and 1.4k errors that say nothing about the
    // source tree, and no way to read the real result. CI never sees this because a
    // fresh checkout has neither directory. vitest.config.ts carries the equivalent
    // exclusions for the same two paths and the same reason — keep them in sync.
    ".claude/worktrees/**",
    "Capstone-LucenaPortal-Admin/**",

    // The Responder Portal's design reference: an exported prototype (bundled
    // JS, not this app's code), kept as documentation beside the Portal
    // (MRG-06). Responder's own ESLint never saw it either — it ran
    // `next lint`, which only walked the app's source directories.
    "src/portals/responder/design/**",
  ]),
]);

export default eslintConfig;
