// src/app/(admin)/admin/(shell)/not-found.tsx
//
// An unknown /admin address ([...slug]). Renders inside the (shell) layout, so
// the sidebar stays and the way back is this Portal's, not the Citizen site's.
// The title goes through the (admin) layout's template, like the five pages'.
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <div className="mx-auto mt-10 max-w-md rounded-none border border-gray-200 bg-white p-8">
      <h1 className="text-xl font-bold text-blue-900">Page not found</h1>
      <p className="mt-3 text-sm text-gray-700">
        This page does not exist. Check the address, or go back to the Dashboard.
      </p>
      <Link
        href="/admin/dashboard"
        className="mt-6 inline-block rounded-none bg-blue-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900 focus-visible:ring-offset-2"
      >
        Back to the Dashboard
      </Link>
    </div>
  );
}
