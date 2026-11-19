'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePausable } from './use-pausable';

/**
 * One auto-advancing carousel: the current slide, and whether it is moving.
 *
 * It pauses the way `usePausable` describes (its button, a pointer over it,
 * keyboard focus inside it, reduced motion). Every manual move waits a full
 * interval before the next automatic one. Spread `regionProps` onto the
 * element wrapping the carousel's slides and controls.
 */
export function useCarousel(length: number, intervalMs: number) {
  const [slide, setSlide] = useState(0);
  const { playing, moving, toggle, focusInside, regionProps } = usePausable();
  // Changed by every manual move, to start the countdown again from it.
  const [restartKey, setRestartKey] = useState(0);

  useEffect(() => {
    if (!moving) return;
    const timer = setInterval(() => setSlide((s) => (s + 1) % length), intervalMs);
    return () => clearInterval(timer);
  }, [moving, length, intervalMs, restartKey]);

  /** A person chose this slide: show it, and wait a full interval from now. */
  const goTo = useCallback((i: number) => {
    setSlide(((i % length) + length) % length);
    setRestartKey((k) => k + 1);
  }, [length]);

  return {
    slide,
    goTo,
    next: () => goTo(slide + 1),
    prev: () => goTo(slide - 1),
    playing,
    toggle,
    /** Keyboard focus is somewhere inside the region (not a mouse click's focus). */
    focusInside,
    regionProps,
  };
}
