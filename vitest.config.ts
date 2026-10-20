import { defaultExclude, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    // This repo keeps real, checked-out sibling git worktrees under
    // .claude/worktrees/ (each one a full copy of the repo, including its
    // own node_modules and test files). Vitest's own defaults only exclude
    // node_modules/.git, so without this, running the suite from a checkout
    // that has sibling worktrees present picks up their nested test files
    // too — a second React instance gets cross-loaded, producing spurious
    // failures unrelated to anything under test. The old jest.config.js this
    // file replaced carried the equivalent exclusions for the same reason
    // (testPathIgnorePatterns/modulePathIgnorePatterns both listed
    // <rootDir>/.claude/worktrees/ and <rootDir>/Capstone-LucenaPortal-Admin/)
    // — this repo has hit the bug class once already, don't drop the guard.
    exclude: [...defaultExclude, "**/.claude/worktrees/**", "**/Capstone-LucenaPortal-Admin/**"],
  },
});
