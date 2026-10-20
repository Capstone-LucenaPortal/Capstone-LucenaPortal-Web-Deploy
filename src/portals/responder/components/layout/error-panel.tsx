"use client";

import { startTransition } from "react";
import { useRouter } from "next/navigation";
import { useOnReconnect } from "@/portals/responder/lib/use-online";

/**
 * The body of both Responder error boundaries (ISO-9): what failed, and a way
 * back that is not a reload of a blank tab.
 *
 * Offline, a failed render or form submit is the connection, not us — so it
 * says that, and retries by itself once the connection returns.
 */
export function ErrorPanel({ reset }: { reset: () => void }) {
  const router = useRouter();

  // reset() alone re-renders the client tree with the RSC payload that
  // failed; refresh() fetches a new one, so the server reads run again.
  function retry() {
    startTransition(() => {
      router.refresh();
      reset();
    });
  }

  const online = useOnReconnect(retry);

  return (
    <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6">
      <h1 className="text-[17px] leading-tight font-bold text-gray-900">
        {online ? "Could not load this page" : "You are offline"}
      </h1>
      <p className="mt-2.5 text-[13px] text-pretty text-gray-600">
        {online
          ? "Something went wrong on our side. Try again in a moment."
          : "Whatever you were sending did not go through. This page will reload by itself when you reconnect."}
      </p>
      <div className="mt-5 flex flex-col gap-2.5">
        <button
          type="button"
          onClick={retry}
          className="flex h-12 items-center justify-center rounded-md bg-lucena-blue text-[15px] font-semibold text-white hover:bg-lucena-blue-dark"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
