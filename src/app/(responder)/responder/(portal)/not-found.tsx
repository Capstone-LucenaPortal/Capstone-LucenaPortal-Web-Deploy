import Link from "next/link";

export const metadata = { title: "Page not found · LucenaPortal Responder" };

/**
 * An unknown /responder address ([...slug]). Renders inside the PortalShell,
 * so the header and navigation stay and the way back is this Portal's, not
 * the Citizen site's.
 */
export default function NotFound() {
  return (
    <div className="flex justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6">
        <h1 className="text-[17px] leading-tight font-bold text-gray-900">
          Page not found
        </h1>
        <p className="mt-2.5 text-[13px] text-pretty text-gray-600">
          This page does not exist. Check the address, or go back to the pool.
        </p>
        <div className="mt-5 flex flex-col gap-2.5">
          <Link
            href="/responder/pool"
            className="flex h-12 items-center justify-center rounded-md bg-lucena-blue text-[15px] font-semibold text-white hover:bg-lucena-blue-dark"
          >
            Back to the pool
          </Link>
        </div>
      </div>
    </div>
  );
}
