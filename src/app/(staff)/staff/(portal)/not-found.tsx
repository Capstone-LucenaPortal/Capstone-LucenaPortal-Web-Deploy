import Link from "next/link";
import { Card } from "@/portals/staff/components/ui/card";

export const metadata = { title: "Page not found · LucenaPortal Staff" };

/**
 * An unknown /staff address ([...slug]) or an unknown id on a detail page.
 * Renders inside the Staff shell, so the sidebar stays and the way back is
 * this Portal's, not the Citizen site's.
 */
export default function NotFound() {
  return (
    <Card className="mx-auto mt-10 max-w-md p-8">
      <h1 className="text-xl font-bold text-lucena-blue">Page not found</h1>
      <p className="mt-3 text-sm text-gray-600">
        This page does not exist. Check the address, or go back to the
        Dashboard.
      </p>
      <Link
        href="/staff/dashboard"
        className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-lucena-blue px-4 text-sm font-medium text-white hover:bg-lucena-blue-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lucena-blue focus-visible:ring-offset-2"
      >
        Back to the Dashboard
      </Link>
    </Card>
  );
}
