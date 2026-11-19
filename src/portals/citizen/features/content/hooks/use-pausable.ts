'use client';

import { useCallback, useState, useSyncExternalStore, type FocusEvent } from 'react';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

// No `matchMedia` (the server, jsdom) counts as no preference.
const reducedMotionQuery = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(REDUCED_MOTION)
    : null;

function subscribeReducedMotion(onChange: () => void) {
  const query = reducedMotionQuery();
  query?.addEventListener('change', onChange);
  return () => query?.removeEventListener('change', onChange);
}

const prefersReducedMotion = () => reducedMotionQuery()?.matches ?? false;

/**
 * Keyboard focus only. A mouse click also focuses a button in Chrome and
 * Firefox, and that focus stays put after the pointer leaves, so counting it
 * would freeze the motion after every click. The pointer handlers cover mice.
 */
function isKeyboardFocus(el: Element): boolean {
  try {
    return el.matches(':focus-visible');
  } catch {
    return true; // a browser that can't tell: treat all focus as keyboard focus
  }
}

/**
 * Whether something that moves by itself (a carousel, a scrolling strip) should
 * be moving now.
 *
 * It moves only while nobody is using it (WCAG 2.2.2, Pause, Stop, Hide): its
 * pause button stops it until Play is pressed, and it holds still while a
 * pointer is over it or keyboard focus is inside it. On a device set to reduce
 * motion it starts paused. Spread `regionProps` onto the element wrapping the
 * moving content and its controls.
 */
export function usePausable() {
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, () => false);
  // null until the person presses the button; until then the device decides.
  const [pausedByUser, setPausedByUser] = useState<boolean | null>(null);
  const [hovered, setHovered] = useState(false);
  const [focusInside, setFocusInside] = useState(false);

  const playing = !(pausedByUser ?? reducedMotion);
  const toggle = useCallback(() => setPausedByUser(playing), [playing]);

  const regionProps = {
    // Pointer, not mouse, events: after a tap the emulated `mouseenter` has no
    // `mouseleave` until the next tap elsewhere, while `pointerleave` follows
    // the finger lifting.
    onPointerEnter: () => setHovered(true),
    onPointerLeave: () => setHovered(false),
    onFocus: (e: FocusEvent<HTMLElement>) => {
      if (isKeyboardFocus(e.target)) setFocusInside(true);
    },
    // React's blur bubbles; only focus leaving the whole region counts.
    onBlur: (e: FocusEvent<HTMLElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusInside(false);
    },
  };

  return {
    /** Not paused by its button (or, before any press, by the device's reduced-motion setting). */
    playing,
    /** Playing, and nobody is pointing at it or focused inside it: it should move now. */
    moving: playing && !hovered && !focusInside,
    toggle,
    /** The device asks for reduced motion. */
    reducedMotion,
    /** Keyboard focus is somewhere inside the region (not a mouse click's focus). */
    focusInside,
    regionProps,
  };
}
