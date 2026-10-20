"use client";

import { useId } from "react";
import { Modal } from "@/portals/responder/components/ui/modal";

/**
 * Bottom sheet on phone, centred dialog from `sm` up. Used by the password
 * reset, the sign-out confirm and the release / reject / photo sheets.
 * Focus, Escape and the page behind are `Modal`'s.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const titleId = useId();
  const descId = useId();

  if (!open) return null;

  return (
    <Modal
      onClose={onClose}
      className="fixed inset-0 z-80 flex flex-col justify-end sm:items-center sm:justify-center"
    >
      <button
        type="button"
        aria-label="Close"
        data-scrim
        onClick={onClose}
        className="animate-scrim-in absolute inset-0 bg-gray-900/50"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className="animate-sheet-up relative w-full rounded-t-2xl bg-white px-4 pt-4.5 pb-5.5 sm:m-4 sm:max-w-md sm:rounded-2xl"
      >
        <div className="mx-auto mb-3.5 h-1 w-9.5 rounded-full bg-gray-200 sm:hidden" />
        <h2 id={titleId} className="text-lg font-bold text-gray-900">
          {title}
        </h2>
        {description && (
          <p id={descId} className="mt-1.5 text-[13px] text-pretty text-gray-500">
            {description}
          </p>
        )}
        {children}
      </div>
    </Modal>
  );
}
