"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/portals/super-staff/lib/utils";

interface ModalProps {
  open: boolean;
  onClose?: () => void;
  children: ReactNode;
  className?: string;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ open, onClose, children, className }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Read onClose through a ref so the effect below depends only on `open` —
  // otherwise an inline `onClose` (new identity every render) would tear down
  // and re-run the effect on any parent re-render, stealing focus mid-typing.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const panel = panelRef.current;
    const initial = panel?.querySelectorAll<HTMLElement>(FOCUSABLE);
    (initial && initial.length > 0 ? initial[0] : panel)?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCloseRef.current?.();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const items = panel.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cn(
          "relative z-10 w-full max-w-lg rounded-lg bg-white p-6 shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-lucena-blue",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
