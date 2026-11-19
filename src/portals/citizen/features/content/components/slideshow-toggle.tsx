'use client';

import type { CSSProperties } from 'react';

interface SlideshowToggleProps {
  playing: boolean;
  onToggle: () => void;
  /** Size, colours and shape, to match the carousel's other controls. */
  style: CSSProperties;
  /** What it pauses, for its accessible name: "Pause <subject>" / "Play <subject>". */
  subject?: string;
}

/**
 * A carousel's (or other moving content's) pause/play button. Its name says
 * what pressing it will do, and its icon shows the same: two bars while
 * playing, a triangle while paused.
 */
export default function SlideshowToggle({ playing, onToggle, style, subject = 'slideshow' }: SlideshowToggleProps) {
  return (
    <button
      type="button"
      aria-label={`${playing ? 'Pause' : 'Play'} ${subject}`}
      onClick={onToggle}
      style={{ border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0, ...style }}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false" fill="currentColor">
        {playing ? (
          <>
            <rect x="2" y="1" width="3" height="10" rx="0.5" />
            <rect x="7" y="1" width="3" height="10" rx="0.5" />
          </>
        ) : (
          <path d="M3 1.2v9.6a.5.5 0 0 0 .76.43l7.6-4.8a.5.5 0 0 0 0-.86l-7.6-4.8A.5.5 0 0 0 3 1.2z" />
        )}
      </svg>
    </button>
  );
}
