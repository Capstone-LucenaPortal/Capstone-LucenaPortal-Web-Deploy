import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import LCCStep7Verification from '@/portals/citizen/features/booking/components/steps/lcc-step-7-verification';

const REFERENCE = 'BK-2026-000042';

function renderStep7() {
  return render(
    <LCCStep7Verification
      referenceNumber={REFERENCE}
      onGoToDashboard={vi.fn()}
      onBookAnother={vi.fn()}
    />,
  );
}

/**
 * This is where the normal booking path ends — submit, upload proof, pay. Step 5
 * is only reached when a booking needs a custom quote, and it was the one screen
 * that got a receipt link in #5 (SCRUM-119), so most citizens who book a venue
 * had no way to their receipt from the screen that confirmed the booking
 * (issue #13).
 */
describe('LCCStep7Verification', () => {
  it('shows the booking reference', () => {
    renderStep7();
    expect(screen.getByText(REFERENCE)).toBeInTheDocument();
  });

  it('links to the Acknowledgement Receipt for that reference', () => {
    renderStep7();
    const link = screen.getByRole('link', { name: /acknowledgement receipt/i });
    expect(link).toHaveAttribute('href', `/receipt/${REFERENCE}`);
  });

  // The link is inserted between these two, so this guards the insertion rather
  // than the buttons' copy — hence tolerant matchers.
  it('keeps both existing actions beside it', () => {
    renderStep7();
    expect(screen.getByRole('button', { name: /go to dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /book another/i })).toBeInTheDocument();
  });
});

/**
 * Acceptance criterion from issue #13, made executable. The criterion is about
 * BOOKING references specifically — the issue scopes its own check to
 * `grep -rn referenceNumber src/features/booking/components/steps` — and so is
 * this, deliberately.
 *
 * What it therefore does NOT cover: a screen that names its reference something
 * else. `src/app/yellow-card/[id]/revise/page.tsx` renders `{reference}` with no
 * receipt link and this would not catch it. That is a real gap, and a separate
 * one — the yellow-card and incident success screens already link theirs, so the
 * right shape is a check per module's own vocabulary rather than one regex
 * guessing at all of them.
 *
 * Kept beside the step-7 test because it is the same question asked of every step
 * rather than one: a step added later inherits the check instead of repeating the
 * bug.
 */
describe('every booking step showing a reference links its receipt', () => {
  const STEPS = join(process.cwd(), 'src', 'portals', 'citizen', 'features', 'booking', 'components', 'steps');

  const stepFiles = () =>
    readdirSync(STEPS)
      .filter((name) => /\.tsx$/.test(name) && !/\.test\.tsx$/.test(name))
      .map((name) => join(STEPS, name));

  it('renders a ReceiptLink wherever it renders {referenceNumber}', () => {
    const offenders = stepFiles().filter((file) => {
      const source = readFileSync(file, 'utf8');
      return source.includes('{referenceNumber}') && !source.includes('ReceiptLink');
    });
    expect(offenders).toEqual([]);
  });

  it('is looking at both steps that show a reference', () => {
    // Guards the scan itself: a broken glob, a renamed directory, or either of
    // these screens quietly dropping its reference fails here rather than
    // letting the scan pass because it found nothing to check.
    const showing = stepFiles().filter((file) =>
      readFileSync(file, 'utf8').includes('{referenceNumber}'),
    );
    expect(showing).toContain(join(STEPS, 'lcc-step-5-pending.tsx'));
    expect(showing).toContain(join(STEPS, 'lcc-step-7-verification.tsx'));
  });
});
