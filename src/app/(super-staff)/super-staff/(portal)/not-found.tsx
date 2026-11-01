import Link from "next/link";
import { Card } from "@/portals/super-staff/components/ui/card";

export const metadata = { title: "Page not found · LucenaPortal Super Staff" };

/**
 * An unknown /super-staff address ([...slug]). Renders inside the Super Staff
 * shell, so the sidebar stays and the way back is this Portal's, not the
 * Citizen site's.
 */
export default function NotFound() {
  return (
    <Card className="mx-auto mt-10 max-w-md p-8">
      <h1 className="text-xl font-bold text-lucena-blue">Page not found</h1>
      <p className="mt-3 text-sm text-gray-600">
        This page does not exist. Check the address, or go back to Accounts.
      </p>
      <Link
        href="/super-staff/accounts"
        className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-lucena-blue px-4 text-sm font-medium text-white transition-colors hover:bg-lucena-blue-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lucena-blue"
      >
        Back to Accounts
      </Link>
    </Card>
  );
}
