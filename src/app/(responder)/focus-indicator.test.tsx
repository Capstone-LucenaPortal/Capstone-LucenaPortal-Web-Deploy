import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ToastProvider, useToast } from "@/portals/responder/components/ui/toast";

/**
 * SCRUM-159 (ISO-9a). The Responder Portal shipped with no visible keyboard
 * focus indicator of any kind: zero `:focus-visible` in this stylesheet and
 * zero `focus-visible:` utilities in its source. A responder tabbing through
 * the pool on a field laptop could not see where they were.
 *
 * jsdom does not compute `:focus-visible` styles, so most of these pin the
 * contract at the source: the global rule exists and reaches every
 * interactive element, the places a plain ring would be invisible are
 * covered, and the stylesheet never switches it off. The estate-wide
 * automated accessibility check is SCRUM-157's.
 */
const APP = join(process.cwd(), "src", "app", "(responder)");
const PORTAL = join(process.cwd(), "src", "portals", "responder");
const readStylesheet = () =>
  readFileSync(join(APP, "globals.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    // `design/` is the exported UI reference, not shipped code.
    if (entry.isDirectory()) return entry.name === "design" ? [] : sourceFiles(path);
    if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) return [];
    return [path];
  });
}
const portalSource = () =>
  [...sourceFiles(PORTAL), ...sourceFiles(APP)].map((file) => ({
    file,
    text: readFileSync(file, "utf8"),
  }));

/** The declarations of the rule whose selector list is exactly `selectors`. */
function ruleFor(css: string, selectors: string[]): string | undefined {
  for (const [, selectorText, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const list = selectorText.split(",").map((s) => s.trim());
    if (list.length === selectors.length && selectors.every((s) => list.includes(s))) return body;
  }
  return undefined;
}

describe("visible keyboard focus indicator", () => {
  it("draws a solid blue ring on every interactive element when focused from the keyboard", () => {
    const body = ruleFor(
      readStylesheet(),
      ["a", "button", "input", "select", "textarea", "summary", "[tabindex]"].map(
        (element) => `${element}:focus-visible`,
      ),
    );

    expect(body).toMatch(/outline:\s*3px solid var\(--color-lucena-blue\)/);
    expect(body).toMatch(/outline-offset:\s*2px/);
  });

  it("rings the label of a visually hidden input, since the input itself is a 1px clip", () => {
    const hiddenInputs = portalSource().filter(({ text }) =>
      /<input\b[^>]*className="[^"]*\bsr-only\b/.test(text),
    );
    expect(hiddenInputs.length).toBeGreaterThan(0);

    expect(ruleFor(readStylesheet(), ["label:has(.sr-only:focus-visible)"])).toMatch(
      /outline:\s*3px solid/,
    );
  });

  it("inverts the ring to yellow inside the blue nav", () => {
    expect(ruleFor(readStylesheet(), ["[data-on-dark] :focus-visible"])).toMatch(
      /outline-color:\s*var\(--color-lucena-yellow\)/,
    );
    for (const file of ["components/layout/nav-rail.tsx", "components/layout/nav-drawer.tsx"]) {
      expect(readFileSync(join(PORTAL, file), "utf8"), file).toMatch(
        /<nav\b[^>]*\bdata-on-dark\b/,
      );
    }
  });

  it("marks the near-black toast dark, and only that one", () => {
    function Trigger() {
      const { showToast } = useToast();
      return (
        <>
          <button onClick={() => showToast("Released")}>neutral</button>
          <button onClick={() => showToast("Synced", "info")}>info</button>
        </>
      );
    }
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText("neutral"));
    expect(screen.getByRole("status")).toHaveAttribute("data-on-dark");

    fireEvent.click(screen.getByText("info"));
    expect(screen.getByRole("status")).not.toHaveAttribute("data-on-dark");
  });

  it("draws a full-screen backdrop's ring inside the viewport", () => {
    expect(ruleFor(readStylesheet(), ["[data-scrim]:focus-visible"])).toMatch(
      /outline-offset:\s*-\d+px/,
    );

    // Every self-closing button or Link stretched over its whole container.
    const unmarked = portalSource().flatMap(({ file, text }) =>
      [...text.matchAll(/<(?:button|Link)\b[^<]*?\/>/g)]
        .map(([tag]) => tag)
        .filter((tag) => /className="[^"]*\binset-0\b/.test(tag) && !/\bdata-scrim\b/.test(tag))
        .map((tag) => `${file}: ${tag.split("\n")[0]}`),
    );
    expect(unmarked).toEqual([]);
  });

  it("is never switched off in the stylesheet", () => {
    // Tailwind utilities are layered, so the unlayered rule above beats any
    // `outline-none` in a className. An unlayered rule here would not lose.
    expect(readStylesheet()).not.toMatch(/outline(?:-style)?:\s*(?:none|0)\b/);
  });
});
