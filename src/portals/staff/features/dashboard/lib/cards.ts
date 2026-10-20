import type { Module } from "@/portals/staff/features/auth/types";
import { getYellowCardCard } from "@/portals/staff/features/yellow-card/lib/dashboard-card";
import { getIncidentCard } from "@/portals/staff/features/incidents/lib/dashboard-card";
import { getBookingCard } from "@/portals/staff/features/booking/lib/dashboard-card";
import type { ModuleCardData } from "../types";

/** Cards always render in this order, regardless of assignment order. */
const MODULE_ORDER: Module[] = ["yellow-card", "incidents", "booking"];

/** One card per assigned module. All three are live; no fixtures remain. */
export async function getDashboardCards(
  assignedModules: Module[],
): Promise<ModuleCardData[]> {
  const modules = MODULE_ORDER.filter((module) => assignedModules.includes(module));

  return Promise.all(
    modules.map((module) => {
      if (module === "yellow-card") return getYellowCardCard();
      if (module === "incidents") return getIncidentCard();
      return getBookingCard();
    }),
  );
}
