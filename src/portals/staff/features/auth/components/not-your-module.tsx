import Link from "next/link";
import { Card } from "@/portals/staff/components/ui/card";
import type { Module } from "../types";

const MODULE_NAME: Record<Module, string> = {
  "yellow-card": "Yellow Card",
  incidents: "Incidents",
  booking: "Booking",
};

/**
 * What a module page renders in place of itself for an account not assigned
 * that module (see isAssigned). Inside the Staff shell, unlike AccessDenied:
 * the account is valid staff, and only this one module is off-limits.
 */
export function NotYourModule({ module }: { module: Module }) {
  const label = MODULE_NAME[module];

  return (
    <Card className="mx-auto mt-10 max-w-md p-8">
      <h1 className="text-xl font-bold text-lucena-blue">
        This page belongs to the {label} desk
      </h1>
      <p className="mt-3 text-sm text-gray-600">
        Your account is not assigned to {label}. If you need it, ask your Super
        Staff to assign it to you.
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
