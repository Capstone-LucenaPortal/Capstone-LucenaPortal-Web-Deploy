"use client";

import { startTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/portals/super-staff/components/ui/button";
import { Card } from "@/portals/super-staff/components/ui/card";

/**
 * Catches whatever the root layout's children throw, including the
 * ProfileReadError from /forbidden and the (portal) layout. Unlike
 * AccessDenied it never signs out: a failed read is no verdict on the account.
 *
 * The copy makes no claim about being signed in. This catches the (auth)
 * pages too, where nobody may be.
 */
export default function RootError({
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

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <Card className="w-full max-w-md">
        <h1 className="text-xl font-bold text-lucena-blue">Could not load this page</h1>
        <p className="mt-3 text-sm text-gray-600">
          Something went wrong on our side. Try again in a moment.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button variant="primary" onClick={retry}>
            Try again
          </Button>
        </div>
      </Card>
    </main>
  );
}
