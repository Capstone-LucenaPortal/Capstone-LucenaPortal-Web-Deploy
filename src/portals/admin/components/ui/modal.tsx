"use client";

// src/portals/admin/components/ui/modal.tsx
import { ReactNode, useEffect, useId, useRef } from "react";
import { cn } from "@/portals/admin/lib/utils";

interface ModalProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

// Selects everything the browser would normally let a user Tab to. This is
// the standard "roughly focusable" selector list (it deliberately does not
// try to be a perfect implementation of the focusability spec — e.g. it
// doesn't account for CSS visibility/display, since anything inside an open
// modal is expected to be visible). Reuse this constant + helper wholesale
// for any other component that needs to trap focus in a container (Task 3.2's
// off-canvas sidebar drawer is the next planned consumer).
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

export function Modal({ title, isOpen, onClose, children, footer }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Whatever had focus right before the modal opened (typically the button
  // that triggered it). Restored on close/unmount so keyboard users land
  // back where they were instead of at the top of the document.
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);
  const headingId = useId();

  // Steps 1 & 3: open -> stash the trigger element, move focus into the
  // dialog, lock background scroll. Close/unmount -> undo both.
  //
  // Both the "enter" and "exit" side effects live in one effect keyed on
  // `isOpen`, with the exit half done entirely in the cleanup function. That
  // is deliberate, not just tidy: React guarantees a `useEffect` cleanup
  // runs before the effect re-runs AND on unmount, so tying the scroll-lock
  // reset and focus restoration to the cleanup (rather than to the
  // `onClose` callback) means they fire even if the modal disappears for a
  // reason other than the user closing it (e.g. the parent stops rendering
  // it). Never move this logic into onClose/an explicit "close" branch —
  // that reintroduces the "unmounted while still locked" bug this is
  // guarding against.
  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedElement.current = document.activeElement as HTMLElement | null;

    // Prefer the dialog's own heading as the initial focus target (it
    // orients screen reader users at "what dialog am I in" before anything
    // else). Fall back to the first focusable element if for some reason
    // the heading ref isn't available.
    const dialog = dialogRef.current;
    const focusable = dialog ? getFocusableElements(dialog) : [];
    const initialFocusTarget = headingRef.current ?? focusable[0] ?? null;
    initialFocusTarget?.focus();

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
      previouslyFocusedElement.current?.focus();
    };
  }, [isOpen]);

  // Step 2: Escape closes the dialog; Tab/Shift+Tab cycle focus without ever
  // leaving it. Kept as its own effect (separate from the one above) so the
  // "what happens on open/close" lifecycle and the "how keys behave while
  // open" behavior can be read and lifted independently of each other.
  //
  // Focusable elements are re-queried on every keypress rather than cached
  // once when the dialog opens. That's intentional: a dialog's contents can
  // change while it's open (e.g. a loading spinner swapping in buttons once
  // data arrives), and a stale cached list would let focus escape into
  // elements that no longer exist or miss ones that just appeared. The
  // re-query is cheap (a single querySelectorAll over a small subtree).
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusable = getFocusableElements(dialog);
      if (focusable.length === 0) {
        // Nothing to tab to at all (shouldn't happen in practice — the
        // close button is always rendered — but guard it anyway so a
        // future consumer with no focusable content doesn't leak focus
        // out of the trap).
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        // Wrap to the last element when Shift+Tab-ing back from the first
        // one — or from the heading itself (it holds initial focus via
        // tabIndex={-1}, which is outside the normal Tab sequence, so the
        // browser's default "go to the previous tabbable element" would
        // otherwise walk straight out of the dialog) — or from anywhere
        // focus has drifted outside the dialog entirely.
        if (active === first || active === headingRef.current || !dialog.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        // Wrap to the first element when Tab-ing forward from the last one.
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className={cn("fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4")}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className={cn("max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-none bg-white shadow-xl")}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={cn("flex items-center justify-between border-b border-gray-200 px-6 py-4")}>
          <h2
            ref={headingRef}
            id={headingId}
            tabIndex={-1}
            // The heading is the initial focus target on every open (see the
            // lifecycle effect above), so it needs its own visible focus
            // indicator — `outline-none` alone would silently strip the
            // browser's default ring with nothing replacing it. Uses the
            // project-wide focus-ring convention established by this file
            // and finalized as `focus-visible:` (rather than plain `focus:`)
            // by Task 3.3, in the app's primary accent color (`blue-900`,
            // same as `Button`'s "primary" variant).
            className={cn(
              "text-lg font-semibold text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-900"
            )}
          >
            {title}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className={cn("text-gray-500 hover:text-gray-600")}
          >
            ✕
          </button>
        </div>
        <div className={cn("px-6 py-4")}>{children}</div>
        {footer && (
          <div className={cn("flex justify-end gap-3 border-t border-gray-200 px-6 py-4")}>{footer}</div>
        )}
      </div>
    </div>
  );
}
