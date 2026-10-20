"use client";

import { useEffect, useRef } from "react";
import { useOnlinePush } from "@/portals/responder/lib/use-online";

/** Everything that can take focus, in DOM order. The exit sheets' forms open
 * on a hidden incidentId input, which matches `input` but takes no focus. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Live regions keep talking while a modal is open: the offline banner, and
 * Next's route announcer, whose live region is inside its shadow root. */
const LIVE_REGION = '[role="status"], [role="alert"], [aria-live], next-route-announcer';

/** Open modals, innermost last. Only the last one answers keys. */
const openModals: HTMLElement[] = [];

/**
 * Makes everything but `root` inert by walking up to <body> and marking each
 * ancestor's other children. The overlay stays where it is rendered rather
 * than portalling to <body>, so a server-rendered dialog keeps its markup and
 * its layout. Returns what it marked, so closing restores only that and
 * leaves alone anything inert for another reason (an outer modal).
 */
function hideTheRest(root: HTMLElement): HTMLElement[] {
  const marked: HTMLElement[] = [];
  for (let node = root; node.parentElement && node !== document.body; node = node.parentElement) {
    for (const sibling of Array.from(node.parentElement.children)) {
      if (sibling === node || !(sibling instanceof HTMLElement)) continue;
      if (sibling.hasAttribute("inert") || sibling.matches(LIVE_REGION)) continue;
      sibling.setAttribute("inert", "");
      marked.push(sibling);
    }
  }
  return marked;
}

/**
 * The one modal primitive (SCRUM-223, claim-flow spec §7.3). Renders the
 * full-screen overlay; the caller puts the backdrop and an `aria-modal` panel
 * with `tabIndex={-1}` inside it. While it is mounted:
 *
 * - focus starts on the panel's first control, or on the panel itself when it
 *   is an `alertdialog` — the message is the point, not the button;
 * - Tab and Shift+Tab wrap inside the overlay, and the rest of the page is
 *   `inert`, so neither the keyboard nor a screen reader can wander behind it;
 * - Escape calls `onClose`;
 * - on unmount focus goes back to whatever had it before, or to <main> when
 *   that is gone (Release redirects to the pool).
 *
 * Open and closed is the caller's: mount it to open, unmount it to close.
 */
export function Modal({
  onClose,
  className,
  children,
}: {
  onClose: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  // Callers pass inline closures; the effect below must run once per opening,
  // or every re-render would yank focus back to the first control.
  const latestOnClose = useRef(onClose);
  useEffect(() => {
    latestOnClose.current = onClose;
  });

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const opener = document.activeElement as HTMLElement | null;

    const panel = root.querySelector<HTMLElement>('[aria-modal="true"]') ?? root;
    const first =
      panel.getAttribute("role") === "alertdialog"
        ? null
        : panel.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel).focus();

    const onKey = (e: KeyboardEvent) => {
      if (openModals[openModals.length - 1] !== root) return;
      if (e.key === "Escape") {
        latestOnClose.current();
        return;
      }
      if (e.key !== "Tab") return;

      // The whole overlay, backdrop included: on the photo sheet the backdrop
      // is the only close control besides Escape.
      const stops = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => !el.closest('[hidden], [aria-hidden="true"], [inert]'),
      );
      if (stops.length === 0) return;
      const firstStop = stops[0];
      const lastStop = stops[stops.length - 1];
      const active = document.activeElement as HTMLElement | null;

      // Focus on the panel itself (an alertdialog, or a sheet whose controls
      // are all disabled) is not a stop, so the native move could walk off
      // the end. Place it by hand: the next stop after the panel, or wrap.
      if (!active || !stops.includes(active)) {
        e.preventDefault();
        const inside = active && root.contains(active) ? active : null;
        const follows = (el: HTMLElement) =>
          inside !== null && !!(inside.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);
        const target = e.shiftKey
          ? ([...stops].reverse().find((el) => inside && !follows(el)) ?? lastStop)
          : (stops.find(follows) ?? firstStop);
        target.focus();
      } else if (e.shiftKey && active === firstStop) {
        e.preventDefault();
        lastStop.focus();
      } else if (!e.shiftKey && active === lastStop) {
        e.preventDefault();
        firstStop.focus();
      }
    };

    openModals.push(root);
    document.addEventListener("keydown", onKey);
    const hidden = hideTheRest(root);

    return () => {
      openModals.splice(openModals.indexOf(root), 1);
      document.removeEventListener("keydown", onKey);
      // Un-inert first: an inert opener cannot take focus.
      for (const el of hidden) el.removeAttribute("inert");
      const back =
        opener && opener !== document.body && opener.isConnected
          ? opener
          : document.querySelector<HTMLElement>("main");
      back?.focus();
    };
  }, []);

  return (
    <div ref={rootRef} className={className}>
      {children}
    </div>
  );
}

/**
 * A `Modal` that closes by navigating, for the server-rendered dialogs whose
 * open state is the URL (`?lost=`, `?resolved=`). A server component cannot
 * hand a client one a callback, so it hands over the href instead. Offline the
 * navigation is held and the dialog stays, like the exit sheets (issue #7).
 */
export function RouteModal({
  closeHref,
  className,
  children,
}: {
  closeHref: string;
  className?: string;
  children: React.ReactNode;
}) {
  const push = useOnlinePush();

  return (
    <Modal onClose={() => push(closeHref)} className={className}>
      {children}
    </Modal>
  );
}
