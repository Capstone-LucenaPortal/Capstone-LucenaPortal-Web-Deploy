"use client";

import { ErrorPanel } from "@/portals/responder/components/layout/error-panel";

/**
 * Catches whatever the root layout's children throw, including the
 * ProfileReadError from /forbidden and the (portal) layout. Unlike
 * AccessDenied it never signs out: a failed read is no verdict on the account.
 *
 * The copy makes no claim about being signed in. This catches the (auth)
 * pages too, where nobody may be. A page under the shell is caught nearer, by
 * responder/(portal)/error.tsx, which keeps the navigation.
 */
export default function RootError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-gray-50 px-4">
      <ErrorPanel reset={reset} />
    </main>
  );
}
