"use client";

import { startTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/portals/admin/components/ui/button";

/**
 * Catches whatever the (admin) root layout's children throw, including the
 * ProfileReadError from the (shell) layout's profile read. Unlike
 * AccessRefusal it never signs out: a failed read is no verdict on the account.
 * Modelled on src/app/(super-staff)/error.tsx.
 *
 * The copy makes no claim about being signed in. This catches the sign-in and
 * accept-invite pages too, where nobody may be.
 */
export default function AdminError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  // reset() alone re-renders the client tree with the RSC payload that
  // failed; refresh() fetches a new one, so the profile is read again.
  function retry() {
    startTransition(() => {
      router.refresh();
      reset();
    });
  }

  // Laid out like AccessRefusal, the other full-screen Admin message.
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-xl font-bold text-blue-900">Could not load this page</h1>
      <p className="max-w-md text-sm text-gray-700">
        Something went wrong on our side. Try again in a moment.
      </p>
      <Button variant="primary" onClick={retry}>
        Try again
      </Button>
    </main>
  );
}
