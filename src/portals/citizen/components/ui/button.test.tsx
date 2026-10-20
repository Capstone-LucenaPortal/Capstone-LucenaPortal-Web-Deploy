import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Button, OUTLINED_GHOST_STYLE, WIDE_PRIMARY_STYLE } from '@/portals/citizen/components/ui/button';

/**
 * The Yellow Card success screens rendered their buttons with
 * `className="btn-primary"` and `className="btn-ghost"` — classes that exist in
 * no stylesheet. `globals.css` is the Citizen Portal's only CSS file and defines
 * layout and accessibility helpers (`stack-mobile`, `fluid-media`, `nav-*`,
 * `hide-xs`, `sr-only`, `skip-link`, `receipt-*`) and no button classes at all.
 *
 * The result was dark browser-default text on the inline `#003DA5` background:
 * a primary action a citizen could barely read (issue #10). The class name
 * looked like styling, which is exactly why it survived review.
 */
describe('no phantom btn-* classes', () => {
  // The Citizen Portal only — its Portal folder and its routes. The other
  // Portals in this app have their own stylesheets and are not scanned.
  const PORTAL = join(process.cwd(), 'src', 'portals', 'citizen');
  const APP = join(process.cwd(), 'src', 'app', '(citizen)');
  const citizenSourceFiles = () => [...sourceFiles(PORTAL), ...sourceFiles(APP)];

  function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return sourceFiles(path);
      if (!/\.tsx?$/.test(entry.name)) return [];
      if (/\.test\.tsx?$/.test(entry.name)) return [];
      return [path];
    });
  }

  it('references no btn-* class that no stylesheet defines', () => {
    const stylesheet = readFileSync(join(APP, 'globals.css'), 'utf8');

    // Not "no btn-* anywhere": defining `.btn-primary` in globals.css would be a
    // perfectly good fix. What must not happen again is a reference with no rule
    // behind it, which is what left the button unstyled and dark-on-dark. So
    // collect every class referenced and demand a definition for each.
    const undefinedReferences = citizenSourceFiles().flatMap((file) => {
      const referenced = readFileSync(file, 'utf8').match(/\bbtn-[a-z0-9-]+\b/g) ?? [];
      return referenced
        .filter((cls) => !stylesheet.includes(`.${cls}`))
        .map((cls) => `${file}: ${cls}`);
    });

    expect(undefinedReferences).toEqual([]);
  });

  it('reaches nested source files, so the scan cannot pass vacuously', () => {
    expect(citizenSourceFiles()).toContain(join(PORTAL, 'components', 'ui', 'button.tsx'));
  });
});

/**
 * What the pages rely on instead. The contract worth pinning is narrow: a
 * primary button must carry its own text colour, because its background is dark.
 * Leave that to the browser and #10 comes straight back.
 */
describe('Button', () => {
  it('defaults to primary, with white text on the Lucena blue', () => {
    render(<Button>View Dashboard</Button>);
    const button = screen.getByRole('button', { name: 'View Dashboard' });
    expect(button).toHaveClass('text-white');
    expect(button).toHaveClass('bg-lucena-blue');
  });

  it('gives the ghost variant a text colour too, on no background', () => {
    render(<Button variant="ghost">Return to Home</Button>);
    const button = screen.getByRole('button', { name: 'Return to Home' });
    expect(button).toHaveClass('text-text-dark');
    expect(button).toHaveClass('bg-transparent');
  });

  // Callers pass layout classes and inline padding. Both must ADD to the
  // variant, never replace it — a caller that silently dropped `text-white`
  // would reproduce the bug one page at a time.
  it('keeps the variant styling when a caller adds its own', () => {
    render(<Button className="w-full font-bold">View Dashboard</Button>);
    const button = screen.getByRole('button', { name: 'View Dashboard' });
    expect(button).toHaveClass('text-white');
    expect(button).toHaveClass('w-full');
  });

  it('lets a caller override the variant padding without losing the rest', () => {
    render(<Button style={{ paddingTop: 16 }}>View Dashboard</Button>);
    const button = screen.getByRole('button', { name: 'View Dashboard' });
    expect(button).toHaveStyle({ paddingTop: '16px' });
    // Untouched defaults survive the merge. Their values belong to the variant,
    // so assert only that they are still set — not what they happen to be.
    expect(button.style.paddingLeft).not.toBe('');
    expect(button.style.paddingBottom).not.toBe('');
  });

  it('keeps the shared success-screen styles free of shorthand padding', () => {
    // A `padding` shorthand mixed with the variant's longhands makes React warn
    // the moment such a style updates. Longhands merge cleanly.
    for (const style of [OUTLINED_GHOST_STYLE, WIDE_PRIMARY_STYLE]) {
      expect(style).not.toHaveProperty('padding');
      expect(style.paddingLeft).toBe(24);
    }
  });

  // The ghost variant sets `text-text-dark`, and `.text-text-dark` is emitted
  // after `.text-lucena-blue` in the compiled CSS, so an added class could not
  // win without tailwind-merge. The outlined style therefore has to carry the
  // colour itself — and takes it from the token rather than repeating the hex.
  it('gives the outlined ghost style its own colour, from the design token', () => {
    expect(OUTLINED_GHOST_STYLE.color).toBe('var(--color-lucena-blue)');
    expect(String(OUTLINED_GHOST_STYLE.border)).toContain('var(--color-lucena-blue)');
  });

  it('swaps the label for a spinner and blocks clicks while loading', async () => {
    const onClick = vi.fn();
    render(<Button loading onClick={onClick}>Submit</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).not.toHaveTextContent('Submit');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
