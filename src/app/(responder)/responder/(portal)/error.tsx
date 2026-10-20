"use client";

import { ErrorPanel } from "@/portals/responder/components/layout/error-panel";

/**
 * Catches what a page under the shell throws — a failed read, or a form action
 * sent with no connection (ISO-9). It renders inside the (portal) layout, so
 * the header, the offline banner and the navigation stay: the responder can
 * retry, or go to their ticket, without a blank screen in between.
 *
 * The layout's own failures (the profile read) are above this boundary and go
 * to (responder)/error.tsx.
 */
export default function PortalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex justify-center px-4 py-10">
      <ErrorPanel reset={reset} />
    </div>
  );
}
