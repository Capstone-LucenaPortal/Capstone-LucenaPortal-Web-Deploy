'use client';

import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  /** Id of the heading that names this dialog, for `aria-labelledby`. */
  labelledBy: string;
  onClose: () => void;
  /** Extra classes for the inner panel — width varies per mode. */
  panelClassName?: string;
  panelStyle?: React.CSSProperties;
  children: ReactNode;
}

/** Everything focusable, in DOM order. `:not([disabled])` matters because a
 * disabled submit button would otherwise become a dead stop in the trap. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Whether a matched element can actually take focus.
 *
 * Deliberately does NOT use `offsetParent !== null`, the usual shorthand for
 * "is this element rendered". That check is wrong here in two directions:
 * `offsetParent` is null for any `position: fixed` element — and this dialog's
 * own overlay is fixed — so a fixed-positioned control inside the panel would
 * be silently dropped from the trap in a real browser. It is also null for
 * every element under a layout-less DOM, which makes the trap untestable.
 *
 * Checking the attributes that actually remove an element from the tab order
 * is both more accurate and environment-independent.
 */
function isReachable(el: HTMLElement): boolean {
  if (el.hasAttribute('disabled')) return false;
  // `closest` covers the container case: a hidden or inert wrapper takes its
  // whole subtree out of the tab order, not just itself.
  if (el.closest('[hidden], [aria-hidden="true"], [inert]')) return false;
  return true;
}

/**
 * A real modal dialog: labelled, focus-trapped, Escape-closable, and it gives
 * focus back where it came from.
 *
 * The portal's modals were previously plain `<div>` overlays — no
 * `role="dialog"`, no `aria-modal`, no trap, no Escape handler, no close
 * button. A screen-reader user was dropped into an unnamed region they could
 * tab straight out of, into the page behind, with no way to tell they had left.
 *
 * Scroll on `<body>` is locked while open, so the page behind does not scroll
 * under the overlay on mobile.
 */
export default function ModalShell({
  labelledBy,
  onClose,
  panelClassName,
  panelStyle,
  children,
}: Props) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  // Captured on mount, restored on unmount — after closing, focus belongs back
  // on whatever opened the dialog, not at the top of the document.
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const panel = panelRef.current;
    if (panel) {
      // Focus the first real control rather than the panel itself, so a
      // keyboard user starts on the field they came to fill in.
      const first = panel.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? panel).focus();
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      const node = panelRef.current;
      if (!node) return;
      const focusable = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        isReachable,
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey && (active === first || !node.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-[2000] animate-[fadeIn_0.2s_ease]"
      // The backdrop is a convenience for mouse users; Escape and the close
      // button are the accessible paths, so it carries no role of its own.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={panelClassName}
        style={panelStyle}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/** The close affordance. Kept here so every dialog gets the same one — the
 * modals previously had no visible close control at all, leaving anyone who
 * did not guess "click the backdrop" stuck. */
export function ModalCloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close dialog"
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        width: 36,
        height: 36,
        borderRadius: 6,
        border: 'none',
        background: 'transparent',
        color: 'inherit',
        fontSize: 22,
        lineHeight: 1,
        cursor: 'pointer',
      }}
    >
      <span aria-hidden="true">×</span>
    </button>
  );
}
